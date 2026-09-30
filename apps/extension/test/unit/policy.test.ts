import { describe, expect, it } from "vitest"
import {
  evaluatePolicy,
  normalizeFrequencyMinutes,
  type PolicyInput,
} from "../../src/ads/policy"

const MINUTE = 60_000
const T0 = 1_700_000_000_000

function input(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    now: T0 + 11 * MINUTE,
    sessionStartedAt: T0,
    lastDeliveredAt: null,
    enabled: true,
    paused: false,
    debugActive: false,
    windowFocused: true,
    frequencyMinutes: 30,
    quietPeriodMinutes: 10,
    ...overrides,
  }
}

describe("evaluatePolicy", () => {
  it("allows after the quiet period when nothing was delivered", () => {
    expect(evaluatePolicy(input())).toEqual({ allowed: true })
  })

  it("blocks during the quiet period with the time it ends", () => {
    const decision = evaluatePolicy(input({ now: T0 + 5 * MINUTE }))
    expect(decision).toEqual({
      allowed: false,
      reason: "quiet-period",
      retryAt: T0 + 10 * MINUTE,
    })
  })

  it("allows exactly at the end of the quiet period", () => {
    expect(evaluatePolicy(input({ now: T0 + 10 * MINUTE }))).toEqual({
      allowed: true,
    })
  })

  it("enforces the frequency window from the last delivery", () => {
    const last = T0 + 20 * MINUTE
    const blocked = evaluatePolicy(
      input({ now: last + 29 * MINUTE, lastDeliveredAt: last })
    )
    expect(blocked).toEqual({
      allowed: false,
      reason: "frequency",
      retryAt: last + 30 * MINUTE,
    })
    expect(
      evaluatePolicy(input({ now: last + 30 * MINUTE, lastDeliveredAt: last }))
    ).toEqual({ allowed: true })
  })

  it("never delivers while disabled, paused, debugging or unfocused", () => {
    expect(evaluatePolicy(input({ enabled: false }))).toMatchObject({
      reason: "disabled",
    })
    expect(evaluatePolicy(input({ paused: true }))).toMatchObject({
      reason: "paused",
    })
    expect(evaluatePolicy(input({ debugActive: true }))).toMatchObject({
      reason: "debugging",
    })
    expect(evaluatePolicy(input({ windowFocused: false }))).toMatchObject({
      reason: "unfocused",
    })
  })

  it("hard stops win over time based rules", () => {
    const decision = evaluatePolicy(
      input({ paused: true, now: T0 + 1 * MINUTE })
    )
    expect(decision).toMatchObject({ reason: "paused", retryAt: null })
  })

  it("clamps frequency to the 15 minute minimum", () => {
    expect(normalizeFrequencyMinutes(1)).toBe(15)
    expect(normalizeFrequencyMinutes(45)).toBe(45)
    expect(normalizeFrequencyMinutes("nope")).toBe(30)
    const last = T0 + 20 * MINUTE
    const decision = evaluatePolicy(
      input({
        frequencyMinutes: 1,
        lastDeliveredAt: last,
        now: last + 5 * MINUTE,
      })
    )
    expect(decision).toMatchObject({
      reason: "frequency",
      retryAt: last + 15 * MINUTE,
    })
  })

  it("treats a zero quiet period as no quiet period", () => {
    expect(evaluatePolicy(input({ quietPeriodMinutes: 0, now: T0 }))).toEqual({
      allowed: true,
    })
  })
})
