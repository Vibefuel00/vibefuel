import { randomUUID } from "node:crypto"
import * as vscode from "vscode"
import type { ClientInfo } from "../api/types"

/** Per-editor-session facts. The session id rotates every activation. */
export interface Session {
  id: string
  startedAt: number
  client: ClientInfo
}

export function createSession(context: vscode.ExtensionContext): Session {
  const packageJson = context.extension.packageJSON as { version?: string }
  return {
    id: randomUUID(),
    startedAt: Date.now(),
    client: {
      editor: vscode.env.appName,
      editor_version: vscode.version,
      extension_version: packageJson.version ?? "0.0.0",
    },
  }
}
