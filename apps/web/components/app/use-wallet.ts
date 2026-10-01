"use client"

import * as React from "react"
import { getWallets } from "@wallet-standard/app"
import type { Wallet, WalletAccount } from "@wallet-standard/base"
import type {
  SolanaSignAndSendTransactionFeature,
  SolanaSignMessageFeature,
} from "@solana/wallet-standard-features"
import type { StandardConnectFeature } from "@wallet-standard/features"

const CHAIN = "solana:mainnet"

function isSolanaWallet(w: Wallet): boolean {
  return (
    w.chains.some((c) => c.startsWith("solana:")) &&
    "standard:connect" in w.features &&
    "solana:signMessage" in w.features &&
    "solana:signAndSendTransaction" in w.features
  )
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

/** Base58 (Bitcoin alphabet), used for Solana transaction signatures. */
function toBase58(bytes: Uint8Array): string {
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  let out = ""
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out
    n /= 58n
  }
  for (const b of bytes) {
    if (b !== 0) break
    out = "1" + out
  }
  return out
}

function toBase64(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Minimal Wallet Standard client: discovers installed Solana wallets, connects,
 * signs a message, and signs + sends a serialized transaction.
 */
export function useWallet() {
  const [wallets, setWallets] = React.useState<Wallet[]>([])
  const [wallet, setWallet] = React.useState<Wallet | null>(null)
  const [account, setAccount] = React.useState<WalletAccount | null>(null)

  React.useEffect(() => {
    const api = getWallets()
    const refresh = () => setWallets(api.get().filter(isSolanaWallet))
    refresh()
    const offs = [api.on("register", refresh), api.on("unregister", refresh)]
    return () => offs.forEach((off) => off())
  }, [])

  const connect = React.useCallback(async (w: Wallet) => {
    const feature = w.features["standard:connect"] as StandardConnectFeature["standard:connect"]
    const { accounts } = await feature.connect()
    const acct = accounts.find((a) => a.chains.includes(CHAIN)) ?? accounts[0]
    if (!acct) throw new Error("The wallet returned no account.")
    setWallet(w)
    setAccount(acct)
    return acct
  }, [])

  const disconnect = React.useCallback(() => {
    setWallet(null)
    setAccount(null)
  }, [])

  const signMessage = React.useCallback(
    async (message: string): Promise<string> => {
      if (!wallet || !account) throw new Error("Connect a wallet first.")
      const feature = wallet.features["solana:signMessage"] as SolanaSignMessageFeature["solana:signMessage"]
      const [out] = await feature.signMessage({ account, message: new TextEncoder().encode(message) })
      if (!out) throw new Error("The wallet did not return a signature.")
      return toBase64(out.signature)
    },
    [wallet, account]
  )

  const signAndSend = React.useCallback(
    async (transactionBase64: string): Promise<string> => {
      if (!wallet || !account) throw new Error("Connect a wallet first.")
      const feature = wallet.features[
        "solana:signAndSendTransaction"
      ] as SolanaSignAndSendTransactionFeature["solana:signAndSendTransaction"]
      const [out] = await feature.signAndSendTransaction({
        account,
        chain: CHAIN,
        transaction: fromBase64(transactionBase64),
        options: { preflightCommitment: "confirmed" },
      })
      if (!out) throw new Error("The wallet did not return a signature.")
      return toBase58(out.signature)
    },
    [wallet, account]
  )

  return { wallets, wallet, account, connect, disconnect, signMessage, signAndSend }
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}
