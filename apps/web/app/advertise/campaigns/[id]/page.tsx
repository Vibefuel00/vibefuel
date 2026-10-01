import { and, eq } from "drizzle-orm"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import QRCode from "qrcode"

import { db, schema } from "@/db"
import { setCampaignStatus } from "@/app/advertise/actions"
import { SiteHeader } from "@/components/site-header"
import { CreativeForm } from "@/components/app/creative-form"
import { PayPanel } from "@/components/app/pay-panel"
import { currentAdvertiser } from "@/lib/auth"
import { env, LAMPORTS_PER_SOL, tokensToSol } from "@/lib/env"
import { paymentsEnabled, solanaPayUrl } from "@/lib/solana"
import { campaignStats } from "@/lib/stats"

export const dynamic = "force-dynamic"

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const adv = await currentAdvertiser()
  if (!adv) redirect("/advertise")

  const [c] = await db
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.advertiserId, adv.id)))
    .limit(1)
  if (!c) notFound()

  const [stats, [payment]] = await Promise.all([
    campaignStats(c.id),
    db.select().from(schema.payments).where(eq(schema.payments.campaignId, c.id)).limit(1),
  ])

  let pay: { sol: string; payUrl: string; qrSvg: string; reference: string } | null = null
  if (c.status === "pending_payment" && payment && paymentsEnabled()) {
    const payUrl = solanaPayUrl({
      lamports: payment.lamports,
      reference: payment.reference,
      label: "Vibefuel",
      message: `Campaign: ${c.name}`,
    })
    const qrSvg = await QRCode.toString(payUrl, { type: "svg", margin: 1, width: 220 })
    pay = { sol: (payment.lamports / LAMPORTS_PER_SOL).toString(), payUrl, qrSvg, reference: payment.reference }
  }

  const remaining = Math.max(0, c.budgetTokens - c.spentTokens)
  const pause = setCampaignStatus.bind(null, c.id, "paused")
  const resume = setCampaignStatus.bind(null, c.id, "active")

  return (
    <main className="app-shell adv-shell">
      <SiteHeader mode="advertiser" signedIn />
      <section className="app-wide">
        <div className="page-head">
          <div>
            <p className="eyebrow">
              <Link href="/advertise/dashboard" className="crumb">Campaigns</Link> / {c.name}
            </p>
            <h1 className="page-title">{c.name}</h1>
          </div>
          <div className="row">
            <span className={`badge badge-${c.status}`}>
              {{ draft: "Draft", pending_payment: "Awaiting payment", active: "Live", paused: "Paused", exhausted: "Budget spent" }[c.status]}
            </span>
            {c.status === "active" && (
              <form action={pause}>
                <button type="submit" className="btn btn-ghost">Pause</button>
              </form>
            )}
            {c.status === "paused" && (
              <form action={resume}>
                <button type="submit" className="btn btn-primary">Resume</button>
              </form>
            )}
          </div>
        </div>

        {c.status === "pending_payment" && payment && (
          <PayPanel
            campaignId={c.id}
            sol={(payment.lamports / LAMPORTS_PER_SOL).toString()}
            treasury={env.treasuryAddress}
            reference={payment.reference}
            payUrl={pay?.payUrl ?? ""}
            qrSvg={pay?.qrSvg ?? ""}
            enabled={Boolean(pay)}
            walletAddress={adv.walletAddress}
          />
        )}

        <div className="stat-grid">
          <div className="stat">
            <span className="stat-label">Impressions</span>
            <span className="stat-value">{stats.impressions.toLocaleString()}</span>
            <span className="stat-sub">{stats.developers} developers reached</span>
          </div>
          <div className="stat">
            <span className="stat-label">Clicks</span>
            <span className="stat-value">{stats.clicks.toLocaleString()}</span>
            <span className="stat-sub">
              {stats.impressions ? `${((stats.clicks / stats.impressions) * 100).toFixed(1)}% CTR` : "—"}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Spent</span>
            <span className="stat-value">{c.spentTokens.toLocaleString()}</span>
            <span className="stat-sub">of {c.budgetTokens.toLocaleString()} tokens</span>
          </div>
          <div className="stat">
            <span className="stat-label">Remaining</span>
            <span className="stat-value">{remaining.toLocaleString()}</span>
            <span className="stat-sub">≈ {tokensToSol(remaining).toFixed(3)} SOL · {Math.floor(remaining / c.rewardTokens)} impressions</span>
          </div>
        </div>

        <CreativeForm
          campaignId={c.id}
          rewardTokens={c.rewardTokens}
          initial={{
            advertiserName: c.advertiserName,
            url: c.url,
            headline: c.headline,
            body: c.body,
            logoUrl: c.logoUrl ?? "",
            brandBg: c.brandBg,
            brandFg: c.brandFg,
          }}
        />

        <div className="two-col">
          <div className="panel">
            <h2 className="panel-title">Details</h2>
            <dl className="dl">
              <dt>Destination</dt>
              <dd><a href={c.url} target="_blank" rel="noopener">{c.url}</a></dd>
              <dt>Reward per impression</dt>
              <dd>{c.rewardTokens} tokens</dd>
              <dt>Dismissed</dt>
              <dd>{stats.dismisses.toLocaleString()}</dd>
              <dt>Created</dt>
              <dd>{c.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })}</dd>
              {payment?.signature && (
                <>
                  <dt>Payment</dt>
                  <dd>
                    <a href={`https://solscan.io/tx/${payment.signature}`} target="_blank" rel="noopener">
                      View on Solscan
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </section>
    </main>
  )
}
