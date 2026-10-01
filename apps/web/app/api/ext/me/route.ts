import { developerFromBearer } from "@/lib/auth"
import { json, tooMany, unauthorized } from "@/lib/api"
import { balanceFor } from "@/lib/ext"
import { rateLimit } from "@/lib/ratelimit"

export const dynamic = "force-dynamic"

/** Account summary for the key. The clients call this to verify a pasted key. */
export async function GET(request: Request) {
  const dev = await developerFromBearer(request)
  if (!dev) return unauthorized()
  if (!rateLimit(`ext:${dev.id}:me`, 60, 60_000)) return tooMany()
  const { stats, balance } = await balanceFor(dev.id)
  return json({
    developer_id: dev.id,
    key_prefix: dev.keyPrefix,
    wallet_address: dev.walletAddress,
    balance,
    earned: stats.earned,
    active_seconds: stats.activeSeconds,
  })
}
