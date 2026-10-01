import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { developerFromBearer } from "@/lib/auth"
import { badRequest, json, readJson, tooMany, unauthorized } from "@/lib/api"
import { rateLimit } from "@/lib/ratelimit"
import { isValidSolanaAddress } from "@/lib/solana"

type Body = { address?: unknown }

/** Link a Solana public address for payouts. Only the public address is ever stored. */
export async function POST(request: Request) {
  const dev = await developerFromBearer(request)
  if (!dev) return unauthorized()
  if (!rateLimit(`ext:${dev.id}:wallet`, 10, 60_000)) return tooMany()
  const body = (await readJson<Body>(request)) ?? {}
  const address = typeof body.address === "string" ? body.address.trim() : ""
  if (!address || !isValidSolanaAddress(address)) return badRequest("That isn't a valid Solana address.")
  await db.update(schema.developers).set({ walletAddress: address }).where(eq(schema.developers.id, dev.id))
  return json({ address, linked_at: new Date().toISOString() })
}

export async function DELETE(request: Request) {
  const dev = await developerFromBearer(request)
  if (!dev) return unauthorized()
  if (!rateLimit(`ext:${dev.id}:wallet`, 10, 60_000)) return tooMany()
  await db.update(schema.developers).set({ walletAddress: null }).where(eq(schema.developers.id, dev.id))
  return new Response(null, { status: 204 })
}
