import {
  ApiRequestError,
  ApiUnavailableError,
  EventBatcher,
  HttpAdapter,
  MOCK_ADS,
  MockAdapter,
  UnauthorizedError,
  describeWalletError,
  evaluatePolicy,
  shortenAddress,
  validateAd,
  validateSerialKey,
  validateSolanaAddress,
  type Balance,
  type Me,
  type PolicyDecision,
  type VibefuelApi,
} from "@workspace/vibefuel-core"
import * as vscode from "vscode"
import { ImpressionTracker } from "./ads/impression"
import {
  eventsAllowed,
  readConfig,
  setEnabled,
  type VibefuelConfig,
} from "./config"
import {
  FETCH_BACKOFF_MS,
  HEARTBEAT_INTERVAL_MS,
  LANDING_URL,
  PRIVACY_URL,
  SCHEDULER_TICK_MS,
  START_URL,
} from "./constants"
import type { Session } from "./state/session"
import { Store } from "./state/store"
import type { FeedState, FromWebview } from "./webview/messages"

export interface ControllerHost {
  extensionUri: vscode.Uri
  globalState: vscode.Memento
  secrets: vscode.SecretStorage
  output: vscode.OutputChannel
  session: Session
}

/**
 * Owns all runtime state. The webview, status bar and commands are thin
 * views over this class. Nothing here touches editor text, chat or terminal.
 */
export class Controller implements vscode.Disposable {
  private config: VibefuelConfig
  private api!: VibefuelApi
  private readonly store: Store
  private readonly impressions: ImpressionTracker
  private batcher!: EventBatcher
  private readonly onChangeEmitter = new vscode.EventEmitter<void>()
  readonly onDidChange = this.onChangeEmitter.event
  private readonly disposables: vscode.Disposable[] = []

  private offline = false
  private signedIn = false
  private signingIn = false
  private me: Me | null = null
  private tick: NodeJS.Timeout | null = null
  private heartbeat: NodeJS.Timeout | null = null
  private focusedSince: number | null = null
  private nextFetchNotBefore = 0
  private lastDecision: PolicyDecision = {
    allowed: false,
    reason: "disabled",
    retryAt: null,
  }
  private dismissed = new Set<string>()

