"use server"

import { headers } from "next/headers"

import { db, schema } from "@/db"
import { developerSession, encryptKey, generateSerialKey, hashSerialKey, keyPrefix } from "@/lib/auth"
import { clientIp, rateLimit } from "@/lib/ratelimit"

export type StartState = { key?: string; error?: string }

/** Creates a developer account and returns the one-time serial key. */
export async function createDeveloper(): Promise<StartState> {
  const ip = clientIp(await headers())
  if (!rateLimit(`start:${ip}`, 5, 10 * 60_000)) {
    return { error: "Too many keys created from this network. Try again in a few minutes." }
  }
  try {
    const key = generateSerialKey()
    const [dev] = await db
      .insert(schema.developers)
      .values({ keyHash: hashSerialKey(key), keyPrefix: keyPrefix(key), keyEnc: encryptKey(key) })
      .returning({ id: schema.developers.id })
    if (!dev) return { error: "Could not create your account. Please try again." }
    await developerSession.set(dev.id)
    return { key }
  } catch (err) {
    console.error("createDeveloper failed", err)
    return { error: "Something went wrong on our side. Please try again." }
  }
}
