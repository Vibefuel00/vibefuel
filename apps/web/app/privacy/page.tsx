import { SiteHeader } from "@/components/site-header"

export const metadata = { title: "Privacy — Vibefuel" }

/** The privacy summary the extension and the Claude Code plugin link to. */
export default function PrivacyPage() {
  return (
    <main className="app-shell dev-shell">
      <SiteHeader mode="developer" signedIn={false} />
      <section className="app-narrow">
        <div className="panel stack-lg">
          <div>
            <p className="eyebrow">Privacy</p>
            <h1 className="panel-title">What Vibefuel collects, and what it never does.</h1>
            <p className="panel-text">
              This is the same summary shown inside the Vibefuel extension and the Claude
              Code plugin. Nothing runs until you opt in, and opting out deletes everything
              the client stored.
            </p>
          </div>

          <div>
            <h2 className="panel-title">Collected, only while Vibefuel is on</h2>
            <ul className="rules">
              <li>Your serial key, to tie events to your dashboard. It is stored hashed on our side.</li>
              <li>Ad events: impression, click and dismiss, each with the campaign id, a timestamp and a random per-session id.</li>
              <li>A heartbeat about once a minute while your editor window is focused: editor name, extension version and active seconds. Shown as hours of work on your dashboard.</li>
              <li>A Solana public address, only if you link one for payouts.</li>
            </ul>
          </div>

          <div>
            <h2 className="panel-title">Never collected</h2>
            <ul className="rules">
              <li>File contents, file names, project names or paths.</li>
              <li>Prompts, chat messages, transcripts or AI completions.</li>
              <li>Keystrokes or clipboard.</li>
              <li>Git remotes or identities.</li>
              <li>Private keys or seed phrases. Vibefuel never asks for them.</li>
            </ul>
          </div>

          <div>
            <h2 className="panel-title">Rules</h2>
            <ul className="rules">
              <li>Events are batched and sent at most once per minute. The queue is dropped on opt-out.</li>
              <li>If your editor&apos;s telemetry setting is off, the extension sends nothing at all.</li>
              <li>A sidebar impression counts after 3 continuous seconds visible with the window focused. A terminal impression counts when the line is displayed.</li>
              <li>Advertisers see aggregate counts for their campaign. They never see who you are.</li>
              <li>Rewards are paid at most once per advertiser every 6 hours and only from a funded campaign budget.</li>
            </ul>
          </div>

          <p className="panel-foot">
            Questions? Open an issue on the repository linked from the extension listing.
          </p>
        </div>
      </section>
    </main>
  )
}
