"use client"

import * as React from "react"

import { updateCreative, type AdvState } from "@/app/advertise/actions"
import { AdPreview } from "@/components/app/ad-preview"

export type Creative = {
  advertiserName: string
  url: string
  headline: string
  body: string
  logoUrl: string
  brandBg: string
  brandFg: string
}

export function CreativeForm({
  campaignId,
  initial,
  rewardTokens,
}: {
  campaignId: string
  initial: Creative
  rewardTokens: number
}) {
  const action = updateCreative.bind(null, campaignId)
  const [state, formAction, pending] = React.useActionState<AdvState, FormData>(action, {})
  const [v, setV] = React.useState<Creative>(initial)
  const set = (k: keyof Creative) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }))

  let domain = "example.com"
  try {
    domain = new URL(/^https?:\/\//i.test(v.url) ? v.url : `https://${v.url}`).hostname.replace(/^www\./, "")
  } catch {
    // Still typing; keep the placeholder domain.
  }

  return (
    <div className="two-col two-col-form">
      <form action={formAction} className="panel stack">
        <h2 className="panel-title">Your card</h2>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Brand name</span>
            <input name="advertiserName" className="input" required maxLength={40} value={v.advertiserName} onChange={set("advertiserName")} />
          </label>
          <label className="field">
            <span className="field-label">Destination</span>
            <input name="url" className="input" required value={v.url} onChange={set("url")} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">
            Headline <span className="count">{v.headline.length}/60</span>
          </span>
          <input name="headline" className="input" required maxLength={60} value={v.headline} onChange={set("headline")} />
        </label>
        <label className="field">
          <span className="field-label">
            Body <span className="count">{v.body.length}/140</span>
          </span>
          <textarea name="body" className="input" required maxLength={140} rows={2} value={v.body} onChange={set("body")} />
        </label>
        <label className="field">
          <span className="field-label">Logo URL (optional, square, https)</span>
          <input name="logoUrl" className="input" placeholder="https://…/logo.png" value={v.logoUrl} onChange={set("logoUrl")} />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Card background</span>
            <span className="color-field">
              <input type="color" value={v.brandBg} onChange={set("brandBg")} aria-label="Pick background color" />
              <input name="brandBg" className="input input-mono" value={v.brandBg} onChange={set("brandBg")} pattern="#[0-9a-fA-F]{6}" />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Card text</span>
            <span className="color-field">
              <input type="color" value={v.brandFg} onChange={set("brandFg")} aria-label="Pick text color" />
              <input name="brandFg" className="input input-mono" value={v.brandFg} onChange={set("brandFg")} pattern="#[0-9a-fA-F]{6}" />
            </span>
          </label>
        </div>
        {state.error && <p className="form-error">{state.error}</p>}
        {state.ok && <p className="form-ok">{state.ok}</p>}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save card"}
        </button>
      </form>

      <aside className="panel panel-sticky">
        <h2 className="panel-title">Live preview</h2>
        <p className="panel-text">This is how your card looks in the Vibefuel panel.</p>
        <div className="preview-frame">
          <AdPreview
            advertiser={v.advertiserName}
            domain={domain}
            headline={v.headline}
            body={v.body}
            logoUrl={v.logoUrl || null}
            brandBg={v.brandBg}
            brandFg={v.brandFg}
            rewardTokens={rewardTokens}
          />
        </div>
      </aside>
    </div>
  )
}
