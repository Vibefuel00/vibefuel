/**
 * Pure delivery policy. Every input is explicit so it can be unit tested with
 * no editor involved. All durations are in milliseconds.
 */
export interface PolicyInput {
  now: number
  /** When the current editor session started. */
  sessionStartedAt: number
  /** When the last card was delivered, or null if none this device. */
  lastDeliveredAt: number | null
  enabled: boolean
  paused: boolean
  debugActive: boolean
  windowFocused: boolean
  frequencyMinutes: number
  quietPeriodMinutes: number
}

export type PolicyBlockReason =
  | "disabled"
  | "paused"
  | "debugging"
  | "unfocused"
  | "quiet-period"
  | "frequency"

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: PolicyBlockReason; retryAt: number | null }

export const MIN_FREQUENCY_MINUTES = 15

const MINUTE = 60_000

/** Clamp user settings to the ranges the policy tolerates. */
export function normalizeFrequencyMinutes(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 30
  return Math.max(MIN_FREQUENCY_MINUTES, n)
}

export function normalizeQuietPeriodMinutes(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 10
  return Math.max(0, n)
}

export function quietPeriodEndsAt(input: PolicyInput): number {
  return (
    input.sessionStartedAt +
    normalizeQuietPeriodMinutes(input.quietPeriodMinutes) * MINUTE
  )
}

export function nextFrequencySlotAt(input: PolicyInput): number | null {
  if (input.lastDeliveredAt === null) return null
  return (
    input.lastDeliveredAt +
    normalizeFrequencyMinutes(input.frequencyMinutes) * MINUTE
  )
}

/**
 * Decide whether a new sponsored message may be requested right now.
 * Order matters: hard stops first, then time based rules with a retry hint.
 */
export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  if (!input.enabled)
    return { allowed: false, reason: "disabled", retryAt: null }
  if (input.paused) return { allowed: false, reason: "paused", retryAt: null }
  if (input.debugActive) {
    return { allowed: false, reason: "debugging", retryAt: null }
  }
  if (!input.windowFocused) {
    return { allowed: false, reason: "unfocused", retryAt: null }
  }

  const quietEnd = quietPeriodEndsAt(input)
  if (input.now < quietEnd) {
    return { allowed: false, reason: "quiet-period", retryAt: quietEnd }
  }

  const slot = nextFrequencySlotAt(input)
  if (slot !== null && input.now < slot) {
    return { allowed: false, reason: "frequency", retryAt: slot }
  }

  return { allowed: true }
}
