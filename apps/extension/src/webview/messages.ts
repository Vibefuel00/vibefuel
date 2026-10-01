import type { Ad, Balance, PolicyBlockReason } from "@workspace/vibefuel-core"

export type Screen = "onboarding" | "signin" | "feed"

export interface AuthView {
  userCode: string
  verificationUri: string
  status: "waiting" | "expired" | "denied" | "error"
}

/** Everything the webview needs to render. The extension owns all state. */
export interface FeedState {
  screen: Screen
  mode: "mock" | "http"
  version: string
  enabled: boolean
  paused: boolean
  ad: Ad | null
  adDeliveredAt: number | null
  impressionCounted: boolean
  balance: Balance | null
  wallet: string | null
  walletSyncPending: boolean
  auth: AuthView | null
  offline: boolean
  eventsBlocked: "editor" | "setting" | null
  blockReason: PolicyBlockReason | null
  nextEligibleAt: number | null
  landingUrl: string
}

export type ToWebview = { type: "state"; state: FeedState } | { type: "ping" }

export type FromWebview =
  | { type: "ready" }
  | { type: "optIn" }
  | { type: "optOut" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "cta"; adId: string }
  | { type: "dismiss"; adId: string }
  | { type: "signIn" }
  | { type: "openVerification" }
  | { type: "restartAuth" }
  | { type: "linkWallet" }
  | { type: "unlinkWallet" }
  | { type: "signOut" }
  | { type: "openLanding" }
  | { type: "openPrivacy" }
  | { type: "refresh" }
