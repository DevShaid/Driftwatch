import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'
import { getAwsCredentials, getTerraformStateFromS3 } from '@/lib/aws'
import { parseTerraformState } from '@/lib/terraform'

export async function POST(req: NextRequest) {
  if (!rateLimit(req, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { org_id, bucket, key, region } = await req.json()

  if (!org_id || !bucket || !key || !region) {
    return NextResponse.json({ error: 'Missing required fields: org_id, bucket, key, region' }, { status: 400 })
  }

  try {
    const { data: awsConn } = await supabase
      .from('aws_connections')
      .select('*')
      .eq('org_id', org_id)
      .maybeSingle()

    if (!awsConn) {
      return NextResponse.json({ error: 'AWS connection required before configuring state backend' }, { status: 400 })
    }

    const creds = await getAwsCredentials(awsConn)
    const rawState = await getTerraformStateFromS3(creds, bucket, key, region)
    const tfState = parseTerraformState(rawState)

    const record = {
      org_id,
      bucket,
      key,
      region,
      verified_at: new Date().toISOString(),
      last_error: null,
    }

    const { data: existing } = await supabase
      .from('state_backends')
      .select('id')
      .eq('org_id', org_id)
      .maybeSingle()

    if (existing) {
      await supabase.from('state_backends').update(record).eq('org_id', org_id)
    } else {
      await supabase.from('state_backends').insert(record)
    }

    return NextResponse.json({
      verified: true,
      resource_count: tfState.resources.length,
      terraform_version: tfState.terraform_version,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    await supabase
      .from('state_backends')
      .update({ last_error: message, verified_at: null })
      .eq('org_id', org_id)
    return NextResponse.json({ verified: false, error: message }, { status: 400 })
  }
}
