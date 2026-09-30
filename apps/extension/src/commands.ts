import * as vscode from "vscode"
import { COMMANDS, LANDING_URL, VIEW_ID } from "./constants"
import type { Controller } from "./controller"

export function registerCommands(controller: Controller): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(COMMANDS.openFeed, () =>
      vscode.commands.executeCommand(`${VIEW_ID}.focus`)
    ),
    vscode.commands.registerCommand(COMMANDS.pause, () =>
      controller.setPaused(true)
    ),
    vscode.commands.registerCommand(COMMANDS.resume, () =>
      controller.setPaused(false)
    ),
    vscode.commands.registerCommand(COMMANDS.linkWallet, () =>
      controller.linkWallet()
    ),
    vscode.commands.registerCommand(COMMANDS.unlinkWallet, () =>
      controller.unlinkWallet()
    ),
    vscode.commands.registerCommand(COMMANDS.signOut, () =>
      controller.signOut()
    ),
    vscode.commands.registerCommand(COMMANDS.openLandingPage, () =>
      vscode.env.openExternal(vscode.Uri.parse(LANDING_URL))
    ),
  ]
}
