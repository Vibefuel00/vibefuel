"use server"

import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { db, schema } from "@/db"
import {
  currentDeveloper,
  decryptKey,
  developerSession,
  encryptKey,
  generateSerialKey,
  hashSerialKey,
  isSerialKeyShape,
  keyPrefix,
  normalizeSerialKey,
} from "@/lib/auth"
import { clientIp, rateLimit } from "@/lib/ratelimit"
import { isValidSolanaAddress } from "@/lib/solana"
import { developerStats } from "@/lib/stats"

export type ActionState = { ok?: string; error?: string; key?: string }

export async function signInWithKey(_: ActionState, formData: FormData): Promise<ActionState> {
  const ip = clientIp(await headers())
  if (!rateLimit(`login:${ip}`, 10, 10 * 60_000)) return { error: "Too many attempts. Try again in a few minutes." }
  const key = normalizeSerialKey(String(formData.get("key") ?? ""))
  if (!isSerialKeyShape(key)) return { error: "That doesn't look like a Vibefuel key (VF-XXXX-XXXX-XXXX-XXXX)." }
  const [dev] = await db
    .select({ id: schema.developers.id })
    .from(schema.developers)
    .where(eq(schema.developers.keyHash, hashSerialKey(key)))
    .limit(1)
  if (!dev) return { error: "No account matches that key." }
  await developerSession.set(dev.id)
  redirect("/dashboard")
}

export async function signOutDeveloper() {
  await developerSession.clear()
  redirect("/")
}

export async function saveWallet(_: ActionState, formData: FormData): Promise<ActionState> {
  const dev = await currentDeveloper()
  if (!dev) redirect("/dashboard/login")
  const address = String(formData.get("wallet") ?? "").trim()
  if (address && !isValidSolanaAddress(address)) return { error: "That isn't a valid Solana address." }
  await db
    .update(schema.developers)
    .set({ walletAddress: address || null })
    .where(eq(schema.developers.id, dev.id))
  revalidatePath("/dashboard")
  return { ok: address ? "Wallet saved." : "Wallet removed." }
}

export async function regenerateKey(): Promise<ActionState> {
  const dev = await currentDeveloper()
  if (!dev) redirect("/dashboard/login")
  const key = generateSerialKey()
  await db
    .update(schema.developers)
    .set({ keyHash: hashSerialKey(key), keyPrefix: keyPrefix(key), keyEnc: encryptKey(key) })
    .where(eq(schema.developers.id, dev.id))
  revalidatePath("/dashboard")
  return { key }
}

export async function requestPayout(): Promise<ActionState> {
  const dev = await currentDeveloper()
  if (!dev) redirect("/dashboard/login")
  if (!dev.walletAddress) return { error: "Add a Solana wallet address first." }
  const stats = await developerStats(dev.id)
  if (stats.balance < 100) return { error: "Payouts start at 100 tokens." }
  await db.insert(schema.payouts).values({
    developerId: dev.id,
    tokens: stats.balance,
    walletAddress: dev.walletAddress,
  })
  revalidatePath("/dashboard")
  return { ok: `Payout of ${stats.balance} tokens requested. It is sent manually for now.` }
}

/** Returns the signed-in developer's full key for copying. */
export async function revealKey(): Promise<ActionState> {
  const dev = await currentDeveloper()
  if (!dev) redirect("/dashboard/login")
  const key = dev.keyEnc ? decryptKey(dev.keyEnc) : null
  if (!key) return { error: "This key can't be shown again. Generate a new one below." }
  return { key }
}
