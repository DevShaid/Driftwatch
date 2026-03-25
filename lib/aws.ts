import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVpcsCommand } from '@aws-sdk/client-ec2'
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds'
import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda'
import { S3Client, ListBucketsCommand, GetBucketVersioningCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { ECSClient, ListServicesCommand, DescribeServicesCommand, ListClustersCommand } from '@aws-sdk/client-ecs'
import { IAMClient, GetRoleCommand } from '@aws-sdk/client-iam'
import { decrypt } from './encrypt'
import type { AwsConnection } from '@/types'

export interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
}

export async function getAwsCredentials(connection: AwsConnection): Promise<AwsCredentials> {
  const region = connection.region

  if (connection.auth_mode === 'role' && connection.role_arn) {
    const sts = new STSClient({ region })
    const assumed = await sts.send(new AssumeRoleCommand({
      RoleArn: connection.role_arn,
      RoleSessionName: 'DriftWatchScan',
      DurationSeconds: 3600,
    }))
    if (!assumed.Credentials) throw new Error('Failed to assume IAM role')
    return {
      accessKeyId:     assumed.Credentials.AccessKeyId!,
      secretAccessKey: assumed.Credentials.SecretAccessKey!,
      sessionToken:    assumed.Credentials.SessionToken,
      region,
    }
  }

  if (
    connection.auth_mode === 'keys' &&
    connection.access_key_encrypted &&
    connection.secret_key_encrypted
  ) {
    return {
      accessKeyId:     decrypt(connection.access_key_encrypted),
      secretAccessKey: decrypt(connection.secret_key_encrypted),
      region,
    }
  }

  throw new Error('No valid AWS credentials configured')
}

export async function getEC2Instances(creds: AwsCredentials): Promise<Record<string, unknown>[]> {
  const client = new EC2Client({ region: creds.region, credentials: creds })
  const response = await client.send(new DescribeInstancesCommand({
    Filters: [{ Name: 'instance-state-name', Values: ['running', 'stopped', 'stopping'] }],
  }))
  const instances: Record<string, unknown>[] = []
  for (const reservation of response.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      instances.push({
        id:              instance.InstanceId,
        instance_type:   instance.InstanceType,
        state:           instance.State?.Name,
        ami:             instance.ImageId,
        subnet_id:       instance.SubnetId,
        vpc_id:          instance.VpcId,
        security_groups: instance.SecurityGroups?.map(sg => sg.GroupId),
        tags:            Object.fromEntries((instance.Tags || []).map(t => [t.Key, t.Value])),
        monitoring:      instance.Monitoring?.State === 'enabled',
        public_ip:       instance.PublicIpAddress,
        private_ip:      instance.PrivateIpAddress,
      })
    }
  }
  return instances
}

export async function getSecurityGroups(creds: AwsCredentials): Promise<Record<string, unknown>[]> {
  const client = new EC2Client({ region: creds.region, credentials: creds })
  const response = await client.send(new DescribeSecurityGroupsCommand({}))
  return (response.SecurityGroups || []).map(sg => ({
    id:          sg.GroupId,
    name:        sg.GroupName,
    description: sg.Description,
    vpc_id:      sg.VpcId,
    ingress: sg.IpPermissions?.map(p => ({
      from_port:   p.FromPort,
      to_port:     p.ToPort,
      protocol:    p.IpProtocol,
      cidr_blocks: p.IpRanges?.map(r => r.CidrIp),
    })),
    egress: sg.IpPermissionsEgress?.map(p => ({
      from_port:   p.FromPort,
      to_port:     p.ToPort,
      protocol:    p.IpProtocol,
      cidr_blocks: p.IpRanges?.map(r => r.CidrIp),
    })),
    tags: Object.fromEntries((sg.Tags || []).map(t => [t.Key, t.Value])),
  }))
}

