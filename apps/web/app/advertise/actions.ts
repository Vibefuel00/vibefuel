"use server"

import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { db, schema } from "@/db"
import { advertiserSession, currentAdvertiser } from "@/lib/auth"
import { env, LAMPORTS_PER_SOL } from "@/lib/env"
import { planById } from "@/lib/plans"
import { clientIp, rateLimit } from "@/lib/ratelimit"
import { buildTransfer, findPayment, isValidSolanaAddress, newReference, paymentsEnabled } from "@/lib/solana"
import { issueNonce, nonceIsValid, signInMessage, verifySignature } from "@/lib/wallet-auth"

export type AdvState = { error?: string; ok?: string }

const HEX = /^#[0-9a-fA-F]{6}$/

function str(formData: FormData, name: string, max = 200): string {
  return String(formData.get(name) ?? "").trim().slice(0, max)
}

function normalizeWebsite(input: string): { url: string; domain: string } | null {
  const raw = input.trim()
  if (!raw) return null
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== "https:" && u.protocol !== "http:") return null
    const domain = u.hostname.replace(/^www\./, "")
    if (!domain.includes(".")) return null
    return { url: u.toString(), domain }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Wallet sign-in
// ---------------------------------------------------------------------------

export async function walletChallenge(address: string): Promise<{ nonce: string; message: string } | { error: string }> {
  const ip = clientIp(await headers())
  if (!rateLimit(`challenge:${ip}`, 30, 10 * 60_000)) return { error: "Too many attempts. Try again in a few minutes." }
  if (!isValidSolanaAddress(address)) return { error: "That wallet address is not valid." }
  const nonce = issueNonce(address)
  return { nonce, message: signInMessage(address, nonce) }
}

export async function walletSignIn(input: {
  address: string
  nonce: string
  signature: string
  company: string
  website: string
}): Promise<AdvState> {
  const ip = clientIp(await headers())
  if (!rateLimit(`wallet-signin:${ip}`, 20, 10 * 60_000)) return { error: "Too many attempts. Try again in a few minutes." }
  const address = input.address.trim()
  if (!isValidSolanaAddress(address)) return { error: "That wallet address is not valid." }
  if (!nonceIsValid(input.nonce, address)) return { error: "The sign-in request expired. Connect again." }
  if (!verifySignature(address, signInMessage(address, input.nonce), input.signature))
    return { error: "The signature did not match the wallet." }

  const company = input.company.trim().slice(0, 80)
  if (company.length < 2) return { error: "Tell us your company or product name." }
  const site = normalizeWebsite(input.website.slice(0, 300))
  if (!site) return { error: "Enter a valid website, like yourcompany.com." }

  await db
    .insert(schema.advertisers)
    .values({ walletAddress: address, company, website: site.url, lastSignInAt: new Date() })
    .onConflictDoUpdate({
      target: schema.advertisers.walletAddress,
      set: { company, website: site.url, lastSignInAt: new Date() },
    })
  const [adv] = await db
    .select({ id: schema.advertisers.id })
    .from(schema.advertisers)
    .where(eq(schema.advertisers.walletAddress, address))
    .limit(1)
  if (!adv) return { error: "Could not save the account. Please try again." }
  await advertiserSession.set(adv.id)
  return { ok: "Signed in." }
}

export async function signOutAdvertiser() {
  await advertiserSession.clear()
  redirect("/")
}

// ---------------------------------------------------------------------------
// Campaign launch and payment
// ---------------------------------------------------------------------------

export type LaunchResult =
  | { campaignId: string; sol: number; transaction: string | null }
  | { error: string }

/**
 * Creates a campaign for the chosen plan with a sensible default card, plus a
 * pending payment. Returns the unsigned transfer for the connected wallet.
 */
export async function launchCampaign(planId: string): Promise<LaunchResult> {
  const adv = await currentAdvertiser()
  if (!adv) return { error: "Connect your wallet first." }
  const plan = planById(planId)
  if (!plan) return { error: "Pick a plan." }
  const site = normalizeWebsite(adv.website ?? "")
  if (!site) return { error: "Add a valid website first." }

  const lamports = Math.round(plan.sol * LAMPORTS_PER_SOL)
  const tokens = Math.floor(lamports / env.lamportsPerToken)
  const reference = newReference()

  const campaignId = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(schema.campaigns)
      .values({
        advertiserId: adv.id,
        name: `${plan.name} · ${adv.company}`,
        advertiserName: adv.company,
        domain: site.domain,
        url: site.url,
        headline: `Discover ${adv.company}.`,
        body: `See what ${adv.company} is building at ${site.domain}.`,
        rewardTokens: plan.rewardTokens,
        budgetTokens: tokens,
        status: "pending_payment",
      })
      .returning({ id: schema.campaigns.id })
    if (!c) throw new Error("insert failed")
    await tx.insert(schema.payments).values({
      advertiserId: adv.id,
      campaignId: c.id,
      lamports,
      tokens,
      reference,
    })
    return c.id
  })

  let transaction: string | null = null
  if (paymentsEnabled()) {
    try {
      transaction = await buildTransfer({ from: adv.walletAddress, lamports, reference })
    } catch (err) {
      console.error("buildTransfer failed", err)
    }
  }
  revalidatePath("/advertise/dashboard")
  return { campaignId, sol: plan.sol, transaction }
}

