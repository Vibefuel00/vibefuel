import { IMPRESSION_SECONDS } from "../constants"

export interface TimerHost {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface ImpressionTrackerOptions {
  onImpression: (adId: string) => void
  /** Continuous visible+focused time required. Defaults to 3 s. */
  dwellMs?: number
  timers?: TimerHost
}

/**
 * Counts an impression only after the card has been visible in the sidebar
 * for a continuous dwell time while the editor window is focused. Any gap in
 * visibility or focus restarts the clock. Each ad counts at most once.
 */
export class ImpressionTracker {
  private adId: string | null = null
  private visible = false
  private focused = false
  private handle: unknown = null
  private counted = new Set<string>()
  private readonly dwellMs: number
  private readonly timers: TimerHost
  private readonly onImpression: (adId: string) => void

  constructor(options: ImpressionTrackerOptions) {
    this.onImpression = options.onImpression
    this.dwellMs = options.dwellMs ?? IMPRESSION_SECONDS * 1000
    this.timers = options.timers ?? {
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    }
  }

  /** The card currently rendered in the sidebar, or null when none. */
  setAd(adId: string | null): void {
    if (this.adId === adId) return
    this.adId = adId
    this.restart()
  }

  /** Whether the sidebar view is actually visible (not collapsed or hidden). */
  setVisible(visible: boolean): void {
    if (this.visible === visible) return
    this.visible = visible
    this.restart()
  }

  /** Whether the editor window has focus. */
  setFocused(focused: boolean): void {
    if (this.focused === focused) return
    this.focused = focused
    this.restart()
  }

  hasCounted(adId: string): boolean {
    return this.counted.has(adId)
  }

  /** Forget which ads were counted; used when the session state is cleared. */
  reset(): void {
    this.counted.clear()
    this.restart()
  }

  dispose(): void {
    this.cancel()
  }

  private restart(): void {
    this.cancel()
    const adId = this.adId
    if (!adId || !this.visible || !this.focused || this.counted.has(adId)) {
      return
    }
    this.handle = this.timers.setTimeout(() => {
      this.handle = null
      if (this.adId !== adId || !this.visible || !this.focused) return
      if (this.counted.has(adId)) return
      this.counted.add(adId)
      this.onImpression(adId)
    }, this.dwellMs)
  }

  private cancel(): void {
    if (this.handle !== null) {
      this.timers.clearTimeout(this.handle)
      this.handle = null
    }
  }
}
