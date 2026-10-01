import "server-only"

import { developerStats } from "@/lib/stats"

export const TOKEN_CURRENCY = "tokens"
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Balance as the clients expect it: available (pending payout) and paid out. */
export async function balanceFor(developerId: string) {
  const stats = await developerStats(developerId)
  return {
    stats,
    balance: {
      pending: stats.balance,
      settled: stats.paid,
      currency: TOKEN_CURRENCY,
      updated_at: new Date().toISOString(),
    },
  }
}
