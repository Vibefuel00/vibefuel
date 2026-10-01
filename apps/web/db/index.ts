import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error("DATABASE_URL is not set")
}

// Reuse the client across hot reloads in development.
const globalForDb = globalThis as unknown as { __vfSql?: ReturnType<typeof postgres> }
const client =
  globalForDb.__vfSql ??
  postgres(url, {
    ssl: url.includes("localhost") ? undefined : "require",
    max: 5,
    prepare: false,
  })
if (process.env.NODE_ENV !== "production") globalForDb.__vfSql = client

export const db = drizzle({ client, schema })
export type Db = typeof db
export { schema }
