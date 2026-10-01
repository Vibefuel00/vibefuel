"use client"

import * as React from "react"
import Link from "next/link"

import { signInWithKey, type ActionState } from "@/app/dashboard/actions"

export function LoginForm() {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(signInWithKey, {})
  return (
    <form action={action} className="panel">
      <p className="eyebrow">Welcome back</p>
      <h2 className="panel-title">Sign in with your key</h2>
      <label className="field">
        <span className="field-label">Serial key</span>
        <input
          name="key"
          className="input input-mono"
          placeholder="VF-XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </label>
      {state.error && <p className="form-error">{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-wide" disabled={pending}>
        {pending ? "Checking…" : "Open dashboard"}
      </button>
      <p className="panel-foot">
        No key yet? <Link href="/start">Start earning</Link>.
      </p>
    </form>
  )
}
