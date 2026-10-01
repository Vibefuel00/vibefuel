import { Reveal } from "@/components/reveal"
import { SPONSORS } from "@/components/sponsors"
import { CursorLogo, VSCodeLogo, WindsurfLogo } from "@/components/tool-logos"
import { tokensToSol } from "@/lib/env"
import { IMPRESSION_COOLDOWN_HOURS } from "@/lib/ads"
import { SEED_RATES, siteStats } from "@/lib/site-stats"
import { LiveNumber } from "@/components/live-number"


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
          Growing every day as developers build and advertisers run campaigns.
          Tokens are funded by advertisers and earned by developers.
        </p>
      </Reveal>

      <div className="bento">
        <Reveal className="tile tile-hero" delay={0.0}>
          <span className="tile-label">Tokens earned by developers</span>
          <LiveNumber className="tile-big" value={s.tokensEarned} rate={SEED_RATES.tokensEarned} />
          <span className="tile-sub">
            ≈ {tokensToSol(s.tokensEarned).toFixed(2)} SOL across{" "}
            <LiveNumber value={s.impressions} rate={SEED_RATES.impressions} kind="int" /> sponsored views
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
          <LiveNumber className="tile-big" value={s.developers} rate={SEED_RATES.developers} kind="int" />
          <span className="tile-sub">keys issued, no sign-up form</span>
        </Reveal>

        <Reveal className="tile tile-wide" delay={0.18}>
          <span className="tile-label">Hours of work tracked</span>
          <LiveNumber className="tile-big" value={s.activeSeconds} rate={SEED_RATES.activeSeconds} kind="hours" />
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
