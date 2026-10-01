import * as vscode from "vscode"
import { VIEW_ID } from "../constants"
import { renderFeedHtml } from "./html"
import type { FeedState, FromWebview, ToWebview } from "./messages"

export interface FeedViewDelegate {
  getState(): FeedState
  onMessage(message: FromWebview): Promise<void>
  onVisibilityChanged(visible: boolean): void
}

/**
 * The only surface that renders a full sponsored card. Re-renders the HTML
 * only when the set of allowed image origins changes, and otherwise pushes
 * state through postMessage.
 */
export class FeedViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = VIEW_ID
  private view: vscode.WebviewView | undefined
  private renderedOrigins = ""
  private readonly disposables: vscode.Disposable[] = []

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly delegate: FeedViewDelegate
  ) {}

  get visible(): boolean {
    return this.view?.visible ?? false
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    }
    webviewView.description = "Sponsored"
    this.renderedOrigins = ""
    this.render(true)

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage((raw: unknown) => {
        const message = raw as FromWebview
        void this.delegate.onMessage(message).then(() => this.render(false))
      }),
      webviewView.onDidChangeVisibility(() => {
        this.delegate.onVisibilityChanged(webviewView.visible)
        if (webviewView.visible) this.render(false)
      }),
      webviewView.onDidDispose(() => {
        this.delegate.onVisibilityChanged(false)
        this.view = undefined
        this.disposeListeners()
      })
    )
    this.delegate.onVisibilityChanged(webviewView.visible)
  }

  /** Push the latest state; re-render HTML if the CSP needs to change. */
  render(force: boolean): void {
    const view = this.view
    if (!view) return
    const state = this.delegate.getState()
    const origins = [
      ...new Set(
        [state.ad?.image_url, state.ad?.logo_url]
          .filter((u): u is string => typeof u === "string")
          .map((u) => new URL(u).origin)
      ),
    ]
    const key = origins.join(" ")
    if (force || key !== this.renderedOrigins) {
      this.renderedOrigins = key
      view.webview.html = renderFeedHtml(
        view.webview,
        this.extensionUri,
        origins
      )
      // The script posts "ready" once loaded and receives the state then.
      return
    }
    this.post({ type: "state", state })
  }

  private post(message: ToWebview): void {
    void this.view?.webview.postMessage(message)
  }

  dispose(): void {
    this.disposeListeners()
  }

  private disposeListeners(): void {
    while (this.disposables.length > 0) this.disposables.pop()?.dispose()
  }
}
