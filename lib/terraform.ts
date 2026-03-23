import type { TerraformState, TerraformResource } from '@/types'

export function parseTerraformState(raw: string): TerraformState {
  let state: TerraformState
  try {
    state = JSON.parse(raw) as TerraformState
  } catch {
    throw new Error('Failed to parse Terraform state: invalid JSON')
  }
  if (!Array.isArray(state.resources)) {
    throw new Error('Invalid Terraform state: missing or malformed resources array')
  }
  return state
}

export function getResourceId(resource: TerraformResource): string | null {
  const attrs = resource.instances?.[0]?.attributes
  if (!attrs) return null
  return (
    (attrs.id as string | undefined) ||
    (attrs.function_name as string | undefined) ||
    (attrs.bucket as string | undefined) ||
    (attrs.db_instance_identifier as string | undefined) ||
    (attrs.name as string | undefined) ||
    null
  )
}

export function groupResourcesByType(state: TerraformState): Map<string, TerraformResource[]> {
  const grouped = new Map<string, TerraformResource[]>()
  for (const resource of state.resources) {
    if (resource.type === 'data') continue
    const existing = grouped.get(resource.type) || []
    existing.push(resource)
    grouped.set(resource.type, existing)
  }
  return grouped
}

export function extractResourceAttributes(resource: TerraformResource): Record<string, unknown> {
  return resource.instances?.[0]?.attributes || {}
}

export const SUPPORTED_RESOURCE_TYPES = [
  'aws_instance',
  'aws_security_group',
  'aws_db_instance',
  'aws_lambda_function',
  'aws_s3_bucket',
  'aws_ecs_service',
  'aws_vpc',
  'aws_iam_role',
] as const
