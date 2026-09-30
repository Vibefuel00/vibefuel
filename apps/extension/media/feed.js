// Vibefuel sidebar script. Pure rendering; all state comes from the extension.
// No inline handlers, no remote code. Runs under a nonce CSP.
;(function () {
  "use strict"
  const vscode = acquireVsCodeApi()
  const app = document.getElementById("app")
  let lastAdId = null
  let state = null
  let ticker = null

  function post(message) {
    vscode.postMessage(message)
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag)
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const value = attrs[key]
        if (value === undefined || value === null || value === false) continue
        if (key === "onClick") node.addEventListener("click", value)
        else if (key === "className") node.className = value
        else if (key === "text") node.textContent = value
        else node.setAttribute(key, String(value))
      }
    }
    if (children) {
      for (const child of children) {
        if (child === null || child === undefined || child === false) continue
        node.appendChild(
          typeof child === "string" ? document.createTextNode(child) : child
        )
      }
    }
    return node
  }

  function button(label, onClick, className, attrs) {
    return el(
      "button",
      Object.assign(
        { type: "button", className, text: label, onClick },
        attrs || {}
      ),
      null
    )
  }

  function formatTokens(value) {
    if (Number.isInteger(value)) return value.toLocaleString("en-US")
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  }

  function formatWait(untilMs) {
    const diff = Math.max(0, untilMs - Date.now())
    const minutes = Math.ceil(diff / 60000)
    if (minutes <= 1) return "in about a minute"
    if (minutes < 60) return "in " + minutes + " minutes"
    const hours = Math.round(minutes / 60)
    return "in about " + hours + (hours === 1 ? " hour" : " hours")
  }

  const PRIVACY = {
    collected: [
      "An anonymous device id",
      "Ad events: impression, click, dismiss",
      "Editor name and version",
      "Extension version",
    ],
    never: [
      "File contents, file names, project names or paths",
      "Prompts, chat messages or AI completions",
      "Keystrokes or clipboard",
      "Git remotes or identities",
    ],
  }

  function privacyDetails() {
    return el("details", null, [
      el("summary", { text: "What Vibefuel collects" }),
      el("p", { className: "small muted", text: "Collected:" }),
      el(
        "ul",
        null,
        PRIVACY.collected.map((t) => el("li", { text: t }))
      ),
      el("p", { className: "small muted", text: "Never collected:" }),
      el(
        "ul",
        null,
        PRIVACY.never.map((t) => el("li", { text: t }))
      ),
      el("p", { className: "small muted" }, [
        "Events are batched and sent at most once per minute. Turning off editor telemetry stops all events. ",
        button(
          "Full privacy summary",
          () => post({ type: "openPrivacy" }),
          "link"
        ),
      ]),
    ])
  }

  function footer(s) {
    return el("footer", null, [
      button("vibefuel website", () => post({ type: "openLanding" }), "link"),
      el("span", {
        className: "muted",
        text:
          "v" + s.version + " · " + (s.mode === "mock" ? "mock mode" : "live"),
      }),
    ])
  }

  // ---------------------------------------------------------- onboarding

  function renderOnboarding(s) {
    return [
      el("p", {
        className: "eyebrow",
        text: "More building. Less credit anxiety.",
      }),
      el("h1", { text: "Let your vibe coding pay for itself." }),
      el("p", null, [
        "Vibefuel shows one sponsored card at a time, only in this sidebar. Advertisers fund tokens on Solana for every qualified view. Put them toward your next AI credits.",
      ]),
      el("div", { className: "section" }, [
        el("h2", { text: "What you see" }),
        el("p", {
          className: "small",
          text: "A clearly labelled sponsored card here, at most one every 30 minutes, never in the first 10 minutes of a session, never while debugging, never in your editor, chat or terminal.",
        }),
        el("h2", { text: "What you earn" }),
        el("p", {
          className: "small",
          text: "Each card shows its reward. A view counts after the card has been visible for 3 seconds with the window focused. Link a Solana public address any time to receive settled tokens.",
        }),
        el("h2", { text: "What is collected" }),
        el("p", {
          className: "small",
          text: "An anonymous device id, ad events, editor name and version, and the extension version. Nothing about your code, files, prompts or git.",
        }),
      ]),
      el("div", { className: "row" }, [
        button("Opt in and start", () => post({ type: "optIn" }), "primary"),
      ]),
      el("p", {
        className: "small muted",
        text: "You can opt out with one click from this view at any time.",
      }),
      privacyDetails(),
      footer(s),
    ]
  }

  // ------------------------------------------------------------- sign in

  function renderSignIn(s) {
    const auth = s.auth
    const children = [el("h1", { text: "Sign in this device" })]
    if (s.offline) {
      children.push(
        el("div", {
          className: "notice warn",
          text: "Vibefuel is offline. The API could not be reached. Sign-in will resume when it is back.",
        })
      )
    }
    if (!auth) {
      children.push(
        el("p", {
          className: "small muted",
          text:
            s.mode === "mock"
              ? "Mock mode: a local device id is generated, nothing leaves your machine."
              : "Sign in with a short code in your browser. No password is typed in the editor.",
        }),
        button("Sign in", () => post({ type: "signIn" }), "primary")
      )
    } else if (auth.status === "waiting") {
      children.push(
        el("p", {
          className: "small",
          text: "Enter this code in your browser:",
        }),
        el("div", { className: "code", text: auth.userCode }),
        el("div", { className: "row" }, [
          button(
            "Open browser",
            () => post({ type: "openVerification" }),
            "primary"
          ),
          button("Start over", () => post({ type: "restartAuth" }), ""),
        ]),
        el("p", { className: "small muted", text: "Waiting for approval…" })
      )
    } else {
      const text =
        auth.status === "expired"
          ? "That code expired."
          : auth.status === "denied"
            ? "Sign-in was declined in the browser."
            : "Could not start sign-in."
      children.push(
        el("div", { className: "notice warn", text: text }),
        button("Try again", () => post({ type: "restartAuth" }), "primary")
      )
    }
    children.push(
      el("div", { className: "row" }, [
        button("Opt out", () => post({ type: "optOut" }), "link"),
      ]),
      footer(s)
    )
    return children
  }

  // ---------------------------------------------------------------- feed

  function renderCard(s) {
    const ad = s.ad
    const card = el("article", {
      className: "card" + (ad.id !== lastAdId ? " enter" : ""),
      "aria-label": "Sponsored message from " + ad.advertiser,
    })
    if (ad.image_url) {
      card.appendChild(
        el("img", {
          className: "card-image",
          src: ad.image_url,
          alt: "",
          loading: "lazy",
        })
      )
    }
    card.appendChild(
      el("div", { className: "card-body" }, [
        el("div", { className: "row between" }, [
          el("span", { className: "sponsored", text: "Sponsored" }),
          el("span", { className: "advertiser", text: ad.advertiser }),
        ]),
        el("h3", { text: ad.headline }),
        el("p", { className: "body", text: ad.body }),
        el("p", {
          className: "reward",
          text: s.impressionCounted
            ? "Earned " + formatTokens(ad.reward_tokens) + " tokens"
            : "Earn " + formatTokens(ad.reward_tokens) + " tokens",
        }),
        el("div", { className: "card-actions" }, [
          button(
            ad.cta_label,
            () => post({ type: "cta", adId: ad.id }),
            "cta",
            {
              title: ad.cta_url,
            }
          ),
          button(
            "Not interested",
            () => post({ type: "dismiss", adId: ad.id }),
            "link"
          ),
        ]),
      ])
    )
    return card
  }

  function renderEmpty(s) {
    let text
    if (s.paused)
      text = "Vibefuel is paused. Resume to see sponsored messages again."
    else if (s.blockReason === "quiet-period" && s.nextEligibleAt) {
      text =
        "Quiet period. The first sponsored message can arrive " +
        formatWait(s.nextEligibleAt) +
        "."
    } else if (s.blockReason === "frequency" && s.nextEligibleAt) {
      text =
        "Nothing new yet. The next sponsored message can arrive " +
        formatWait(s.nextEligibleAt) +
        "."
    } else if (s.blockReason === "debugging")
      text = "No sponsored messages while a debug session is running."
    else if (s.blockReason === "unfocused")
      text = "Sponsored messages only arrive while the window is focused."
    else text = "Nothing sponsored right now. Keep building."
    return el("div", { className: "empty", text: text })
  }

  function renderFeed(s) {
    const children = []
    if (s.offline) {
      children.push(
        el("div", {
          className: "notice warn",
          text: "Vibefuel is offline. The API could not be reached; it retries quietly in the background.",
        })
      )
    }
    if (s.eventsBlocked === "editor") {
      children.push(
        el("div", {
          className: "notice warn",
          text: "Editor telemetry is off, so Vibefuel cannot report views and no tokens are earned.",
        })
      )
    } else if (s.eventsBlocked === "setting") {
      children.push(
        el("div", {
          className: "notice warn",
          text: "vibefuel.telemetry is off, so views are not reported and no tokens are earned.",
        })
      )
    }

    children.push(s.ad && !s.paused ? renderCard(s) : renderEmpty(s))

    const balance = s.balance || { pending: 0, settled: 0, currency: "tokens" }
    children.push(
      el("div", { className: "section" }, [
        el("h2", { text: "Earnings" }),
        el("div", { className: "stats" }, [
          el("div", { className: "stat" }, [
            el("div", {
              className: "value",
              text: formatTokens(balance.pending),
            }),
            el("div", {
              className: "label",
              text: "Pending " + balance.currency,
            }),
          ]),
          el("div", { className: "stat" }, [
            el("div", {
              className: "value",
              text: formatTokens(balance.settled),
            }),
            el("div", {
              className: "label",
              text: "Settled " + balance.currency,
            }),
          ]),
        ]),
        el("p", {
          className: "small muted",
          text: "Put settled tokens toward your next AI credits.",
        }),
      ])
    )

    children.push(
      el("div", { className: "section" }, [
        el("h2", { text: "Wallet" }),
        s.wallet
          ? el("div", { className: "row between" }, [
              el("span", null, [
                el("span", { text: s.wallet }),
                s.walletSyncPending
                  ? el("span", {
                      className: "small muted",
                      text: " · syncing when online",
                    })
                  : null,
              ]),
              button("Unlink", () => post({ type: "unlinkWallet" }), ""),
            ])
          : el("div", { className: "row between" }, [
              el("span", {
                className: "small muted",
                text: "No Solana address linked.",
              }),
              button("Link wallet", () => post({ type: "linkWallet" }), ""),
            ]),
        el("p", {
          className: "small muted",
          text: "Only a public address is stored. Vibefuel never asks for private keys or seed phrases.",
        }),
      ])
    )

    children.push(
      el("div", { className: "row between" }, [
        s.paused
          ? button("Resume Vibefuel", () => post({ type: "resume" }), "primary")
          : button("Pause Vibefuel", () => post({ type: "pause" }), ""),
        el("span", { className: "row" }, [
          button("Sign out", () => post({ type: "signOut" }), "link"),
          button("Opt out", () => post({ type: "optOut" }), "link"),
        ]),
      ])
    )
    children.push(privacyDetails(), footer(s))
    return children
  }

  // -------------------------------------------------------------- render

  function render() {
    if (!state) return
    const s = state
    app.setAttribute("aria-busy", "false")
    app.replaceChildren()
    let nodes
    if (s.screen === "onboarding") nodes = renderOnboarding(s)
    else if (s.screen === "signin") nodes = renderSignIn(s)
    else nodes = renderFeed(s)
    for (const node of nodes) app.appendChild(node)
    lastAdId = s.ad ? s.ad.id : null

    if (ticker) clearInterval(ticker)
    ticker = null
    if (s.screen === "feed" && !s.ad && s.nextEligibleAt) {
      ticker = setInterval(() => post({ type: "refresh" }), 30000)
    }
  }

  window.addEventListener("message", (event) => {
    const message = event.data
    if (!message || typeof message !== "object") return
    if (message.type === "state") {
      state = message.state
      render()
    }
  })

  post({ type: "ready" })
})()
