"use client"

import * as React from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"

import { SPONSORS, sponsorStyle } from "@/components/sponsors"

const SCENES = [
  {
    prompt: "add rate limiting to the API",
    result: "Done · 3 files changed · tests passing",
    ad: SPONSORS[0]!,
  },
  {
    prompt: "fix the flaky auth test",
    result: "Done · 1 file changed · 14 tests passing",
    ad: SPONSORS[1]!,
  },
  {
    prompt: "write docs for the webhook endpoint",
    result: "Done · README.md updated",
    ad: SPONSORS[2]!,
  },
] as const

const VERBS = ["Thinking", "Cooking", "Planning", "Generating", "Reviewing"] as const

// Faux code for the editor pane: [indent, [tone, width]...]
const CODE_LINES: ReadonlyArray<
  readonly [number, ReadonlyArray<readonly [string, number]>]
> = [
  [0, [["k", 30], ["n", 60], ["p", 28]]],
  [1, [["n", 44], ["p", 70]]],
  [1, [["k", 24], ["n", 40], ["s", 64]]],
  [2, [["n", 84], ["p", 26]]],
  [1, [["c", 96]]],
  [1, [["k", 34], ["n", 52]]],
  [0, [["p", 16]]],
  [0, [["k", 42], ["n", 66], ["p", 24]]],
  [1, [["n", 38], ["s", 78]]],
  [1, [["n", 58], ["p", 40]]],
  [0, [["p", 16]]],
]

type Phase = "prompt" | "working" | "done"

const PROMPT_MS = 900
const AD_DELAY_MS = 700
const VIEW_MS = 2400
const WORKING_MS = AD_DELAY_MS + VIEW_MS + 900
const DONE_MS = 1700
const VERB_MS = 750
const START_BALANCE = 116

const EASE = [0.22, 1, 0.36, 1] as const

