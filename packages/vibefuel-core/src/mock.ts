import { randomUUID } from "node:crypto"
import type { PollResult, VibefuelApi } from "./client"
import type {
  Ad,
  AdEvent,
  Balance,
  DeviceAuthResponse,
  EventBatchResult,
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
const KEY_SETTLED = "mock.settled"
const KEY_SEEN_EVENTS = "mock.seenEvents"
const KEY_WALLET = "mock.wallet"
const KEY_DEVICE_ID = "mock.deviceId"
/** Pending credits settle after this long, to make both balances move. */
const SETTLE_AFTER_MS = 10 * 60_000
const CURRENCY = "FUEL"

/**
 * Serves a rotating set of fictional ads from `media/mock-ads.json`, keeps the
 * balance in the storage it is given, and logs every event to the logger.
 */
export class MockAdapter implements VibefuelApi {
  readonly mode = "mock" as const

  constructor(
    private readonly ads: Ad[],
    private readonly storage: MockStorage,
    private readonly log: MockLogger,
    private readonly now: () => number = () => Date.now()
  ) {}

  startDeviceAuth(): Promise<DeviceAuthResponse> {
    this.log.appendLine("[mock] device auth started (auto-approved locally)")
    return Promise.resolve({
      device_code: `mock-${randomUUID()}`,
      user_code: "MOCK-MODE",
      verification_uri: "https://localhost/mock-verification",
      expires_in: 600,
      interval: 1,
    })
  }

  async pollDeviceToken(deviceCode: string): Promise<PollResult> {
    let deviceId = this.storage.get<string>(KEY_DEVICE_ID)
    if (!deviceId) {
      deviceId = randomUUID()
      await this.storage.update(KEY_DEVICE_ID, deviceId)
    }
    this.log.appendLine(`[mock] token issued for ${deviceCode.slice(0, 12)}…`)
    return {
      status: "ok",
      token: {
        access_token: `mock-token-${deviceId}`,
        token_type: "Bearer",
        device_id: deviceId,
      },
    }
  }

  async getNextAd(sessionId: string): Promise<Ad | null> {
    if (this.ads.length === 0) return null
    const index = this.storage.get<number>(KEY_INDEX) ?? 0
    const ad = this.ads[index % this.ads.length]
    await this.storage.update(KEY_INDEX, (index + 1) % this.ads.length)
    if (!ad) return null
    // Mock ads never expire; refresh the timestamp so validation passes.
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
    for (const event of events) {
      const duplicate = seen.has(event.id)
      this.log.appendLine(
        `[mock] event ${event.type} ad=${event.ad_id} at=${event.occurred_at}${duplicate ? " (duplicate, ignored)" : ""}`
      )
      if (duplicate) continue
      seen.add(event.id)
      if (event.type === "impression") {
        const ad = this.ads.find((a) => a.id === event.ad_id)
        if (ad) {
          credits.push({
            ad_id: ad.id,
            tokens: ad.reward_tokens,
            at: this.now(),
          })
          this.log.appendLine(`[mock] credited ${ad.reward_tokens} ${CURRENCY}`)
        }
      }
    }
    await this.storage.update(KEY_SEEN_EVENTS, [...seen].slice(-1000))
    await this.storage.update(KEY_CREDITS, credits)
    const balance = await this.getBalance()
    return { accepted: events.length, balance }
  }

  async getBalance(): Promise<Balance> {
    const credits = this.storage.get<Credit[]>(KEY_CREDITS) ?? []
    let settled = this.storage.get<number>(KEY_SETTLED) ?? 0
    const cutoff = this.now() - SETTLE_AFTER_MS
    const stillPending: Credit[] = []
    for (const credit of credits) {
      if (credit.at <= cutoff) settled += credit.tokens
      else stillPending.push(credit)
    }
    if (stillPending.length !== credits.length) {
      await this.storage.update(KEY_CREDITS, stillPending)
      await this.storage.update(KEY_SETTLED, settled)
    }
    const pending = stillPending.reduce((sum, c) => sum + c.tokens, 0)
    return {
      pending,
      settled,
      currency: CURRENCY,
      updated_at: new Date(this.now()).toISOString(),
    }
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
      KEY_SETTLED,
      KEY_SEEN_EVENTS,
      KEY_WALLET,
      KEY_DEVICE_ID,
    ]) {
      await this.storage.update(key, undefined)
    }
  }
}
