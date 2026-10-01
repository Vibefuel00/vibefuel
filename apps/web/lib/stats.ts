import "server-only"

import { and, desc, eq, gte, sql } from "drizzle-orm"

import { db, schema } from "@/db"

const { adEvents, workDays, payouts, campaigns } = schema

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type DayPoint = { day: string; label: string; tokens: number; seconds: number }

export async function developerStats(developerId: string) {
  const [totals] = await db
    .select({
      earned: sql<number>`coalesce(sum(${adEvents.rewardTokens}), 0)::int`,
      impressions: sql<number>`count(*) filter (where ${adEvents.type} = 'impression')::int`,
      clicks: sql<number>`count(*) filter (where ${adEvents.type} = 'click')::int`,
    })
    .from(adEvents)
    .where(eq(adEvents.developerId, developerId))

  const [pay] = await db
    .select({
      paid: sql<number>`coalesce(sum(${payouts.tokens}) filter (where ${payouts.status} = 'paid'), 0)::int`,
      requested: sql<number>`coalesce(sum(${payouts.tokens}) filter (where ${payouts.status} = 'requested'), 0)::int`,
    })
    .from(payouts)
    .where(eq(payouts.developerId, developerId))

  const [work] = await db
    .select({ seconds: sql<number>`coalesce(sum(${workDays.activeSeconds}), 0)::int` })
    .from(workDays)
    .where(eq(workDays.developerId, developerId))

  const since = new Date(Date.now() - 6 * 86_400_000)
  const sinceDay = utcDay(since)

  const tokensByDay = await db
    .select({
      day: sql<string>`to_char(${adEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      tokens: sql<number>`coalesce(sum(${adEvents.rewardTokens}), 0)::int`,
    })
    .from(adEvents)
    .where(and(eq(adEvents.developerId, developerId), gte(adEvents.occurredAt, since)))
    .groupBy(sql`1`)

  const secondsByDay = await db
    .select({ day: workDays.day, seconds: workDays.activeSeconds })
    .from(workDays)
    .where(and(eq(workDays.developerId, developerId), gte(workDays.day, sinceDay)))

  const days: DayPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const day = utcDay(d)
    days.push({
      day,
      label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      tokens: tokensByDay.find((r) => r.day === day)?.tokens ?? 0,
      seconds: secondsByDay.find((r) => r.day === day)?.seconds ?? 0,
    })
  }

  const earned = totals?.earned ?? 0
  const paid = pay?.paid ?? 0
  const requested = pay?.requested ?? 0

  return {
    earned,
    paid,
    requested,
    balance: earned - paid - requested,
    impressions: totals?.impressions ?? 0,
    clicks: totals?.clicks ?? 0,
    activeSeconds: work?.seconds ?? 0,
    days,
  }
}

export async function developerRecentEvents(developerId: string, limit = 12) {
  return db
    .select({
      id: adEvents.id,
      type: adEvents.type,
      reward: adEvents.rewardTokens,
      occurredAt: adEvents.occurredAt,
      advertiser: campaigns.advertiserName,
      headline: campaigns.headline,
    })
    .from(adEvents)
    .innerJoin(campaigns, eq(adEvents.campaignId, campaigns.id))
    .where(eq(adEvents.developerId, developerId))
    .orderBy(desc(adEvents.occurredAt))
    .limit(limit)
}

export async function campaignStats(campaignId: string) {
  const [row] = await db
    .select({
      impressions: sql<number>`count(*) filter (where ${adEvents.type} = 'impression')::int`,
      clicks: sql<number>`count(*) filter (where ${adEvents.type} = 'click')::int`,
      dismisses: sql<number>`count(*) filter (where ${adEvents.type} = 'dismiss')::int`,
      developers: sql<number>`count(distinct ${adEvents.developerId})::int`,
    })
    .from(adEvents)
    .where(eq(adEvents.campaignId, campaignId))
  return {
    impressions: row?.impressions ?? 0,
    clicks: row?.clicks ?? 0,
    dismisses: row?.dismisses ?? 0,
    developers: row?.developers ?? 0,
  }
}

export async function advertiserCampaignRows(advertiserId: string) {
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      advertiserName: campaigns.advertiserName,
      headline: campaigns.headline,
      status: campaigns.status,
      rewardTokens: campaigns.rewardTokens,
      budgetTokens: campaigns.budgetTokens,
      spentTokens: campaigns.spentTokens,
      createdAt: campaigns.createdAt,
      impressions: sql<number>`(select count(*) from ${adEvents} e where e.campaign_id = ${campaigns.id} and e.type = 'impression')::int`,
      clicks: sql<number>`(select count(*) from ${adEvents} e where e.campaign_id = ${campaigns.id} and e.type = 'click')::int`,
    })
    .from(campaigns)
    .where(eq(campaigns.advertiserId, advertiserId))
    .orderBy(desc(campaigns.createdAt))
  return rows
}

export function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m.toString().padStart(2, "0")}m`
}
