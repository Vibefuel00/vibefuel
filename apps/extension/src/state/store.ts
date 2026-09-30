import type * as vscode from "vscode"
import type { Ad, Balance } from "../api/types"

export interface PendingAuth {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_at: number
  interval_ms: number
}

export interface CurrentAd {
  ad: Ad
  deliveredAt: number
  impressionCounted: boolean
}

const KEYS = {
  lastDeliveredAt: "vibefuel.lastDeliveredAt",
  currentAd: "vibefuel.currentAd",
  paused: "vibefuel.paused",
  deviceId: "vibefuel.deviceId",
  balance: "vibefuel.balance",
  pendingAuth: "vibefuel.pendingAuth",
  walletSyncPending: "vibefuel.walletSyncPending",
  onboardingSeen: "vibefuel.onboardingSeen",
} as const

const SECRETS = {
  accessToken: "vibefuel.accessToken",
  walletAddress: "vibefuel.walletAddress",
} as const

/**
 * Typed wrapper over globalState and SecretStorage. Only the public wallet
 * address and the device token ever go to SecretStorage; nothing about the
 * workspace is stored anywhere.
 */
export class Store {
  constructor(
    private readonly globalState: vscode.Memento,
    private readonly secrets: vscode.SecretStorage
  ) {}

  get lastDeliveredAt(): number | null {
    return this.globalState.get<number | null>(KEYS.lastDeliveredAt, null)
  }
  setLastDeliveredAt(value: number | null): Thenable<void> {
    return this.globalState.update(KEYS.lastDeliveredAt, value)
  }

  get currentAd(): CurrentAd | null {
    return this.globalState.get<CurrentAd | null>(KEYS.currentAd, null)
  }
  setCurrentAd(value: CurrentAd | null): Thenable<void> {
    return this.globalState.update(KEYS.currentAd, value)
  }

  get paused(): boolean {
    return this.globalState.get<boolean>(KEYS.paused, false)
  }
  setPaused(value: boolean): Thenable<void> {
    return this.globalState.update(KEYS.paused, value)
  }

  get deviceId(): string | null {
    return this.globalState.get<string | null>(KEYS.deviceId, null)
  }
  setDeviceId(value: string | null): Thenable<void> {
    return this.globalState.update(KEYS.deviceId, value)
  }

  get balance(): Balance | null {
    return this.globalState.get<Balance | null>(KEYS.balance, null)
  }
  setBalance(value: Balance | null): Thenable<void> {
    return this.globalState.update(KEYS.balance, value)
  }

  get pendingAuth(): PendingAuth | null {
    return this.globalState.get<PendingAuth | null>(KEYS.pendingAuth, null)
  }
  setPendingAuth(value: PendingAuth | null): Thenable<void> {
    return this.globalState.update(KEYS.pendingAuth, value)
  }

  get walletSyncPending(): boolean {
    return this.globalState.get<boolean>(KEYS.walletSyncPending, false)
  }
  setWalletSyncPending(value: boolean): Thenable<void> {
    return this.globalState.update(KEYS.walletSyncPending, value)
  }

  getAccessToken(): Thenable<string | undefined> {
    return this.secrets.get(SECRETS.accessToken)
  }
  async setAccessToken(value: string | null): Promise<void> {
    if (value === null) await this.secrets.delete(SECRETS.accessToken)
    else await this.secrets.store(SECRETS.accessToken, value)
  }

  getWalletAddress(): Thenable<string | undefined> {
    return this.secrets.get(SECRETS.walletAddress)
  }
  async setWalletAddress(value: string | null): Promise<void> {
    if (value === null) await this.secrets.delete(SECRETS.walletAddress)
    else await this.secrets.store(SECRETS.walletAddress, value)
  }

  /** Wipe everything Vibefuel stored. Used on opt-out. */
  async clearAll(): Promise<void> {
    for (const key of Object.values(KEYS)) {
      await this.globalState.update(key, undefined)
    }
    for (const key of Object.values(SECRETS)) {
      await this.secrets.delete(key)
    }
  }
}
