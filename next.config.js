/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@aws-sdk/client-ec2',
      '@aws-sdk/client-rds',
      '@aws-sdk/client-s3',
      '@aws-sdk/client-lambda',
      '@aws-sdk/client-ecs',
      '@aws-sdk/client-iam',
      '@aws-sdk/client-sts',
    ],
  },
}

module.exports = nextConfig
