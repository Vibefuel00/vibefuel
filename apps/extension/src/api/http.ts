import { HTTP_TIMEOUT_MS } from "../constants"
import {
  ApiRequestError,
  ApiUnavailableError,
  UnauthorizedError,
  type PollResult,
  type TokenSource,
  type VibefuelApi,
} from "./client"
import type {
  Ad,
  AdEvent,
  Balance,
  ClientInfo,
  DeviceAuthResponse,
  DeviceTokenPending,
  DeviceTokenResponse,
  EventBatchResult,
  Wallet,
} from "./types"

type FetchLike = typeof fetch

export interface HttpAdapterOptions {
  baseUrl: string
  client: ClientInfo
  tokens: TokenSource
  fetchImpl?: FetchLike
  timeoutMs?: number
}

export class HttpAdapter implements VibefuelApi {
  readonly mode = "http" as const
  private readonly baseUrl: string
  private readonly client: ClientInfo
  private readonly tokens: TokenSource
  private readonly fetchImpl: FetchLike
  private readonly timeoutMs: number

  constructor(options: HttpAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "")
    this.client = options.client
    this.tokens = options.tokens
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? HTTP_TIMEOUT_MS
  }

  async startDeviceAuth(): Promise<DeviceAuthResponse> {
    const res = await this.request("POST", "/v1/auth/device", {
      body: { client: this.client },
      auth: false,
    })
    return (await res.json()) as DeviceAuthResponse
  }

  async pollDeviceToken(deviceCode: string): Promise<PollResult> {
    const res = await this.request("POST", "/v1/auth/token", {
      body: { device_code: deviceCode },
      auth: false,
      allow: [400],
    })
    if (res.status === 400) {
      const pending = (await res.json()) as DeviceTokenPending
      return { status: "pending", error: pending.error }
    }
    return { status: "ok", token: (await res.json()) as DeviceTokenResponse }
  }

  async getNextAd(sessionId: string): Promise<Ad | null> {
    const query = new URLSearchParams({
      session_id: sessionId,
      editor: this.client.editor,
    })
    const res = await this.request("GET", `/v1/ads/next?${query.toString()}`)
    if (res.status === 204) return null
    return (await res.json()) as Ad
  }

  async postEvents(events: AdEvent[]): Promise<EventBatchResult> {
    const res = await this.request("POST", "/v1/events", {
      body: { events, client: this.client },
    })
    return (await res.json()) as EventBatchResult
  }

  async getBalance(): Promise<Balance> {
    const res = await this.request("GET", "/v1/rewards/balance")
    return (await res.json()) as Balance
  }

  async linkWallet(address: string): Promise<Wallet> {
    const res = await this.request("POST", "/v1/wallet", {
      body: { address },
    })
    return (await res.json()) as Wallet
  }

  async unlinkWallet(): Promise<void> {
    await this.request("DELETE", "/v1/wallet")
  }

  private async request(
    method: string,
    path: string,
    options: { body?: unknown; auth?: boolean; allow?: number[] } = {}
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Vibefuel-Client": `${this.client.editor}/${this.client.editor_version} vibefuel/${this.client.extension_version}`,
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }
    if (options.auth !== false) {
      const token = await this.tokens.getToken()
      if (!token) throw new UnauthorizedError()
      headers.Authorization = `Bearer ${token}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let res: Response
    try {
      const init: RequestInit = { method, headers, signal: controller.signal }
      if (options.body !== undefined) init.body = JSON.stringify(options.body)
      res = await this.fetchImpl(`${this.baseUrl}${path}`, init)
    } catch (error) {
      throw new ApiUnavailableError(`Could not reach ${this.baseUrl}`, error)
    } finally {
      clearTimeout(timer)
    }

    if (res.ok || options.allow?.includes(res.status)) return res
    if (res.status === 401) throw new UnauthorizedError()
    if (res.status >= 500 || res.status === 429) {
      throw new ApiUnavailableError(`API answered ${res.status}`)
    }
    let code = "request_failed"
    let message = `API answered ${res.status}`
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      code = body.error ?? code
      message = body.message ?? message
    } catch {
      // Body was not JSON; keep the defaults.
    }
    throw new ApiRequestError(res.status, code, message)
  }
}
