import "server-only"

import { sql } from "drizzle-orm"

export type SiteStats = {
  tokensEarned: number
  impressions: number
  developers: number
  activeSeconds: number
  advertisers: number
  liveCampaigns: number
}

/** Per-second growth rates used both for the seed and the on-page ticker. */
export type StatRates = {
  tokensEarned: number
  impressions: number
  developers: number
  activeSeconds: number
}

// ---------------------------------------------------------------------------
// SEED: presentation baseline added on top of live database numbers.
// It grows on a fixed clock from SEED_EPOCH so every visitor sees the same,
// steadily rising figures. Set every base and rate to 0 to show only real
// data. Keep this honest with the copy on the page.
// ---------------------------------------------------------------------------

const SEED_EPOCH = Date.UTC(2026, 9, 1) // 1 Oct 2026: the day the seed starts growing

const SEED_BASE = {
  tokensEarned: 4_380,
  impressions: 362,
  developers: 21,
  activeSeconds: 1_190 * 3600,
  advertisers: 0, // featured sponsors are added by the section itself
  liveCampaigns: 2,
}

export const SEED_RATES: StatRates = {
  tokensEarned: 0.018, // ≈ 1,550 / day
  impressions: 0.0016, // ≈ 140 / day
  developers: 0.0000045, // ≈ 1 every 2.5 days
  activeSeconds: 0.42, // ≈ 10 developer-hours / day
}

function seeded(now = Date.now()): SiteStats {
  const t = Math.max(0, (now - SEED_EPOCH) / 1000)
  return {
    tokensEarned: Math.floor(SEED_BASE.tokensEarned + SEED_RATES.tokensEarned * t),
    impressions: Math.floor(SEED_BASE.impressions + SEED_RATES.impressions * t),
    developers: Math.floor(SEED_BASE.developers + SEED_RATES.developers * t),
    activeSeconds: Math.floor(SEED_BASE.activeSeconds + SEED_RATES.activeSeconds * t),
    advertisers: SEED_BASE.advertisers,
    liveCampaigns: SEED_BASE.liveCampaigns,
  }
}

async function live(): Promise<SiteStats | null> {
  if (!process.env.DATABASE_URL) return null
  try {
    const { db } = await import("@/db")
    const [row] = await db.execute<{
      tokens: number
      impressions: number
      developers: number
      seconds: number
      advertisers: number
      live: number
    }>(sql`
      select
        (select coalesce(sum(reward_tokens), 0) from ad_events)::int as tokens,
        (select count(*) from ad_events where type = 'impression')::int as impressions,
        (select count(*) from developers)::int as developers,
        (select coalesce(sum(active_seconds), 0) from work_days)::int as seconds,
        (select count(distinct advertiser_id) from campaigns)::int as advertisers,
        (select count(*) from campaigns where status = 'active')::int as live
    `)
    if (!row) return null
    return {
      tokensEarned: Number(row.tokens),
      impressions: Number(row.impressions),
      developers: Number(row.developers),
      activeSeconds: Number(row.seconds),
      advertisers: Number(row.advertisers),
      liveCampaigns: Number(row.live),
    }
  } catch (err) {
    console.error("siteStats failed", err)
    return null
  }
}

/** Public numbers for the home page: seed baseline plus real activity. */
export async function siteStats(): Promise<SiteStats> {
  const s = seeded()
  const l = await live()
  if (!l) return s
  return {
    tokensEarned: s.tokensEarned + l.tokensEarned,
    impressions: s.impressions + l.impressions,
    developers: s.developers + l.developers,
    activeSeconds: s.activeSeconds + l.activeSeconds,
    advertisers: s.advertisers + l.advertisers,
    liveCampaigns: s.liveCampaigns + l.liveCampaigns,
  }
}
