export type Plan = 'starter' | 'pro' | 'team'
export type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled'
export type ScanStatus = 'running' | 'completed' | 'failed'
export type DriftType = 'MISSING' | 'UNMANAGED' | 'DRIFTED'
export type Severity = 'critical' | 'warning' | 'info'
export type AuthMode = 'role' | 'keys'
export type ScanSchedule = 'manual' | '1h' | '6h' | '24h'

export interface Organization {
  id: string
  name: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: Plan
  plan_status: PlanStatus
  scan_schedule: ScanSchedule
  created_at: string
  updated_at: string
}

export interface AwsConnection {
  id: string
  org_id: string
  auth_mode: AuthMode
  role_arn: string | null
  region: string
  access_key_encrypted: string | null
  secret_key_encrypted: string | null
  verified_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface StateBackend {
  id: string
  org_id: string
  bucket: string
  key: string
  region: string
  verified_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface SlackConnection {
  id: string
  org_id: string
  webhook_url: string
  channel: string | null
  verified_at: string | null
  created_at: string
}

export interface Scan {
  id: string
  org_id: string
  started_at: string
  completed_at: string | null
  status: ScanStatus
  resources_checked: number
  drift_count: number
  critical_count: number
  warning_count: number
  info_count: number
  error_message: string | null
  triggered_by: 'schedule' | 'manual' | 'api'
}

export interface DriftItem {
  id: string
  scan_id: string
  org_id: string
  resource_type: string
  resource_id: string
  drift_type: DriftType
  severity: Severity
  expected_config: Record<string, unknown> | null
  actual_config: Record<string, unknown> | null
  diff_summary: string | null
  resolved_at: string | null
  created_at: string
}

export interface TerraformResource {
  type: string
  name: string
  provider: string
  instances: Array<{
    attributes: Record<string, unknown>
  }>
}

export interface TerraformState {
  version: number
  terraform_version: string
  resources: TerraformResource[]
}

export interface DriftResult {
  resourceType: string
  resourceId: string
  driftType: DriftType
  severity: Severity
  expectedConfig: Record<string, unknown> | null
  actualConfig: Record<string, unknown> | null
  diffSummary: string
}
