"use client"

import * as React from "react"
import Link from "next/link"

import { signOutAdvertiser } from "@/app/advertise/actions"
import { signOutDeveloper } from "@/app/dashboard/actions"
import { FuelPumpMark } from "@/components/logo"
import { XIcon } from "@/components/site-footer"
import { X_URL } from "@/lib/site"

export type Role = "developer" | "advertiser"

const ROLES: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "developer", label: "I'm a developer" },
  { value: "advertiser", label: "I'm an advertiser" },
]

/**
 * The one header used on every page. The role pill is the site's navigation:
 * on the home page it switches the hero copy; elsewhere it links to each side
 * and highlights the current one.
 */
export function SiteHeader(
  props:
    | { mode: "landing"; role: Role; onRoleChange: (role: Role) => void }
    | { mode: "developer" | "advertiser"; signedIn: boolean }
) {
  const refs = React.useRef<Partial<Record<Role, HTMLButtonElement | null>>>({})
  const current: Role = props.mode === "landing" ? props.role : props.mode

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (props.mode !== "landing") return
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
    event.preventDefault()
    const next: Role = current === "developer" ? "advertiser" : "developer"
    props.onRoleChange(next)
    refs.current[next]?.focus()
  }

  const hrefFor = (role: Role) => {
    if (role === "advertiser") return "/advertise"
    return props.mode !== "landing" && props.signedIn && props.mode === "developer" ? "/dashboard" : "/#start"
  }

  return (
    <header className="site-header">
      <Link href="/" className="logo" aria-label="Vibefuel home">
        <FuelPumpMark />
        <span className="logo-wordmark">Vibefuel</span>
      </Link>

      <div className="site-nav">
        {props.mode === "landing" ? (
          <div className="role-selector" role="radiogroup" aria-label="Choose how you want to use Vibefuel" onKeyDown={onKeyDown}>
            {ROLES.map((option) => {
              const selected = option.value === current
              return (
                <button
                  key={option.value}
                  ref={(node) => {
                    refs.current[option.value] = node
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className="role-option"
                  data-selected={selected ? "true" : undefined}
                  onClick={() => props.onRoleChange(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        ) : (
          <nav className="role-selector" aria-label="Site sections">
            {ROLES.map((option) => {
              const selected = option.value === current
              return (
                <Link
                  key={option.value}
                  href={hrefFor(option.value)}
                  className="role-option"
                  data-selected={selected ? "true" : undefined}
                  aria-current={selected ? "page" : undefined}
                >
                  {option.label}
                </Link>
              )
            })}
          </nav>
        )}

        {props.mode !== "landing" && props.signedIn && (
          <form action={props.mode === "developer" ? signOutDeveloper : signOutAdvertiser}>
            <button type="submit" className="link-button site-signout">
              Sign out
            </button>
          </form>
        )}

        <a href={X_URL} target="_blank" rel="noopener" className="x-button" aria-label="Follow Vibefuel on X">
          <XIcon />
          <span className="x-label">Follow us</span>
        </a>
      </div>
    </header>
  )
}
