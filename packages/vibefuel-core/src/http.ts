import { HTTP_TIMEOUT_MS } from "./constants"
import {
  ApiRequestError,
  ApiUnavailableError,
  UnauthorizedError,
  type TokenSource,
  type VibefuelApi,
} from "./client"
import type {
  Ad,
  AdEvent,
  ClientInfo,
  EventBatchResult,
  Me,
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

  async me(): Promise<Me> {
    const res = await this.request("GET", "/api/ext/me")
    return (await res.json()) as Me
  }

  async heartbeat(activeSeconds: number): Promise<void> {
    await this.request("POST", "/api/ext/heartbeat", {
      body: {
        editor: this.client.editor,
        extension_version: this.client.extension_version,
        active_seconds: Math.max(0, Math.min(600, Math.floor(activeSeconds))),
      },
    })
  }

  async getNextAd(sessionId: string): Promise<Ad | null> {
    const query = new URLSearchParams({ session_id: sessionId })
    if (this.client.surface) query.set("surface", this.client.surface)
    const res = await this.request(
      "GET",
      `/api/ext/ads/next?${query.toString()}`
    )
    if (res.status === 204) return null
    return (await res.json()) as Ad
  }

  async postEvents(events: AdEvent[]): Promise<EventBatchResult> {
    const res = await this.request("POST", "/api/ext/events", {
      body: { events, client: this.client },
    })
    return (await res.json()) as EventBatchResult
  }

  async linkWallet(address: string): Promise<Wallet> {
    const res = await this.request("POST", "/api/ext/wallet", {
      body: { address },
    })
    return (await res.json()) as Wallet
  }

  async unlinkWallet(): Promise<void> {
    await this.request("DELETE", "/api/ext/wallet")
  }

  private async request(
    method: string,
    path: string,
    options: { body?: unknown; allow?: number[] } = {}
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Vibefuel-Client": `${this.client.editor}/${this.client.editor_version} vibefuel/${this.client.extension_version}`,
    }
    if (options.body !== undefined) headers["Content-Type"] = "application/json"
    const token = await this.tokens.getToken()
    if (!token) throw new UnauthorizedError()
    headers.Authorization = `Bearer ${token}`

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
      message = body.message ?? body.error ?? message
    } catch {
      // Body was not JSON; keep the defaults.
    }
    throw new ApiRequestError(res.status, code, message)
  }
}
