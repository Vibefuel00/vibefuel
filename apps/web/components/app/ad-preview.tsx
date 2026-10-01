/** Renders a campaign as the compact branded card developers see. */
export function AdPreview({
  advertiser,
  domain,
  headline,
  body,
  logoUrl,
  brandBg,
  brandFg,
  rewardTokens,
}: {
  advertiser: string
  domain: string
  headline: string
  body: string
  logoUrl?: string | null
  brandBg: string
  brandFg: string
  rewardTokens: number
}) {
  const style = {
    "--ad-bg": brandBg,
    "--ad-fg": brandFg,
    "--ad-muted": `color-mix(in srgb, ${brandFg} 66%, transparent)`,
    "--ad-logo-bg": brandBg,
  } as React.CSSProperties
  return (
    <div className="ad-card ad-card-compact" style={style}>
      <div className="ad-card-top">
        <span className="ad-label">Sponsored</span>
        <span className="ad-reward">Earn {rewardTokens} tokens</span>
      </div>
      <div className="ad-card-main">
        <span className="ad-logo">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- advertiser-supplied logo URL
            <img src={logoUrl} alt="" width="24" height="24" />
          ) : (
            <span className="ad-logo-fallback" aria-hidden="true">
              {advertiser.slice(0, 1).toUpperCase() || "A"}
            </span>
          )}
        </span>
        <div className="ad-card-text">
          <p className="ad-advertiser">
            {advertiser || "Brand"} · {domain || "example.com"}
          </p>
          <p className="ad-headline">{headline || "Your headline"}</p>
          <p className="ad-body">{body || "A short line about what you offer."}</p>
        </div>
      </div>
    </div>
  )
}
