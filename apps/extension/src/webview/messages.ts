import type { Ad, Balance, PolicyBlockReason } from "@workspace/vibefuel-core"

export type Screen = "onboarding" | "signin" | "feed"

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
  keyPrefix: string | null
  wallet: string | null
  signingIn: boolean
  offline: boolean
  eventsBlocked: "editor" | "setting" | null
  blockReason: PolicyBlockReason | null
  nextEligibleAt: number | null
  landingUrl: string
  startUrl: string
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
  | { type: "getKey" }
  | { type: "openDashboard" }
  | { type: "linkWallet" }
  | { type: "unlinkWallet" }
  | { type: "signOut" }
  | { type: "openLanding" }
  | { type: "openPrivacy" }
  | { type: "refresh" }
