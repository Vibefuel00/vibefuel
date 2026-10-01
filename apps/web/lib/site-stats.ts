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

const EMPTY: SiteStats = {
  tokensEarned: 0,
  impressions: 0,
  developers: 0,
  activeSeconds: 0,
  advertisers: 0,
  liveCampaigns: 0,
}

/**
 * Public numbers for the home page. Never throws: without a database (for
 * example during an image build) it returns zeros and the page still renders.
 */
export async function siteStats(): Promise<SiteStats> {
  if (!process.env.DATABASE_URL) return EMPTY
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
    if (!row) return EMPTY
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
    return EMPTY
  }
}
