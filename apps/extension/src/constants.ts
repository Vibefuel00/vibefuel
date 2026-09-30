export const EXTENSION_ID = "vibefuel.vibefuel"
export const VIEW_ID = "vibefuel.feed"
export const OUTPUT_CHANNEL_NAME = "Vibefuel"

/**
 * Public landing page. The site lives in `apps/web` of this monorepo; the
 * production hostname is not final, so this is the single place to change it.
 */
export const LANDING_URL = "https://vibefuel.dev"
export const PRIVACY_URL = `${LANDING_URL}/privacy`

/** Seconds a card must stay visible with the window focused before an impression counts. */
export const IMPRESSION_SECONDS = 3
/** Minimum interval between event batch flushes. */
export const EVENT_FLUSH_INTERVAL_MS = 60_000
/** How often the scheduler re-evaluates the delivery policy. */
export const SCHEDULER_TICK_MS = 15_000
/** Backoff after the API returns nothing or fails, so we do not hammer it. */
export const FETCH_BACKOFF_MS = 5 * 60_000
/** Maximum number of events kept in memory when the API is unreachable. */
export const MAX_QUEUED_EVENTS = 500
export const HTTP_TIMEOUT_MS = 10_000

export const COMMANDS = {
  openFeed: "vibefuel.openFeed",
  pause: "vibefuel.pause",
  resume: "vibefuel.resume",
  linkWallet: "vibefuel.linkWallet",
  unlinkWallet: "vibefuel.unlinkWallet",
  signOut: "vibefuel.signOut",
  openLandingPage: "vibefuel.openLandingPage",
} as const
