"use client"

import Link from "next/link"
import * as React from "react"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className="app-shell dev-shell">
      <section className="app-narrow">
        <div className="panel">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="panel-title">We hit a snag.</h1>
          <p className="panel-text">
            The page could not load. Try again, or head back home. If it keeps
            happening, tell us{error.digest ? ` and mention code ${error.digest}` : ""}.
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={reset}>
              Try again
            </button>
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
