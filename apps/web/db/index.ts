import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

// The client is created on first use, not at import time, so modules that
// import `db` can be loaded during a build where DATABASE_URL is absent.
const globalForDb = globalThis as unknown as {
  __vfSql?: ReturnType<typeof postgres>
  __vfDb?: ReturnType<typeof drizzle<typeof schema>>
}

function connect() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const client =
    globalForDb.__vfSql ??
    postgres(url, {
      ssl: url.includes("localhost") || url.includes(".railway.internal") ? undefined : "require",
      max: 5,
      prepare: false,
    })
  const instance = drizzle({ client, schema })
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__vfSql = client
    globalForDb.__vfDb = instance
  } else {
    globalForDb.__vfSql = client
    globalForDb.__vfDb = instance
  }
  return instance
}

type Db = ReturnType<typeof connect>

/** Lazily connected Drizzle instance. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = globalForDb.__vfDb ?? connect()
    const value = Reflect.get(real, prop, receiver)
    return typeof value === "function" ? value.bind(real) : value
  },
})

export type { Db }
export { schema }
