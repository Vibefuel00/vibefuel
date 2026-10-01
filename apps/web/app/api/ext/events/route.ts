import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { developerFromBearer } from "@/lib/auth"
import { badRequest, json, readJson, tooMany, unauthorized } from "@/lib/api"
import { recordEvents, type IncomingEvent } from "@/lib/ads"
import { balanceFor, UUID_RE } from "@/lib/ext"
import { rateLimit } from "@/lib/ratelimit"

type WireEvent = {
  id?: unknown
  ad_id?: unknown
  type?: unknown
  occurred_at?: unknown
  session_id?: unknown
}
type Body = {
  events?: WireEvent[]
  client?: { editor?: unknown; extension_version?: unknown }
}

const TYPES = new Set(["impression", "click", "dismiss"])

/** Batch of ad events from a client. Rewarded impressions credit tokens. */
export async function POST(request: Request) {
  const dev = await developerFromBearer(request)
  if (!dev) return unauthorized()
  if (!rateLimit(`ext:${dev.id}:events`, 60, 60_000)) return tooMany()
  const body = await readJson<Body>(request)
  if (!body || !Array.isArray(body.events)) return badRequest("events must be an array")

  const clean: IncomingEvent[] = []
  for (const ev of body.events.slice(0, 100)) {
    if (!ev || typeof ev !== "object") continue
    const type = String(ev.type)
    const adId = String(ev.ad_id)
    if (!TYPES.has(type) || !UUID_RE.test(adId)) continue
    clean.push({
      campaignId: adId,
      type: type as IncomingEvent["type"],
      clientEventId: typeof ev.id === "string" ? ev.id.slice(0, 80) : undefined,
      occurredAt: typeof ev.occurred_at === "string" ? ev.occurred_at : undefined,
    })
  }

  const result = await recordEvents(dev.id, clean)

  // Remember which client this key is used from; nothing else about the client is kept.
  const client = body.client ?? {}
  if (typeof client.editor === "string" || typeof client.extension_version === "string") {
    await db
      .update(schema.developers)
      .set({
        lastSeenAt: new Date(),
        editor: typeof client.editor === "string" ? client.editor.slice(0, 40) : dev.editor,
        extensionVersion:
          typeof client.extension_version === "string"
            ? client.extension_version.slice(0, 40)
            : dev.extensionVersion,
      })
      .where(eq(schema.developers.id, dev.id))
  }

  const { balance } = await balanceFor(dev.id)
  return json({ ...result, balance })
}
