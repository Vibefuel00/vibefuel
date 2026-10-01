import * as vscode from "vscode"
import { DEFAULT_API_BASE_URL } from "./constants"
import {
  normalizeFrequencyMinutes,
  normalizeQuietPeriodMinutes,
} from "@workspace/vibefuel-core"

export interface VibefuelConfig {
  enabled: boolean
  frequencyMinutes: number
  quietPeriodMinutes: number
  showStatusBar: boolean
  apiBaseUrl: string
  telemetry: boolean
}

export function readConfig(): VibefuelConfig {
  const cfg = vscode.workspace.getConfiguration("vibefuel")
  return {
    enabled: cfg.get<boolean>("enabled", false),
    frequencyMinutes: normalizeFrequencyMinutes(cfg.get("frequencyMinutes")),
    quietPeriodMinutes: normalizeQuietPeriodMinutes(
      cfg.get("quietPeriodMinutes")
    ),
    showStatusBar: cfg.get<boolean>("showStatusBar", true),
    apiBaseUrl: normalizeApiBaseUrl(
      cfg.get<string>("apiBaseUrl", DEFAULT_API_BASE_URL)
    ),
    telemetry: cfg.get<boolean>("telemetry", true),
  }
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await vscode.workspace
    .getConfiguration("vibefuel")
    .update("enabled", enabled, vscode.ConfigurationTarget.Global)
}

/** Events may only be sent when both the editor and the user allow it. */
export function eventsAllowed(config: VibefuelConfig): boolean {
  return vscode.env.isTelemetryEnabled && config.telemetry
}

/** Empty or "mock" selects mock mode; anything else must be an http(s) URL. */
export function normalizeApiBaseUrl(value: unknown): string {
  const v = typeof value === "string" ? value.trim() : ""
  if (v === "" || v.toLowerCase() === "mock") return ""
  return /^https?:\/\//i.test(v) ? v : DEFAULT_API_BASE_URL
}
