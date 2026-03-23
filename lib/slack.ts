import type { Scan, DriftResult } from '@/types'

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  warning:  '🟡',
  info:     '🔵',
}

export async function sendSlackAlert(
  webhookUrl: string,
  orgName: string,
  scan: Scan,
  driftItems: DriftResult[],
  appUrl: string
): Promise<void> {
  const critical = driftItems.filter(d => d.severity === 'critical')
  const top5 = [
    ...critical,
    ...driftItems.filter(d => d.severity !== 'critical'),
  ].slice(0, 5)

  const driftLines = top5.map(item =>
    `${SEVERITY_EMOJI[item.severity]} ${item.driftType} | \`${item.resourceType}\` | \`${item.resourceId}\` | ${item.diffSummary}`
  )

  const summaryText = scan.drift_count === 0
    ? '✅ No drift detected — all resources match Terraform state.'
    : `*${scan.resources_checked}* resources scanned • *${scan.drift_count}* drift items found • *${scan.critical_count}* critical`

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🔍 DriftWatch Scan Complete — ${orgName}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: summaryText },
    },
  ]

  if (driftLines.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: driftLines.join('\n') },
    })
  }

  if (scan.drift_count > 5) {
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `_...and ${scan.drift_count - 5} more items. View the full report for details._`,
      }],
    })
  }

  blocks.push({
    type: 'actions',
    elements: [{
      type: 'button',
      text: { type: 'plain_text', text: 'View full report →' },
      url: `${appUrl}/scans/${scan.id}`,
    }],
  })

  const payload = {
    text: `DriftWatch: ${scan.drift_count} drift item(s) found for ${orgName}`,
    blocks,
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Slack webhook failed (${response.status}): ${body}`)
  }
}
