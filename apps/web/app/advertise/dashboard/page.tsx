import Link from "next/link"
import { redirect } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { currentAdvertiser } from "@/lib/auth"
import { tokensToSol } from "@/lib/env"
import { advertiserCampaignRows } from "@/lib/stats"

export const metadata = { title: "Campaigns — Vibefuel" }
export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_payment: "Awaiting payment",
  active: "Live",
  paused: "Paused",
  exhausted: "Budget spent",
}

export default async function AdvertiserDashboard() {
  const adv = await currentAdvertiser()
  if (!adv) redirect("/advertise")
  const rows = await advertiserCampaignRows(adv.id)
  const totals = rows.reduce(
    (a, r) => ({
      impressions: a.impressions + r.impressions,
      clicks: a.clicks + r.clicks,
      spent: a.spent + r.spentTokens,
      live: a.live + (r.status === "active" ? 1 : 0),
    }),
    { impressions: 0, clicks: 0, spent: 0, live: 0 }
  )

  return (
    <main className="app-shell adv-shell">
      <SiteHeader mode="advertiser" signedIn />
      <section className="app-wide">
        <div className="page-head">
          <div>
            <p className="eyebrow">{adv.company} · {adv.walletAddress.slice(0, 4)}…{adv.walletAddress.slice(-4)}</p>
            <h1 className="page-title">Campaigns</h1>
          </div>
          <Link href="/advertise" className="btn btn-primary">
            New campaign
          </Link>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <span className="stat-label">Live campaigns</span>
            <span className="stat-value">{totals.live}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Impressions</span>
            <span className="stat-value">{totals.impressions.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Clicks</span>
            <span className="stat-value">{totals.clicks.toLocaleString()}</span>
            <span className="stat-sub">
              {totals.impressions ? `${((totals.clicks / totals.impressions) * 100).toFixed(1)}% CTR` : "—"}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Spent</span>
            <span className="stat-value">{totals.spent.toLocaleString()}</span>
            <span className="stat-sub">tokens · ≈ {tokensToSol(totals.spent).toFixed(3)} SOL</span>
          </div>
        </div>

        <div className="panel">
          {rows.length === 0 ? (
            <p className="panel-text">
              No campaigns yet. Pick a plan, pay in SOL from your wallet, and it goes live
              the moment the transfer confirms.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>Spent / budget</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <span className="table-sub">{r.advertiserName} · {r.headline}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td>{r.impressions.toLocaleString()}</td>
                    <td>{r.clicks.toLocaleString()}</td>
                    <td>
                      {r.spentTokens.toLocaleString()} / {r.budgetTokens.toLocaleString()}
                    </td>
                    <td>
                      <Link href={`/advertise/campaigns/${r.id}`} className="table-link">
                        {r.status === "pending_payment" ? "Pay" : "Details"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
