import type { Ad, Balance } from "@workspace/vibefuel-core"

export function formatTokens(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US")
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

/**
 * The one sponsored line shown after a task. Always labelled, always with
 * the reward, and the link is plain text so the terminal makes it clickable.
 */
export function formatSponsoredLine(ad: Ad): string {
  const link = ad.click_url ?? ad.cta_url
  const body = ad.body.endsWith(".") ? ad.body : `${ad.body}.`
  return `Sponsored · ${ad.advertiser}: ${ad.headline} — ${body} ${ad.cta_label}: ${link} · Earn ${formatTokens(ad.reward_tokens)} tokens · /vibefuel:pause to pause`
}

export function formatBalance(balance: Balance | null): string {
  if (!balance) return "0 tokens"
  const total = balance.pending + balance.settled
  return `${formatTokens(total)} ${balance.currency}`
}

/** Status line segment. Keep it short; it sits next to the model name. */
export function formatStatusLine(input: {
  optedIn: boolean
  paused: boolean
  balance: Balance | null
  pending: boolean
}): string {
  if (!input.optedIn) return "⛽ Vibefuel off · /vibefuel:optin"
  const parts = [`⛽ ${formatBalance(input.balance)}`]
  if (input.paused) parts.push("paused")
  else if (input.pending) parts.push("● new")
  return parts.join(" · ")
}

export function formatWait(untilMs: number, now: number): string {
  const minutes = Math.ceil(Math.max(0, untilMs - now) / 60_000)
  if (minutes <= 1) return "in about a minute"
  if (minutes < 60) return `in ${minutes} minutes`
  const hours = Math.round(minutes / 60)
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`
}

export const PRIVACY_SUMMARY = `Vibefuel privacy summary (terminal plugin)

Collected
  - An anonymous device id
  - Ad events: impression, click, dismiss, with ad id, timestamp and a per-session id
  - Client name and version (Claude Code) and the plugin version

Never collected
  - File contents, file names, project names or paths
  - Prompts, chat messages, transcripts or AI completions
  - Keystrokes or clipboard
  - Git remotes or identities

Rules
  - The Stop hook reads only session_id and agent_id from the hook input. It never reads the transcript.
  - A terminal impression counts when the sponsored line is displayed. There is no view timer in a terminal.
  - Links are tracked by a redirect, so a click can be rewarded without any script in your terminal.
  - At most one sponsored line per 30 minutes, none in the first 10 minutes of a session, never mid-task, never inside subagents.
  - /vibefuel:optout deletes ~/.vibefuel entirely.
  - In mock mode (no API URL set) nothing is sent anywhere; events go to ~/.vibefuel/log.txt.`
