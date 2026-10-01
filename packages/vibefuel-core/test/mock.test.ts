import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import * as path from "node:path"
import { MockAdapter, type MockStorage } from "../src/mock"
import type { Ad } from "../src/types"

function memoryStorage(): MockStorage {
  const map = new Map<string, unknown>()
  return {
    get: <T>(key: string) => map.get(key) as T | undefined,
    update: (key, value) => {
      if (value === undefined) map.delete(key)
      else map.set(key, value)
      return Promise.resolve()
    },
  }
}

const ads = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "data/mock-ads.json"), "utf8")
) as Ad[]

describe("MockAdapter", () => {
  it("rotates through the five ads", async () => {
    const lines: string[] = []
    const api = new MockAdapter(ads, memoryStorage(), {
      appendLine: (l) => lines.push(l),
    })
    const seen: string[] = []
    for (let i = 0; i < 6; i++) seen.push((await api.getNextAd("s"))!.id)
    expect(seen).toEqual([
      "mock-001",
      "mock-002",
      "mock-003",
      "mock-004",
      "mock-005",
      "mock-001",
    ])
    expect(lines.length).toBeGreaterThan(0)
  })

  it("credits one impression per campaign per 6 hours and pays out after ten minutes", async () => {
    let now = 1_000_000
    const api = new MockAdapter(
      ads,
      memoryStorage(),
      { appendLine: () => {} },
      () => now
    )
    const event = (id: string) => ({
      id,
      ad_id: "mock-001",
      type: "impression" as const,
      occurred_at: new Date(now).toISOString(),
      session_id: "s",
    })
    const first = await api.postEvents([event("e1"), event("e1")])
    expect(first).toMatchObject({
      accepted: 1,
      rewarded: 12,
      balance: { pending: 12, settled: 0 },
    })
    const again = await api.postEvents([event("e2")])
    expect(again).toMatchObject({ accepted: 1, rewarded: 0 })
    now += 11 * 60_000
    expect((await api.me()).balance).toMatchObject({ pending: 0, settled: 12 })
    now += 6 * 60 * 60_000
    expect((await api.postEvents([event("e3")])).rewarded).toBe(12)
  })

  it("reports a mock account, heartbeat time and wallet", async () => {
    const api = new MockAdapter(ads, memoryStorage(), { appendLine: () => {} })
    await api.heartbeat(60)
    await api.linkWallet("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    const me = await api.me()
    expect(me.key_prefix).toBe("VF-MOCK")
    expect(me.active_seconds).toBe(60)
    expect(me.wallet_address).toBe(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    )
    await api.unlinkWallet()
    expect((await api.me()).wallet_address).toBeNull()
  })
})
