import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import * as path from "node:path"
import { validateAd } from "../src/validate"

const NOW = Date.parse("2026-06-01T00:00:00Z")
const base = {
  id: "a1",
  advertiser: "Quillstack Labs",
  headline: "Ship docs that stay in sync",
  body: "Short body.",
  cta_label: "Try it",
  cta_url: "https://example.com/x",
  reward_tokens: 5,
  expires_at: "2026-07-01T00:00:00Z",
}

describe("validateAd", () => {
  it("accepts a well formed ad and trims text", () => {
    expect(validateAd({ ...base, headline: "  Hi  " }, NOW)).toEqual({
      ...base,
      headline: "Hi",
    })
  })

  it("rejects non-https CTA and image URLs", () => {
    expect(
      validateAd({ ...base, cta_url: "http://example.com" }, NOW)
    ).toBeNull()
    expect(
      validateAd({ ...base, cta_url: "javascript:alert(1)" }, NOW)
    ).toBeNull()
    expect(
      validateAd({ ...base, image_url: "http://x.test/a.png" }, NOW)
    ).toBeNull()
  })

  it("enforces field length limits", () => {
    expect(validateAd({ ...base, advertiser: "a".repeat(41) }, NOW)).toBeNull()
    expect(validateAd({ ...base, headline: "a".repeat(61) }, NOW)).toBeNull()
    expect(validateAd({ ...base, body: "a".repeat(141) }, NOW)).toBeNull()
    expect(validateAd({ ...base, cta_label: "a".repeat(21) }, NOW)).toBeNull()
  })

  it("rejects expired ads and bad rewards", () => {
    expect(
      validateAd({ ...base, expires_at: "2020-01-01T00:00:00Z" }, NOW)
    ).toBeNull()
    expect(validateAd({ ...base, reward_tokens: -1 }, NOW)).toBeNull()
    expect(validateAd({ ...base, reward_tokens: "5" }, NOW)).toBeNull()
  })

  it("every mock ad passes validation", () => {
    const ads = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "data/mock-ads.json"), "utf8")
    ) as unknown[]
    expect(ads).toHaveLength(5)
    for (const ad of ads) expect(validateAd(ad, NOW)).not.toBeNull()
  })
})
