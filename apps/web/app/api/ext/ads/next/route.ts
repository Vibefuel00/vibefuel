import { developerFromBearer } from "@/lib/auth"
import { json, tooMany, unauthorized } from "@/lib/api"
import { rateLimit } from "@/lib/ratelimit"
import { nextAdFor } from "@/lib/ads"

/** Returns the next eligible sponsored message, or 204 when there is none. */
export async function GET(request: Request) {
  const dev = await developerFromBearer(request)
  if (!dev) return unauthorized()
  if (!rateLimit(`ext:${dev.id}:ads/next`, 60, 60_000)) return tooMany()
  const ad = await nextAdFor(dev.id)
  if (!ad) return new Response(null, { status: 204 })
  return json(ad)
}
