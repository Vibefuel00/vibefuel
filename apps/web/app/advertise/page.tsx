import { AdvertiserOnboarding } from "@/components/app/advertiser-onboarding"
import { SiteHeader } from "@/components/site-header"
import { currentAdvertiser } from "@/lib/auth"
import { env } from "@/lib/env"
import { PLANS } from "@/lib/plans"
import { paymentsEnabled } from "@/lib/solana"

export const metadata = { title: "Advertise — Vibefuel" }
export const dynamic = "force-dynamic"

export default async function AdvertisePage() {
  const adv = await currentAdvertiser()
  return (
    <main className="app-shell adv-shell">
      <SiteHeader mode="advertiser" signedIn={Boolean(adv)} />
      <section className="adv-hero">
        <p className="eyebrow">Fuel the people building what's next</p>
        <h1 className="adv-hero-title">
          Put your brand
          <br />
          in their workflow.
        </h1>
        <p className="adv-hero-lead">
          Your card appears in the Vibefuel panel inside AI coding tools while developers
          build. Pick a plan, pay once in SOL from your wallet, and every qualified view
          funds a developer's tokens.
        </p>
      </section>
      <section className="app-wide">
        <AdvertiserOnboarding
          plans={PLANS}
          lamportsPerToken={env.lamportsPerToken}
          paymentsEnabled={paymentsEnabled()}
          initial={adv ? { company: adv.company, website: adv.website ?? "", wallet: adv.walletAddress } : undefined}
        />
      </section>
    </main>
  )
}
