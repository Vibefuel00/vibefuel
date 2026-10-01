import "server-only"

/**
 * Small in-memory sliding-window limiter. Good for a single instance; swap for
 * Redis if the app is scaled horizontally.
 */
const buckets = new Map<string, number[]>()
let lastSweep = Date.now()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (now - lastSweep > 60_000) {
    for (const [k, hits] of buckets) {
      if (hits.every((t) => now - t > windowMs)) buckets.delete(k)
    }
    lastSweep = now
  }
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")
  return (fwd ? fwd.split(",")[0] : headers.get("x-real-ip")) ?.trim() || "unknown"
}
