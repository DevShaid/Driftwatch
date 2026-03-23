import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!rateLimit(req, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { org_id, webhook_url, channel } = await req.json()

  if (!org_id || !webhook_url) {
    return NextResponse.json({ error: 'Missing required fields: org_id, webhook_url' }, { status: 400 })
  }

  if (!webhook_url.startsWith('https://hooks.slack.com/')) {
    return NextResponse.json({ error: 'Invalid Slack webhook URL' }, { status: 400 })
  }

  try {
    const testPayload = {
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ *DriftWatch connected* — infrastructure drift alerts will be posted to this channel.',
        },
      }],
    }

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Slack returned ${response.status}: ${body}`)
    }

    const record = {
      org_id,
      webhook_url,
      channel: channel || null,
      verified_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('slack_connections')
      .select('id')
      .eq('org_id', org_id)
      .maybeSingle()

    if (existing) {
      await supabase.from('slack_connections').update(record).eq('org_id', org_id)
    } else {
      await supabase.from('slack_connections').insert(record)
    }

    return NextResponse.json({ verified: true })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    return NextResponse.json({ verified: false, error: message }, { status: 400 })
  }
}
