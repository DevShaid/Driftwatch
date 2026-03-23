import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'
import { encrypt } from '@/lib/encrypt'
import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { EC2Client, DescribeRegionsCommand } from '@aws-sdk/client-ec2'

export async function POST(req: NextRequest) {
  if (!rateLimit(req, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { org_id, auth_mode, role_arn, region, access_key, secret_key } = await req.json()

  if (!org_id || !auth_mode || !region) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    let credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }

    if (auth_mode === 'role') {
      if (!role_arn) return NextResponse.json({ error: 'role_arn required' }, { status: 400 })
      const sts = new STSClient({ region })
      const assumed = await sts.send(new AssumeRoleCommand({
        RoleArn: role_arn,
        RoleSessionName: 'DriftWatchVerify',
        DurationSeconds: 900,
      }))
      if (!assumed.Credentials) throw new Error('Failed to assume IAM role — check trust policy')
      credentials = {
        accessKeyId: assumed.Credentials.AccessKeyId!,
        secretAccessKey: assumed.Credentials.SecretAccessKey!,
        sessionToken: assumed.Credentials.SessionToken,
      }
    } else {
      if (!access_key || !secret_key) {
        return NextResponse.json({ error: 'Access key and secret required' }, { status: 400 })
      }
      credentials = { accessKeyId: access_key, secretAccessKey: secret_key }
    }

    const sts = new STSClient({ region, credentials })
    const identity = await sts.send(new GetCallerIdentityCommand({}))

    const ec2 = new EC2Client({ region, credentials })
    await ec2.send(new DescribeRegionsCommand({ RegionNames: [region] }))

    const record: Record<string, unknown> = {
      org_id,
      auth_mode,
      region,
      verified_at: new Date().toISOString(),
      last_error: null,
    }

    if (auth_mode === 'role') {
      record.role_arn = role_arn
    } else {
      record.access_key_encrypted = encrypt(access_key)
      record.secret_key_encrypted = encrypt(secret_key)
    }

    const { data: existing } = await supabase
      .from('aws_connections')
      .select('id')
      .eq('org_id', org_id)
      .maybeSingle()

    if (existing) {
      await supabase.from('aws_connections').update(record).eq('org_id', org_id)
    } else {
      await supabase.from('aws_connections').insert(record)
    }

    return NextResponse.json({ verified: true, account_id: identity.Account, arn: identity.Arn })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    await supabase
      .from('aws_connections')
      .update({ last_error: message, verified_at: null })
      .eq('org_id', org_id)
    return NextResponse.json({ verified: false, error: message }, { status: 400 })
  }
}
