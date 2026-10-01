import { ImageResponse } from "next/og"

import { CREAM, PumpMark } from "./og-parts"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: CREAM,
        }}
      >
        <PumpMark size={118} />
      </div>
    ),
    { ...size }
  )
}
