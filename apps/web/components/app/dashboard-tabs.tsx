"use client"

import * as React from "react"

export type TabId = "overview" | "how" | "setup"

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "how", label: "How it works" },
  { id: "setup", label: "Setup" },
]

function readHash(): TabId {
  const h = window.location.hash.replace("#", "")
  return TABS.some((t) => t.id === h) ? (h as TabId) : "overview"
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

export function DashboardTabs({ panels }: { panels: Record<TabId, React.ReactNode> }) {
  // The URL hash is the source of truth, so a tab can be linked to and the
  // server render (no hash) always starts on the overview.
  const active = React.useSyncExternalStore(subscribe, readHash, () => "overview" as TabId)
  const refs = React.useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  function select(id: TabId) {
    const url = id === "overview" ? window.location.pathname : `#${id}`
    window.history.replaceState(null, "", url)
    window.dispatchEvent(new HashChangeEvent("hashchange"))
  }

  function indexAfterKey(key: string, i: number): number | null {
    if (key === "ArrowRight") return (i + 1) % TABS.length
    if (key === "ArrowLeft") return (i - 1 + TABS.length) % TABS.length
    if (key === "Home") return 0
    if (key === "End") return TABS.length - 1
    return null
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const n = indexAfterKey(e.key, TABS.findIndex((t) => t.id === active))
    if (n === null) return
    e.preventDefault()
    const id = TABS[n]!.id
    select(id)
    refs.current[id]?.focus()
  }

  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label="Dashboard sections" onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(n) => {
              refs.current[t.id] = n
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className="tab"
            data-selected={active === t.id ? "true" : undefined}
            onClick={() => select(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={active !== t.id}
          className="tabpanel"
        >
          {panels[t.id]}
        </div>
      ))}
    </div>
  )
}
