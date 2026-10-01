import { Reveal } from "@/components/reveal"
import { SPONSORS } from "@/components/sponsors"
import { CursorLogo, VSCodeLogo, WindsurfLogo } from "@/components/tool-logos"
import { tokensToSol } from "@/lib/env"
import { IMPRESSION_COOLDOWN_HOURS } from "@/lib/ads"
import { siteStats } from "@/lib/site-stats"

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

function hours(seconds: number): string {
  const h = seconds / 3600
  return h < 10 ? h.toFixed(1) : compact(Math.round(h))
}

/** Bento grid of live numbers and a few fixed facts about how Vibefuel works. */
export async function StatsBento() {
  const s = await siteStats()
  // The featured sponsors count as advertisers on board alongside paying ones.
  const advertisers = s.advertisers + SPONSORS.length
  const tokenSol = tokensToSol(1)

  return (
    <section className="bento-section" aria-labelledby="bento-title">
      <Reveal className="bento-head">
        <h2 id="bento-title" className="integrations-title">
          The numbers
          <br />
          so far.
        </h2>
        <p className="integrations-lead">
          Live from the platform. Every token here was funded by an advertiser and
          earned by a developer who kept building.
        </p>
      </Reveal>

      <div className="bento">
        <Reveal className="tile tile-hero" delay={0.0}>
          <span className="tile-label">Tokens earned by developers</span>
          <span className="tile-big">{compact(s.tokensEarned)}</span>
          <span className="tile-sub">
            ≈ {tokensToSol(s.tokensEarned).toFixed(3)} SOL across {compact(s.impressions)} sponsored views
          </span>
          <span className="tile-glow" aria-hidden="true" />
        </Reveal>

        <Reveal className="tile tile-dark" delay={0.06}>
          <span className="tile-label">Advertisers on board</span>
          <span className="tile-big">{advertisers}</span>
          <span className="tile-logos" aria-hidden="true">
            {SPONSORS.map((sp) => (
              <span key={sp.id} className="tile-logo" style={{ background: sp.theme.logoBg }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- small sponsor logo */}
                <img src={sp.logo} alt="" width="22" height="22" />
              </span>
            ))}
          </span>
          <span className="tile-sub">{s.liveCampaigns} campaign{s.liveCampaigns === 1 ? "" : "s"} live right now</span>
        </Reveal>

        <Reveal className="tile" delay={0.12}>
          <span className="tile-label">Developers earning</span>
          <span className="tile-big">{compact(s.developers)}</span>
          <span className="tile-sub">keys issued, no sign-up form</span>
        </Reveal>

        <Reveal className="tile tile-wide" delay={0.18}>
          <span className="tile-label">Hours of work tracked</span>
          <span className="tile-big">{hours(s.activeSeconds)}</span>
          <span className="tile-sub">editor time reported by the extension, nothing else</span>
        </Reveal>

        <Reveal className="tile tile-accent" delay={0.24}>
          <span className="tile-label">One token is</span>
          <span className="tile-big tile-big-sm">{tokenSol.toFixed(4)} SOL</span>
          <span className="tile-sub">paid out to your wallet, from 100 tokens</span>
        </Reveal>

        <Reveal className="tile" delay={0.3}>
          <span className="tile-label">Fair pacing</span>
          <span className="tile-big tile-big-sm">1 / {IMPRESSION_COOLDOWN_HOURS}h</span>
          <span className="tile-sub">one rewarded view per advertiser, per developer</span>
        </Reveal>

        <Reveal className="tile tile-wide tile-tools" delay={0.36}>
          <span className="tile-label">Works where you already build</span>
          <span className="tile-tools-row" aria-hidden="true">
            <span className="tile-tool"><CursorLogo className="tile-tool-logo" /> Cursor</span>
            <span className="tile-tool"><VSCodeLogo className="tile-tool-logo" /> VS Code</span>
            <span className="tile-tool"><WindsurfLogo className="tile-tool-logo" /> Windsurf</span>
          </span>
          <span className="tile-sub">one extension, your code never leaves your machine</span>
        </Reveal>
      </div>
    </section>
  )
}
