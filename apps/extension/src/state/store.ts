import type * as vscode from "vscode"
import type { Ad, Me } from "@workspace/vibefuel-core"

export interface CurrentAd {
  ad: Ad
  deliveredAt: number
  impressionCounted: boolean
}

const KEYS = {
  lastDeliveredAt: "vibefuel.lastDeliveredAt",
  currentAd: "vibefuel.currentAd",
  paused: "vibefuel.paused",
  me: "vibefuel.me",
  onboardingSeen: "vibefuel.onboardingSeen",
} as const

const SECRETS = {
  accessToken: "vibefuel.serialKey",
} as const

/**
 * Typed wrapper over globalState and SecretStorage. Only the serial key goes
 * to SecretStorage; nothing about the workspace is stored anywhere.
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

  get me(): Me | null {
    return this.globalState.get<Me | null>(KEYS.me, null)
  }
  setMe(value: Me | null): Thenable<void> {
    return this.globalState.update(KEYS.me, value)
  }

  getAccessToken(): Thenable<string | undefined> {
    return this.secrets.get(SECRETS.accessToken)
  }
  async setAccessToken(value: string | null): Promise<void> {
    if (value === null) await this.secrets.delete(SECRETS.accessToken)
    else await this.secrets.store(SECRETS.accessToken, value)
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
