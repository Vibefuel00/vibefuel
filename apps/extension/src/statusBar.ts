import * as vscode from "vscode"
import { COMMANDS } from "./constants"
import type { Balance } from "./api/types"

/**
 * Fuel icon plus balance. A small dot appears when a new sponsored message is
 * waiting. Never shows ad copy; clicking focuses the feed view.
 */
export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      "vibefuel.balance",
      vscode.StatusBarAlignment.Right,
      50
    )
    this.item.name = "Vibefuel"
    this.item.command = COMMANDS.openFeed
  }

  update(input: {
    show: boolean
    enabled: boolean
    paused: boolean
    balance: Balance | null
    newMessageWaiting: boolean
    offline: boolean
  }): void {
    if (!input.show || !input.enabled) {
      this.item.hide()
      return
    }
    const total = input.balance
      ? input.balance.pending + input.balance.settled
      : 0
    const symbol = input.balance?.currency ?? "tokens"
    const parts = ["$(flame)", formatTokens(total)]
    if (input.paused) parts.push("$(debug-pause)")
    else if (input.newMessageWaiting) parts.push("$(circle-small-filled)")
    this.item.text = parts.join(" ")

    const lines = [`Vibefuel · ${formatTokens(total)} ${symbol}`]
    if (input.balance) {
      lines.push(
        `Pending ${formatTokens(input.balance.pending)} · Settled ${formatTokens(input.balance.settled)}`
      )
    }
    if (input.paused) lines.push("Paused")
    else if (input.newMessageWaiting)
      lines.push("New sponsored message waiting")
    if (input.offline) lines.push("Offline: could not reach the Vibefuel API")
    lines.push("Click to open the Vibefuel feed")
    this.item.tooltip = lines.join("\n")
    this.item.show()
  }

  dispose(): void {
    this.item.dispose()
  }
}

export function formatTokens(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US")
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}
