export const EXTENSION_ID = "vibefuel.vibefuel"
export const VIEW_ID = "vibefuel.feed"
export const OUTPUT_CHANNEL_NAME = "Vibefuel"

/** Public site. Also the default API host; see `vibefuel.apiBaseUrl`. */
export const LANDING_URL = "https://vibefuel.app"
export const PRIVACY_URL = `${LANDING_URL}/privacy`
/** Where a developer creates a serial key. */
export const START_URL = `${LANDING_URL}/start`
export const DEFAULT_API_BASE_URL = LANDING_URL

/** Seconds a card must stay visible with the window focused before an impression counts. */
export const IMPRESSION_SECONDS = 3
/** How often the scheduler re-evaluates the delivery policy. */
export const SCHEDULER_TICK_MS = 15_000
/** Active-time heartbeat cadence while the window is focused. */
export const HEARTBEAT_INTERVAL_MS = 60_000
/** Backoff after the API returns nothing or fails, so we do not hammer it. */
export const FETCH_BACKOFF_MS = 5 * 60_000

export const COMMANDS = {
  openFeed: "vibefuel.openFeed",
  signIn: "vibefuel.signIn",
  pause: "vibefuel.pause",
  resume: "vibefuel.resume",
  linkWallet: "vibefuel.linkWallet",
  unlinkWallet: "vibefuel.unlinkWallet",
  signOut: "vibefuel.signOut",
  openLandingPage: "vibefuel.openLandingPage",
} as const
