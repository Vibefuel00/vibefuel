import { describe, expect, it } from "vitest"
import {
  decodeBase58,
  shortenAddress,
  validateSolanaAddress,
} from "../src/wallet"

// Well known public keys: the System Program and the SPL Token program.
const SYSTEM_PROGRAM = "11111111111111111111111111111111"
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
const WRAPPED_SOL = "So11111111111111111111111111111111111111112"

describe("validateSolanaAddress", () => {
  it("accepts valid 32 byte base58 public keys", () => {
    expect(validateSolanaAddress(TOKEN_PROGRAM)).toEqual({
      ok: true,
      address: TOKEN_PROGRAM,
    })
    expect(validateSolanaAddress(SYSTEM_PROGRAM).ok).toBe(true)
    expect(validateSolanaAddress(WRAPPED_SOL).ok).toBe(true)
  })

  it("trims surrounding whitespace", () => {
    expect(validateSolanaAddress(`  ${TOKEN_PROGRAM}\n`)).toEqual({
      ok: true,
      address: TOKEN_PROGRAM,
    })
  })

  it("rejects empty input", () => {
    expect(validateSolanaAddress("   ")).toEqual({ ok: false, reason: "empty" })
  })

  it("rejects characters outside the base58 alphabet", () => {
    expect(validateSolanaAddress("0OIl" + TOKEN_PROGRAM.slice(4))).toEqual({
      ok: false,
      reason: "characters",
    })
    expect(validateSolanaAddress("0x" + "a".repeat(40))).toMatchObject({
      ok: false,
      reason: "characters",
    })
  })

  it("rejects strings of the wrong length", () => {
    expect(validateSolanaAddress("abc")).toEqual({
      ok: false,
      reason: "length",
    })
    expect(validateSolanaAddress("2".repeat(45))).toEqual({
      ok: false,
      reason: "length",
    })
  })

  it("rejects base58 that does not decode to 32 bytes", () => {
    // 44 chars of 'z' decodes to more than 32 bytes.
    expect(validateSolanaAddress("z".repeat(44))).toEqual({
      ok: false,
      reason: "not-32-bytes",
    })
    // 32 chars of '2' decodes to fewer than 32 bytes.
    expect(validateSolanaAddress("2".repeat(32))).toEqual({
      ok: false,
      reason: "not-32-bytes",
    })
  })

  it("never accepts something that looks like a seed phrase or private key", () => {
    expect(
      validateSolanaAddress("abandon abandon abandon abandon abandon about")
    ).toMatchObject({ ok: false })
    // A 64 byte secret key in base58 is 87 to 88 characters.
    expect(validateSolanaAddress("3".repeat(88))).toMatchObject({ ok: false })
  })
})

describe("decodeBase58", () => {
  it("decodes leading ones as zero bytes", () => {
    const bytes = decodeBase58(SYSTEM_PROGRAM)
    expect(bytes).not.toBeNull()
    expect(bytes!.length).toBe(32)
    expect(bytes!.every((b) => b === 0)).toBe(true)
  })

  it("returns null on invalid characters", () => {
    expect(decodeBase58("0")).toBeNull()
  })
})

describe("shortenAddress", () => {
  it("keeps the first and last four characters", () => {
    expect(shortenAddress(TOKEN_PROGRAM)).toBe("Toke…Q5DA")
    expect(shortenAddress("short")).toBe("short")
  })
})
