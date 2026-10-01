import { describe, expect, it } from "vitest"
import { formatSponsoredLine, formatStatusLine } from "../src/format"

const ad = {
  id: "a",
  advertiser: "Quillstack Labs",
  headline: "Ship docs that stay in sync",
  body: "Short body.",
  cta_label: "Try it",
  cta_url: "https://example.com/x",
  reward_tokens: 12,
  expires_at: "2099-01-01T00:00:00Z",
}

describe("formatSponsoredLine", () => {
  it("labels, rewards and links, preferring the tracked click url", () => {
    const line = formatSponsoredLine({
      ...ad,
      click_url: "https://api.example/v1/go/a?t=x",
    })
    expect(line.startsWith("Sponsored · Quillstack Labs")).toBe(true)
    expect(line).toContain("Earn 12 tokens")
    expect(line).toContain("Try it: https://api.example/v1/go/a?t=x")
    expect(line).toContain("/vibefuel:pause")
  })

  it("falls back to the cta url", () => {
    expect(formatSponsoredLine(ad)).toContain("https://example.com/x")
  })
})

describe("formatStatusLine", () => {
  it("shows balance, pause and new markers", () => {
    const balance = { pending: 20, settled: 108, currency: "tokens" }
    expect(
      formatStatusLine({
        optedIn: false,
        paused: false,
        balance,
        pending: false,
      })
    ).toContain("off")
    expect(
      formatStatusLine({ optedIn: true, paused: false, balance, pending: true })
    ).toBe("⛽ 128 tokens · ● new")
    expect(
      formatStatusLine({ optedIn: true, paused: true, balance, pending: true })
    ).toBe("⛽ 128 tokens · paused")
  })
})
