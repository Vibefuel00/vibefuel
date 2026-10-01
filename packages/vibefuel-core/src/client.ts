import type { Ad, AdEvent, EventBatchResult, Me, Wallet } from "./types"

export type ApiMode = "mock" | "http"

/** Thrown when the API cannot be reached or answers with a server error. */
export class ApiUnavailableError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown
  ) {
    super(message)
    this.name = "ApiUnavailableError"
  }
}

/** Thrown on 401; the caller signs the device out. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Serial key rejected")
    this.name = "UnauthorizedError"
  }
}

/** Thrown on 4xx other than 401 (bad input such as an invalid address). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "ApiRequestError"
  }
}

/**
 * One interface, two adapters. `MockAdapter` serves fictional ads from a local
 * list; `HttpAdapter` talks to the contract in `api/openapi.yaml`.
 */
export interface VibefuelApi {
  readonly mode: ApiMode
  /** Verifies the key and returns the account summary. */
  me(): Promise<Me>
  heartbeat(activeSeconds: number): Promise<void>
  getNextAd(sessionId: string): Promise<Ad | null>
  postEvents(events: AdEvent[]): Promise<EventBatchResult>
  linkWallet(address: string): Promise<Wallet>
  unlinkWallet(): Promise<void>
}

/** Provides the serial key for HTTP requests. */
export interface TokenSource {
  getToken(): Promise<string | undefined>
}
