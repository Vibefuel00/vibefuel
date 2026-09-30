import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import * as path from "node:path"
import { MockAdapter, type MockStorage } from "../../src/api/mock"
import type { Ad } from "../../src/api/types"

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
  readFileSync(path.resolve(process.cwd(), "media/mock-ads.json"), "utf8")
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

  it("credits impressions once and settles them after ten minutes", async () => {
    let now = 1_000_000
    const api = new MockAdapter(
      ads,
      memoryStorage(),
      { appendLine: () => {} },
      () => now
    )
    const event = {
      id: "e1",
      ad_id: "mock-001",
      type: "impression" as const,
      occurred_at: new Date(now).toISOString(),
      session_id: "s",
    }
    const result = await api.postEvents([event, event])
    expect(result.balance).toMatchObject({ pending: 12, settled: 0 })
    now += 11 * 60_000
    expect(await api.getBalance()).toMatchObject({ pending: 0, settled: 12 })
  })
})
