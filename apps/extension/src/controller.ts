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
  validateSolanaAddress,
  type Balance,
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
  LANDING_URL,
  PRIVACY_URL,
  SCHEDULER_TICK_MS,
} from "./constants"
import type { Session } from "./state/session"
import { Store, type PendingAuth } from "./state/store"
import type { AuthView, FeedState, FromWebview } from "./webview/messages"

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

  private viewVisible = false
  private offline = false
  private signedIn = false
  private authView: AuthView | null = null
  private authPoll: NodeJS.Timeout | null = null
  private tick: NodeJS.Timeout | null = null
  private nextFetchNotBefore = 0
  private nextAuthRetryAt = 0
  private lastDecision: PolicyDecision = {
    allowed: false,
    reason: "disabled",
    retryAt: null,
  }
  private walletCache: string | null = null
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
        this.evaluate()
      }),
      vscode.debug.onDidStartDebugSession(() => this.evaluate()),
      vscode.debug.onDidTerminateDebugSession(() => this.evaluate()),
      vscode.env.onDidChangeTelemetryEnabled(() => this.changed())
    )
    this.impressions.setFocused(vscode.window.state.focused)
  }

  // ---------------------------------------------------------------- lifecycle

  async start(): Promise<void> {
    this.walletCache = (await this.store.getWalletAddress()) ?? null
    await this.syncContextKeys()
    if (this.config.enabled) {
      await this.ensureSignedIn()
    }
    this.tick = setInterval(() => void this.onTick(), SCHEDULER_TICK_MS)
    void this.onTick()
    this.changed()
  }

  dispose(): void {
    if (this.tick) clearInterval(this.tick)
    this.stopAuthPolling()
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
    return this.store.balance
  }

  get walletLinked(): boolean {
    return this.walletCache !== null
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
      balance: this.store.balance,
      wallet: this.walletCache ? shortenAddress(this.walletCache) : null,
      walletSyncPending: this.store.walletSyncPending,
      auth: this.authView,
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
    }
  }

  onViewVisibilityChanged(visible: boolean): void {
    this.viewVisible = visible
    this.impressions.setVisible(visible)
    if (visible) void this.refreshBalance()
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
      case "restartAuth":
        await this.ensureSignedIn(true)
        return
      case "openVerification":
        if (this.authView) {
          await vscode.env.openExternal(
            vscode.Uri.parse(this.authView.verificationUri)
          )
        }
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
    }
  }

  // ---------------------------------------------------------------- actions

  async optIn(): Promise<void> {
    await setEnabled(true)
    // onDidChangeConfiguration will pick this up, but do it now for snappiness.
    this.config = readConfig()
    await this.store.setPaused(false)
    await this.syncContextKeys()
    await this.ensureSignedIn()
    this.evaluate()
  }

  /** One click, clears everything Vibefuel stored. */
  async optOut(): Promise<void> {
    this.stopAuthPolling()
    this.batcher.clear()
    this.impressions.reset()
    this.dismissed.clear()
    this.signedIn = false
    this.authView = null
    this.offline = false
    await this.store.clearAll()
    if (this.api instanceof MockAdapter) await this.api.reset()
    this.walletCache = null
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

  async linkWallet(): Promise<void> {
    const value = await vscode.window.showInputBox({
      title: "Link Solana wallet",
      prompt:
        "Paste your Solana public address. Never paste a private key or seed phrase; Vibefuel will never ask for one.",
      placeHolder: "e.g. 7xKX…  (32 to 44 base58 characters)",
      ignoreFocusOut: true,
      validateInput: (text) => {
        const result = validateSolanaAddress(text)
        return result.ok ? null : describeWalletError(result.reason)
      },
    })
    if (value === undefined) return
    const result = validateSolanaAddress(value)
    if (!result.ok) return
    await this.store.setWalletAddress(result.address)
    this.walletCache = result.address
    await this.syncWallet()
    await this.syncContextKeys()
    this.changed()
  }

  async unlinkWallet(): Promise<void> {
    await this.store.setWalletAddress(null)
    this.walletCache = null
    await this.store.setWalletSyncPending(false)
    if (this.signedIn) {
      try {
        await this.api.unlinkWallet()
        this.setOffline(false)
      } catch (error) {
        this.handleApiError(error, "unlink wallet")
      }
    }
    await this.syncContextKeys()
    this.changed()
  }

  async signOut(): Promise<void> {
    this.stopAuthPolling()
    this.batcher.clear()
    this.signedIn = false
    this.authView = null
    await this.store.setAccessToken(null)
    await this.store.setPendingAuth(null)
    await this.store.setDeviceId(null)
    this.log("Signed out.")
    this.evaluate()
  }

  // ------------------------------------------------------------------- auth

  /**
   * Device code flow against the contract. In mock mode the adapter approves
   * immediately and hands back a locally generated device id.
   */
  async ensureSignedIn(restart = false): Promise<void> {
    if (!this.config.enabled) return
    if (!restart && (await this.store.getAccessToken())) {
      this.signedIn = true
      this.authView = null
      this.changed()
      return
    }
    this.stopAuthPolling()
    let pending: PendingAuth | null = restart ? null : this.store.pendingAuth
    if (pending && pending.expires_at <= Date.now()) pending = null
    if (!pending) {
      try {
        const res = await this.api.startDeviceAuth()
        pending = {
          device_code: res.device_code,
          user_code: res.user_code,
          verification_uri: res.verification_uri,
          expires_at: Date.now() + res.expires_in * 1000,
          interval_ms: Math.max(1, res.interval) * 1000,
        }
        if (res.verification_uri_complete) {
          pending.verification_uri_complete = res.verification_uri_complete
        }
        await this.store.setPendingAuth(pending)
        this.setOffline(false)
      } catch (error) {
        this.handleApiError(error, "start sign-in")
        this.authView = {
          userCode: "",
          verificationUri: "",
          status: "error",
        }
        this.changed()
        return
      }
    }
    this.authView = {
      userCode: pending.user_code,
      verificationUri:
        pending.verification_uri_complete ?? pending.verification_uri,
      status: "waiting",
    }
    this.changed()
    this.pollAuth(pending)
  }

  private pollAuth(pending: PendingAuth): void {
    let interval = pending.interval_ms
    const poll = async (): Promise<void> => {
      this.authPoll = null
      if (Date.now() > pending.expires_at) {
        this.authView = { ...this.authView!, status: "expired" }
        await this.store.setPendingAuth(null)
        this.changed()
        return
      }
      try {
        const result = await this.api.pollDeviceToken(pending.device_code)
        this.setOffline(false)
        if (result.status === "ok") {
          await this.store.setAccessToken(result.token.access_token)
          await this.store.setDeviceId(result.token.device_id)
          await this.store.setPendingAuth(null)
          this.signedIn = true
          this.authView = null
          this.log(`Signed in (${this.api.mode} mode).`)
          await this.syncWallet()
          await this.refreshBalance()
          this.evaluate()
          return
        }
        if (result.error === "slow_down") interval += 5000
        if (result.error === "expired_token") {
          this.authView = { ...this.authView!, status: "expired" }
          await this.store.setPendingAuth(null)
          this.changed()
          return
        }
        if (result.error === "access_denied") {
          this.authView = { ...this.authView!, status: "denied" }
          await this.store.setPendingAuth(null)
          this.changed()
          return
        }
      } catch (error) {
        this.handleApiError(error, "poll sign-in")
        interval = Math.min(interval * 2, 60_000)
      }
      this.authPoll = setTimeout(() => void poll(), interval)
    }
    this.authPoll = setTimeout(
      () => void poll(),
      this.api.mode === "mock" ? 0 : interval
    )
  }

  /** After an offline failure, retry sign-in quietly every few minutes. */
  private async retrySignInIfOffline(): Promise<void> {
    if (!this.config.enabled || this.signedIn || this.authPoll) return
    if (this.authView?.status !== "error") return
    if (Date.now() < this.nextAuthRetryAt) return
    this.nextAuthRetryAt = Date.now() + FETCH_BACKOFF_MS
    await this.ensureSignedIn(true)
  }

  private stopAuthPolling(): void {
    if (this.authPoll) {
      clearTimeout(this.authPoll)
      this.authPoll = null
    }
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
    await this.retrySignInIfOffline()
    if (!this.lastDecision.allowed) return
    if (Date.now() < this.nextFetchNotBefore) return
    await this.fetchNextAd()
    await this.batcher.flush()
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
        ? `Impression counted for ${adId} (${current.ad.reward_tokens} tokens pending).`
        : `Impression for ${adId} not reported: events are disabled.`
    )
    await this.batcher.flush()
    this.changed()
  }

  // ---------------------------------------------------------------- helpers

  private async refreshBalance(): Promise<void> {
    if (!this.signedIn) return
    try {
      const balance = await this.api.getBalance()
      await this.store.setBalance(balance)
      this.setOffline(false)
      this.changed()
    } catch (error) {
      this.handleApiError(error, "refresh balance")
    }
  }

  private async syncWallet(): Promise<void> {
    if (!this.signedIn || !this.walletCache) return
    try {
      await this.api.linkWallet(this.walletCache)
      await this.store.setWalletSyncPending(false)
      this.setOffline(false)
    } catch (error) {
      if (error instanceof ApiRequestError) {
        void vscode.window.showWarningMessage(`Vibefuel: ${error.message}`)
        await this.store.setWalletAddress(null)
        this.walletCache = null
        return
      }
      await this.store.setWalletSyncPending(true)
      this.handleApiError(error, "link wallet")
    }
  }

  private async onConfigChanged(): Promise<void> {
    const previous = this.config
    this.config = readConfig()
    if (previous.apiBaseUrl !== this.config.apiBaseUrl) {
      this.log(
        `API mode changed to ${this.config.apiBaseUrl ? "http" : "mock"}; signing out.`
      )
      this.rebuildApi()
      this.rebuildBatcher()
      await this.signOut()
    }
    if (previous.enabled !== this.config.enabled) {
      if (this.config.enabled) await this.ensureSignedIn()
      else {
        this.stopAuthPolling()
        this.batcher.clear()
      }
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
        if (result.balance) {
          void this.store.setBalance(result.balance).then(() => this.changed())
        } else {
          void this.refreshBalance()
        }
      },
      onError: (error) => this.handleApiError(error, "send events"),
    })
  }

  private handleApiError(error: unknown, action: string): void {
    if (error instanceof UnauthorizedError) {
      this.log(`Device token rejected while trying to ${action}; signing out.`)
      void this.signOut()
      return
    }
    if (error instanceof ApiUnavailableError) {
      this.setOffline(true)
      this.log(`Offline while trying to ${action}: ${error.message}`)
      return
    }
    this.log(
      `Failed to ${action}: ${error instanceof Error ? error.message : String(error)}`
    )
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
