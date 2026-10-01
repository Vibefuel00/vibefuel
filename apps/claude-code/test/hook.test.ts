import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { MOCK_ADS, MockAdapter } from "@workspace/vibefuel-core"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { onSessionStart, onStop, parseHookInput } from "../src/hook"
import { StateStore, mockStorage } from "../src/state"

const MINUTE = 60_000
let dir: string
let store: StateStore
let now: number

function ctx() {
  const api = new MockAdapter([...MOCK_ADS], mockStorage(store), {
    appendLine: () => {},
  })
  let ids = 0
  return { store, api, now: () => now, newId: () => `evt-${++ids}` }
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibefuel-test-"))
  store = new StateStore(dir)
  now = Date.parse("2026-06-01T10:00:00Z")
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("parseHookInput", () => {
  it("reads only the fields Vibefuel needs and ignores the rest", () => {
    const input = parseHookInput(
      JSON.stringify({
        session_id: "s1",
        hook_event_name: "Stop",
        transcript_path: "/secret/transcript.jsonl",
        last_assistant_message: "private",
        cwd: "/private/project",
      })
    )
    expect(input).toEqual({ session_id: "s1", hook_event_name: "Stop" })
  })

  it("tolerates garbage", () => {
    expect(parseHookInput("not json")).toEqual({})
  })
})

describe("Stop hook", () => {
  async function signIn() {
    store.update((s) => void (s.optedIn = true))
    const c = ctx()
    const start = await c.api.startDeviceAuth()
    const token = await c.api.pollDeviceToken(start.device_code)
    if (token.status === "ok") store.setToken(token.token.access_token)
  }

  it("shows nothing before opt-in", async () => {
    const out = await onStop({ session_id: "s1" }, ctx())
    expect(out).toEqual({})
  })

  it("shows nothing during the quiet period, then one labelled line", async () => {
    await signIn()
    onSessionStart({ session_id: "s1", source: "startup" }, ctx())
    expect(await onStop({ session_id: "s1" }, ctx())).toEqual({})
    now += 10 * MINUTE
    const out = await onStop({ session_id: "s1" }, ctx())
    expect(out.systemMessage).toMatch(/^Sponsored · /)
    expect(out.systemMessage).toContain("Earn 12 tokens")
    expect(out.systemMessage).toContain("https://")
    expect(store.load().lastDeliveredAt).toBe(now)
    // Impression counted on display and credited by the mock.
    expect(store.load().balance).toMatchObject({ pending: 12 })
  })

  it("respects the frequency window", async () => {
    await signIn()
    store.update((s) => void (s.quietPeriodMinutes = 0))
    expect(
      (await onStop({ session_id: "s1" }, ctx())).systemMessage
    ).toBeDefined()
    now += 29 * MINUTE
    expect(await onStop({ session_id: "s1" }, ctx())).toEqual({})
    now += 1 * MINUTE
    expect(
      (await onStop({ session_id: "s1" }, ctx())).systemMessage
    ).toBeDefined()
  })

  it("never shows inside subagents or while paused", async () => {
    await signIn()
    store.update((s) => void (s.quietPeriodMinutes = 0))
    expect(
      await onStop({ session_id: "s1", agent_id: "sub-1" }, ctx())
    ).toEqual({})
    store.update((s) => void (s.paused = true))
    expect(await onStop({ session_id: "s1" }, ctx())).toEqual({})
  })

  it("stays silent when the API is unreachable", async () => {
    await signIn()
    store.update((s) => void (s.quietPeriodMinutes = 0))
    const c = ctx()
    c.api.getNextAd = () => Promise.reject(new (class extends Error {})("boom"))
    expect(await onStop({ session_id: "s1" }, c)).toEqual({})
  })
})

describe("StateStore", () => {
  it("writes files readable only by the owner and wipes everything on opt-out", () => {
    store.update((s) => void (s.optedIn = true))
    store.setToken("secret")
    const mode = (p: string) => fs.statSync(p).mode & 0o777
    expect(mode(path.join(dir, "state.json"))).toBe(0o600)
    expect(mode(path.join(dir, "token"))).toBe(0o600)
    store.wipe()
    expect(fs.existsSync(dir)).toBe(false)
  })
})
