"use client"

import * as React from "react"
import Link from "next/link"

import { StartModal } from "@/components/app/start-modal"
import { HeroDemo } from "@/components/hero-demo"
import { Reveal } from "@/components/reveal"
import { SiteHeader, type Role } from "@/components/site-header"
import { BUILDER } from "@/lib/site"
import { LINKS } from "@/lib/links"
import {
  ClaudeLogo,
  CursorLogo,
  GitHubLogo,
  VSCodeLogo,
} from "@/components/tool-logos"

type HeroCopy = {
  headline: readonly string[]
  description: string
  caption: string
  primaryLabel: string
  secondaryLabel: string
}

const COPY: Record<Role, HeroCopy> = {
  developer: {
    headline: ["Let your vibe coding", "pay for itself."],
    description:
      "See ads in your coding tools. Earn tokens on Solana from advertisers and put them toward your next AI credits.",
    caption: "Built for your AI coding workflow",
    primaryLabel: "Start earning",
    secondaryLabel: "Run an ad",
  },
  advertiser: {
    headline: ["Put your brand", "in their workflow."],
    description:
      "Place ads in AI coding tools and reach developers while they build. Your campaign funds their rewards on Solana.",
    caption: "Turn your ad budget into fuel for builders",
    primaryLabel: "Run an ad",
    secondaryLabel: "Start earning",
  },
}

function ArrowIcon() {
  return (
    <svg
      className="action-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

const PRIMARY_HREF: Record<Role, string> = {
  developer: "/start",
  advertiser: "/advertise",
}

const SECONDARY_HREF: Record<Role, string> = {
  developer: "/advertise",
  advertiser: "/",
}

const INSTALLS = [
  {
    eyebrow: "Download on the",
    title: "VS Code Marketplace",
    href: LINKS.marketplace,
    Logo: VSCodeLogo,
    bg: "#0078d4",
    fg: "#ffffff",
  },
  {
    eyebrow: "Get it for Cursor on",
    title: "Open VSX",
    href: LINKS.openVsx,
    Logo: CursorLogo,
    bg: "#0a0a0a",
    fg: "#ffffff",
  },
  {
    eyebrow: "Install the plugin for",
    title: "Claude Code",
    href: LINKS.claudeCodeRepo,
    Logo: ClaudeLogo,
    bg: "#d97757",
    fg: "#ffffff",
  },
  {
    eyebrow: "View the source on",
    title: "GitHub",
    href: LINKS.sourceRepo,
    Logo: GitHubLogo,
    bg: "#24292f",
    fg: "#ffffff",
  },
] as const

function HeroCopyBlock({
  role,
  active,
  onStart,
}: {
  role: Role
  active: boolean
  onStart: () => void
}) {
  const copy = COPY[role]
  return (
    <div
      className="hero-copy"
      data-role={role}
      aria-hidden={!active}
      inert={!active}
    >
      <h1 id={active ? "hero-title" : undefined} className="hero-title">
        {copy.headline.map((line, index) => (
          <React.Fragment key={line}>
            {index > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </h1>
      <p className="hero-description">{copy.description}</p>
      <p className="hero-caption">
        {copy.caption}
        <span className="hero-credit">
          · Built on Solana by{" "}
          <a
            href={BUILDER.url}
            target="_blank"
            rel="noopener"
            className="hero-builder"
            tabIndex={active ? 0 : -1}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- small avatar served from /public */}
            <img src={BUILDER.avatar} alt="" width="18" height="18" />@
            {BUILDER.handle}
          </a>
        </span>
      </p>
      {role === "developer" && (
        <div className="hero-installs" aria-label="Install Vibefuel">
          {INSTALLS.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="install-badge"
              style={
                {
                  "--badge-bg": item.bg,
                  "--badge-fg": item.fg,
                } as React.CSSProperties
              }
              target="_blank"
              rel="noopener"
              tabIndex={active ? 0 : -1}
            >
              <item.Logo className="install-badge-logo" />
              <span className="install-badge-text">
                <span className="install-badge-eyebrow">{item.eyebrow}</span>
                <span className="install-badge-title">{item.title}</span>
              </span>
            </a>
          ))}
        </div>
      )}
      <div className="hero-actions">
        {role === "developer" ? (
          <button
            type="button"
            className="action-button action-primary"
            tabIndex={active ? 0 : -1}
            onClick={onStart}
          >
            {copy.primaryLabel}
            <ArrowIcon />
          </button>
        ) : (
          <Link
            href={PRIMARY_HREF[role]}
            className="action-button action-primary"
            tabIndex={active ? 0 : -1}
          >
            {copy.primaryLabel}
            <ArrowIcon />
          </Link>
        )}
        {role === "advertiser" ? (
          <button
            type="button"
            className="action-button action-secondary"
            tabIndex={active ? 0 : -1}
            onClick={onStart}
          >
            {copy.secondaryLabel}
          </button>
        ) : (
          <Link
            href={SECONDARY_HREF[role]}
            className="action-button action-secondary"
            tabIndex={active ? 0 : -1}
          >
            {copy.secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  )
}

const ROLE_VALUES: readonly Role[] = ["developer", "advertiser"]

export function Landing() {
  const [role, setRole] = React.useState<Role>("developer")
  const [startOpen, setStartOpen] = React.useState(false)

  // /#start (and the old /start route) opens the key modal.
  React.useEffect(() => {
    const check = () => {
      if (window.location.hash === "#start") setStartOpen(true)
    }
    check()
    window.addEventListener("hashchange", check)
    return () => window.removeEventListener("hashchange", check)
  }, [])

  function closeStart() {
    setStartOpen(false)
    if (window.location.hash === "#start")
      window.history.replaceState(null, "", window.location.pathname)
  }

  return (
    <>
      <SiteHeader mode="landing" role={role} onRoleChange={setRole} />

      <section className="hero" aria-labelledby="hero-title">
        <Reveal className="hero-content" y={18}>
          {ROLE_VALUES.map((value) => (
            <HeroCopyBlock
              key={value}
              role={value}
              active={value === role}
              onStart={() => setStartOpen(true)}
            />
          ))}
        </Reveal>
        <Reveal className="hero-aside" delay={0.15} y={26}>
          <HeroDemo />
        </Reveal>
      </section>

      <StartModal open={startOpen} onClose={closeStart} />
    </>
  )
}
