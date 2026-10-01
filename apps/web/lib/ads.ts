import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { and, eq, gt, notExists, sql } from "drizzle-orm"

import { db, schema } from "@/db"
import { env } from "@/lib/env"

const { campaigns, adEvents } = schema

/** Minimum gap between rewarded impressions of one campaign for one developer. */
export const IMPRESSION_COOLDOWN_HOURS = 6
/** How long a served ad stays valid on the client. */
const AD_TTL_MS = 60 * 60_000
/** Tracked click links stay valid this long. */
const CLICK_TOKEN_TTL_MS = 24 * 60 * 60_000

/** Wire shape of a served ad. Matches `Ad` in packages/vibefuel-core/api/openapi.yaml. */
export type ServedAd = {
  id: string
  advertiser: string
  domain: string
  headline: string
  body: string
  cta_label: string
  cta_url: string
  logo_url?: string
  brand_bg: string
  brand_fg: string
  click_url: string
  reward_tokens: number
  expires_at: string
}

function ctaLabel(domain: string): string {
  const label = `Visit ${domain}`
  return label.length <= 20 ? label : "Learn more"
}

// ---------------------------------------------------------------------------
// Click tokens: bind a developer to a campaign without exposing the serial key
// in a link. <developerId>.<campaignId>.<expires>.<hmac>
// ---------------------------------------------------------------------------

function signClick(payload: string): string {
  return createHmac("sha256", `${env.authSecret}:click`).update(payload).digest("base64url")
}

export function issueClickToken(developerId: string, campaignId: string, now = Date.now()): string {
  const payload = `${developerId}.${campaignId}.${now + CLICK_TOKEN_TTL_MS}`
  return `${payload}.${signClick(payload)}`
}

export function readClickToken(token: string, campaignId: string): { developerId: string } | null {
  const parts = token.split(".")
  if (parts.length !== 4) return null
  const [developerId, cid, expires, sig] = parts as [string, string, string, string]
  if (cid !== campaignId) return null
  if (Number(expires) < Date.now()) return null
  const expected = signClick(`${developerId}.${cid}.${expires}`)
  if (sig.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  return { developerId }
}

export async function nextAdFor(developerId: string): Promise<ServedAd | null> {
  const cutoff = new Date(Date.now() - IMPRESSION_COOLDOWN_HOURS * 3_600_000)
  const rows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "active"),
        sql`${campaigns.spentTokens} + ${campaigns.rewardTokens} <= ${campaigns.budgetTokens}`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(adEvents)
            .where(
              and(
                eq(adEvents.developerId, developerId),
                eq(adEvents.campaignId, campaigns.id),
                eq(adEvents.type, "impression"),
                gt(adEvents.rewardTokens, 0),
                gt(adEvents.occurredAt, cutoff)
              )
            )
        )
      )
    )
    .orderBy(sql`random()`)
    .limit(1)
  const c = rows[0]
  if (!c) return null
  const token = issueClickToken(developerId, c.id)
  const ad: ServedAd = {
    id: c.id,
    advertiser: c.advertiserName,
    domain: c.domain,
    headline: c.headline,
    body: c.body,
    cta_label: ctaLabel(c.domain),
    cta_url: c.url,
    brand_bg: c.brandBg,
    brand_fg: c.brandFg,
    click_url: `${env.appUrl}/api/go/${c.id}?t=${encodeURIComponent(token)}`,
    reward_tokens: c.rewardTokens,
    expires_at: new Date(Date.now() + AD_TTL_MS).toISOString(),
  }
  if (c.logoUrl) ad.logo_url = c.logoUrl
  return ad
}

export type IncomingEvent = {
  campaignId: string
  type: "impression" | "click" | "dismiss"
  clientEventId?: string
  occurredAt?: string
}

export async function recordEvents(developerId: string, events: IncomingEvent[]) {
  let accepted = 0
  let rewarded = 0
  const cutoff = new Date(Date.now() - IMPRESSION_COOLDOWN_HOURS * 3_600_000)

  for (const ev of events.slice(0, 100)) {
    const occurredAt = ev.occurredAt ? new Date(ev.occurredAt) : new Date()
    if (Number.isNaN(occurredAt.getTime())) continue

    await db.transaction(async (tx) => {
      const [campaign] = await tx
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, ev.campaignId))
        .limit(1)
        .for("update")
      if (!campaign) return

      let reward = 0
      if (ev.type === "impression" && campaign.status === "active") {
        const [recent] = await tx
          .select({ one: sql`1` })
          .from(adEvents)
          .where(
            and(
              eq(adEvents.developerId, developerId),
              eq(adEvents.campaignId, campaign.id),
              eq(adEvents.type, "impression"),
              gt(adEvents.rewardTokens, 0),
              gt(adEvents.occurredAt, cutoff)
            )
          )
          .limit(1)
        const hasBudget = campaign.spentTokens + campaign.rewardTokens <= campaign.budgetTokens
        if (!recent && hasBudget) reward = campaign.rewardTokens
      }

      const inserted = await tx
        .insert(adEvents)
        .values({
          developerId,
          campaignId: campaign.id,
          type: ev.type,
          rewardTokens: reward,
          clientEventId: ev.clientEventId ?? null,
          occurredAt,
        })
        .onConflictDoNothing()
        .returning({ id: adEvents.id })
      if (inserted.length === 0) return
      accepted++

      if (reward > 0) {
        rewarded += reward
        const spent = campaign.spentTokens + reward
        const exhausted = spent + campaign.rewardTokens > campaign.budgetTokens
        await tx
          .update(campaigns)
          .set({ spentTokens: spent, status: exhausted ? "exhausted" : campaign.status })
          .where(eq(campaigns.id, campaign.id))
      }
    })
  }
  return { accepted, rewarded }
}
