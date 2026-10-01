// Sponsor placements featured across the site. Colors follow each brand's own
// site so every card reads as that brand rather than as a generic template.

export type Sponsor = {
  id: "usepaid" | "zed" | "axiom"
  advertiser: string
  domain: string
  url: string
  headline: string
  body: string
  reward: number
  logo: string
  theme: {
    bg: string
    fg: string
    muted: string
    logoBg: string
  }
}

export const SPONSORS: readonly Sponsor[] = [
  {
    id: "usepaid",
    advertiser: "UsePaid",
    domain: "usepaid.app",
    url: "https://usepaid.app/",
    headline: "Launch tokens and claim creator fees.",
    body: "Route creator fees to recipients and claim them in SOL.",
    reward: 12,
    logo: "/sponsors/usepaid.svg",
    theme: {
      bg: "#0a0a0a",
      fg: "#ffffff",
      muted: "rgba(255, 255, 255, 0.66)",
      logoBg: "#0a0a0a",
    },
  },
  {
    id: "zed",
    advertiser: "Zed",
    domain: "zed.dev",
    url: "https://zed.dev/",
    headline: "Your last next editor.",
    body: "A high-performance, multiplayer code editor.",
    reward: 9,
    logo: "/sponsors/zed.svg",
    theme: {
      bg: "#dae4f8",
      fg: "#1b1e23",
      muted: "rgba(27, 30, 35, 0.66)",
      logoBg: "#ffffff",
    },
  },
  {
    id: "axiom",
    advertiser: "Axiom",
    domain: "axiom.trade",
    url: "https://axiom.trade/pulse?chain=sol",
    headline: "Discover new Solana launches on Pulse.",
    body: "A live feed of new tokens as they appear on Solana.",
    reward: 15,
    logo: "/sponsors/axiom.png",
    theme: {
      bg: "linear-gradient(135deg, #0f1015 0%, #1d1f2b 100%)",
      fg: "#f1f2f6",
      muted: "rgba(241, 242, 246, 0.66)",
      logoBg: "#0f1015",
    },
  },
]

export function sponsorStyle(s: Sponsor): React.CSSProperties {
  return {
    "--ad-bg": s.theme.bg,
    "--ad-fg": s.theme.fg,
    "--ad-muted": s.theme.muted,
    "--ad-logo-bg": s.theme.logoBg,
  } as React.CSSProperties
}