export function HeroDemo() {
  const reduced = useReducedMotion()
  const [scene, setScene] = React.useState(0)
  const [phase, setPhase] = React.useState<Phase>("working")
  const [elapsed, setElapsed] = React.useState(0)
  const [verb, setVerb] = React.useState(0)
  const [balanceTarget, setBalanceTarget] = React.useState(START_BALANCE)

  const balance = useMotionValue(START_BALANCE)
  const balanceText = useTransform(() => Math.round(balance.get()).toString())

  const current = SCENES[scene % SCENES.length]!
  const adVisible =
    reduced || (phase === "working" && elapsed >= AD_DELAY_MS)
  const earned =
    reduced ||
    (phase === "working" && elapsed >= AD_DELAY_MS + VIEW_MS) ||
    phase === "done"

  // Phase machine: prompt -> working -> done -> next scene.
  React.useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout>
    if (phase === "prompt") {
      timer = setTimeout(() => {
        setElapsed(0)
        setPhase("working")
      }, PROMPT_MS)
    } else if (phase === "working") {
      timer = setTimeout(() => setPhase("done"), WORKING_MS)
    } else {
      timer = setTimeout(() => {
        setScene((s) => s + 1)
        setPhase("prompt")
      }, DONE_MS)
    }
    return () => clearTimeout(timer)
  }, [phase, reduced])

  // Sub-timers while working: ad reveal, then the reward.
  React.useEffect(() => {
    if (reduced || phase !== "working") return
    const reveal = setTimeout(() => setElapsed(AD_DELAY_MS), AD_DELAY_MS)
    const reward = setTimeout(() => {
      setElapsed(AD_DELAY_MS + VIEW_MS)
      setBalanceTarget((b) => b + current.ad.reward)
    }, AD_DELAY_MS + VIEW_MS)
    return () => {
      clearTimeout(reveal)
      clearTimeout(reward)
    }
  }, [phase, reduced, current.ad.reward])

  // Cycling status verb while working.
  React.useEffect(() => {
    if (reduced || phase !== "working") return
    const v = setInterval(() => setVerb((i) => i + 1), VERB_MS)
    return () => clearInterval(v)
  }, [phase, reduced])

  React.useEffect(() => {
    const controls = animate(balance, balanceTarget, {
      duration: reduced ? 0 : 0.7,
      ease: EASE,
    })
    return () => controls.stop()
  }, [balance, balanceTarget, reduced])

  const status =
    phase === "done" ? current.result : `${VERBS[verb % VERBS.length]}…`

  return (
    <div
      className="hero-demo mock-window"
      data-frame="editor"
      role="group"
      aria-label="How Vibefuel works: a sponsored message appears in the agent panel while it works"
    >
      <div className="mock-titlebar">
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mock-title">vibefuel-app — Cursor</span>
      </div>

      <div className="mock-body">
        <div className="mock-activity" aria-hidden="true">
          <i />
          <i />
          <i />
          <i className="is-active" />
        </div>

        <div className="mock-sidebar cur-panel">
          <div className="cur-panel-head">
            <span className="mock-sidebar-title">Agent</span>
            <span className="cur-panel-meta">Auto</span>
          </div>

          <div className="cur-messages">
            <div className="cur-user">{current.prompt}</div>

            <div className="cur-agent">
              <p className="cur-status" data-phase={phase}>
                <span className="cur-status-dot" aria-hidden="true" />
                <span className="cur-status-text">{status}</span>
                {phase === "working" && (
                  <span className="cur-stop" aria-hidden="true">
                    Stop
                  </span>
                )}
              </p>
              {phase === "working" && (
                <p className="cur-step">
                  Reading {current.prompt.split(" ").at(-1)} context…
                </p>
              )}
            </div>

            <div className="demo-ad-slot">
              <AnimatePresence initial={false}>
                {adVisible && (
                  <motion.div
                    key={`ad-${scene}`}
                    className="ad-card ad-card-compact"
                    style={sponsorStyle(current.ad)}
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.32, ease: EASE }}
                  >
                    <div className="ad-card-top">
                      <span className="ad-label">Sponsored</span>
                      <span className="ad-reward">+{current.ad.reward} tokens</span>
                    </div>
                    <div className="ad-card-main">
                      <span className="ad-logo">
                        {/* eslint-disable-next-line @next/next/no-img-element -- small sponsor logo from an arbitrary host */}
                        <img src={current.ad.logo} alt="" width="26" height="26" />
                      </span>
                      <div className="ad-card-text">
                        <p className="ad-advertiser">
                          {current.ad.advertiser} · {current.ad.domain}
                        </p>
                        <a
                          className="ad-headline"
                          href={current.ad.url}
                          target="_blank"
                          rel="noopener sponsored"
                        >
                          {current.ad.headline}
                        </a>
                      </div>
                    </div>
                    <div className="ad-view-track" aria-hidden="true">
                      <motion.span
                        className="ad-view-fill"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{
                          duration: reduced ? 0 : VIEW_MS / 1000,
                          ease: "linear",
                        }}
                      />
                    </div>
                    <AnimatePresence>
                      {earned && (
                        <motion.span
                          key="chip"
                          className="ad-chip"
                          initial={reduced ? false : { opacity: 0, y: 8, scale: 0.85 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.28, ease: EASE }}
                          aria-hidden="true"
                        >
                          +{current.ad.reward}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="cur-input" aria-hidden="true">
            <span className="cur-input-text">Plan, search, build anything</span>
            <span className="cur-send">↑</span>
          </div>
        </div>

        <div className="mock-editor" aria-hidden="true">
          <div className="mock-tabs">
            <span className="is-active">limits.ts</span>
            <span>auth.ts</span>
          </div>
          <div className="mock-code">
            {CODE_LINES.map(([indent, segments], row) => (
              <div
                key={row}
                className="mock-line"
                style={{ paddingLeft: `${indent * 12}px` }}
              >
                {segments.map(([tone, width], i) => (
                  <i
                    key={i}
                    className={`mock-tok tone-${tone}`}
                    style={{ width: `${width}px` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mock-statusbar">
        <span>main</span>
        <span className="mock-status-fuel">
          <span aria-hidden="true">⛽ </span>
          <motion.span>{balanceText}</motion.span> tokens
        </span>
      </div>
    </div>
  )
}
