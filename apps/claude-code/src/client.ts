import {
  HttpAdapter,
  MOCK_ADS,
  MockAdapter,
  type ClientInfo,
  type VibefuelApi,
} from "@workspace/vibefuel-core"
import { mockStorage, type StateStore } from "./state"

export const PLUGIN_VERSION = "0.1.0"
/** Hooks must finish fast; keep network calls well under the hook timeout. */
const TERMINAL_HTTP_TIMEOUT_MS = 6_000

export function clientInfo(): ClientInfo {
  return {
    editor: "Claude Code",
    editor_version: process.env.CLAUDE_CODE_VERSION ?? "unknown",
    extension_version: PLUGIN_VERSION,
    surface: "terminal",
  }
}

export const DEFAULT_API_BASE_URL = "https://vibefuel.app"

/** Env wins, then the stored setting. "" means the default host; "mock" selects mock mode. */
export function apiBaseUrl(store: StateStore): string {
  const raw = (
    process.env.VIBEFUEL_API_BASE_URL ??
    store.load().apiBaseUrl ??
    ""
  ).trim()
  if (raw === "") return DEFAULT_API_BASE_URL
  if (raw.toLowerCase() === "mock") return ""
  return raw
}

export function createApi(store: StateStore): VibefuelApi {
  const baseUrl = apiBaseUrl(store)
  if (baseUrl) {
    return new HttpAdapter({
      baseUrl,
      client: clientInfo(),
      tokens: { getToken: () => Promise.resolve(store.getToken()) },
      timeoutMs: TERMINAL_HTTP_TIMEOUT_MS,
    })
  }
  return new MockAdapter([...MOCK_ADS], mockStorage(store), {
    appendLine: (line) => store.log(line),
  })
}
