import type { DriftResult, DriftType, Severity, TerraformResource } from '@/types'
import { getResourceId, extractResourceAttributes } from './terraform'

const CRITICAL_RESOURCE_TYPES = ['aws_instance', 'aws_db_instance', 'aws_iam_role']
const CRITICAL_FIELDS: Record<string, string[]> = {
  aws_instance: ['instance_type', 'ami', 'state', 'security_groups'],
  aws_security_group: ['ingress', 'egress'],
  aws_db_instance: ['instance_class', 'engine', 'multi_az', 'storage_encrypted', 'deletion_protection'],
  aws_iam_role: ['assume_role_policy', 'managed_policy_arns'],
}

function deepDiff(expected: Record<string, unknown>, actual: Record<string, unknown>): Array<{ key: string; expected: unknown; actual: unknown }> {
  const diffs = []
  const allKeys = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)]))
  for (const key of allKeys) {
    if (key.startsWith('_') || key === 'timeouts' || key === 'id') continue
    const expVal = JSON.stringify(expected[key])
    const actVal = JSON.stringify(actual[key])
    if (expVal !== actVal && expected[key] !== undefined) {
      diffs.push({ key, expected: expected[key], actual: actual[key] })
    }
  }
  return diffs
}

function scoreSeverity(resourceType: string, diffs: Array<{ key: string }>): Severity {
  const criticalFields = CRITICAL_FIELDS[resourceType] || []
  const hasCriticalFieldDrift = diffs.some(d => criticalFields.includes(d.key))
  if (hasCriticalFieldDrift) return 'critical'
  if (CRITICAL_RESOURCE_TYPES.includes(resourceType)) return 'warning'
  return 'info'
}

function buildDiffSummary(diffs: Array<{ key: string; expected: unknown; actual: unknown }>): string {
  return diffs.slice(0, 3).map(d => `${d.key}: ${JSON.stringify(d.expected)} → ${JSON.stringify(d.actual)}`).join('; ')
}

export function detectMissingResources(
  tfResources: TerraformResource[],
  liveIds: Set<string>
): DriftResult[] {
  const results: DriftResult[] = []
  for (const resource of tfResources) {
    const id = getResourceId(resource)
    if (!id) continue
    if (!liveIds.has(id)) {
      const attrs = extractResourceAttributes(resource)
      results.push({
        resourceType: resource.type,
        resourceId: id,
        driftType: 'MISSING',
        severity: CRITICAL_RESOURCE_TYPES.includes(resource.type) ? 'critical' : 'warning',
        expectedConfig: attrs,
        actualConfig: null,
        diffSummary: `Resource exists in Terraform state but was not found in AWS`,
      })
    }
  }
  return results
}

export function detectUnmanagedResources(
  resourceType: string,
  liveResources: Record<string, unknown>[],
  tfIds: Set<string>
): DriftResult[] {
  const results: DriftResult[] = []
  for (const live of liveResources) {
    const id = live.id as string
    if (!id || tfIds.has(id)) continue
    results.push({
      resourceType,
      resourceId: id,
      driftType: 'UNMANAGED',
      severity: 'warning',
      expectedConfig: null,
      actualConfig: live,
      diffSummary: `Resource exists in AWS but is not tracked in Terraform state`,
    })
  }
  return results
}

export function detectConfigDrift(
  resource: TerraformResource,
  liveConfig: Record<string, unknown>
): DriftResult | null {
  const id = getResourceId(resource)
  if (!id) return null
  const expectedAttrs = extractResourceAttributes(resource)
  const relevantExpected: Record<string, unknown> = {}
  const relevantActual: Record<string, unknown> = {}
  for (const key of Object.keys(expectedAttrs)) {
    if (key.startsWith('_') || key === 'timeouts' || key === 'id') continue
    if (key in liveConfig) {
      relevantExpected[key] = expectedAttrs[key]
      relevantActual[key] = liveConfig[key]
    }
  }
  const diffs = deepDiff(relevantExpected, relevantActual)
  if (diffs.length === 0) return null
  return {
    resourceType: resource.type,
    resourceId: id,
    driftType: 'DRIFTED',
    severity: scoreSeverity(resource.type, diffs),
    expectedConfig: relevantExpected,
    actualConfig: relevantActual,
    diffSummary: buildDiffSummary(diffs),
  }
}
