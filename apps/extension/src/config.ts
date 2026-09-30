import * as vscode from "vscode"
import {
  normalizeFrequencyMinutes,
  normalizeQuietPeriodMinutes,
} from "./ads/policy"

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
    apiBaseUrl: cfg.get<string>("apiBaseUrl", "").trim(),
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
