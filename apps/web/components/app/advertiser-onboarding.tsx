"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { checkPayment, launchCampaign, walletChallenge, walletSignIn } from "@/app/advertise/actions"
import { AdInEditor } from "@/components/app/ad-in-editor"
import { useWallet } from "@/components/app/use-wallet"
import { WalletConnect } from "@/components/app/wallet-connect"
import type { Plan } from "@/lib/plans"

type Step = "idle" | "signing" | "launching" | "paying" | "confirming" | "done"

function domainOf(input: string): string {
  const raw = input.trim()
  if (!raw) return ""
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export function AdvertiserOnboarding({
  plans,
  lamportsPerToken,
  paymentsEnabled,
  initial,
}: {
  plans: readonly Plan[]
  lamportsPerToken: number
  paymentsEnabled: boolean
  initial?: { company: string; website: string; wallet: string }
}) {
  const router = useRouter()
  const w = useWallet()
  const [company, setCompany] = React.useState(initial?.company ?? "")
  const [website, setWebsite] = React.useState(initial?.website ?? "")
  const [planId, setPlanId] = React.useState(plans[1]?.id ?? plans[0]!.id)
  const [step, setStep] = React.useState<Step>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [signature, setSignature] = React.useState<string | null>(null)

  const plan = plans.find((p) => p.id === planId) ?? plans[0]!
  const tokensFor = (p: Plan) => Math.floor((p.sol * 1e9) / lamportsPerToken)
  const viewsFor = (p: Plan) => Math.floor(tokensFor(p) / p.rewardTokens)
  const busy = step !== "idle" && step !== "done"
  const domain = domainOf(website)
  const name = company.trim() || "Your company"

  async function connectAndLaunch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const account = w.account
      if (!account) throw new Error("Connect your wallet in step 03 first.")
      setStep("signing")
      const challenge = await walletChallenge(account.address)
      if ("error" in challenge) throw new Error(challenge.error)
      const sig = await w.signMessage(challenge.message)
      const signedIn = await walletSignIn({ address: account.address, nonce: challenge.nonce, signature: sig, company, website })
      if (signedIn.error) throw new Error(signedIn.error)
      setStep("launching")
      const launched = await launchCampaign(plan.id)
      if ("error" in launched) throw new Error(launched.error)
      if (!launched.transaction) {
        router.push(`/advertise/campaigns/${launched.campaignId}`)
        return
      }
      setStep("paying")
      const txSig = await w.signAndSend(launched.transaction)
      setSignature(txSig)
      setStep("confirming")
      for (let i = 0; i < 6; i++) {
        const r = await checkPayment(launched.campaignId)
        if (r.ok) break
        await new Promise((res) => setTimeout(res, 2500))
      }
      setStep("done")
      router.push(`/advertise/campaigns/${launched.campaignId}`)
    } catch (err) {
      setStep("idle")
      setError(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  const stepLabel: Record<Step, string> = {
    idle: !w.account
      ? "Connect a wallet to continue"
      : paymentsEnabled
        ? `Pay ${plan.sol} SOL and launch`
        : "Create campaign",
    signing: "Sign the message in your wallet…",
    launching: "Creating your campaign…",
    paying: `Approve the ${plan.sol} SOL transfer…`,
    confirming: "Waiting for the network to confirm…",
    done: "Done, opening your campaign…",
  }

  return (
    <form onSubmit={connectAndLaunch} className="onboard">
      <div className="onboard-form">
        <div className="onboard-section">
          <p className="onboard-step">01 — About you</p>
          <label className="big-field">
            <span className="big-label">Company name</span>
            <input
              className="big-input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              placeholder="Acme"
              disabled={busy}
              autoComplete="organization"
            />
          </label>
          <label className="big-field">
            <span className="big-label">Website link</span>
            <input
              className="big-input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              required
              placeholder="acme.com"
              inputMode="url"
              disabled={busy}
              autoComplete="url"
            />
          </label>
        </div>

        <fieldset className="onboard-section plan-list" disabled={busy}>
          <legend className="onboard-step">02 — Plan</legend>
          {plans.map((p) => {
            const selected = p.id === planId
            return (
              <label key={p.id} className="plan-row" data-selected={selected ? "true" : undefined}>
                <input type="radio" name="plan" value={p.id} checked={selected} onChange={() => setPlanId(p.id)} className="plan-radio" />
                <span className="plan-check" aria-hidden="true" />
                <span className="plan-row-main">
                  <span className="plan-name">{p.name}</span>
                  <span className="plan-blurb">{p.blurb}</span>
                  <span className="plan-meta">
                    ≈ {viewsFor(p).toLocaleString()} rewarded views · {p.rewardTokens} tokens each
                  </span>
                </span>
                <span className="plan-price">{p.sol} SOL</span>
              </label>
            )
          })}
        </fieldset>

        <div className="onboard-section">
          <p className="onboard-step">03 — Wallet</p>
          <WalletConnect
            wallets={w.wallets}
            wallet={w.wallet}
            account={w.account}
            onConnect={w.connect}
            onDisconnect={w.disconnect}
            disabled={busy}
          />
          <p className="panel-foot">
            Your wallet is your account. You sign a short message to prove it's yours. No email, no password.
          </p>
        </div>
      </div>

      <aside className="onboard-preview">
        <div className="preview-sticky">
          <p className="onboard-step">Preview</p>
          <AdInEditor
            advertiser={name}
            domain={domain || "yourcompany.com"}
            headline={`Discover ${name}.`}
            body={`See what ${name} is building at ${domain || "yourcompany.com"}.`}
            brandBg="#0a0a0a"
            brandFg="#ffffff"
            rewardTokens={plan.rewardTokens}
          />
          <p className="preview-note">
            Your card in the Vibefuel panel, shown while developers' agents work. You can
            change the headline, text, logo, and colors after launch.
          </p>

          <div className="summary">
            <div className="summary-row">
              <span>{plan.name} plan</span>
              <strong>{plan.sol} SOL</strong>
            </div>
            <div className="summary-row summary-sub">
              <span>Rewarded views, about</span>
              <span>{viewsFor(plan).toLocaleString()}</span>
            </div>
            <div className="summary-row summary-sub">
              <span>Reward per view</span>
              <span>{plan.rewardTokens} tokens</span>
            </div>
          </div>

          {!paymentsEnabled && (
            <p className="form-error">
              Payments are not configured on this server yet. The campaign will be created and wait for payment.
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
          {signature && (
            <p className="form-ok">
              Transfer sent.{" "}
              <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener">View on Solscan</a>
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-wide btn-lg" disabled={busy || !w.account}>
            {stepLabel[step]}
          </button>
          <p className="panel-foot">One transfer. The campaign goes live the moment the network confirms it.</p>
        </div>
      </aside>
    </form>
  )
}
