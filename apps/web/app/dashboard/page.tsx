import { redirect } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import {
  KeyPanel,
  PayoutButton,
  WalletForm,
} from "@/components/app/dashboard-forms"
import { DashboardTabs } from "@/components/app/dashboard-tabs"
import { currentDeveloper } from "@/lib/auth"
import { env, tokensToSol } from "@/lib/env"
import { LINKS } from "@/lib/links"
import { IMPRESSION_COOLDOWN_HOURS } from "@/lib/ads"
import { developerRecentEvents, developerStats, formatHours } from "@/lib/stats"

export const metadata = { title: "Dashboard — Vibefuel" }
export const dynamic = "force-dynamic"

/** The extension sends a heartbeat about once a minute; ten minutes without one means it is off. */
function isRecentlySeen(lastSeenAt: Date | null): boolean {
  return lastSeenAt !== null && Date.now() - lastSeenAt.getTime() < 10 * 60_000
}

export default async function DashboardPage() {
  const dev = await currentDeveloper()
  if (!dev) redirect("/dashboard/login")
  const [stats, recent] = await Promise.all([
    developerStats(dev.id),
    developerRecentEvents(dev.id),
  ])
  const maxTokens = Math.max(1, ...stats.days.map((d) => d.tokens))
  const maxSeconds = Math.max(1, ...stats.days.map((d) => d.seconds))
  const connected = isRecentlySeen(dev.lastSeenAt)
  const tokenSol = tokensToSol(1)

  const overview = (
    <div className="stack-lg">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Balance</span>
          <span className="stat-value">{stats.balance.toLocaleString()}</span>
          <span className="stat-sub">
            tokens · ≈ {tokensToSol(stats.balance).toFixed(4)} SOL
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Hours of work</span>
          <span className="stat-value">{formatHours(stats.activeSeconds)}</span>
          <span className="stat-sub">editor active time, all time</span>
        </div>
        <div className="stat">
          <span className="stat-label">Impressions</span>
          <span className="stat-value">
            {stats.impressions.toLocaleString()}
          </span>
          <span className="stat-sub">sponsored messages seen</span>
        </div>
        <div className="stat">
          <span className="stat-label">Clicks</span>
          <span className="stat-value">{stats.clicks.toLocaleString()}</span>
          <span className="stat-sub">
            {stats.impressions
              ? `${((stats.clicks / stats.impressions) * 100).toFixed(1)}% of impressions`
              : "no impressions yet"}
          </span>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h2 className="panel-title">Last 7 days</h2>
          <div
            className="bars"
            role="img"
            aria-label="Tokens earned and hours worked per day over the last seven days"
          >
            {stats.days.map((d) => (
              <div key={d.day} className="bar-col">
                <div className="bar-track">
                  <div
                    className="bar bar-tokens"
                    style={{ height: `${(d.tokens / maxTokens) * 100}%` }}
                    title={`${d.tokens} tokens`}
                  />
                  <div
                    className="bar bar-hours"
                    style={{ height: `${(d.seconds / maxSeconds) * 100}%` }}
                    title={formatHours(d.seconds)}
                  />
                </div>
                <span className="bar-label">{d.label}</span>
                <span className="bar-value">{d.tokens}</span>
              </div>
            ))}
          </div>
          <p className="legend">
            <span className="legend-swatch swatch-tokens" /> tokens
            <span className="legend-swatch swatch-hours" /> hours worked
          </p>
        </div>

        <div className="panel">
          <h2 className="panel-title">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="panel-text">
              Nothing yet. Once the extension is set up, sponsored messages you
              see will show up here with the tokens they earned.
            </p>
          ) : (
            <ul className="activity">
              {recent.map((e) => (
                <li key={e.id}>
                  <span className={`activity-type type-${e.type}`}>
                    {e.type}
                  </span>
                  <span className="activity-text">
                    <strong>{e.advertiser}</strong> · {e.headline}
                  </span>
                  <span className="activity-reward">
                    {e.reward > 0 ? `+${e.reward}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h2 className="panel-title">Payout wallet</h2>
          <WalletForm initial={dev.walletAddress ?? ""} />
        </div>
        <div className="panel">
          <h2 className="panel-title">Payout</h2>
          <p className="panel-text">
            {stats.requested > 0
              ? `${stats.requested} tokens are queued for payout.`
              : `${stats.paid} tokens paid out so far.`}
          </p>
          <PayoutButton
            balance={stats.balance}
            hasWallet={Boolean(dev.walletAddress)}
          />
        </div>
      </div>
    </div>
  )

  const how = (
    <div className="stack-lg">
      <div className="three-col">
        <div className="panel">
          <span className="step-num">1</span>
          <h2 className="panel-title">See</h2>
          <p className="panel-text">
            While your coding agent works, a sponsored card appears in the
            Vibefuel panel. Never in your code, your completions, or your chat.
            One card at a time, clearly labeled.
          </p>
        </div>
        <div className="panel">
          <span className="step-num">2</span>
          <h2 className="panel-title">Earn</h2>
          <p className="panel-text">
            A card counts once it has been visible for three seconds with your
            window focused. Each counted view credits the reward the advertiser
            set, straight to your balance.
          </p>
        </div>
        <div className="panel">
          <span className="step-num">3</span>
          <h2 className="panel-title">Spend</h2>
          <p className="panel-text">
            Save a Solana address and request a payout once you have 100 tokens.
            Put it toward your next AI credits, or keep it. Your call.
          </p>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h2 className="panel-title">The rules</h2>
          <ul className="rules">
            <li>
              <strong>
                One reward per advertiser every {IMPRESSION_COOLDOWN_HOURS}{" "}
                hours.
              </strong>{" "}
              You can see the same card again sooner, but it only pays once per
              window.
            </li>
            <li>
              <strong>Rewards come from a real budget.</strong> Advertisers pay
              in SOL up front. When a campaign's budget is spent, it stops
              showing.
            </li>
            <li>
              <strong>One token is {tokenSol.toFixed(4)} SOL.</strong> Balances
              show both so there are no surprises at payout.
            </li>
            <li>
              <strong>Clicking is optional.</strong> You earn for seeing, not
              clicking. Dismissing a card is fine too.
            </li>
            <li>
              <strong>Pause any time.</strong> Turn Vibefuel off in the
              extension and nothing is shown or sent.
            </li>
          </ul>
        </div>
        <div className="panel">
          <h2 className="panel-title">What leaves your machine</h2>
          <p className="panel-text">
            Only these, and only while Vibefuel is on:
          </p>
          <ul className="rules">
            <li>A heartbeat with your editor name and active minutes.</li>
            <li>Which cards were shown, clicked, or dismissed.</li>
            <li>Your serial key, to tie those to this dashboard.</li>
          </ul>
          <p className="panel-text">
            Never file contents, file names, prompts, completions, chat,
            keystrokes, or git remotes.
          </p>
        </div>
      </div>
    </div>
  )

  const setup = (
    <div className="stack-lg">
      <div className="two-col">
        <div className="panel">
          <h2 className="panel-title">Your extension key</h2>
          <p className="panel-text">
            Paste this into the Vibefuel extension. Treat it like a password:
            anyone with it can earn to your balance.
          </p>
          <KeyPanel prefix={dev.keyPrefix} canReveal={Boolean(dev.keyEnc)} />
        </div>
        <div className="panel">
          <h2 className="panel-title">Install</h2>
          <ol className="steps">
            <li>
              Install <strong>Vibefuel</strong> from the{" "}
              <a href={LINKS.marketplace} target="_blank" rel="noopener">
                VS Code Marketplace
              </a>{" "}
              or{" "}
              <a href={LINKS.openVsx} target="_blank" rel="noopener">
                Open VSX
              </a>{" "}
              (Cursor and Windsurf), or open it directly in{" "}
              <a href={LINKS.vscodeDeepLink}>VS Code</a> /{" "}
              <a href={LINKS.cursorDeepLink}>Cursor</a>. For Claude Code, use
              the{" "}
              <a href={LINKS.claudeCodeRepo} target="_blank" rel="noopener">
                plugin
              </a>
              .
            </li>
            <li>Open the Vibefuel panel from the activity bar.</li>
            <li>Paste your key and opt in.</li>
            <li>
              Come back here. The status pill at the top turns green once the
              extension has checked in.
            </li>
          </ol>
          <p className="panel-foot">
            Status now:{" "}
            {connected
              ? `connected via ${dev.editor ?? "your editor"}`
              : dev.lastSeenAt
                ? `last seen ${dev.lastSeenAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC`
                : "not connected yet"}
            .
          </p>
        </div>
      </div>
      <div className="panel panel-muted">
        <h2 className="panel-title">Building your own integration?</h2>
        <p className="panel-text">
          The same key works as a Bearer token against the Vibefuel API.
          Endpoints and the event rules are documented in the repo under{" "}
          <code className="inline-code">docs/extension-api.md</code>. Base URL:{" "}
          <code className="inline-code">{env.appUrl}</code>.
        </p>
      </div>
    </div>
  )

  return (
    <main className="app-shell dev-shell">
      <SiteHeader mode="developer" signedIn />
      <section className="app-wide">
        <div className="page-head">
          <div>
            <p className="eyebrow">Your earnings</p>
            <h1 className="page-title">Dashboard</h1>
          </div>
          <p className={`status-pill ${connected ? "is-on" : ""}`}>
            <span className="status-dot" aria-hidden="true" />
            {connected
              ? `Extension connected · ${dev.editor ?? "editor"}`
              : dev.lastSeenAt
                ? `Last seen ${dev.lastSeenAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC`
                : "Extension not connected yet"}
          </p>
        </div>
        <DashboardTabs panels={{ overview, how, setup }} />
      </section>
    </main>
  )
}
