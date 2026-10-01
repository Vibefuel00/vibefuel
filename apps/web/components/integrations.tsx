"use client"

import * as React from "react"

import {
  ClaudeLogo,
  CopilotLogo,
  CursorLogo,
  JetBrainsLogo,
  VSCodeLogo,
  WindsurfLogo,
} from "@/components/tool-logos"
import { Reveal } from "@/components/reveal"
import { SPONSORS, sponsorStyle, type Sponsor } from "@/components/sponsors"

type ToolId =
  | "cursor"
  | "vscode"
  | "claude"
  | "copilot"
  | "windsurf"
  | "jetbrains"

type Tool = {
  id: ToolId
  name: string
  Logo: (props: { className?: string }) => React.JSX.Element
  /** Which mock frame to render in the preview. */
  frame: "editor" | "terminal"
  /** Title shown in the mock window's title bar. */
  windowTitle: string
  /** Short line under the "How it works" heading. */
  summary: string
  steps: readonly [string, string, string]
}

const TOOLS: readonly Tool[] = [
  {
    id: "cursor",
    name: "Cursor",
    Logo: CursorLogo,
    frame: "editor",
    windowTitle: "Cursor — vibefuel-app",
    summary:
      "Vibefuel runs as a regular extension in Cursor. Sponsored messages live in their own sidebar panel, never in your editor or chat.",
    steps: [
      "Install the Vibefuel extension from Open VSX.",
      "Open the Vibefuel panel in the sidebar and opt in.",
      "Sponsored messages appear a few times a day. Each qualified view earns tokens.",
    ],
  },
  {
    id: "vscode",
    name: "VS Code",
    Logo: VSCodeLogo,
    frame: "editor",
    windowTitle: "Visual Studio Code — vibefuel-app",
    summary:
      "The same extension, straight from the marketplace. Your code and prompts never leave your machine.",
    steps: [
      "Install Vibefuel from the VS Code Marketplace.",
      "Open the Vibefuel panel and link a Solana address if you want payouts.",
      "Keep building. Your balance shows in the status bar.",
    ],
  },
  {
    id: "claude",
    name: "Claude Code",
    Logo: ClaudeLogo,
    frame: "terminal",
    windowTitle: "Terminal — claude",
    summary:
      "For terminal workflows, a sponsored line shows between tasks, clearly labeled and easy to skip.",
    steps: [
      "Enable the Vibefuel hook for your terminal agent.",
      "A short sponsored message appears after a task finishes, never mid-task.",
      "Tokens accrue to the same balance as your editor.",
    ],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    Logo: CopilotLogo,
    frame: "editor",
    windowTitle: "Visual Studio Code — vibefuel-app",
    summary:
      "Vibefuel sits alongside Copilot in VS Code. It never touches completions or Copilot Chat.",
    steps: [
      "Install Vibefuel in the same VS Code you use Copilot in.",
      "Opt in from the Vibefuel panel.",
      "Copilot keeps working as before. Vibefuel earns on the side.",
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    Logo: WindsurfLogo,
    frame: "editor",
    windowTitle: "Windsurf — vibefuel-app",
    summary:
      "Windsurf installs VS Code extensions from Open VSX, so Vibefuel works out of the box.",
    steps: [
      "Install the Vibefuel extension from Open VSX.",
      "Open the panel and opt in.",
      "Sponsored messages stay in the panel. Cascade stays untouched.",
    ],
  },
  {
    id: "jetbrains",
    name: "JetBrains",
    Logo: JetBrainsLogo,
    frame: "editor",
    windowTitle: "IntelliJ IDEA — vibefuel-app",
    summary:
      "A tool window plugin for JetBrains IDEs is planned. Same panel, same rules, same balance.",
    steps: [
      "Install the Vibefuel plugin from the JetBrains Marketplace when it ships.",
      "Open the Vibefuel tool window and opt in.",
      "Earn while you build, across every JetBrains IDE you use.",
    ],
  },
]


// Faux code lines for the editor mock: [indent, [tone, width]...]
const CODE_LINES: ReadonlyArray<
  readonly [number, ReadonlyArray<readonly [string, number]>]
> = [
  [0, [["k", 34], ["n", 72], ["p", 40]]],
  [1, [["n", 56], ["p", 96]]],
  [1, [["k", 28], ["n", 48], ["s", 88]]],
  [2, [["n", 120], ["p", 36]]],
  [1, [["c", 140]]],
  [1, [["k", 40], ["n", 64]]],
  [0, [["p", 18]]],
  [0, [["k", 52], ["n", 90], ["p", 30]]],
  [1, [["n", 44], ["s", 110]]],
]

function SponsoredCard({ ad }: { ad: Sponsor }) {
  return (
    <div className="ad-card ad-card-compact" style={sponsorStyle(ad)}>
      <div className="ad-card-top">
        <span className="ad-label">Sponsored</span>
        <span className="ad-reward">Earn {ad.reward} tokens</span>
      </div>
      <div className="ad-card-main">
        <span className="ad-logo">
          {/* eslint-disable-next-line @next/next/no-img-element -- small sponsor logo from an arbitrary host */}
          <img src={ad.logo} alt="" width="26" height="26" />
        </span>
        <div className="ad-card-text">
          <p className="ad-advertiser">
            {ad.advertiser} · {ad.domain}
          </p>
          <a
            className="ad-headline"
            href={ad.url}
            target="_blank"
            rel="noopener sponsored"
          >
            {ad.headline}
          </a>
          <p className="ad-body">{ad.body}</p>
        </div>
      </div>
    </div>
  )
}

function EditorFrame({ tool, ad }: { tool: Tool; ad: Sponsor }) {
  return (
    <div className="mock-window" data-frame="editor">
      <div className="mock-titlebar">
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mock-title">{tool.windowTitle}</span>
      </div>
      <div className="mock-body">
        <div className="mock-activity" aria-hidden="true">
          <i />
          <i />
          <i />
          <i className="is-active" />
        </div>
        <div className="mock-sidebar">
          <div className="mock-sidebar-title">Vibefuel</div>
          <SponsoredCard ad={ad} />
          <div className="mock-balance">
            <span>Balance</span>
            <strong>128 tokens</strong>
          </div>
        </div>
        <div className="mock-editor" aria-hidden="true">
          <div className="mock-tabs">
            <span className="is-active">app.tsx</span>
            <span>agent.ts</span>
          </div>
          <div className="mock-code">
            {CODE_LINES.map(([indent, segments], row) => (
              <div
                key={row}
                className="mock-line"
                style={{ paddingLeft: `${indent * 16}px` }}
              >
                {segments.map(([tone, width], i) => (
                  <i
                    key={i}
                    className={`mock-tok tone-${tone}`}
                    style={{ width: `${width}px` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mock-statusbar">
        <span>main</span>
        <span className="mock-status-fuel">⛽ 128 tokens</span>
      </div>
    </div>
  )
}

function TerminalFrame({ tool, ad }: { tool: Tool; ad: Sponsor }) {
  return (
    <div className="mock-window" data-frame="terminal">
      <div className="mock-titlebar">
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mock-title">{tool.windowTitle}</span>
      </div>
      <div className="mock-terminal">
        <p>
          <span className="t-prompt">❯</span> fix the failing tests in auth.ts
        </p>
        <p className="t-dim">Reading auth.ts, auth.test.ts</p>
        <p className="t-dim">Updated 2 files · 6 tests passing</p>
        <div className="mock-term-card" style={sponsorStyle(ad)}>
          <span className="mock-term-head">
            {/* eslint-disable-next-line @next/next/no-img-element -- small sponsor logo from an arbitrary host */}
          <img className="mock-term-logo" src={ad.logo} alt="" width="18" height="18" />
            <span className="mock-card-label">Sponsored</span>
          </span>
          <span className="t-strong">
            {ad.advertiser} · {ad.domain}
          </span>
          <a
            className="mock-term-link"
            href={ad.url}
            target="_blank"
            rel="noopener sponsored"
          >
            {ad.headline}
          </a>
          <span className="t-dim">Earn {ad.reward} tokens · Skip</span>
        </div>
        <p>
          <span className="t-prompt">❯</span>
          <span className="t-cursor" aria-hidden="true" />
        </p>
      </div>
    </div>
  )
}

export function Integrations() {
  const [active, setActive] = React.useState<ToolId>("cursor")
  const tabRefs = React.useRef<Partial<Record<ToolId, HTMLButtonElement | null>>>(
    {}
  )
  const toolIndex = Math.max(0, TOOLS.findIndex((t) => t.id === active))
  const tool = TOOLS[toolIndex]!
  const ad = SPONSORS[toolIndex % SPONSORS.length]!

  function indexAfterKey(key: string, index: number): number | null {
    if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % TOOLS.length
    if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + TOOLS.length) % TOOLS.length
    if (key === "Home") return 0
    if (key === "End") return TOOLS.length - 1
    return null
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const next = indexAfterKey(event.key, TOOLS.findIndex((t) => t.id === active))
    if (next === null) return
    event.preventDefault()
    const id = TOOLS[next]!.id
    setActive(id)
    tabRefs.current[id]?.focus()
  }

  return (
    <section className="integrations" aria-labelledby="integrations-title">
      <Reveal className="integrations-head">
        <h2 id="integrations-title" className="integrations-title">
          One extension.
          <br />
          Every tool you already open.
        </h2>
        <p className="integrations-lead">
          Pick a tool to see where sponsored messages show up. They live in
          their own panel, never in your code, completions or chat.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
      <div
        className="tool-tabs"
        role="tablist"
        aria-label="Supported tools"
        onKeyDown={onKeyDown}
      >
        {TOOLS.map(({ id, name, Logo }) => {
          const selected = id === active
          return (
            <button
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node
              }}
              type="button"
              role="tab"
              id={`tool-tab-${id}`}
              aria-selected={selected}
              aria-controls="tool-panel"
              tabIndex={selected ? 0 : -1}
              className="tool-tab"
              data-selected={selected ? "true" : undefined}
              onClick={() => setActive(id)}
            >
              <Logo className="tool-logo" />
              <span>{name}</span>
            </button>
          )
        })}
      </div>
      </Reveal>

      <Reveal delay={0.18}>
      <div
        id="tool-panel"
        role="tabpanel"
        aria-labelledby={`tool-tab-${tool.id}`}
        className="tool-panel"
      >
        <div className="tool-preview">
          {tool.frame === "terminal" ? (
            <TerminalFrame tool={tool} ad={ad} />
          ) : (
            <EditorFrame tool={tool} ad={ad} />
          )}
        </div>
        <div className="tool-how">
          <h3 className="tool-how-title">How it works in {tool.name}</h3>
          <p className="tool-how-summary">{tool.summary}</p>
          <ol className="tool-steps">
            {tool.steps.map((step, i) => (
              <li key={i}>
                <span className="tool-step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      </Reveal>

      <p className="integrations-note">
        Vibefuel is an independent extension. Tool names and logos belong to
        their owners and are shown for compatibility only. No affiliation or
        endorsement is implied. Sponsored cards are examples of the format.
      </p>
    </section>
  )
}
