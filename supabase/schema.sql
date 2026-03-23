-- DriftWatch Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Organizations
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'team')),
  plan_status text not null default 'trialing' check (plan_status in ('active', 'trialing', 'past_due', 'canceled')),
  scan_schedule text not null default '24h' check (scan_schedule in ('manual', '1h', '6h', '24h')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AWS Connections
create table aws_connections (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  auth_mode text not null default 'role' check (auth_mode in ('role', 'keys')),
  role_arn text,
  region text not null default 'us-east-1',
  access_key_encrypted text,
  secret_key_encrypted text,
  verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Terraform State Backends
create table state_backends (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  bucket text not null,
  key text not null,
  region text not null default 'us-east-1',
  verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Slack Connections
create table slack_connections (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  webhook_url text not null,
  channel text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Scans
create table scans (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  resources_checked integer not null default 0,
  drift_count integer not null default 0,
  critical_count integer not null default 0,
  warning_count integer not null default 0,
  info_count integer not null default 0,
  error_message text,
  triggered_by text not null default 'schedule' check (triggered_by in ('schedule', 'manual', 'api'))
);

-- Drift Items
create table drift_items (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references scans(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  resource_type text not null,
  resource_id text not null,
  drift_type text not null check (drift_type in ('MISSING', 'UNMANAGED', 'DRIFTED')),
  severity text not null check (severity in ('critical', 'warning', 'info')),
  expected_config jsonb,
  actual_config jsonb,
  diff_summary text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_scans_org_id on scans(org_id);
create index idx_scans_started_at on scans(started_at desc);
create index idx_drift_items_scan_id on drift_items(scan_id);
create index idx_drift_items_org_id on drift_items(org_id);
create index idx_drift_items_severity on drift_items(severity);
create index idx_drift_items_resolved on drift_items(resolved_at) where resolved_at is null;

-- RLS Policies
alter table organizations enable row level security;
alter table aws_connections enable row level security;
alter table state_backends enable row level security;
alter table slack_connections enable row level security;
alter table scans enable row level security;
alter table drift_items enable row level security;

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger organizations_updated_at before update on organizations
  for each row execute function update_updated_at();
create trigger aws_connections_updated_at before update on aws_connections
  for each row execute function update_updated_at();
create trigger state_backends_updated_at before update on state_backends
  for each row execute function update_updated_at();
