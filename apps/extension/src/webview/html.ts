import { randomBytes } from "node:crypto"
import * as vscode from "vscode"

export function nonce(): string {
  return randomBytes(16).toString("base64url")
}

/**
 * Build the sidebar HTML. The CSP is strict: scripts only with the nonce,
 * styles only from the extension, images only from the extension plus the
 * https origin of the current ad image (passed in by the caller).
 */
export function renderFeedHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  allowedImageOrigins: string[]
): string {
  const n = nonce()
  const script = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "feed.js")
  )
  const style = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "feed.css")
  )
  const imgSources = [webview.cspSource, ...allowedImageOrigins].join(" ")
  const csp = [
    "default-src 'none'",
    `img-src ${imgSources}`,
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${n}'`,
    `font-src ${webview.cspSource}`,
  ].join("; ")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${style.toString()}" />
  <title>Vibefuel</title>
</head>
<body>
  <main id="app" aria-live="polite" aria-busy="true">
    <p class="loading">Loading Vibefuel…</p>
  </main>
  <script nonce="${n}" src="${script.toString()}"></script>
</body>
</html>`
}
