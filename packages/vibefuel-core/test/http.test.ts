import { describe, expect, it } from "vitest"
import {
  ApiRequestError,
  ApiUnavailableError,
  UnauthorizedError,
} from "../src/client"
import { HttpAdapter } from "../src/http"

const client = {
  editor: "Visual Studio Code",
  editor_version: "1.90.0",
  extension_version: "0.1.0",
  surface: "sidebar" as const,
}

function adapter(
  fetchImpl: typeof fetch,
  token: string | null = "VF-AAAA-BBBB-CCCC-DDDD"
) {
  return new HttpAdapter({
    baseUrl: "https://api.invalid/",
    client,
    tokens: { getToken: () => Promise.resolve(token ?? undefined) },
    fetchImpl,
    timeoutMs: 50,
  })
}

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

const ME = {
  developer_id: "d1",
  key_prefix: "VF-AAAA",
  wallet_address: null,
  balance: { pending: 12, settled: 0, currency: "tokens" },
  earned: 12,
  active_seconds: 60,
}

describe("HttpAdapter", () => {
  it("degrades to ApiUnavailableError when the host cannot be reached", async () => {
    const api = adapter(() => Promise.reject(new TypeError("fetch failed")))
    await expect(api.getNextAd("s")).rejects.toBeInstanceOf(ApiUnavailableError)
    await expect(api.me()).rejects.toBeInstanceOf(ApiUnavailableError)
  })

  it("treats a hung request as unavailable after the timeout", async () => {
    const api = adapter(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          )
        })
    )
    await expect(api.me()).rejects.toBeInstanceOf(ApiUnavailableError)
  })

  it("maps 5xx and 429 to unavailable, 401 to unauthorized, other 4xx to request errors", async () => {
    await expect(
      adapter(() => Promise.resolve(json(503, { error: "down" }))).me()
    ).rejects.toBeInstanceOf(ApiUnavailableError)
    await expect(
      adapter(() => Promise.resolve(json(429, { error: "slow" }))).me()
    ).rejects.toBeInstanceOf(ApiUnavailableError)
    await expect(
      adapter(() => Promise.resolve(json(401, { error: "nope" }))).me()
    ).rejects.toBeInstanceOf(UnauthorizedError)
    const bad = adapter(() =>
      Promise.resolve(
        json(400, { error: "That isn't a valid Solana address." })
      )
    )
    await expect(bad.linkWallet("x")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 400,
      message: "That isn't a valid Solana address.",
    })
    await expect(bad.linkWallet("x")).rejects.toBeInstanceOf(ApiRequestError)
  })

  it("returns null on 204 from ads/next and sends the bearer key and surface", async () => {
    let seen: Record<string, string> = {}
    let url = ""
    const api = adapter((input, init) => {
      url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      seen = init?.headers as Record<string, string>
      return Promise.resolve(new Response(null, { status: 204 }))
    })
    expect(await api.getNextAd("session-9")).toBeNull()
    expect(url).toBe(
      "https://api.invalid/api/ext/ads/next?session_id=session-9&surface=sidebar"
    )
    expect(seen.Authorization).toBe("Bearer VF-AAAA-BBBB-CCCC-DDDD")
    expect(seen["X-Vibefuel-Client"]).toContain("vibefuel/0.1.0")
  })

  it("refuses calls without a key instead of sending them", async () => {
    let called = false
    const api = adapter(() => {
      called = true
      return Promise.resolve(json(200, ME))
    }, null)
    await expect(api.me()).rejects.toBeInstanceOf(UnauthorizedError)
    expect(called).toBe(false)
  })

  it("speaks the contract for me, heartbeat, events and wallet", async () => {
    const calls: { url: string; method: string; body: unknown }[] = []
    const api = adapter((input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      calls.push({
        url,
        method: init?.method ?? "GET",
        body:
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as unknown)
            : null,
      })
      if (url.endsWith("/api/ext/me")) return Promise.resolve(json(200, ME))
      if (url.endsWith("/api/ext/heartbeat"))
        return Promise.resolve(json(200, { ok: true }))
      if (url.endsWith("/api/ext/events")) {
        return Promise.resolve(
          json(200, { accepted: 1, rewarded: 12, balance: ME.balance })
        )
      }
      if (url.endsWith("/api/ext/wallet") && init?.method === "POST") {
        return Promise.resolve(
          json(200, { address: "x", linked_at: "2026-01-01T00:00:00Z" })
        )
      }
      if (url.endsWith("/api/ext/wallet") && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return Promise.resolve(json(404, { error: "nope" }))
    })
    expect(await api.me()).toEqual(ME)
    await api.heartbeat(999)
    expect(calls[1]?.body).toEqual({
      editor: client.editor,
      extension_version: "0.1.0",
      active_seconds: 600,
    })
    const result = await api.postEvents([
      {
        id: "e1",
        ad_id: "c1",
        type: "impression",
        occurred_at: "2026-01-01T00:00:00Z",
        session_id: "s",
      },
    ])
    expect(result.rewarded).toBe(12)
    expect(calls[2]?.body).toMatchObject({
      events: [{ ad_id: "c1" }],
      client: { editor: client.editor },
    })
    expect((await api.linkWallet("x")).address).toBe("x")
    await api.unlinkWallet()
    expect(calls.map((c) => c.method)).toEqual([
      "GET",
      "POST",
      "POST",
      "POST",
      "DELETE",
    ])
  })
})
