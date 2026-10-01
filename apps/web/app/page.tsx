import { CloudDivider } from "@/components/cloud-divider"
import { Integrations } from "@/components/integrations"
import { Landing } from "@/components/landing"
import { Reveal } from "@/components/reveal"
import { StatsBento } from "@/components/stats-bento"

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260801_022931_e13cbef4-690a-42d2-b5ee-5b3b1f483c83.mp4"

// Live stats refresh every minute without making the page dynamic per request.
export const revalidate = 60

export default function Page() {
  return (
    <main id="top" className="page">
      <Landing />

      <CloudDivider />

      <Integrations />

      <StatsBento />

      <Reveal as="section" className="media" y={30}>
        <video
          className="media-placeholder"
          aria-label="Vibefuel product preview"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      </Reveal>
    </main>
  )
}
