"use client"

import * as React from "react"

import {
  regenerateKey,
  requestPayout,
  revealKey,
  saveWallet,
  type ActionState,
} from "@/app/dashboard/actions"
import { KeyReveal } from "@/components/app/key-reveal"

export function WalletForm({ initial }: { initial: string }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(saveWallet, {})
  return (
    <form action={action} className="stack">
      <label className="field">
        <span className="field-label">Solana wallet address</span>
        <input
          name="wallet"
          className="input input-mono"
          defaultValue={initial}
          placeholder="Your public address, for payouts"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {state.error && <p className="form-error">{state.error}</p>}
      {state.ok && <p className="form-ok">{state.ok}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save wallet"}
      </button>
    </form>
  )
}

/**
 * Key panel: masked by default. "Reveal" decrypts the key on the server and
 * shows it with a copy button. "Generate new" rotates it immediately.
 */
export function KeyPanel({ prefix, canReveal }: { prefix: string; canReveal: boolean }) {
  const [key, setKey] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<"reveal" | "rotate" | null>(null)
  const [confirmRotate, setConfirmRotate] = React.useState(false)

  async function reveal() {
    setBusy("reveal")
    setError(null)
    const r = await revealKey()
    setBusy(null)
    if (r.key) setKey(r.key)
    else setError(r.error ?? "Could not reveal the key.")
  }

  async function rotate() {
    if (!confirmRotate) {
      setConfirmRotate(true)
      return
    }
    setBusy("rotate")
    setError(null)
    const r = await regenerateKey()
    setBusy(null)
    setConfirmRotate(false)
    if (r.key) setKey(r.key)
    else setError(r.error ?? "Could not generate a key.")
  }

  return (
    <div className="stack">
      {key ? (
        <KeyReveal serialKey={key} onHide={() => setKey(null)} />
      ) : (
        <div className="key-box key-box-masked">
          <code className="key-value" aria-label={`Key starting with ${prefix}`}>
            {prefix}-••••-••••-••••
          </code>
          <button type="button" className="btn btn-primary" onClick={reveal} disabled={!canReveal || busy !== null}>
            {busy === "reveal" ? "Revealing…" : "Reveal key"}
          </button>
        </div>
      )}
      {!canReveal && (
        <p className="panel-foot">
          This key was created before reveal existed, so it can't be shown again. Generate a new one.
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="row">
        <button type="button" className={`btn ${confirmRotate ? "btn-danger" : "btn-ghost"}`} onClick={rotate} disabled={busy !== null}>
          {busy === "rotate" ? "Generating…" : confirmRotate ? "Yes, replace my key" : "Generate a new key"}
        </button>
        {confirmRotate && (
          <button type="button" className="link-button" onClick={() => setConfirmRotate(false)}>
            Cancel
          </button>
        )}
      </div>
      <p className="panel-foot">
        Generating a new key disconnects the extension until you paste the new one.
      </p>
    </div>
  )
}

export function PayoutButton({ balance, hasWallet }: { balance: number; hasWallet: boolean }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    async () => requestPayout(),
    {}
  )
  const disabled = pending || !hasWallet || balance < 100
  return (
    <form action={action} className="stack">
      {state.error && <p className="form-error">{state.error}</p>}
      {state.ok && <p className="form-ok">{state.ok}</p>}
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        {pending ? "Requesting…" : "Request payout"}
      </button>
      <p className="panel-foot">Minimum 100 tokens. Needs a saved wallet.</p>
    </form>
  )
}
