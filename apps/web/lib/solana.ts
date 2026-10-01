import "server-only"

import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js"

import { env, LAMPORTS_PER_SOL } from "@/lib/env"

export function isValidSolanaAddress(value: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(value.trim()).toBytes())
  } catch {
    return false
  }
}

export function paymentsEnabled(): boolean {
  return env.treasuryAddress.length > 0 && isValidSolanaAddress(env.treasuryAddress)
}

/** A fresh reference key that uniquely tags one payment on-chain. */
export function newReference(): string {
  return Keypair.generate().publicKey.toBase58()
}

/** Solana Pay transfer request URL (wallets open these directly). */
export function solanaPayUrl(params: { lamports: number; reference: string; label: string; message: string }) {
  const amount = (params.lamports / LAMPORTS_PER_SOL).toString()
  const q = new URLSearchParams({
    amount,
    reference: params.reference,
    label: params.label,
    message: params.message,
  })
  return `solana:${env.treasuryAddress}?${q.toString()}`
}

/**
 * Look for a confirmed transfer to the treasury tagged with `reference`.
 * Returns the signature when the treasury received at least `lamports`.
 */
export async function findPayment(reference: string, lamports: number): Promise<string | null> {
  if (!paymentsEnabled()) return null
  const connection = new Connection(env.solanaRpcUrl, "confirmed")
  const refKey = new PublicKey(reference)
  const treasury = new PublicKey(env.treasuryAddress)
  const sigs = await connection.getSignaturesForAddress(refKey, { limit: 10 }, "confirmed")
  for (const s of sigs) {
    if (s.err) continue
    const tx = await connection.getTransaction(s.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    })
    if (!tx || !tx.meta) continue
    const keys = tx.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx.meta.loadedAddresses,
    })
    const idx = keys.staticAccountKeys.findIndex((k) => k.equals(treasury))
    if (idx < 0) continue
    const received = (tx.meta.postBalances[idx] ?? 0) - (tx.meta.preBalances[idx] ?? 0)
    if (received >= lamports) return s.signature
  }
  return null
}

/**
 * Unsigned transfer from `from` to the treasury, tagged with `reference` as a
 * read-only key so the payment can be found on-chain. Returned as base64 wire
 * bytes; a Wallet Standard wallet signs and sends them as-is.
 */
export async function buildTransfer(params: { from: string; lamports: number; reference: string }) {
  const connection = new Connection(env.solanaRpcUrl, "confirmed")
  const from = new PublicKey(params.from)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")
  const tx = new Transaction({ feePayer: from, blockhash, lastValidBlockHeight })
  const ix = SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: new PublicKey(env.treasuryAddress),
    lamports: params.lamports,
  })
  ix.keys.push({ pubkey: new PublicKey(params.reference), isSigner: false, isWritable: false })
  tx.add(ix)
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64")
}
