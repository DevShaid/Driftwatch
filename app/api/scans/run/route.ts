import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'
import { getAwsCredentials, getEC2Instances, getSecurityGroups, getRDSInstances, getLambdaFunctions, getS3Buckets, getECSServices, getVPCs, getTerraformStateFromS3 } from '@/lib/aws'
import { parseTerraformState, groupResourcesByType, getResourceId, SUPPORTED_RESOURCE_TYPES } from '@/lib/terraform'
import { detectMissingResources, detectUnmanagedResources, detectConfigDrift } from '@/lib/drift'
import { sendSlackAlert } from '@/lib/slack'
import type { DriftResult } from '@/types'

export const maxDuration = 60 
export async function POST(req: NextRequest) {
  if (!rateLimit(req, 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: { org_id?: string; triggered_by?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { org_id, triggered_by = 'manual' } = body
  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', org_id)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const { data: awsConn } = await supabase
    .from('aws_connections')
    .select('*')
    .eq('org_id', org_id)
    .maybeSingle()
  if (!awsConn) return NextResponse.json({ error: 'AWS connection not configured' }, { status: 400 })

  const { data: stateBackend } = await supabase
    .from('state_backends')
    .select('*')
    .eq('org_id', org_id)
    .maybeSingle()
  if (!stateBackend) return NextResponse.json({ error: 'State backend not configured' }, { status: 400 })

  const { data: scan, error: scanInsertError } = await supabase
    .from('scans')
    .insert({
      org_id,
      triggered_by,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (scanInsertError || !scan) {
    return NextResponse.json({ error: 'Failed to create scan record' }, { status: 500 })
  }

  try {
    const creds = await getAwsCredentials(awsConn)

    const rawState = await getTerraformStateFromS3(
      creds,
      stateBackend.bucket,
      stateBackend.key,
      stateBackend.region
    )
    const tfState = parseTerraformState(rawState)
    const grouped = groupResourcesByType(tfState)

    const [liveEC2, liveSGs, liveRDS, liveLambda, liveS3, liveECS, liveVPCs] = await Promise.all([
      getEC2Instances(creds),
      getSecurityGroups(creds),
      getRDSInstances(creds),
      getLambdaFunctions(creds),
      getS3Buckets(creds),
      getECSServices(creds),
      getVPCs(creds),
    ])

    const liveResourceMap: Record<string, Record<string, unknown>[]> = {
      aws_instance: liveEC2,
      aws_security_group: liveSGs,
      aws_db_instance: liveRDS,
      aws_lambda_function: liveLambda,
      aws_s3_bucket: liveS3,
      aws_ecs_service: liveECS,
      aws_vpc: liveVPCs,
    }

    const allDrift: DriftResult[] = []
    let totalResourcesChecked = 0

    for (const resourceType of SUPPORTED_RESOURCE_TYPES) {
      const tfResources = grouped.get(resourceType) || []
      const liveResources = liveResourceMap[resourceType] || []

      totalResourcesChecked += Math.max(tfResources.length, liveResources.length)

      const tfIds = new Set(
        tfResources.map(r => getResourceId(r)).filter(Boolean) as string[]
      )
      const liveMap = new Map(liveResources.map(r => [r.id as string, r]))
      const liveIds = new Set(liveResources.map(r => r.id as string))

      allDrift.push(...detectMissingResources(tfResources, liveIds))
      allDrift.push(...detectUnmanagedResources(resourceType, liveResources, tfIds))

      for (const tfResource of tfResources) {
        const id = getResourceId(tfResource)
        if (!id || !liveMap.has(id)) continue
        const drift = detectConfigDrift(tfResource, liveMap.get(id)!)
        if (drift) allDrift.push(drift)
      }
    }

    const critical = allDrift.filter(d => d.severity === 'critical').length
    const warning  = allDrift.filter(d => d.severity === 'warning').length
    const info     = allDrift.filter(d => d.severity === 'info').length

    if (allDrift.length > 0) {
      const { error: insertError } = await supabase.from('drift_items').insert(
        allDrift.map(d => ({
          scan_id: scan.id,
          org_id,
          resource_type: d.resourceType,
          resource_id:   d.resourceId,
          drift_type:    d.driftType,
          severity:      d.severity,
          expected_config: d.expectedConfig,
          actual_config:   d.actualConfig,
          diff_summary:    d.diffSummary,
        }))
      )
      if (insertError) console.error('Failed to insert drift items:', insertError.message)
    }

    const { data: completedScan } = await supabase
      .from('scans')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        resources_checked: totalResourcesChecked,
        drift_count:   allDrift.length,
        critical_count: critical,
        warning_count:  warning,
        info_count:     info,
      })
      .eq('id', scan.id)
      .select()
      .single()

    const { data: slackConn } = await supabase
      .from('slack_connections')
      .select('*')
      .eq('org_id', org_id)
      .maybeSingle()

    if (slackConn && completedScan) {
      sendSlackAlert(
        slackConn.webhook_url,
        org.name,
        completedScan,
        allDrift,
        process.env.NEXT_PUBLIC_APP_URL || 'https://driftwatch.io'
      ).catch(err => console.error('Slack alert failed:', err))
    }

    return NextResponse.json({
      scan: completedScan,
      drift_count: allDrift.length,
      critical_count: critical,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Scan ${scan.id} failed:`, message)
    await supabase
      .from('scans')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('id', scan.id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
