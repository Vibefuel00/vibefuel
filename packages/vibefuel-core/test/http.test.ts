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
}

function adapter(fetchImpl: typeof fetch, token: string | null = "tok") {
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

describe("HttpAdapter", () => {
  it("degrades to ApiUnavailableError when the host cannot be reached", async () => {
    const api = adapter(() => Promise.reject(new TypeError("fetch failed")))
    await expect(api.getNextAd("s")).rejects.toBeInstanceOf(ApiUnavailableError)
    await expect(api.getBalance()).rejects.toBeInstanceOf(ApiUnavailableError)
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
    await expect(api.getBalance()).rejects.toBeInstanceOf(ApiUnavailableError)
  })

  it("maps 5xx and 429 to unavailable, 401 to unauthorized, other 4xx to request errors", async () => {
    await expect(
      adapter(() => Promise.resolve(json(503, { error: "down" }))).getBalance()
    ).rejects.toBeInstanceOf(ApiUnavailableError)
    await expect(
      adapter(() => Promise.resolve(json(429, { error: "slow" }))).getBalance()
    ).rejects.toBeInstanceOf(ApiUnavailableError)
    await expect(
      adapter(() => Promise.resolve(json(401, { error: "nope" }))).getBalance()
    ).rejects.toBeInstanceOf(UnauthorizedError)
    const bad = adapter(() =>
      Promise.resolve(
        json(400, { error: "invalid_address", message: "Not a Solana key" })
      )
    )
    await expect(bad.linkWallet("x")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 400,
      code: "invalid_address",
    })
    await expect(bad.linkWallet("x")).rejects.toBeInstanceOf(ApiRequestError)
  })

  it("returns null on 204 from ads/next and sends the bearer token", async () => {
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
      "https://api.invalid/v1/ads/next?session_id=session-9&editor=Visual+Studio+Code"
    )
    expect(seen.Authorization).toBe("Bearer tok")
    expect(seen["X-Vibefuel-Client"]).toContain("vibefuel/0.1.0")
  })

  it("refuses authenticated calls without a token instead of sending them", async () => {
    let called = false
    const api = adapter(() => {
      called = true
      return Promise.resolve(json(200, {}))
    }, null)
    await expect(api.getBalance()).rejects.toBeInstanceOf(UnauthorizedError)
    expect(called).toBe(false)
  })

  it("implements the device code flow responses", async () => {
    const start = adapter(() =>
      Promise.resolve(
        json(200, {
          device_code: "dc",
          user_code: "FUEL-1234",
          verification_uri: "https://example.com/device",
          expires_in: 600,
          interval: 5,
        })
      )
    )
    expect((await start.startDeviceAuth()).user_code).toBe("FUEL-1234")

    const pending = adapter(() =>
      Promise.resolve(json(400, { error: "authorization_pending" }))
    )
    expect(await pending.pollDeviceToken("dc")).toEqual({
      status: "pending",
      error: "authorization_pending",
    })

    const ok = adapter(() =>
      Promise.resolve(
        json(200, { access_token: "t", token_type: "Bearer", device_id: "d" })
      )
    )
    expect(await ok.pollDeviceToken("dc")).toMatchObject({
      status: "ok",
      token: { access_token: "t", device_id: "d" },
    })
  })
})
