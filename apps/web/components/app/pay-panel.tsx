"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { checkPayment, prepareTransfer, type AdvState } from "@/app/advertise/actions"
import { shortAddress, useWallet } from "@/components/app/use-wallet"
import { WalletConnect } from "@/components/app/wallet-connect"

export function PayPanel({
  campaignId,
  sol,
  treasury,
  reference,
  payUrl,
  qrSvg,
  enabled,
  walletAddress,
}: {
  campaignId: string
  sol: string
  treasury: string
  reference: string
  payUrl: string
  qrSvg: string
  enabled: boolean
  walletAddress: string
}) {
  const router = useRouter()
  const w = useWallet()
  const [state, setState] = React.useState<AdvState>({})
  const [checking, setChecking] = React.useState(false)
  const [paying, setPaying] = React.useState(false)
  const [signature, setSignature] = React.useState<string | null>(null)
  const [showManual, setShowManual] = React.useState(false)

  const check = React.useCallback(async () => {
    setChecking(true)
    const result = await checkPayment(campaignId)
    setState(result)
    setChecking(false)
    if (result.ok) router.refresh()
  }, [campaignId, router])

  React.useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => {
      void check()
    }, 12_000)
    return () => clearInterval(t)
  }, [check, enabled])

  async function payWithWallet() {
    setState({})
    setPaying(true)
    try {
      const account = w.account
      if (!account) throw new Error("Connect your wallet first.")
      if (account.address !== walletAddress) {
        throw new Error(`Connect the wallet you signed in with (${shortAddress(walletAddress)}), or pay manually below.`)
      }
      const prepared = await prepareTransfer(campaignId)
      if ("error" in prepared) throw new Error(prepared.error)
      const sig = await w.signAndSend(prepared.transaction)
      setSignature(sig)
      for (let i = 0; i < 6; i++) {
        const r = await checkPayment(campaignId)
        if (r.ok) {
          setState(r)
          router.refresh()
          return
        }
        await new Promise((res) => setTimeout(res, 2500))
      }
      setState({ ok: "Transfer sent. Confirming on-chain…" })
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "Payment failed." })
    } finally {
      setPaying(false)
    }
  }

  if (!enabled) {
    return (
      <div className="panel">
        <h2 className="panel-title">Payment</h2>
        <p className="form-error">
          Payments are not configured on this server yet. The treasury wallet address
          must be set before campaigns can be paid for.
        </p>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Pay {sol} SOL to go live</h2>
      <p className="panel-text">
        Approve one transfer from your connected wallet. The transaction carries a
        unique reference, so it is matched to this campaign automatically.
      </p>
      <div className="row">
        <WalletConnect
          wallets={w.wallets}
          wallet={w.wallet}
          account={w.account}
          onConnect={w.connect}
          onDisconnect={w.disconnect}
          disabled={paying}
        />
        <button type="button" className="btn btn-primary" onClick={payWithWallet} disabled={paying || !w.account}>
          {paying ? "Waiting for wallet…" : `Pay ${sol} SOL`}
        </button>
        <button type="button" className="link-button" onClick={() => setShowManual((s) => !s)}>
          {showManual ? "Hide manual payment" : "Pay another way"}
        </button>
      </div>
      {signature && (
        <p className="form-ok">
          Transfer sent.{" "}
          <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener">View on Solscan</a>
        </p>
      )}
      {state.error && <p className="form-error">{state.error}</p>}
      {state.ok && <p className="form-ok">{state.ok}</p>}

      {showManual && (
        <div className="pay-grid">
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="stack">
            <a href={payUrl} className="btn btn-ghost btn-wide">Open in a mobile wallet</a>
            <div className="kv">
              <span className="kv-label">Amount</span>
              <code className="kv-value">{sol} SOL</code>
            </div>
            <div className="kv">
              <span className="kv-label">To</span>
              <code className="kv-value">{treasury}</code>
            </div>
            <div className="kv">
              <span className="kv-label">Reference</span>
              <code className="kv-value">{reference}</code>
            </div>
            <p className="panel-foot">
              Sending manually? Use the wallet link so the reference account is included.
              A plain transfer without it cannot be matched.
            </p>
            <button type="button" className="btn btn-ghost" onClick={check} disabled={checking}>
              {checking ? "Checking…" : "I've paid, check now"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
