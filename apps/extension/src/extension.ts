import * as vscode from "vscode"
import { registerCommands } from "./commands"
import { OUTPUT_CHANNEL_NAME } from "./constants"
import { Controller } from "./controller"
import { createSession } from "./state/session"
import { StatusBar } from "./statusBar"
import { FeedViewProvider } from "./webview/feedView"

let controller: Controller | undefined

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME)
  const session = createSession(context)
  controller = new Controller({
    extensionUri: context.extensionUri,
    globalState: context.globalState,
    secrets: context.secrets,
    output,
    session,
  })

  const feedView = new FeedViewProvider(context.extensionUri, {
    getState: () => controller!.getFeedState(),
    onMessage: (message) => controller!.handleMessage(message),
    onVisibilityChanged: (visible) =>
      controller!.onViewVisibilityChanged(visible),
  })
  const statusBar = new StatusBar()

  const refresh = (): void => {
    const c = controller
    if (!c) return
    feedView.render(false)
    statusBar.update({
      show: c.currentConfig.showStatusBar,
      enabled: c.currentConfig.enabled,
      paused: c.getFeedState().paused,
      balance: c.balance,
      newMessageWaiting: c.newMessageWaiting,
      offline: c.isOffline,
    })
  }

  context.subscriptions.push(
    output,
    controller,
    feedView,
    statusBar,
    controller.onDidChange(refresh),
    vscode.window.registerWebviewViewProvider(
      FeedViewProvider.viewId,
      feedView
    ),
    ...registerCommands(controller)
  )

  await controller.start()
  refresh()

  if (
    !controller.currentConfig.enabled &&
    context.globalState.get("vibefuel.onboardingSeen") !== true
  ) {
    // First activation: reveal the opt-in screen once. Nothing runs until opt-in.
    await context.globalState.update("vibefuel.onboardingSeen", true)
    await vscode.commands.executeCommand(`${FeedViewProvider.viewId}.focus`)
  }
}

export function deactivate(): void {
  controller = undefined
}
