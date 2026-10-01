"use client"

import * as React from "react"
import Link from "next/link"

import { createDeveloper, type StartState } from "@/app/start/actions"
import { KeyReveal } from "@/components/app/key-reveal"
import { LINKS } from "@/lib/links"

export function StartForm() {
  const [state, action, pending] = React.useActionState<StartState, FormData>(
    async () => createDeveloper(),
    {}
  )

  if (state.key) {
    return (
      <div className="panel panel-plain">
        <p className="eyebrow">Step 1 of 2</p>
        <h2 className="panel-title">Here is your serial key</h2>
        <p className="panel-text">
          Paste it into the Vibefuel extension when it asks for a key. This is
          the only time the full key is shown, so copy it somewhere safe. You
          can generate a new one from your dashboard at any time.
        </p>
        <KeyReveal serialKey={state.key} />
        <ol className="steps">
          <li>
            Install the Vibefuel extension:{" "}
            <a href={LINKS.vscodeDeepLink}>open in VS Code</a>,{" "}
            <a href={LINKS.cursorDeepLink}>open in Cursor</a>, or search
            &ldquo;Vibefuel&rdquo; in your editor&apos;s Extensions view. Claude
            Code users:{" "}
            <a href={LINKS.claudeCodeRepo} target="_blank" rel="noopener">
              install the plugin
            </a>
            .
          </li>
          <li>Open the Vibefuel panel, opt in, and paste this key.</li>
          <li>Keep building. Your stats appear on the dashboard.</li>
        </ol>
        <Link href="/dashboard" className="btn btn-primary btn-wide">
          Open my dashboard
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="panel panel-plain">
      <h2 className="panel-title">Create your developer key</h2>
      <p className="panel-text">
        No email, no password. One click creates your account and a serial key
        that links the extension to your dashboard. Rewards are earned when
        sponsored messages are shown while you work.
      </p>
      {state.error && <p className="form-error">{state.error}</p>}
      <button
        type="submit"
        className="btn btn-primary btn-wide"
        disabled={pending}
      >
        {pending ? "Generating…" : "Generate my key"}
      </button>
      <p className="panel-foot">
        Already have a key? <Link href="/dashboard/login">Sign in with it</Link>
        .
      </p>
    </form>
  )
}
