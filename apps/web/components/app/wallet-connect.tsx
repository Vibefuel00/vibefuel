"use client"

import * as React from "react"
import type { Wallet, WalletAccount } from "@wallet-standard/base"

import { shortAddress } from "@/components/app/use-wallet"

const INSTALL = [
  { name: "Phantom", url: "https://phantom.app" },
  { name: "Solflare", url: "https://solflare.com" },
  { name: "Backpack", url: "https://backpack.app" },
]

/**
 * One button. Closed: "Connect wallet" opens a modal listing every detected
 * Solana wallet. Connected: shows the wallet and address with a change action.
 */
export function WalletConnect({
  wallets,
  wallet,
  account,
  onConnect,
  onDisconnect,
  disabled,
}: {
  wallets: Wallet[]
  wallet: Wallet | null
  account: WalletAccount | null
  onConnect: (w: Wallet) => Promise<unknown>
  onDisconnect: () => void
  disabled?: boolean
}) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const [open, setOpen] = React.useState(false)
  const [connecting, setConnecting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  async function pick(w: Wallet) {
    setConnecting(w.name)
    setError(null)
    try {
      await onConnect(w)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect.")
    } finally {
      setConnecting(null)
    }
  }

  return (
    <>
      {account ? (
        <span className="wallet-chip">
          {wallet?.icon && (
            // eslint-disable-next-line @next/next/no-img-element -- wallet-provided data URI icon
            <img src={wallet.icon} alt="" width="18" height="18" />
          )}
          <span className="status-dot is-on" aria-hidden="true" />
          {wallet?.name} · {shortAddress(account.address)}
          <button type="button" className="link-button" onClick={onDisconnect} disabled={disabled}>
            Change
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => setOpen(true)} disabled={disabled}>
          Connect wallet
        </button>
      )}

      <dialog
        ref={ref}
        className="wallet-modal"
        aria-labelledby="wallet-modal-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false)
        }}
      >
        <div className="wallet-modal-body">
          <div className="wallet-modal-head">
            <h2 id="wallet-modal-title" className="panel-title">Connect a wallet</h2>
            <button type="button" className="link-button" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          {wallets.length > 0 ? (
            <ul className="wallet-options">
              {wallets.map((w) => (
                <li key={w.name}>
                  <button
                    type="button"
                    className="wallet-option"
                    onClick={() => pick(w)}
                    disabled={connecting !== null}
                  >
                    {w.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- wallet-provided data URI icon
                      <img src={w.icon} alt="" width="32" height="32" />
                    ) : (
                      <span className="wallet-option-fallback" aria-hidden="true">{w.name.slice(0, 1)}</span>
                    )}
                    <span className="wallet-option-name">{w.name}</span>
                    <span className="wallet-option-meta">
                      {connecting === w.name ? "Connecting…" : "Detected"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-text">No Solana wallet was detected in this browser.</p>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="wallet-install">
            <span className="panel-foot">{wallets.length > 0 ? "Don't see yours?" : "Get a wallet:"}</span>
            {INSTALL.filter((i) => !wallets.some((w) => w.name.toLowerCase().includes(i.name.toLowerCase()))).map((i) => (
              <a key={i.name} href={i.url} target="_blank" rel="noopener" className="wallet-install-link">
                {i.name}
              </a>
            ))}
          </div>
        </div>
      </dialog>
    </>
  )
}
