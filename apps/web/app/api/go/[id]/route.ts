import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { readClickToken, recordEvents } from "@/lib/ads"
import { UUID_RE } from "@/lib/ext"
import { clientIp, rateLimit } from "@/lib/ratelimit"

/**
 * Tracked link for terminal surfaces. Records one click per token and sends
 * the browser to the campaign URL. No serial key is involved.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  const token = url.searchParams.get("t") ?? ""
  if (!UUID_RE.test(id) || !token) return new Response("Not found", { status: 404 })
  if (!rateLimit(`go:${clientIp(request.headers)}`, 60, 60_000)) {
    return new Response("Too many requests", { status: 429 })
  }
  const claim = readClickToken(token, id)
  if (!claim) return new Response("Not found", { status: 404 })

  const [campaign] = await db
    .select({ url: schema.campaigns.url })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, id))
    .limit(1)
  if (!campaign) return new Response("Not found", { status: 404 })

  // The token itself is the idempotency key, so a refreshed tab counts once.
  const sig = token.split(".")[3] ?? token
  await recordEvents(claim.developerId, [{ campaignId: id, type: "click", clientEventId: `go:${sig.slice(0, 60)}` }])
  return Response.redirect(campaign.url, 302)
}
