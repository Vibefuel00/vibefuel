import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { PublicKey } from "@solana/web3.js"
import nacl from "tweetnacl"

import { env } from "@/lib/env"

const NONCE_TTL_MS = 5 * 60_000

function sign(payload: string): string {
  return createHmac("sha256", `${env.authSecret}:wallet-nonce`).update(payload).digest("base64url")
}

/** Stateless nonce bound to one address: <address>.<expires>.<random>.<hmac> */
export function issueNonce(address: string): string {
  const payload = `${address}.${Date.now() + NONCE_TTL_MS}.${randomBytes(8).toString("base64url")}`
  return `${payload}.${sign(payload)}`
}

export function nonceIsValid(nonce: string, address: string): boolean {
  const parts = nonce.split(".")
  if (parts.length !== 4) return false
  const [addr, expires, rand, sig] = parts as [string, string, string, string]
  if (addr !== address) return false
  if (Number(expires) < Date.now()) return false
  const expected = sign(`${addr}.${expires}.${rand}`)
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

/** The exact text the wallet is asked to sign. Shown to the user by the wallet. */
export function signInMessage(address: string, nonce: string): string {
  return [
    "Sign in to Vibefuel as an advertiser.",
    "",
    "This signature proves you control this wallet. It does not send a transaction or cost anything.",
    "",
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
  ].join("\n")
}

export function verifySignature(address: string, message: string, signatureBase64: string): boolean {
  try {
    const pub = new PublicKey(address).toBytes()
    const sig = Buffer.from(signatureBase64, "base64")
    if (sig.length !== 64) return false
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub)
  } catch {
    return false
  }
}
