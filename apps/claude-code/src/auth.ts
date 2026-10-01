import { ApiUnavailableError, type VibefuelApi } from "@workspace/vibefuel-core"
import type { StateStore } from "./state"

export type LoginResult =
  | { status: "signed-in"; deviceId: string }
  | {
      status: "waiting"
      userCode: string
      verificationUri: string
      expiresAt: number
    }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "offline" }

/** Start the device code flow, or finish one already in progress. */
export async function login(
  store: StateStore,
  api: VibefuelApi,
  now = Date.now()
): Promise<LoginResult> {
  if (store.getToken()) {
    return { status: "signed-in", deviceId: store.load().deviceId ?? "" }
  }
  let pending = store.load().pendingAuth
  if (pending && pending.expires_at <= now) pending = null
  if (!pending) {
    try {
      const res = await api.startDeviceAuth()
      pending = {
        device_code: res.device_code,
        user_code: res.user_code,
        verification_uri: res.verification_uri_complete ?? res.verification_uri,
        expires_at: now + res.expires_in * 1000,
        interval_ms: Math.max(1, res.interval) * 1000,
      }
      const saved = pending
      store.update((s) => {
        s.pendingAuth = saved
      })
    } catch (error) {
      if (error instanceof ApiUnavailableError) return { status: "offline" }
      throw error
    }
  }
  return poll(store, api, pending)
}

/** One poll of the token endpoint. Called by login and by the Stop hook. */
export async function poll(
  store: StateStore,
  api: VibefuelApi,
  pending: NonNullable<ReturnType<StateStore["load"]>["pendingAuth"]>
): Promise<LoginResult> {
  let result
  try {
    result = await api.pollDeviceToken(pending.device_code)
  } catch (error) {
    if (error instanceof ApiUnavailableError) return { status: "offline" }
    throw error
  }
  if (result.status === "ok") {
    store.setToken(result.token.access_token)
    store.update((s) => {
      s.deviceId = result.token.device_id
      s.pendingAuth = null
    })
    store.log(`Signed in (${api.mode} mode).`)
    return { status: "signed-in", deviceId: result.token.device_id }
  }
  if (result.error === "expired_token") {
    store.update((s) => {
      s.pendingAuth = null
    })
    return { status: "expired" }
  }
  if (result.error === "access_denied") {
    store.update((s) => {
      s.pendingAuth = null
    })
    return { status: "denied" }
  }
  return {
    status: "waiting",
    userCode: pending.user_code,
    verificationUri: pending.verification_uri,
    expiresAt: pending.expires_at,
  }
}
