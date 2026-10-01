import Link from "next/link"

import { FuelPumpMark } from "@/components/logo"

import { BUILDER, CONTACT_EMAIL, X_HANDLE, X_URL } from "@/lib/site"

export function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/" className="logo" aria-label="Vibefuel home">
            <FuelPumpMark />
            <span className="logo-wordmark">Vibefuel</span>
          </Link>
          <p className="footer-tag">Let your vibe coding pay for itself.</p>
          <p className="footer-fine">
            Rewards are paid in tokens on Solana and can be put toward AI credits. Nothing is
            purchased automatically. Vibefuel is independent of the editors and tools it works with.
          </p>
        </div>
        <nav className="footer-cols" aria-label="Footer">
          <div className="footer-col">
            <span className="footer-col-title">Developers</span>
            <Link href="/#start">Get a key</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard#how">How it works</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Advertisers</span>
            <Link href="/advertise">Run an ad</Link>
            <Link href="/advertise/dashboard">Campaigns</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Company</span>
            <a href={X_URL} target="_blank" rel="noopener">
              <XIcon /> @{X_HANDLE}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </div>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© {year} Vibefuel</span>
        <span className="footer-credit">
          Built on Solana by{" "}
          <a href={BUILDER.url} target="_blank" rel="noopener" className="footer-builder">
            {/* eslint-disable-next-line @next/next/no-img-element -- small avatar served from /public */}
            <img src={BUILDER.avatar} alt="" width="22" height="22" />
            @{BUILDER.handle}
          </a>
        </span>
      </div>
      <div className="footer-giant" aria-hidden="true">
        <FuelPumpMark className="footer-giant-mark" size="0.78em" />
        <span className="footer-giant-word">Vibefuel</span>
      </div>
    </footer>
  )
}
