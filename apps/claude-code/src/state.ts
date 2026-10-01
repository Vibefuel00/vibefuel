import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import type { Balance } from "@workspace/vibefuel-core"

/** Everything Vibefuel keeps for the terminal plugin. Lives in ~/.vibefuel. */
export interface VibefuelState {
  optedIn: boolean
  paused: boolean
  keyPrefix: string | null
  walletAddress: string | null
  lastDeliveredAt: number | null
  /** Session id → start time, used for the quiet period. Pruned after a day. */
  sessions: Record<string, number>
  balance: Balance | null
  /** "" = default (vibefuel.app), "mock" = offline mock mode, or a custom host. */
  apiBaseUrl: string
  frequencyMinutes: number
  quietPeriodMinutes: number
  /** Storage for the mock adapter. */
  mock: Record<string, unknown>
  /** Last sponsored message shown, for /vibefuel:status. */
  lastAd: {
    id: string
    advertiser: string
    headline: string
    at: number
  } | null
}

export const DEFAULT_STATE: VibefuelState = {
  optedIn: false,
  paused: false,
  keyPrefix: null,
  walletAddress: null,
  lastDeliveredAt: null,
  sessions: {},
  balance: null,
  apiBaseUrl: "",
  frequencyMinutes: 30,
  quietPeriodMinutes: 10,
  mock: {},
  lastAd: null,
}

const SESSION_TTL_MS = 24 * 60 * 60_000

export function vibefuelHome(): string {
  return process.env.VIBEFUEL_HOME ?? path.join(os.homedir(), ".vibefuel")
}

export class StateStore {
  readonly dir: string
  private readonly statePath: string
  private readonly tokenPath: string
  private readonly logPath: string
  private cache: VibefuelState | null = null

  constructor(dir = vibefuelHome()) {
    this.dir = dir
    this.statePath = path.join(dir, "state.json")
    this.tokenPath = path.join(dir, "token")
    this.logPath = path.join(dir, "log.txt")
  }

  load(): VibefuelState {
    if (this.cache) return this.cache
    let parsed: Partial<VibefuelState> = {}
    try {
      parsed = JSON.parse(
        fs.readFileSync(this.statePath, "utf8")
      ) as Partial<VibefuelState>
    } catch {
      // Missing or corrupt file: start from defaults.
    }
    const state: VibefuelState = { ...DEFAULT_STATE, ...parsed }
    state.sessions = { ...(parsed.sessions ?? {}) }
    state.mock = { ...(parsed.mock ?? {}) }
    this.cache = state
    return state
  }

  save(state: VibefuelState): void {
    this.cache = state
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 })
    const tmp = `${this.statePath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, this.statePath)
  }

  update(mutate: (state: VibefuelState) => void): VibefuelState {
    const state = this.load()
    mutate(state)
    this.save(state)
    return state
  }

  getToken(): string | undefined {
    try {
      const token = fs.readFileSync(this.tokenPath, "utf8").trim()
      return token.length > 0 ? token : undefined
    } catch {
      return undefined
    }
  }

  setToken(token: string | null): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 })
    if (token === null) {
      fs.rmSync(this.tokenPath, { force: true })
      return
    }
    fs.writeFileSync(this.tokenPath, token, { mode: 0o600 })
  }

  log(line: string): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 })
      fs.appendFileSync(this.logPath, `${new Date().toISOString()} ${line}\n`, {
        mode: 0o600,
      })
    } catch {
      // Logging must never break a hook.
    }
  }

  /** Remove every file Vibefuel wrote. Used on opt-out. */
  wipe(): void {
    this.cache = null
    fs.rmSync(this.dir, { recursive: true, force: true })
  }

  /** Record a session start; prune sessions older than a day. */
  touchSession(sessionId: string, now: number): number {
    const state = this.load()
    for (const [id, startedAt] of Object.entries(state.sessions)) {
      if (now - startedAt > SESSION_TTL_MS) delete state.sessions[id]
    }
    const startedAt = state.sessions[sessionId] ?? now
    state.sessions[sessionId] = startedAt
    this.save(state)
    return startedAt
  }
}

/** MockStorage adapter over the state file so the mock accrues balance locally. */
export function mockStorage(store: StateStore) {
  return {
    get<T>(key: string): T | undefined {
      return store.load().mock[key] as T | undefined
    },
    update(key: string, value: unknown): Promise<void> {
      store.update((s) => {
        if (value === undefined) delete s.mock[key]
        else s.mock[key] = value
      })
      return Promise.resolve()
    },
  }
}
