const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/
const PUBKEY_BYTES = 32

export type WalletValidation =
  | { ok: true; address: string }
  | { ok: false; reason: "empty" | "characters" | "length" | "not-32-bytes" }

/** Decode base58 into bytes. Returns null on an invalid character. */
export function decodeBase58(value: string): Uint8Array | null {
  if (!BASE58_RE.test(value)) return null
  let big = 0n
  for (const char of value) {
    big = big * 58n + BigInt(ALPHABET.indexOf(char))
  }
  const bytes: number[] = []
  while (big > 0n) {
    bytes.unshift(Number(big & 0xffn))
    big >>= 8n
  }
  // Each leading '1' encodes a zero byte.
  for (const char of value) {
    if (char !== "1") break
    bytes.unshift(0)
  }
  return Uint8Array.from(bytes)
}

/**
 * A Solana public address is the base58 encoding of a 32 byte ed25519 key,
 * which is 32 to 44 characters long. We never see, request or store anything
 * but this public address.
 */
export function validateSolanaAddress(input: string): WalletValidation {
  const address = input.trim()
  if (address.length === 0) return { ok: false, reason: "empty" }
  if (!BASE58_RE.test(address)) return { ok: false, reason: "characters" }
  if (address.length < 32 || address.length > 44) {
    return { ok: false, reason: "length" }
  }
  const bytes = decodeBase58(address)
  if (!bytes || bytes.length !== PUBKEY_BYTES) {
    return { ok: false, reason: "not-32-bytes" }
  }
  return { ok: true, address }
}

export function describeWalletError(
  reason: Exclude<WalletValidation, { ok: true }>["reason"]
): string {
  switch (reason) {
    case "empty":
      return "Paste a Solana public address."
    case "characters":
      return "That is not base58. Solana addresses use 1-9, A-Z and a-z without 0, O, I or l."
    case "length":
      return "A Solana address is 32 to 44 characters long."
    case "not-32-bytes":
      return "That does not decode to a 32 byte public key."
  }
}

export function shortenAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}
