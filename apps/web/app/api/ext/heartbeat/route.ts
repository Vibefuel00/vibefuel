import { eq, sql } from "drizzle-orm"

import { db, schema } from "@/db"
import { developerFromBearer } from "@/lib/auth"
import { badRequest, json, readJson, tooMany, unauthorized } from "@/lib/api"
import { rateLimit } from "@/lib/ratelimit"

export const dynamic = "force-dynamic"

type Body = { editor?: unknown; extension_version?: unknown; active_seconds?: unknown }

/** Sent by a client about once a minute while the editor window is focused. */
export async function POST(request: Request) {
  const dev = await developerFromBearer(request)
  if (!dev) return unauthorized()
  if (!rateLimit(`ext:${dev.id}:heartbeat`, 30, 60_000)) return tooMany()
  const body = (await readJson<Body>(request)) ?? {}
  const raw = Number(body.active_seconds ?? 0)
  if (!Number.isFinite(raw)) return badRequest("active_seconds must be a number")
  const seconds = Math.max(0, Math.min(600, Math.floor(raw)))

  if (seconds > 0) {
    const day = new Date().toISOString().slice(0, 10)
    await db
      .insert(schema.workDays)
      .values({ developerId: dev.id, day, activeSeconds: seconds })
      .onConflictDoUpdate({
        target: [schema.workDays.developerId, schema.workDays.day],
        set: {
          activeSeconds: sql`${schema.workDays.activeSeconds} + ${seconds}`,
          updatedAt: new Date(),
        },
      })
  }

  await db
    .update(schema.developers)
    .set({
      lastSeenAt: new Date(),
      editor: typeof body.editor === "string" ? body.editor.slice(0, 40) : dev.editor,
      extensionVersion:
        typeof body.extension_version === "string" ? body.extension_version.slice(0, 40) : dev.extensionVersion,
    })
    .where(eq(schema.developers.id, dev.id))

  return json({ ok: true })
}
