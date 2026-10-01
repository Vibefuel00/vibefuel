import type { VibefuelApi } from "./client"
import type {
  Ad,
  AdEvent,
  Balance,
  EventBatchResult,
  Me,
  Wallet,
} from "./types"

/** Minimal key/value persistence so the mock adapter does not import vscode. */
export interface MockStorage {
  get<T>(key: string): T | undefined
  update(key: string, value: unknown): PromiseLike<void>
}

export interface MockLogger {
  appendLine(line: string): void
}

interface Credit {
  ad_id: string
  tokens: number
  at: number
}

const KEY_INDEX = "mock.adIndex"
const KEY_CREDITS = "mock.credits"
const KEY_PAID = "mock.paid"
const KEY_SEEN_EVENTS = "mock.seenEvents"
const KEY_WALLET = "mock.wallet"
const KEY_ACTIVE = "mock.activeSeconds"
const KEY_LAST_REWARD = "mock.lastReward"
/** Mirrors the server: one rewarded impression per campaign per developer per 6 hours. */
const REWARD_COOLDOWN_MS = 6 * 60 * 60_000
/** Credits "pay out" after this long so both balance figures move. */
const PAYOUT_AFTER_MS = 10 * 60_000
const CURRENCY = "tokens"
export const MOCK_KEY_PREFIX = "VF-MOCK"

/**
 * Serves a rotating set of fictional ads, keeps the balance in the storage it
 * is given, and logs every event to the logger. Any key is accepted.
 */
export class MockAdapter implements VibefuelApi {
  readonly mode = "mock" as const

  constructor(
    private readonly ads: Ad[],
    private readonly storage: MockStorage,
    private readonly log: MockLogger,
    private readonly now: () => number = () => Date.now()
  ) {}

  async me(): Promise<Me> {
    const balance = await this.balance()
    const wallet = this.storage.get<Wallet>(KEY_WALLET)
    const credits = this.storage.get<Credit[]>(KEY_CREDITS) ?? []
    const paid = this.storage.get<number>(KEY_PAID) ?? 0
    return {
      developer_id: "mock-developer",
      key_prefix: MOCK_KEY_PREFIX,
      wallet_address: wallet?.address ?? null,
      balance,
      earned: paid + credits.reduce((s, c) => s + c.tokens, 0),
      active_seconds: this.storage.get<number>(KEY_ACTIVE) ?? 0,
    }
  }

  async heartbeat(activeSeconds: number): Promise<void> {
    const total =
      (this.storage.get<number>(KEY_ACTIVE) ?? 0) + Math.max(0, activeSeconds)
    await this.storage.update(KEY_ACTIVE, total)
    this.log.appendLine(`[mock] heartbeat +${activeSeconds}s (total ${total}s)`)
  }

  async getNextAd(sessionId: string): Promise<Ad | null> {
    if (this.ads.length === 0) return null
    const index = this.storage.get<number>(KEY_INDEX) ?? 0
    const ad = this.ads[index % this.ads.length]
    await this.storage.update(KEY_INDEX, (index + 1) % this.ads.length)
    if (!ad) return null
    const fresh: Ad = {
      ...ad,
      expires_at: new Date(this.now() + 24 * 60 * 60_000).toISOString(),
    }
    this.log.appendLine(
      `[mock] ads/next → ${fresh.id} (${fresh.advertiser}) for session ${sessionId.slice(0, 8)}`
    )
    return fresh
  }

  async postEvents(events: AdEvent[]): Promise<EventBatchResult> {
    const seen = new Set(this.storage.get<string[]>(KEY_SEEN_EVENTS) ?? [])
    const credits = this.storage.get<Credit[]>(KEY_CREDITS) ?? []
    const lastReward =
      this.storage.get<Record<string, number>>(KEY_LAST_REWARD) ?? {}
    let accepted = 0
    let rewarded = 0
    for (const event of events) {
      const duplicate = seen.has(event.id)
      this.log.appendLine(
        `[mock] event ${event.type} ad=${event.ad_id} at=${event.occurred_at}${duplicate ? " (duplicate, ignored)" : ""}`
      )
      if (duplicate) continue
      seen.add(event.id)
      accepted++
      if (event.type === "impression") {
        const ad = this.ads.find((a) => a.id === event.ad_id)
        const last = lastReward[event.ad_id] ?? -Infinity
        if (ad && this.now() - last >= REWARD_COOLDOWN_MS) {
          credits.push({
            ad_id: ad.id,
            tokens: ad.reward_tokens,
            at: this.now(),
          })
          lastReward[event.ad_id] = this.now()
          rewarded += ad.reward_tokens
          this.log.appendLine(`[mock] credited ${ad.reward_tokens} ${CURRENCY}`)
        } else if (ad) {
          this.log.appendLine(
            `[mock] impression not rewarded: ${ad.id} rewarded within the last 6 hours`
          )
        }
      }
    }
    await this.storage.update(KEY_SEEN_EVENTS, [...seen].slice(-1000))
    await this.storage.update(KEY_CREDITS, credits)
    await this.storage.update(KEY_LAST_REWARD, lastReward)
    return { accepted, rewarded, balance: await this.balance() }
  }

  async linkWallet(address: string): Promise<Wallet> {
    const wallet: Wallet = {
      address,
      linked_at: new Date(this.now()).toISOString(),
    }
    await this.storage.update(KEY_WALLET, wallet)
    this.log.appendLine(`[mock] wallet linked ${address.slice(0, 4)}…`)
    return wallet
  }

  async unlinkWallet(): Promise<void> {
    await this.storage.update(KEY_WALLET, undefined)
    this.log.appendLine("[mock] wallet unlinked")
  }

  /** Clears everything the mock accumulated. Used on opt-out. */
  async reset(): Promise<void> {
    for (const key of [
      KEY_INDEX,
      KEY_CREDITS,
      KEY_PAID,
      KEY_SEEN_EVENTS,
      KEY_WALLET,
      KEY_ACTIVE,
      KEY_LAST_REWARD,
    ]) {
      await this.storage.update(key, undefined)
    }
  }

  private async balance(): Promise<Balance> {
    const credits = this.storage.get<Credit[]>(KEY_CREDITS) ?? []
    let paid = this.storage.get<number>(KEY_PAID) ?? 0
    const cutoff = this.now() - PAYOUT_AFTER_MS
    const open: Credit[] = []
    for (const credit of credits) {
      if (credit.at <= cutoff) paid += credit.tokens
      else open.push(credit)
    }
    if (open.length !== credits.length) {
      await this.storage.update(KEY_CREDITS, open)
      await this.storage.update(KEY_PAID, paid)
    }
    return {
      pending: open.reduce((sum, c) => sum + c.tokens, 0),
      settled: paid,
      currency: CURRENCY,
      updated_at: new Date(this.now()).toISOString(),
    }
  }
}
