import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const BIN = path.resolve(process.cwd(), "bin/vibefuel.cjs")
let home: string

function run(args: string[], stdin = ""): string {
  return execFileSync("node", [BIN, ...args], {
    input: stdin,
    env: { ...process.env, VIBEFUEL_HOME: home },
    encoding: "utf8",
  })
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "vibefuel-cli-"))
})
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
})

describe("vibefuel CLI (built bundle, mock mode)", () => {
  it("opt-in signs in locally and a Stop hook shows a line after the quiet period", () => {
    expect(run(["optin"])).toContain("Signed in (mock mode)")
    expect(run(["config", "quiet", "0"])).toContain("Quiet period set to 0")
    const stop = run(
      ["hook", "stop"],
      JSON.stringify({ session_id: "s", hook_event_name: "Stop" })
    )
    const parsed = JSON.parse(stop) as { systemMessage: string }
    expect(parsed.systemMessage).toMatch(/^Sponsored · /)
    expect(run(["statusline"], "{}")).toMatch(/^⛽ 12 FUEL · ● new/)
    expect(run(["status"])).toContain("Balance: 12 FUEL")
  })

  it("stays silent and exits 0 on a Stop hook before opt-in", () => {
    expect(run(["hook", "stop"], "{}")).toBe("")
  })

  it("validates wallet addresses and never stores a bad one", () => {
    run(["optin"])
    expect(run(["wallet", "not-an-address"])).toContain("base58")
    expect(
      run(["wallet", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"])
    ).toContain("Toke…Q5DA linked")
    expect(run(["status"])).toContain("Wallet: Toke…Q5DA")
  })

  it("opt-out deletes the home directory", () => {
    run(["optin"])
    expect(fs.existsSync(path.join(home, "token"))).toBe(true)
    run(["optout"])
    expect(fs.existsSync(home)).toBe(false)
  })
})
