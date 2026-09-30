import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ImpressionTracker } from "../../src/ads/impression"

describe("ImpressionTracker", () => {
  let counted: string[]
  let tracker: ImpressionTracker

  beforeEach(() => {
    vi.useFakeTimers()
    counted = []
    tracker = new ImpressionTracker({
      onImpression: (id) => counted.push(id),
    })
  })

  afterEach(() => {
    tracker.dispose()
    vi.useRealTimers()
  })

  it("counts after 3 continuous seconds visible and focused", () => {
    tracker.setFocused(true)
    tracker.setVisible(true)
    tracker.setAd("ad-1")
    vi.advanceTimersByTime(2999)
    expect(counted).toEqual([])
    vi.advanceTimersByTime(1)
    expect(counted).toEqual(["ad-1"])
  })

  it("restarts the clock when the view is hidden mid-way", () => {
    tracker.setFocused(true)
    tracker.setVisible(true)
    tracker.setAd("ad-1")
    vi.advanceTimersByTime(2000)
    tracker.setVisible(false)
    vi.advanceTimersByTime(5000)
    expect(counted).toEqual([])
    tracker.setVisible(true)
    vi.advanceTimersByTime(2999)
    expect(counted).toEqual([])
    vi.advanceTimersByTime(1)
    expect(counted).toEqual(["ad-1"])
  })

  it("never counts background renders (window unfocused)", () => {
    tracker.setFocused(false)
    tracker.setVisible(true)
    tracker.setAd("ad-1")
    vi.advanceTimersByTime(60_000)
    expect(counted).toEqual([])
    tracker.setFocused(true)
    vi.advanceTimersByTime(3000)
    expect(counted).toEqual(["ad-1"])
  })

  it("restarts the clock when focus is lost mid-way", () => {
    tracker.setFocused(true)
    tracker.setVisible(true)
    tracker.setAd("ad-1")
    vi.advanceTimersByTime(2500)
    tracker.setFocused(false)
    tracker.setFocused(true)
    vi.advanceTimersByTime(2500)
    expect(counted).toEqual([])
    vi.advanceTimersByTime(500)
    expect(counted).toEqual(["ad-1"])
  })

  it("counts each ad at most once and a replaced ad starts fresh", () => {
    tracker.setFocused(true)
    tracker.setVisible(true)
    tracker.setAd("ad-1")
    vi.advanceTimersByTime(3000)
    tracker.setVisible(false)
    tracker.setVisible(true)
    vi.advanceTimersByTime(3000)
    expect(counted).toEqual(["ad-1"])
    tracker.setAd("ad-2")
    vi.advanceTimersByTime(3000)
    expect(counted).toEqual(["ad-1", "ad-2"])
    expect(tracker.hasCounted("ad-1")).toBe(true)
  })

  it("does nothing when the ad is cleared", () => {
    tracker.setFocused(true)
    tracker.setVisible(true)
    tracker.setAd("ad-1")
    vi.advanceTimersByTime(1000)
    tracker.setAd(null)
    vi.advanceTimersByTime(10_000)
    expect(counted).toEqual([])
  })
})
