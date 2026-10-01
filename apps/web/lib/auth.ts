import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"
import { cookies } from "next/headers"
import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { env } from "@/lib/env"

// ---------------------------------------------------------------------------
// Serial keys for developers: VF-XXXX-XXXX-XXXX-XXXX (Crockford-ish alphabet,
// no ambiguous characters). Stored hashed; the plain key is shown once.
// ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"

export function generateSerialKey(): string {
  const bytes = randomBytes(16)
  let out = ""
  for (let i = 0; i < 16; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length]
    if (i % 4 === 3 && i < 15) out += "-"
  }
  return `VF-${out}`
}

export function normalizeSerialKey(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "")
}

export function isSerialKeyShape(key: string): boolean {
  return /^VF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)
}

export function hashSerialKey(key: string): string {
  return createHash("sha256").update(`${env.authSecret}:${key}`).digest("hex")
}

export function keyPrefix(key: string): string {
  return key.slice(0, 7) // "VF-XXXX"
}

// Reversible encryption so a signed-in developer can reveal their own key.
// Key material is derived from AUTH_SECRET; rotating it invalidates reveals
// (the hash-based login still works).
function encryptionKey(): Buffer {
  return createHash("sha256").update(`${env.authSecret}:key-enc`).digest()
}

export function encryptKey(key: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const ct = Buffer.concat([cipher.update(key, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ct].map((b) => b.toString("base64url")).join(".")
}

export function decryptKey(blob: string): string | null {
  try {
    const [iv, tag, ct] = blob.split(".").map((p) => Buffer.from(p, "base64url"))
    if (!iv || !tag || !ct) return null
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Passwords for advertisers (scrypt, no external deps).
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, "hex")
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

// ---------------------------------------------------------------------------
// Signed session cookies. Value: <subject>.<expires>.<hmac>
// ---------------------------------------------------------------------------

const DEV_COOKIE = "vf_dev"
const ADV_COOKIE = "vf_adv"
const SESSION_DAYS = 90

function sign(payload: string): string {
  return createHmac("sha256", env.authSecret).update(payload).digest("base64url")
}

function makeToken(subject: string): string {
  const expires = Date.now() + SESSION_DAYS * 86_400_000
  const payload = `${subject}.${expires}`
  return `${payload}.${sign(payload)}`
}

function readToken(token: string | undefined): string | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [subject, expires, sig] = parts as [string, string, string]
  const payload = `${subject}.${expires}`
  const expected = sign(payload)
  if (sig.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  if (Number(expires) < Date.now()) return null
  return subject
}

async function setSession(name: string, subject: string) {
  const store = await cookies()
  store.set({
    name,
    value: makeToken(subject),
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  })
}

async function clearSession(name: string) {
  const store = await cookies()
  store.set({ name, value: "", path: "/", maxAge: 0 })
}

export const developerSession = {
  set: (id: string) => setSession(DEV_COOKIE, id),
  clear: () => clearSession(DEV_COOKIE),
  async id(): Promise<string | null> {
    const store = await cookies()
    return readToken(store.get(DEV_COOKIE)?.value)
  },
}

export const advertiserSession = {
  set: (id: string) => setSession(ADV_COOKIE, id),
  clear: () => clearSession(ADV_COOKIE),
  async id(): Promise<string | null> {
    const store = await cookies()
    return readToken(store.get(ADV_COOKIE)?.value)
  },
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function currentDeveloper() {
  const id = await developerSession.id()
  if (!id) return null
  const rows = await db.select().from(schema.developers).where(eq(schema.developers.id, id)).limit(1)
  return rows[0] ?? null
}

export async function currentAdvertiser() {
  const id = await advertiserSession.id()
  if (!id) return null
  const rows = await db.select().from(schema.advertisers).where(eq(schema.advertisers.id, id)).limit(1)
  return rows[0] ?? null
}

/** Resolve a developer from an extension Bearer token (the serial key). */
export async function developerFromBearer(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const key = normalizeSerialKey(match[1]!)
  if (!isSerialKeyShape(key)) return null
  const rows = await db
    .select()
    .from(schema.developers)
    .where(eq(schema.developers.keyHash, hashSerialKey(key)))
    .limit(1)
  return rows[0] ?? null
}
