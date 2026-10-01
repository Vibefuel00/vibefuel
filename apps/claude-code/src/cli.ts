import {
  ApiRequestError,
  ApiUnavailableError,
  describeWalletError,
  shortenAddress,
  validateSolanaAddress,
} from "@workspace/vibefuel-core"
import { login } from "./auth"
import { apiBaseUrl, createApi } from "./client"
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
      return runLogin(store)
    }

    case "optout": {
      store.wipe()
      out(
        "Vibefuel is off. Everything under ~/.vibefuel was deleted, including the device token and any linked address."
      )
      return 0
    }

    case "login":
      return runLogin(store)

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

async function runLogin(store: StateStore): Promise<number> {
  if (!store.load().optedIn) {
    out("Run /vibefuel:optin first.")
    return 0
  }
  const api = createApi(store)
  try {
    const result = await login(store, api)
    switch (result.status) {
      case "signed-in":
        out(
          `Signed in (${api.mode} mode). Device id ${result.deviceId.slice(0, 8)}…`
        )
        return 0
      case "waiting":
        out(
          [
            `Open ${result.verificationUri} and enter the code ${result.userCode}.`,
            `This code expires ${formatWait(result.expiresAt, Date.now())}. Run /vibefuel:login again to check, or just keep working: sign-in completes on its own.`,
          ].join("\n")
        )
        return 0
      case "expired":
        out(
          "That sign-in code expired. Run /vibefuel:login again for a new one."
        )
        return 0
      case "denied":
        out("Sign-in was declined in the browser.")
        return 0
      case "offline":
        out(
          `Could not reach the Vibefuel API at ${apiBaseUrl(store)}. Sign-in will be retried after your next task.`
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
    `Mode: ${api.mode === "mock" ? "mock (no API URL set; nothing is sent anywhere)" : apiBaseUrl(store)}`
  )
  lines.push(
    `Signed in: ${signedIn ? "yes" : state.pendingAuth ? "waiting for browser approval" : "no"}`
  )
  if (state.optedIn && signedIn) {
    try {
      const balance = await api.getBalance()
      store.update((s) => void (s.balance = balance))
      lines.push(
        `Balance: ${formatBalance(balance)} (pending ${formatTokens(balance.pending)}, settled ${formatTokens(balance.settled)})`
      )
    } catch (error) {
      lines.push(
        `Balance: ${formatBalance(state.balance)} (cached; ${error instanceof ApiUnavailableError ? "API offline" : "refresh failed"})`
      )
    }
  }
  lines.push(
    `Wallet: ${state.walletAddress ? shortenAddress(state.walletAddress) : "none linked (use /vibefuel:wallet <address>)"}`
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
  lines.push(`Website: ${LANDING_URL}`)
  out(lines.join("\n"))
  return 0
}

async function runWallet(store: StateStore, args: string[]): Promise<number> {
  const api = createApi(store)
  if (args[0] === "--unlink" || args[0] === "unlink") {
    store.update((s) => void (s.walletAddress = null))
    if (store.getToken()) {
      try {
        await api.unlinkWallet()
      } catch {
        // Local unlink already happened; the server copy is cleared next sync.
      }
    }
    out("Wallet address unlinked.")
    return 0
  }
  const input = args.join(" ")
  const result = validateSolanaAddress(input)
  if (!result.ok) {
    out(
      `${describeWalletError(result.reason)} Vibefuel only ever stores a public address, never a private key or seed phrase.`
    )
    return 0
  }
  store.update((s) => void (s.walletAddress = result.address))
  if (store.getToken()) {
    try {
      await api.linkWallet(result.address)
      out(`Wallet ${shortenAddress(result.address)} linked.`)
    } catch (error) {
      if (error instanceof ApiRequestError) {
        store.update((s) => void (s.walletAddress = null))
        out(`The API rejected that address: ${error.message}`)
      } else {
        out(
          `Wallet ${shortenAddress(result.address)} saved locally; it will sync when the API is reachable.`
        )
      }
    }
  } else {
    out(
      `Wallet ${shortenAddress(result.address)} saved. It syncs once you are signed in.`
    )
  }
  return 0
}

function runConfig(store: StateStore, args: string[]): number {
  const [key, value] = args
  const state = store.load()
  if (!key) {
    out(
      [
        `api: ${state.apiBaseUrl || "(empty, mock mode)"}`,
        `frequency: ${state.frequencyMinutes} minutes (min 15)`,
        `quiet: ${state.quietPeriodMinutes} minutes`,
      ].join("\n")
    )
    return 0
  }
  switch (key) {
    case "api": {
      const url = (value ?? "").trim()
      if (url && !/^https?:\/\//.test(url)) {
        out("The API URL must start with http:// or https://.")
        return 0
      }
      store.update((s) => void (s.apiBaseUrl = url))
      store.setToken(null)
      store.update((s) => void (s.pendingAuth = null))
      out(
        url
          ? `API set to ${url}. Signed out; run /vibefuel:login.`
          : "API cleared; mock mode. Signed out."
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
      out("Usage: config [api <url>|frequency <minutes>|quiet <minutes>]")
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
