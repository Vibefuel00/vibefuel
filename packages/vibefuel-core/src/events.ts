import { EVENT_FLUSH_INTERVAL_MS, MAX_QUEUED_EVENTS } from "./constants"
import type { AdEvent, AdEventType, EventBatchResult } from "./types"

export interface EventSink {
  postEvents(events: AdEvent[]): Promise<EventBatchResult>
}

export interface EventBatcherOptions {
  sink: EventSink
  sessionId: string
  /** Hard off switch: editor telemetry disabled or the user turned events off. */
  isEnabled: () => boolean
  onFlushed?: (result: EventBatchResult) => void
  onError?: (error: unknown) => void
  flushIntervalMs?: number
  maxQueued?: number
  now?: () => number
  newId?: () => string
  timers?: {
    setTimeout(cb: () => void, ms: number): unknown
    clearTimeout(handle: unknown): void
  }
}

/**
 * Queues ad events and sends them in batches, at most once per flush
 * interval. Failed batches stay queued (bounded) and retry on the next flush.
 */
export class EventBatcher {
  private queue: AdEvent[] = []
  private lastFlushAt = -Infinity
  private timer: unknown = null
  private inFlight: Promise<void> | null = null
  private readonly opts: Required<
    Pick<
      EventBatcherOptions,
      "flushIntervalMs" | "maxQueued" | "now" | "newId" | "timers"
    >
  > &
    EventBatcherOptions

  constructor(options: EventBatcherOptions) {
    this.opts = {
      flushIntervalMs: EVENT_FLUSH_INTERVAL_MS,
      maxQueued: MAX_QUEUED_EVENTS,
      now: () => Date.now(),
      newId: () => globalThis.crypto.randomUUID(),
      timers: {
        setTimeout: (cb, ms) => setTimeout(cb, ms),
        clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      },
      ...options,
    }
  }

  get size(): number {
    return this.queue.length
  }

  /** Record an event. Returns false when events are disabled and dropped. */
  track(type: AdEventType, adId: string): boolean {
    if (!this.opts.isEnabled()) return false
    this.queue.push({
      id: this.opts.newId(),
      ad_id: adId,
      type,
      occurred_at: new Date(this.opts.now()).toISOString(),
      session_id: this.opts.sessionId,
    })
    if (this.queue.length > this.opts.maxQueued) {
      this.queue.splice(0, this.queue.length - this.opts.maxQueued)
    }
    this.schedule()
    return true
  }

  /** Drop everything without sending. Used on opt-out and sign-out. */
  clear(): void {
    this.queue = []
    this.cancelTimer()
  }

  /** Send now if the interval allows, otherwise schedule the next flush. */
  async flush(force = false): Promise<void> {
    if (this.inFlight) return this.inFlight
    if (this.queue.length === 0) return
    if (!this.opts.isEnabled()) {
      this.clear()
      return
    }
    const elapsed = this.opts.now() - this.lastFlushAt
    if (!force && elapsed < this.opts.flushIntervalMs) {
      this.schedule()
      return
    }
    const batch = this.queue
    this.queue = []
    this.cancelTimer()
    this.lastFlushAt = this.opts.now()
    this.inFlight = this.opts.sink
      .postEvents(batch)
      .then((result) => this.opts.onFlushed?.(result))
      .catch((error: unknown) => {
        // Put the batch back in front so order is kept, then retry later.
        this.queue = [...batch, ...this.queue].slice(-this.opts.maxQueued)
        this.opts.onError?.(error)
        this.schedule()
      })
      .finally(() => {
        this.inFlight = null
      })
    return this.inFlight
  }

  dispose(): void {
    this.cancelTimer()
  }

  private schedule(): void {
    if (this.timer !== null || this.queue.length === 0) return
    const wait = Math.max(
      0,
      this.opts.flushIntervalMs - (this.opts.now() - this.lastFlushAt)
    )
    this.timer = this.opts.timers.setTimeout(() => {
      this.timer = null
      void this.flush()
    }, wait)
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      this.opts.timers.clearTimeout(this.timer)
      this.timer = null
    }
  }
}
