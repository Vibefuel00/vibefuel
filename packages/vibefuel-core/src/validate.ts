import type { Ad } from "./types"

const LIMITS = {
  advertiser: 40,
  headline: 60,
  body: 140,
  cta_label: 20,
} as const

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Validate an ad from either adapter before it reaches the webview. Anything
 * that violates the format is dropped rather than rendered partially.
 */
export function validateAd(input: unknown, now = Date.now()): Ad | null {
  if (!input || typeof input !== "object") return null
  const ad = input as Record<string, unknown>

  const text = (key: keyof typeof LIMITS): string | null => {
    const value = ad[key]
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (trimmed.length === 0 || trimmed.length > LIMITS[key]) return null
    return trimmed
  }

  const id = typeof ad.id === "string" && ad.id.length > 0 ? ad.id : null
  const advertiser = text("advertiser")
  const headline = text("headline")
  const body = text("body")
  const cta_label = text("cta_label")
  if (!id || !advertiser || !headline || !body || !cta_label) return null

  if (!isHttpsUrl(ad.cta_url)) return null
  if (ad.image_url !== undefined && !isHttpsUrl(ad.image_url)) return null
  if (ad.click_url !== undefined && !isHttpsUrl(ad.click_url)) return null

  const reward = ad.reward_tokens
  if (typeof reward !== "number" || !Number.isFinite(reward) || reward < 0) {
    return null
  }

  if (typeof ad.expires_at !== "string") return null
  const expires = Date.parse(ad.expires_at)
  if (Number.isNaN(expires) || expires <= now) return null

  const result: Ad = {
    id,
    advertiser,
    headline,
    body,
    cta_label,
    cta_url: ad.cta_url,
    reward_tokens: reward,
    expires_at: ad.expires_at,
  }
  if (ad.image_url !== undefined) result.image_url = ad.image_url
  if (ad.click_url !== undefined) result.click_url = ad.click_url
  return result
}
