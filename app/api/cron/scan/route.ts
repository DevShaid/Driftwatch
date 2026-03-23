import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const hour = now.getUTCHours()

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, scan_schedule, plan_status')
    .in('plan_status', ['active', 'trialing'])
    .neq('scan_schedule', 'manual')

  if (error) {
    console.error('Cron: failed to fetch orgs:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ triggered: 0, succeeded: 0, failed: 0 })
  }

  const toScan = orgs.filter(org => {
    if (org.scan_schedule === '1h')  return true
    if (org.scan_schedule === '6h')  return hour % 6 === 0
    if (org.scan_schedule === '24h') return hour === 6
    return false
  })

  if (toScan.length === 0) {
    return NextResponse.json({ triggered: 0, succeeded: 0, failed: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://driftwatch.io'

  const results = await Promise.allSettled(
    toScan.map(org =>
      fetch(`${appUrl}/api/scans/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: org.id, triggered_by: 'schedule' }),
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
    )
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed    = results.filter(r => r.status === 'rejected').length

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Cron scan failed for org ${toScan[i].id}:`, r.reason)
    }
  })

  return NextResponse.json({ triggered: toScan.length, succeeded, failed })
}
