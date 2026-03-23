import { NextRequest } from 'next/server'

interface RateLimitRecord {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitRecord>()

// Clean up expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)

export function rateLimit(req: NextRequest, limit: number, windowMs: number): boolean {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const now = Date.now()
  const record = store.get(ip)

  if (!record || now > record.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= limit) return false
  record.count++
  return true
}