  constructor(private readonly host: ControllerHost) {
    this.config = readConfig()
    this.store = new Store(host.globalState, host.secrets)
    this.impressions = new ImpressionTracker({
      onImpression: (adId) => void this.onImpression(adId),
    })
    this.rebuildApi()
    this.rebuildBatcher()

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("vibefuel")) void this.onConfigChanged()
      }),
      vscode.window.onDidChangeWindowState((state) => {
        this.impressions.setFocused(state.focused)
        this.focusedSince = state.focused ? Date.now() : null
        this.evaluate()
      }),
      vscode.debug.onDidStartDebugSession(() => this.evaluate()),
      vscode.debug.onDidTerminateDebugSession(() => this.evaluate()),
      vscode.env.onDidChangeTelemetryEnabled(() => this.changed())
    )
    this.impressions.setFocused(vscode.window.state.focused)
    this.focusedSince = vscode.window.state.focused ? Date.now() : null
  }

  // ---------------------------------------------------------------- lifecycle

  async start(): Promise<void> {
    this.me = this.store.me
    await this.syncContextKeys()
    if (this.config.enabled) await this.ensureSignedIn()
    this.tick = setInterval(() => void this.onTick(), SCHEDULER_TICK_MS)
    this.heartbeat = setInterval(
      () => void this.onHeartbeat(),
      HEARTBEAT_INTERVAL_MS
    )
    void this.onTick()
    this.changed()
  }

  dispose(): void {
    if (this.tick) clearInterval(this.tick)
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.impressions.dispose()
    this.batcher.dispose()
    this.onChangeEmitter.dispose()
    for (const d of this.disposables) d.dispose()
  }

  // ------------------------------------------------------------------ state

  get currentConfig(): VibefuelConfig {
    return this.config
  }

  get isOffline(): boolean {
    return this.offline
  }

  get newMessageWaiting(): boolean {
    const current = this.store.currentAd
    return (
      !!current &&
      !current.impressionCounted &&
      !this.dismissed.has(current.ad.id)
    )
  }

  get balance(): Balance | null {
    return this.me?.balance ?? null
  }

  get walletLinked(): boolean {
    return !!this.me?.wallet_address
  }

  getFeedState(): FeedState {
    const current = this.store.currentAd
    const showAd =
      current && !this.dismissed.has(current.ad.id) ? current : null
    const screen: FeedState["screen"] = !this.config.enabled
      ? "onboarding"
      : this.signedIn
        ? "feed"
        : "signin"
    return {
      screen,
      mode: this.api.mode,
      version: this.host.session.client.extension_version,
      enabled: this.config.enabled,
      paused: this.store.paused,
      ad: showAd?.ad ?? null,
      adDeliveredAt: showAd?.deliveredAt ?? null,
      impressionCounted: showAd?.impressionCounted ?? false,
      balance: this.balance,
      keyPrefix: this.me?.key_prefix ?? null,
      wallet: this.me?.wallet_address
        ? shortenAddress(this.me.wallet_address)
        : null,
      signingIn: this.signingIn,
      offline: this.offline,
      eventsBlocked: !vscode.env.isTelemetryEnabled
        ? "editor"
        : this.config.telemetry
          ? null
          : "setting",
      blockReason: this.lastDecision.allowed ? null : this.lastDecision.reason,
      nextEligibleAt: this.lastDecision.allowed
        ? null
        : this.lastDecision.retryAt,
      landingUrl: LANDING_URL,
      startUrl: START_URL,
    }
  }

  onViewVisibilityChanged(visible: boolean): void {
    this.impressions.setVisible(visible)
    if (visible) void this.refreshMe()
  }

  // --------------------------------------------------------------- messages

  async handleMessage(message: FromWebview): Promise<void> {
    switch (message.type) {
      case "ready":
      case "refresh":
        this.evaluate()
        return
      case "optIn":
        await this.optIn()
        return
      case "optOut":
        await this.optOut()
        return
      case "pause":
        await this.setPaused(true)
        return
      case "resume":
        await this.setPaused(false)
        return
      case "cta":
        await this.clickCta(message.adId)
        return
      case "dismiss":
        await this.dismiss(message.adId)
        return
      case "signIn":
        await this.signIn()
        return
      case "getKey":
        await vscode.env.openExternal(vscode.Uri.parse(START_URL))
        return
      case "linkWallet":
        await this.linkWallet()
        return
      case "unlinkWallet":
        await this.unlinkWallet()
        return
      case "signOut":
        await this.signOut()
        return
      case "openLanding":
        await vscode.env.openExternal(vscode.Uri.parse(LANDING_URL))
        return
      case "openPrivacy":
        await vscode.env.openExternal(vscode.Uri.parse(PRIVACY_URL))
        return
      case "openDashboard":
        await vscode.env.openExternal(
          vscode.Uri.parse(`${LANDING_URL}/dashboard`)
        )
        return
    }
  }

  // ---------------------------------------------------------------- actions

  async optIn(): Promise<void> {
    await setEnabled(true)
    this.config = readConfig()
    await this.store.setPaused(false)
    await this.syncContextKeys()
    await this.ensureSignedIn()
    this.evaluate()
  }

  /** One click, clears everything Vibefuel stored. */
  async optOut(): Promise<void> {
    this.batcher.clear()
    this.impressions.reset()
    this.dismissed.clear()
    this.signedIn = false
    this.me = null
    this.offline = false
    await this.store.clearAll()
    if (this.api instanceof MockAdapter) await this.api.reset()
    await setEnabled(false)
    this.config = readConfig()
    await this.syncContextKeys()
    this.evaluate()
    this.log("Opted out. Local state cleared.")
  }

  async setPaused(paused: boolean): Promise<void> {
    await this.store.setPaused(paused)
    await this.syncContextKeys()
    this.evaluate()
  }

  async clickCta(adId: string): Promise<void> {
    const current = this.store.currentAd
    if (!current || current.ad.id !== adId) return
    this.batcher.track("click", adId)
    await vscode.env.openExternal(vscode.Uri.parse(current.ad.cta_url))
    this.changed()
  }

  async dismiss(adId: string): Promise<void> {
    const current = this.store.currentAd
    if (!current || current.ad.id !== adId) return
    this.dismissed.add(adId)
    this.batcher.track("dismiss", adId)
    this.impressions.setAd(null)
    await this.store.setCurrentAd(null)
    this.evaluate()
  }

  /**
   * Sign in with a serial key from vibefuel.app. In mock mode the key is not
   * needed: the mock adapter accepts the device as is.
   */
  async signIn(): Promise<void> {
    if (!this.config.enabled) return
    if (this.api.mode === "mock") {
      await this.store.setAccessToken("VF-MOCK-MOCK-MOCK-MOCK")
      await this.finishSignIn()
      return
    }
    const value = await vscode.window.showInputBox({
      title: "Sign in to Vibefuel",
      prompt: `Paste the Vibefuel key from ${LANDING_URL}. It links this editor to your dashboard.`,
      placeHolder: "VF-XXXX-XXXX-XXXX-XXXX",
      ignoreFocusOut: true,
      password: true,
      validateInput: (text) => {
        const result = validateSerialKey(text)
        return result.ok ? null : result.message
      },
    })
    if (value === undefined) return
    const result = validateSerialKey(value)
    if (!result.ok) return
    await this.store.setAccessToken(result.key)
    await this.finishSignIn()
  }

  private async ensureSignedIn(): Promise<void> {
    if (!this.config.enabled) return
    if (await this.store.getAccessToken()) await this.finishSignIn()
  }

  /** Verify the stored key against the API and load the account summary. */
  private async finishSignIn(): Promise<void> {
    this.signingIn = true
    this.changed()
    try {
      const me = await this.api.me()
      this.me = me
      await this.store.setMe(me)
      this.signedIn = true
      this.setOffline(false)
      this.log(`Signed in as ${me.key_prefix} (${this.api.mode} mode).`)
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await this.store.setAccessToken(null)
        this.signedIn = false
        this.me = null
        void vscode.window.showWarningMessage(
          "Vibefuel: that key was not accepted. Create one at vibefuel.app and try again."
        )
      } else if (error instanceof ApiUnavailableError) {
        // Keep the key; treat the device as signed in with cached data and retry later.
        this.signedIn = true
        this.setOffline(true)
        this.log(`Could not verify the key right now: ${error.message}`)
      } else {
        this.log(`Sign-in failed: ${describe(error)}`)
      }
    } finally {
      this.signingIn = false
      await this.syncContextKeys()
      this.evaluate()
    }
  }

  async linkWallet(): Promise<void> {
    const value = await vscode.window.showInputBox({
      title: "Link Solana wallet",
      prompt:
        "Paste your Solana public address (the address you share to receive funds).",
      placeHolder: "32 to 44 base58 characters",
      ignoreFocusOut: true,
      validateInput: (text) => {
        const result = validateSolanaAddress(text)
        return result.ok ? null : describeWalletError(result.reason)
      },
    })
    if (value === undefined) return
    const result = validateSolanaAddress(value)
    if (!result.ok) return
    try {
      await this.api.linkWallet(result.address)
      this.setOffline(false)
      await this.refreshMe()
      void vscode.window.showInformationMessage(
        `Vibefuel: wallet ${shortenAddress(result.address)} linked.`
      )
    } catch (error) {
      if (error instanceof ApiRequestError) {
        void vscode.window.showWarningMessage(`Vibefuel: ${error.message}`)
      } else {
        this.handleApiError(error, "link wallet")
        void vscode.window.showWarningMessage(
          "Vibefuel: could not reach the API. Try again in a moment."
        )
      }
    }
  }

  async unlinkWallet(): Promise<void> {
    try {
      await this.api.unlinkWallet()
      this.setOffline(false)
      await this.refreshMe()
    } catch (error) {
      this.handleApiError(error, "unlink wallet")
    }
  }

  async signOut(): Promise<void> {
    this.batcher.clear()
    this.signedIn = false
    this.me = null
    await this.store.setAccessToken(null)
    await this.store.setMe(null)
    await this.syncContextKeys()
    this.log("Signed out.")
    this.evaluate()
  }

  // -------------------------------------------------------------- delivery

  private policyInput() {
    return {
      now: Date.now(),
      sessionStartedAt: this.host.session.startedAt,
      lastDeliveredAt: this.store.lastDeliveredAt,
      enabled: this.config.enabled && this.signedIn,
      paused: this.store.paused,
      debugActive: vscode.debug.activeDebugSession !== undefined,
      windowFocused: vscode.window.state.focused,
      frequencyMinutes: this.config.frequencyMinutes,
      quietPeriodMinutes: this.config.quietPeriodMinutes,
    }
  }

  /** Re-run the policy and notify views. Cheap; safe to call often. */
  private evaluate(): void {
    this.lastDecision = evaluatePolicy(this.policyInput())
    const current = this.store.currentAd
    this.impressions.setAd(
      current &&
        !this.dismissed.has(current.ad.id) &&
        this.config.enabled &&
        !this.store.paused
        ? current.ad.id
        : null
    )
    this.changed()
  }

  private async onTick(): Promise<void> {
    this.evaluate()
    if (this.config.enabled && !this.signedIn && !this.signingIn) {
      // A key is stored but the last verification failed offline: retry quietly.
      if (await this.store.getAccessToken()) await this.ensureSignedIn()
    }
    if (!this.lastDecision.allowed) return
    if (Date.now() < this.nextFetchNotBefore) return
    await this.fetchNextAd()
    await this.batcher.flush()
  }

  /** Active editor time while focused, sent about once a minute. */
  private async onHeartbeat(): Promise<void> {
    if (!this.config.enabled || !this.signedIn || !eventsAllowed(this.config))
      return
    if (!vscode.window.state.focused || this.focusedSince === null) return
    const seconds = Math.min(
      600,
      Math.round((Date.now() - this.focusedSince) / 1000)
    )
    this.focusedSince = Date.now()
    if (seconds <= 0) return
    try {
      await this.api.heartbeat(seconds)
      this.setOffline(false)
    } catch (error) {
      this.handleApiError(error, "send heartbeat")
    }
  }

  private async fetchNextAd(): Promise<void> {
    try {
      const raw = await this.api.getNextAd(this.host.session.id)
      this.setOffline(false)
      if (raw === null) {
        this.nextFetchNotBefore = Date.now() + FETCH_BACKOFF_MS
        this.log("No eligible sponsored message right now.")
        return
      }
      const ad = validateAd(raw)
      if (!ad) {
        this.nextFetchNotBefore = Date.now() + FETCH_BACKOFF_MS
        this.log(
          `Dropped an ad that failed validation (${String((raw as { id?: string }).id)}).`
        )
        return
      }
      const now = Date.now()
      await this.store.setCurrentAd({
        ad,
        deliveredAt: now,
        impressionCounted: false,
      })
      await this.store.setLastDeliveredAt(now)
      this.log(`Delivered sponsored message ${ad.id} from ${ad.advertiser}.`)
      this.evaluate()
    } catch (error) {
      this.nextFetchNotBefore = Date.now() + FETCH_BACKOFF_MS
      this.handleApiError(error, "fetch next ad")
    }
  }

  private async onImpression(adId: string): Promise<void> {
    const current = this.store.currentAd
    if (!current || current.ad.id !== adId) return
    await this.store.setCurrentAd({ ...current, impressionCounted: true })
    const tracked = this.batcher.track("impression", adId)
    this.log(
      tracked
        ? `Impression counted for ${adId} (${current.ad.reward_tokens} tokens).`
        : `Impression for ${adId} not reported: events are disabled.`
    )
    await this.batcher.flush()
    this.changed()
  }

  // ---------------------------------------------------------------- helpers

  private async refreshMe(): Promise<void> {
    if (!this.signedIn) return
    try {
      const me = await this.api.me()
      this.me = me
      await this.store.setMe(me)
      this.setOffline(false)
      await this.syncContextKeys()
      this.changed()
    } catch (error) {
      this.handleApiError(error, "refresh account")
    }
  }

  private async onConfigChanged(): Promise<void> {
    const previous = this.config
    this.config = readConfig()
    if (previous.apiBaseUrl !== this.config.apiBaseUrl) {
      this.log(
        `API changed to ${this.config.apiBaseUrl || "mock"}; signing out.`
      )
      this.rebuildApi()
      this.rebuildBatcher()
      await this.signOut()
      await this.store.setCurrentAd(null)
    }
    if (previous.enabled !== this.config.enabled) {
      if (this.config.enabled) await this.ensureSignedIn()
      else this.batcher.clear()
    }
    await this.syncContextKeys()
    this.evaluate()
  }

  private rebuildApi(): void {
    const baseUrl = this.config.apiBaseUrl
    if (baseUrl) {
      this.api = new HttpAdapter({
        baseUrl,
        client: this.host.session.client,
        tokens: {
          getToken: () => Promise.resolve(this.store.getAccessToken()),
        },
      })
    } else {
      this.api = new MockAdapter(
        [...MOCK_ADS],
        this.host.globalState,
        this.host.output
      )
    }
  }

  private rebuildBatcher(): void {
    this.batcher?.dispose()
    this.batcher = new EventBatcher({
      sink: { postEvents: (events) => this.api.postEvents(events) },
      sessionId: this.host.session.id,
      isEnabled: () => this.config.enabled && eventsAllowed(this.config),
      onFlushed: (result) => {
        this.setOffline(false)
        if (this.me) {
          this.me = {
            ...this.me,
            balance: result.balance,
            earned: this.me.earned + result.rewarded,
          }
          void this.store.setMe(this.me).then(() => this.changed())
        } else {
          void this.refreshMe()
        }
      },
      onError: (error) => this.handleApiError(error, "send events"),
    })
  }

  private handleApiError(error: unknown, action: string): void {
    if (error instanceof UnauthorizedError) {
      this.log(`Serial key rejected while trying to ${action}; signing out.`)
      void this.signOut()
      return
    }
    if (error instanceof ApiUnavailableError) {
      this.setOffline(true)
      this.log(`Offline while trying to ${action}: ${error.message}`)
      return
    }
    this.log(`Failed to ${action}: ${describe(error)}`)
  }

  private setOffline(offline: boolean): void {
    if (this.offline === offline) return
    this.offline = offline
    this.changed()
  }

  private async syncContextKeys(): Promise<void> {
    await vscode.commands.executeCommand(
      "setContext",
      "vibefuel.enabled",
      this.config.enabled
    )
    await vscode.commands.executeCommand(
      "setContext",
      "vibefuel.paused",
      this.store.paused
    )
    await vscode.commands.executeCommand(
      "setContext",
      "vibefuel.signedIn",
      this.signedIn
    )
    await vscode.commands.executeCommand(
      "setContext",
      "vibefuel.walletLinked",
      this.walletLinked
    )
  }

  private changed(): void {
    this.onChangeEmitter.fire()
  }

  private log(line: string): void {
    this.host.output.appendLine(`${new Date().toISOString()} ${line}`)
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
