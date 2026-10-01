import Link from "next/link"

export default function NotFound() {
  return (
    <main className="app-shell dev-shell">
      <section className="app-narrow">
        <div className="panel">
          <p className="eyebrow">404</p>
          <h1 className="panel-title">That page doesn't exist.</h1>
          <p className="panel-text">Check the link, or go back to the start.</p>
          <Link href="/" className="btn btn-primary">
            Home
          </Link>
        </div>
      </section>
    </main>
  )
}