/** Fresh unsigned transfer for an existing pending payment (blockhashes expire). */
export async function prepareTransfer(campaignId: string): Promise<{ transaction: string } | { error: string }> {
  const adv = await currentAdvertiser()
  if (!adv) return { error: "Connect your wallet first." }
  if (!paymentsEnabled()) return { error: "Payments are not configured on this server yet." }
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.campaignId, campaignId),
        eq(schema.payments.advertiserId, adv.id),
        eq(schema.payments.status, "pending")
      )
    )
    .limit(1)
  if (!payment) return { error: "Nothing to pay for this campaign." }
  try {
    const transaction = await buildTransfer({
      from: adv.walletAddress,
      lamports: payment.lamports,
      reference: payment.reference,
    })
    return { transaction }
  } catch (err) {
    console.error("prepareTransfer failed", err)
    return { error: "Could not reach the Solana network. Try again." }
  }
}

export async function checkPayment(campaignId: string): Promise<AdvState> {
  const adv = await currentAdvertiser()
  if (!adv) return { error: "Connect your wallet first." }
  if (!paymentsEnabled()) return { error: "Payments are not configured on this server yet." }
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.campaignId, campaignId),
        eq(schema.payments.advertiserId, adv.id),
        eq(schema.payments.status, "pending")
      )
    )
    .limit(1)
  if (!payment) return { ok: "Nothing to confirm." }
  const signature = await findPayment(payment.reference, payment.lamports)
  if (!signature) return { error: "No matching transfer found yet. Give the network a few seconds and check again." }
  await db.transaction(async (tx) => {
    await tx
      .update(schema.payments)
      .set({ status: "confirmed", signature, confirmedAt: new Date() })
      .where(eq(schema.payments.id, payment.id))
    await tx.update(schema.campaigns).set({ status: "active" }).where(eq(schema.campaigns.id, campaignId))
  })
  revalidatePath(`/advertise/campaigns/${campaignId}`)
  revalidatePath("/advertise/dashboard")
  return { ok: "Payment confirmed. Your campaign is live." }
}

export async function setCampaignStatus(campaignId: string, status: "active" | "paused") {
  const adv = await currentAdvertiser()
  if (!adv) redirect("/advertise")
  const [c] = await db
    .select({ status: schema.campaigns.status })
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.advertiserId, adv.id)))
    .limit(1)
  if (!c) return
  if (c.status !== "active" && c.status !== "paused") return
  await db.update(schema.campaigns).set({ status }).where(eq(schema.campaigns.id, campaignId))
  revalidatePath(`/advertise/campaigns/${campaignId}`)
  revalidatePath("/advertise/dashboard")
}

/** Edit the card shown to developers. */
export async function updateCreative(campaignId: string, _: AdvState, formData: FormData): Promise<AdvState> {
  const adv = await currentAdvertiser()
  if (!adv) redirect("/advertise")
  const headline = str(formData, "headline", 60)
  const body = str(formData, "body", 140)
  const logoUrl = str(formData, "logoUrl", 300)
  const brandBg = str(formData, "brandBg", 7)
  const brandFg = str(formData, "brandFg", 7)
  const advertiserName = str(formData, "advertiserName", 40)
  const site = normalizeWebsite(str(formData, "url", 300))
  if (advertiserName.length < 2) return { error: "Add the brand name shown on the card." }
  if (!site) return { error: "The destination must be a valid website." }
  if (headline.length < 4) return { error: "Write a headline (up to 60 characters)." }
  if (body.length < 4) return { error: "Write a short body (up to 140 characters)." }
  if (logoUrl && !/^https:\/\//.test(logoUrl)) return { error: "Logo must be an https:// image URL." }
  if (!HEX.test(brandBg) || !HEX.test(brandFg)) return { error: "Colors must be hex like #0a0a0a." }

  const result = await db
    .update(schema.campaigns)
    .set({
      advertiserName,
      url: site.url,
      domain: site.domain,
      headline,
      body,
      logoUrl: logoUrl || null,
      brandBg: brandBg.toLowerCase(),
      brandFg: brandFg.toLowerCase(),
    })
    .where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.advertiserId, adv.id)))
    .returning({ id: schema.campaigns.id })
  if (!result.length) return { error: "Campaign not found." }
  revalidatePath(`/advertise/campaigns/${campaignId}`)
  return { ok: "Card saved." }
}
