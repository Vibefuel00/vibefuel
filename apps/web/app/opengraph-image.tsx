import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { CREAM, INK, MUTED, ORANGE, PumpMark } from "./og-parts"

export const alt = "Vibefuel — Let your vibe coding pay for itself."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const semiBold = await readFile(join(process.cwd(), "app/fonts/Geist-SemiBold.ttf"))
const medium = await readFile(join(process.cwd(), "app/fonts/Geist-Medium.ttf"))

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: CREAM,
          color: INK,
          fontFamily: "Geist",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PumpMark size={40} />
            <span style={{ fontSize: 34, fontWeight: 500, letterSpacing: -0.5 }}>Vibefuel</span>
          </div>
          <span style={{ fontSize: 22, color: MUTED, fontWeight: 500 }}>vibefuel.app</span>
        </div>

        {/* Body */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 720 }}>
            <div
              style={{
                display: "flex",
                fontSize: 78,
                fontWeight: 600,
                lineHeight: 1.02,
                letterSpacing: -4,
              }}
            >
              Let your vibe coding pay for itself.
            </div>
            <div style={{ display: "flex", fontSize: 27, color: MUTED, fontWeight: 500, lineHeight: 1.35 }}>
              See ads in your coding tools. Earn tokens on Solana from advertisers and put them
              toward your next AI credits.
            </div>
          </div>

          {/* Mini sponsored card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: 300,
              padding: 22,
              borderRadius: 22,
              background: "#0a0a0a",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  display: "flex",
                  padding: "5px 11px",
                  borderRadius: 999,
                  background: ORANGE,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                SPONSORED
              </span>
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.7)" }}>+12 tokens</span>
            </div>
            <span style={{ fontSize: 15, color: "rgba(255,255,255,0.7)" }}>Your brand · yourbrand.com</span>
            <span style={{ fontSize: 23, fontWeight: 600, lineHeight: 1.2, letterSpacing: -0.6 }}>
              Shown while the agent is thinking.
            </span>
            <div style={{ display: "flex", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.16)" }}>
              <div style={{ display: "flex", width: "62%", height: 4, borderRadius: 2, background: ORANGE }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 21, color: MUTED }}>
          <span>Works in Cursor, VS Code and Windsurf</span>
          <span>Built on Solana · @danilobleal</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: semiBold, style: "normal", weight: 600 },
        { name: "Geist", data: medium, style: "normal", weight: 500 },
      ],
    }
  )
}
