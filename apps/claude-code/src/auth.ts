import {
  ApiUnavailableError,
  UnauthorizedError,
  validateSerialKey,
  type VibefuelApi,
} from "@workspace/vibefuel-core"
import type { StateStore } from "./state"

export const MOCK_KEY = "VF-MOCK-MOCK-MOCK-MOCK"

export type LoginResult =
  | { status: "signed-in"; keyPrefix: string }
  | { status: "invalid"; message: string }
  | { status: "rejected" }
  | { status: "offline" }

/**
 * Sign in with a serial key from vibefuel.app. In mock mode no key is needed.
 * The key is verified with GET /api/ext/me and stored with 0600 permissions.
 */
export async function login(
  store: StateStore,
  api: VibefuelApi,
  input: string
): Promise<LoginResult> {
  let key: string
  if (api.mode === "mock") {
    key = MOCK_KEY
  } else {
    const result = validateSerialKey(input)
    if (!result.ok) return { status: "invalid", message: result.message }
    key = result.key
  }
  store.setToken(key)
  try {
    const me = await api.me()
    store.update((s) => {
      s.keyPrefix = me.key_prefix
      s.balance = me.balance
      s.walletAddress = me.wallet_address
    })
    store.log(`Signed in as ${me.key_prefix} (${api.mode} mode).`)
    return { status: "signed-in", keyPrefix: me.key_prefix }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      store.setToken(null)
      return { status: "rejected" }
    }
    if (error instanceof ApiUnavailableError) {
      // Keep the key; the Stop hook verifies it once the API is reachable.
      return { status: "offline" }
    }
    store.setToken(null)
    throw error
  }
}
