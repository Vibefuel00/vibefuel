import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AdEvent, EventBatchResult } from "../../src/api/types"
import { EventBatcher } from "../../src/state/events"

function makeSink() {
  const batches: AdEvent[][] = []
  let fail = false
  return {
    batches,
    setFail(value: boolean) {
      fail = value
    },
    sink: {
      postEvents: (events: AdEvent[]): Promise<EventBatchResult> => {
        if (fail) return Promise.reject(new Error("offline"))
        batches.push(events)
        return Promise.resolve({ accepted: events.length })
      },
    },
  }
}

describe("EventBatcher", () => {
  let enabled: boolean
  let ids: number

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    enabled = true
    ids = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function make(sink: ReturnType<typeof makeSink>, extra = {}) {
    return new EventBatcher({
      sink: sink.sink,
      sessionId: "session-1",
      isEnabled: () => enabled,
      newId: () => `evt-${++ids}`,
      ...extra,
    })
  }

  it("shapes events per the contract", async () => {
    const s = makeSink()
    const batcher = make(s)
    batcher.track("impression", "ad-1")
    await batcher.flush()
    expect(s.batches).toEqual([
      [
        {
          id: "evt-1",
          ad_id: "ad-1",
          type: "impression",
          occurred_at: "2026-01-01T00:00:00.000Z",
          session_id: "session-1",
        },
      ],
    ])
  })

  it("sends at most once per minute and batches in between", async () => {
    const s = makeSink()
    const batcher = make(s)
    batcher.track("impression", "ad-1")
    await batcher.flush()
    expect(s.batches).toHaveLength(1)

    batcher.track("click", "ad-1")
    batcher.track("dismiss", "ad-1")
    await batcher.flush()
    expect(s.batches).toHaveLength(1)
    expect(batcher.size).toBe(2)

    await vi.advanceTimersByTimeAsync(59_999)
    expect(s.batches).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(s.batches).toHaveLength(2)
    expect(s.batches[1]!.map((e) => e.type)).toEqual(["click", "dismiss"])
  })

  it("flushes automatically without an explicit flush call", async () => {
    const s = makeSink()
    const batcher = make(s)
    batcher.track("impression", "ad-1")
    await vi.advanceTimersByTimeAsync(0)
    expect(s.batches).toHaveLength(1)
  })

  it("keeps failed batches and retries them in order", async () => {
    const s = makeSink()
    const errors: unknown[] = []
    const batcher = make(s, { onError: (e: unknown) => errors.push(e) })
    s.setFail(true)
    batcher.track("impression", "ad-1")
    await batcher.flush()
    expect(errors).toHaveLength(1)
    expect(batcher.size).toBe(1)

    batcher.track("click", "ad-1")
    s.setFail(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(s.batches).toHaveLength(1)
    expect(s.batches[0]!.map((e) => e.type)).toEqual(["impression", "click"])
  })

  it("drops events when disabled and clears the queue on the next flush", async () => {
    const s = makeSink()
    const batcher = make(s)
    batcher.track("impression", "ad-1")
    await batcher.flush()
    batcher.track("click", "ad-1")
    expect(batcher.size).toBe(1)
    enabled = false
    expect(batcher.track("dismiss", "ad-1")).toBe(false)
    await batcher.flush(true)
    expect(batcher.size).toBe(0)
    expect(s.batches).toHaveLength(1)
  })

  it("clear() drops the queue without sending (opt-out)", async () => {
    const s = makeSink()
    const batcher = make(s)
    batcher.track("impression", "ad-1")
    batcher.clear()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(s.batches).toHaveLength(0)
    expect(batcher.size).toBe(0)
  })

  it("bounds the queue while offline", () => {
    const s = makeSink()
    const batcher = make(s, { maxQueued: 3 })
    s.setFail(true)
    for (let i = 0; i < 10; i++) batcher.track("click", `ad-${i}`)
    expect(batcher.size).toBe(3)
  })
})