export async function getRDSInstances(creds: AwsCredentials): Promise<Record<string, unknown>[]> {
  const client = new RDSClient({ region: creds.region, credentials: creds })
  const response = await client.send(new DescribeDBInstancesCommand({}))
  return (response.DBInstances || []).map(db => ({
    id:                  db.DBInstanceIdentifier,
    engine:              db.Engine,
    engine_version:      db.EngineVersion,
    instance_class:      db.DBInstanceClass,
    status:              db.DBInstanceStatus,
    multi_az:            db.MultiAZ,
    storage:             db.AllocatedStorage,
    storage_encrypted:   db.StorageEncrypted,
    publicly_accessible: db.PubliclyAccessible,
    deletion_protection: db.DeletionProtection,
    tags:                Object.fromEntries((db.TagList || []).map(t => [t.Key, t.Value])),
  }))
}

export async function getLambdaFunctions(creds: AwsCredentials): Promise<Record<string, unknown>[]> {
  const client = new LambdaClient({ region: creds.region, credentials: creds })
  const response = await client.send(new ListFunctionsCommand({}))
  return (response.Functions || []).map(fn => ({
    id:            fn.FunctionName,
    arn:           fn.FunctionArn,
    runtime:       fn.Runtime,
    memory_size:   fn.MemorySize,
    timeout:       fn.Timeout,
    handler:       fn.Handler,
    role:          fn.Role,
    last_modified: fn.LastModified,
  }))
}

export async function getS3Buckets(creds: AwsCredentials): Promise<Record<string, unknown>[]> {
  const client = new S3Client({ region: creds.region, credentials: creds })
  const response = await client.send(new ListBucketsCommand({}))
  const buckets: Record<string, unknown>[] = []
  for (const bucket of response.Buckets || []) {
    let versioning = 'Disabled'
    try {
      const v = await client.send(new GetBucketVersioningCommand({ Bucket: bucket.Name! }))
      versioning = v.Status || 'Disabled'
    } catch {
    }
    buckets.push({
      id:         bucket.Name,
      name:       bucket.Name,
      created:    bucket.CreationDate,
      versioning,
      region:     creds.region,
    })
  }
  return buckets
}

export async function getECSServices(creds: AwsCredentials): Promise<Record<string, unknown>[]> {
  const client = new ECSClient({ region: creds.region, credentials: creds })
  const clustersResp = await client.send(new ListClustersCommand({}))
  const services: Record<string, unknown>[] = []
  for (const clusterArn of clustersResp.clusterArns || []) {
    const listResp = await client.send(new ListServicesCommand({ cluster: clusterArn }))
    if (!listResp.serviceArns?.length) continue
    const descResp = await client.send(new DescribeServicesCommand({
      cluster: clusterArn,
      services: listResp.serviceArns,
    }))
    for (const svc of descResp.services || []) {
      services.push({
        id:              svc.serviceName,
        arn:             svc.serviceArn,
        cluster:         clusterArn,
        desired_count:   svc.desiredCount,
        running_count:   svc.runningCount,
        status:          svc.status,
        task_definition: svc.taskDefinition,
        tags:            Object.fromEntries((svc.tags || []).map(t => [t.key, t.value])),
      })
    }
  }
  return services
}

export async function getVPCs(creds: AwsCredentials): Promise<Record<string, unknown>[]> {
  const client = new EC2Client({ region: creds.region, credentials: creds })
  const response = await client.send(new DescribeVpcsCommand({}))
  return (response.Vpcs || []).map(vpc => ({
    id:         vpc.VpcId,
    cidr:       vpc.CidrBlock,
    is_default: vpc.IsDefault,
    state:      vpc.State,
    tags:       Object.fromEntries((vpc.Tags || []).map(t => [t.Key, t.Value])),
  }))
}

export async function getIAMRole(creds: AwsCredentials, roleName: string): Promise<Record<string, unknown> | null> {
  const client = new IAMClient({ region: creds.region, credentials: creds })
  try {
    const response = await client.send(new GetRoleCommand({ RoleName: roleName }))
    return {
      id:   response.Role?.RoleName,
      arn:  response.Role?.Arn,
      path: response.Role?.Path,
      tags: Object.fromEntries((response.Role?.Tags || []).map(t => [t.Key, t.Value])),
    }
  } catch {
    return null
  }
}

export async function getTerraformStateFromS3(
  creds: AwsCredentials,
  bucket: string,
  key: string,
  stateRegion: string
): Promise<string> {
  const client = new S3Client({ region: stateRegion, credentials: creds })
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!response.Body) throw new Error('State file is empty')
  return response.Body.transformToString()
}
