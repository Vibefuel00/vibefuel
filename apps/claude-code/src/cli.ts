import {
  ApiRequestError,
  ApiUnavailableError,
  describeWalletError,
  shortenAddress,
  validateSolanaAddress,
} from "@workspace/vibefuel-core"
import { login } from "./auth"
import { DEFAULT_API_BASE_URL, apiBaseUrl, createApi } from "./client"
import {
  PRIVACY_SUMMARY,
  formatBalance,
  formatStatusLine,
  formatTokens,
  formatWait,
} from "./format"
import { decide, onSessionStart, onStop, parseHookInput } from "./hook"
import { StateStore } from "./state"

const LANDING_URL = "https://vibefuel.app"

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return ""
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

function out(text: string): void {
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`)
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv
  const store = new StateStore()

  switch (command ?? "") {
    case "hook": {
      const event = rest[0]
      const input = parseHookInput(await readStdin())
      const ctx = { store, api: createApi(store) }
      const output =
        event === "session-start"
          ? onSessionStart(input, ctx)
          : event === "stop"
            ? await onStop(input, ctx)
            : {}
      if (output.systemMessage) out(JSON.stringify(output))
      return 0
    }

    case "statusline": {
      await readStdin() // Claude Code pipes session JSON; we only show our own data.
      const state = store.load()
      const pending =
        state.lastAd !== null && Date.now() - state.lastAd.at < 10 * 60_000
      out(
        formatStatusLine({
          optedIn: state.optedIn,
          paused: state.paused,
          balance: state.balance,
          pending,
        })
      )
      return 0
    }

    case "optin": {
      store.update((s) => {
        s.optedIn = true
        s.paused = false
      })
      out(
        "Vibefuel is on. One labelled sponsored line may appear after a task finishes, at most every 30 minutes and never in the first 10 minutes of a session."
      )
      return runLogin(store, rest)
    }

    case "optout": {
      store.wipe()
      out(
        "Vibefuel is off. Everything under ~/.vibefuel was deleted, including the device token and any linked address."
      )
      return 0
    }

    case "login":
      return runLogin(store, rest)

    case "pause":
      store.update((s) => void (s.paused = true))
      out("Vibefuel paused. No sponsored lines until /vibefuel:resume.")
      return 0

    case "resume":
      store.update((s) => void (s.paused = false))
      out("Vibefuel resumed.")
      return 0

    case "status":
      return runStatus(store)

    case "wallet":
      return runWallet(store, rest)

    case "config":
      return runConfig(store, rest)

    case "privacy":
      out(PRIVACY_SUMMARY)
      return 0

    case "statusline-snippet":
      out(
        [
          "Add this to ~/.claude/settings.json to show your Vibefuel balance in the status line:",
          "",
          JSON.stringify(
            {
              statusLine: {
                type: "command",
                command: `node "${process.env.CLAUDE_PLUGIN_ROOT ?? "<plugin root>"}/bin/vibefuel.cjs" statusline`,
              },
            },
            null,
            2
          ),
        ].join("\n")
      )
      return 0

    default:
      out(
        "Usage: vibefuel <optin|optout|login|status|pause|resume|wallet|config|privacy|statusline|statusline-snippet|hook>"
      )
      return command ? 1 : 0
  }
}

async function runLogin(store: StateStore, args: string[]): Promise<number> {
  if (!store.load().optedIn) {
    out("Run /vibefuel:optin first.")
    return 0
  }
  const api = createApi(store)
  const input = args.join(" ").trim()
  if (api.mode === "http" && !input) {
    if (store.getToken()) {
      out(
        `Already signed in as ${store.load().keyPrefix ?? "your key"}. To switch keys: /vibefuel:login VF-XXXX-XXXX-XXXX-XXXX`
      )
      return 0
    }
    out(
      [
        `Create a free serial key at ${LANDING_URL}/start (no email, no password), then run:`,
        "  /vibefuel:login VF-XXXX-XXXX-XXXX-XXXX",
      ].join("\n")
    )
    return 0
  }
  try {
    const result = await login(store, api, input)
    switch (result.status) {
      case "signed-in":
        out(`Signed in as ${result.keyPrefix} (${api.mode} mode).`)
        return 0
      case "invalid":
        out(result.message)
        return 0
      case "rejected":
        out(
          `That key was not accepted. Create one at ${LANDING_URL}/start and try again.`
        )
        return 0
      case "offline":
        out(
          `Could not reach the Vibefuel API at ${apiBaseUrl(store)}. The key is saved and will be checked after your next task.`
        )
        return 0
    }
  } catch (error) {
    out(
      `Sign-in failed: ${error instanceof Error ? error.message : String(error)}`
    )
    return 0
  }
}

async function runStatus(store: StateStore): Promise<number> {
  const state = store.load()
  const api = createApi(store)
  const signedIn = store.getToken() !== undefined
  const lines: string[] = []
  lines.push(
    `Vibefuel: ${state.optedIn ? "on" : "off (run /vibefuel:optin)"}${state.paused ? ", paused" : ""}`
  )
  lines.push(
    `Mode: ${api.mode === "mock" ? "mock (fictional ads, nothing is sent anywhere)" : apiBaseUrl(store)}`
  )
  lines.push(
    `Signed in: ${signedIn ? `yes (${state.keyPrefix ?? "key saved"})` : "no (run /vibefuel:login <key>)"}`
  )
  let wallet = state.walletAddress
  if (state.optedIn && signedIn) {
    try {
      const me = await api.me()
      wallet = me.wallet_address
      store.update((s) => {
        s.balance = me.balance
        s.keyPrefix = me.key_prefix
        s.walletAddress = me.wallet_address
      })
      lines.push(
        `Balance: ${formatBalance(me.balance)} (available ${formatTokens(me.balance.pending)}, paid out ${formatTokens(me.balance.settled)}, earned ${formatTokens(me.earned)} all time)`
      )
    } catch (error) {
      lines.push(
        `Balance: ${formatBalance(state.balance)} (cached; ${error instanceof ApiUnavailableError ? "API offline" : "refresh failed"})`
      )
    }
  }
  lines.push(
    `Wallet: ${wallet ? shortenAddress(wallet) : "none linked (use /vibefuel:wallet <address>)"}`
  )
  if (state.lastAd) {
    lines.push(
      `Last sponsored line: ${state.lastAd.advertiser}, ${new Date(state.lastAd.at).toLocaleString()}`
    )
  }
  const { decision } = decide(process.env.CLAUDE_SESSION_ID ?? "status", {
    store,
    api,
  })
  if (!decision.allowed) {
    const reason =
      decision.reason === "quiet-period" && decision.retryAt
        ? `quiet period ends ${formatWait(decision.retryAt, Date.now())}`
        : decision.reason === "frequency" && decision.retryAt
          ? `next sponsored line possible ${formatWait(decision.retryAt, Date.now())}`
          : decision.reason
    lines.push(`Next: ${reason}`)
  } else {
    lines.push("Next: a sponsored line may appear after your next task")
  }
  lines.push(`Dashboard: ${LANDING_URL}/dashboard`)
  out(lines.join("\n"))
  return 0
}

async function runWallet(store: StateStore, args: string[]): Promise<number> {
  const api = createApi(store)
  if (!store.getToken()) {
    out("Sign in first: /vibefuel:login VF-XXXX-XXXX-XXXX-XXXX")
    return 0
  }
  if (args[0] === "--unlink" || args[0] === "unlink") {
    try {
      await api.unlinkWallet()
      store.update((s) => void (s.walletAddress = null))
      out("Wallet address unlinked.")
    } catch {
      out("Could not reach the Vibefuel API. Try again in a moment.")
    }
    return 0
  }
  const result = validateSolanaAddress(args.join(" "))
  if (!result.ok) {
    out(
      `${describeWalletError(result.reason)} Vibefuel only ever stores a public address, never a private key or seed phrase.`
    )
    return 0
  }
  try {
    await api.linkWallet(result.address)
    store.update((s) => void (s.walletAddress = result.address))
    out(`Wallet ${shortenAddress(result.address)} linked.`)
  } catch (error) {
    if (error instanceof ApiRequestError)
      out(`The API rejected that address: ${error.message}`)
    else out("Could not reach the Vibefuel API. Try again in a moment.")
  }
  return 0
}

function runConfig(store: StateStore, args: string[]): number {
  const [key, value] = args
  const state = store.load()
  if (!key) {
    out(
      [
        `api: ${apiBaseUrl(store) || "mock"}`,
        `frequency: ${state.frequencyMinutes} minutes (min 15)`,
        `quiet: ${state.quietPeriodMinutes} minutes`,
      ].join("\n")
    )
    return 0
  }
  switch (key) {
    case "api": {
      const raw = (value ?? "").trim()
      const url = raw.toLowerCase() === "mock" ? "mock" : raw
      if (url && url !== "mock" && !/^https?:\/\//.test(url)) {
        out("The API URL must start with http:// or https://, or be 'mock'.")
        return 0
      }
      store.update((s) => void (s.apiBaseUrl = url))
      store.setToken(null)
      out(
        url === "mock"
          ? "Mock mode: fictional ads, nothing is sent anywhere. Signed out."
          : url
            ? `API set to ${url}. Signed out; run /vibefuel:login <key>.`
            : `API reset to ${DEFAULT_API_BASE_URL}. Signed out; run /vibefuel:login <key>.`
      )
      return 0
    }
    case "frequency": {
      const n = Math.max(15, Number(value) || 30)
      store.update((s) => void (s.frequencyMinutes = n))
      out(`Frequency set to ${n} minutes.`)
      return 0
    }
    case "quiet": {
      const n = Math.max(0, Number(value) || 0)
      store.update((s) => void (s.quietPeriodMinutes = n))
      out(`Quiet period set to ${n} minutes.`)
      return 0
    }
    default:
      out("Usage: config [api <url|mock>|frequency <minutes>|quiet <minutes>]")
      return 0
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    // Never surface a stack trace to the user; hooks must stay silent on failure.
    new StateStore().log(
      `CLI failed: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exit(0)
  }
)
