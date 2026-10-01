import { randomUUID } from "node:crypto"
import {
  ApiUnavailableError,
  UnauthorizedError,
  evaluatePolicy,
  validateAd,
  type PolicyDecision,
  type VibefuelApi,
} from "@workspace/vibefuel-core"
import { formatSponsoredLine } from "./format"
import type { StateStore } from "./state"

/** The only hook input fields Vibefuel reads. The transcript is never opened. */
export interface HookInput {
  session_id?: string
  hook_event_name?: string
  agent_id?: string
  source?: string
}

export interface HookOutput {
  systemMessage?: string
}

export interface HookContext {
  store: StateStore
  api: VibefuelApi
  now?: () => number
  newId?: () => string
}

export function parseHookInput(raw: string): HookInput {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const pick = (key: string): string | undefined =>
      typeof parsed[key] === "string" ? parsed[key] : undefined
    const input: HookInput = {}
    const session_id = pick("session_id")
    const hook_event_name = pick("hook_event_name")
    const agent_id = pick("agent_id")
    const source = pick("source")
    if (session_id !== undefined) input.session_id = session_id
    if (hook_event_name !== undefined) input.hook_event_name = hook_event_name
    if (agent_id !== undefined) input.agent_id = agent_id
    if (source !== undefined) input.source = source
    return input
  } catch {
    return {}
  }
}

/** SessionStart: remember when this session began for the quiet period. */
export function onSessionStart(input: HookInput, ctx: HookContext): HookOutput {
  const now = ctx.now?.() ?? Date.now()
  if (!input.session_id) return {}
  if (input.source === "compact") return {}
  ctx.store.touchSession(input.session_id, now)
  return {}
}

export function decide(
  sessionId: string,
  ctx: HookContext
): { decision: PolicyDecision; signedIn: boolean } {
  const now = ctx.now?.() ?? Date.now()
  const state = ctx.store.load()
  const signedIn = ctx.store.getToken() !== undefined
  const sessionStartedAt = ctx.store.touchSession(sessionId, now)
  const decision = evaluatePolicy({
    now,
    sessionStartedAt,
    lastDeliveredAt: state.lastDeliveredAt,
    enabled: state.optedIn && signedIn,
    paused: state.paused,
    debugActive: false,
    windowFocused: true,
    frequencyMinutes: state.frequencyMinutes,
    quietPeriodMinutes: state.quietPeriodMinutes,
  })
  return { decision, signedIn }
}

/**
 * Stop: after a task finishes, maybe show one sponsored line. Returns {} in
 * every case where nothing should be shown. Never throws.
 */
export async function onStop(
  input: HookInput,
  ctx: HookContext
): Promise<HookOutput> {
  const { store, api } = ctx
  const now = ctx.now?.() ?? Date.now()
  try {
    if (input.agent_id) return {}
    const sessionId = input.session_id ?? "unknown"
    const state = store.load()
    if (!state.optedIn) return {}

    if (!store.getToken()) return {}

    const { decision } = decide(sessionId, ctx)
    if (!decision.allowed) return {}

    const raw = await api.getNextAd(sessionId)
    if (raw === null) {
      store.log("No eligible sponsored message right now.")
      return {}
    }
    const ad = validateAd(raw, now)
    if (!ad) {
      store.log(
        `Dropped an ad that failed validation (${String((raw as { id?: string }).id)}).`
      )
      return {}
    }

    store.update((s) => {
      s.lastDeliveredAt = now
      s.lastAd = {
        id: ad.id,
        advertiser: ad.advertiser,
        headline: ad.headline,
        at: now,
      }
    })
    store.log(`Showed sponsored message ${ad.id} from ${ad.advertiser}.`)

    // A terminal impression counts on display. Report it right away; the Stop
    // hook fires at most once per frequency window, so this stays well under
    // one request per minute.
    try {
      const result = await api.postEvents([
        {
          id: ctx.newId?.() ?? randomUUID(),
          ad_id: ad.id,
          type: "impression",
          occurred_at: new Date(now).toISOString(),
          session_id: sessionId,
        },
      ])
      if (result.balance) {
        const balance = result.balance
        store.update((s) => void (s.balance = balance))
      }
    } catch (error) {
      store.log(`Could not report impression: ${describe(error)}`)
    }

    // Let the dashboard show "connected via Claude Code"; no active time is claimed.
    try {
      await api.heartbeat(0)
    } catch {
      // Best effort only.
    }

    // Lets the dashboard show "connected via Claude Code"; no active time is claimed.
    try {
      await api.heartbeat(0)
    } catch {
      // Best effort only.
    }

    return { systemMessage: formatSponsoredLine(ad) }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      store.setToken(null)
      store.log("Device token rejected; signed out. Run /vibefuel:login.")
    } else if (error instanceof ApiUnavailableError) {
      store.log(`Offline: ${error.message}`)
    } else {
      store.log(`Stop hook failed: ${describe(error)}`)
    }
    return {}
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
