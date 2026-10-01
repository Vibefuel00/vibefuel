"use client"

import * as React from "react"

export function KeyReveal({ serialKey, onHide }: { serialKey: string; onHide?: () => void }) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(serialKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be blocked; the key is still selectable.
    }
  }

  return (
    <div className="key-box">
      <code className="key-value" aria-label="Your serial key">
        {serialKey}
      </code>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={copy}>
          {copied ? "Copied" : "Copy key"}
        </button>
        {onHide && (
          <button type="button" className="link-button" onClick={onHide}>
            Hide
          </button>
        )}
      </div>
    </div>
  )
}
