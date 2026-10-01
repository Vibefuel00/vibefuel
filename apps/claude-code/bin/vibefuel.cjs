#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../packages/vibefuel-core/src/client.ts
var ApiUnavailableError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ApiUnavailableError";
  }
  cause;
};
var UnauthorizedError = class extends Error {
  constructor() {
    super("Device token rejected");
    this.name = "UnauthorizedError";
  }
};
var ApiRequestError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiRequestError";
  }
  status;
  code;
};

// ../../packages/vibefuel-core/src/constants.ts
var HTTP_TIMEOUT_MS = 1e4;

// ../../packages/vibefuel-core/src/policy.ts
var MIN_FREQUENCY_MINUTES = 15;
var MINUTE = 6e4;
function normalizeFrequencyMinutes(value) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 30;
  return Math.max(MIN_FREQUENCY_MINUTES, n);
}
function normalizeQuietPeriodMinutes(value) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 10;
  return Math.max(0, n);
}
function quietPeriodEndsAt(input) {
  return input.sessionStartedAt + normalizeQuietPeriodMinutes(input.quietPeriodMinutes) * MINUTE;
}
function nextFrequencySlotAt(input) {
  if (input.lastDeliveredAt === null) return null;
  return input.lastDeliveredAt + normalizeFrequencyMinutes(input.frequencyMinutes) * MINUTE;
}
function evaluatePolicy(input) {
  if (!input.enabled)
    return { allowed: false, reason: "disabled", retryAt: null };
  if (input.paused) return { allowed: false, reason: "paused", retryAt: null };
  if (input.debugActive) {
    return { allowed: false, reason: "debugging", retryAt: null };
  }
  if (!input.windowFocused) {
    return { allowed: false, reason: "unfocused", retryAt: null };
  }
  const quietEnd = quietPeriodEndsAt(input);
  if (input.now < quietEnd) {
    return { allowed: false, reason: "quiet-period", retryAt: quietEnd };
  }
  const slot = nextFrequencySlotAt(input);
  if (slot !== null && input.now < slot) {
    return { allowed: false, reason: "frequency", retryAt: slot };
  }
  return { allowed: true };
}

// ../../packages/vibefuel-core/src/validate.ts
var LIMITS = {
  advertiser: 40,
  headline: 60,
  body: 140,
  cta_label: 20
};
function isHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
function validateAd(input, now = Date.now()) {
  if (!input || typeof input !== "object") return null;
  const ad = input;
  const text = (key) => {
    const value = ad[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > LIMITS[key]) return null;
    return trimmed;
  };
  const id = typeof ad.id === "string" && ad.id.length > 0 ? ad.id : null;
  const advertiser = text("advertiser");
  const headline = text("headline");
  const body = text("body");
  const cta_label = text("cta_label");
  if (!id || !advertiser || !headline || !body || !cta_label) return null;
  if (!isHttpsUrl(ad.cta_url)) return null;
  if (ad.image_url !== void 0 && !isHttpsUrl(ad.image_url)) return null;
  if (ad.click_url !== void 0 && !isHttpsUrl(ad.click_url)) return null;
  const reward = ad.reward_tokens;
  if (typeof reward !== "number" || !Number.isFinite(reward) || reward < 0) {
    return null;
  }
  if (typeof ad.expires_at !== "string") return null;
  const expires = Date.parse(ad.expires_at);
  if (Number.isNaN(expires) || expires <= now) return null;
  const result = {
    id,
    advertiser,
    headline,
    body,
    cta_label,
    cta_url: ad.cta_url,
    reward_tokens: reward,
    expires_at: ad.expires_at
  };
  if (ad.image_url !== void 0) result.image_url = ad.image_url;
  if (ad.click_url !== void 0) result.click_url = ad.click_url;
  return result;
}

// ../../packages/vibefuel-core/src/wallet.ts
var ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
var PUBKEY_BYTES = 32;
function decodeBase58(value) {
  if (!BASE58_RE.test(value)) return null;
  let big = 0n;
  for (const char of value) {
    big = big * 58n + BigInt(ALPHABET.indexOf(char));
  }
  const bytes = [];
  while (big > 0n) {
    bytes.unshift(Number(big & 0xffn));
    big >>= 8n;
  }
  for (const char of value) {
    if (char !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}
function validateSolanaAddress(input) {
  const address = input.trim();
  if (address.length === 0) return { ok: false, reason: "empty" };
  if (!BASE58_RE.test(address)) return { ok: false, reason: "characters" };
  if (address.length < 32 || address.length > 44) {
    return { ok: false, reason: "length" };
  }
  const bytes = decodeBase58(address);
  if (!bytes || bytes.length !== PUBKEY_BYTES) {
    return { ok: false, reason: "not-32-bytes" };
  }
  return { ok: true, address };
}
function describeWalletError(reason) {
  switch (reason) {
    case "empty":
      return "Paste a Solana public address.";
    case "characters":
      return "That is not base58. Solana addresses use 1-9, A-Z and a-z without 0, O, I or l.";
    case "length":
      return "A Solana address is 32 to 44 characters long.";
    case "not-32-bytes":
      return "That does not decode to a 32 byte public key.";
  }
}
function shortenAddress(address) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}\u2026${address.slice(-4)}`;
}

// ../../packages/vibefuel-core/src/http.ts
var HttpAdapter = class {
  mode = "http";
  baseUrl;
  client;
  tokens;
  fetchImpl;
  timeoutMs;
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.client = options.client;
    this.tokens = options.tokens;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? HTTP_TIMEOUT_MS;
  }
  async startDeviceAuth() {
    const res = await this.request("POST", "/v1/auth/device", {
      body: { client: this.client },
      auth: false
    });
    return await res.json();
  }
  async pollDeviceToken(deviceCode) {
    const res = await this.request("POST", "/v1/auth/token", {
      body: { device_code: deviceCode },
      auth: false,
      allow: [400]
    });
    if (res.status === 400) {
      const pending = await res.json();
      return { status: "pending", error: pending.error };
    }
    return { status: "ok", token: await res.json() };
  }
  async getNextAd(sessionId) {
    const query = new URLSearchParams({
      session_id: sessionId,
      editor: this.client.editor
    });
    const res = await this.request("GET", `/v1/ads/next?${query.toString()}`);
    if (res.status === 204) return null;
    return await res.json();
  }
  async postEvents(events) {
    const res = await this.request("POST", "/v1/events", {
      body: { events, client: this.client }
    });
    return await res.json();
  }
  async getBalance() {
    const res = await this.request("GET", "/v1/rewards/balance");
    return await res.json();
  }
  async linkWallet(address) {
    const res = await this.request("POST", "/v1/wallet", {
      body: { address }
    });
    return await res.json();
  }
  async unlinkWallet() {
    await this.request("DELETE", "/v1/wallet");
  }
  async request(method, path2, options = {}) {
    const headers = {
      Accept: "application/json",
      "X-Vibefuel-Client": `${this.client.editor}/${this.client.editor_version} vibefuel/${this.client.extension_version}`
    };
    if (options.body !== void 0) {
      headers["Content-Type"] = "application/json";
    }
    if (options.auth !== false) {
      const token = await this.tokens.getToken();
      if (!token) throw new UnauthorizedError();
      headers.Authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      const init = { method, headers, signal: controller.signal };
      if (options.body !== void 0) init.body = JSON.stringify(options.body);
      res = await this.fetchImpl(`${this.baseUrl}${path2}`, init);
    } catch (error) {
      throw new ApiUnavailableError(`Could not reach ${this.baseUrl}`, error);
    } finally {
      clearTimeout(timer);
    }
    if (res.ok || options.allow?.includes(res.status)) return res;
    if (res.status === 401) throw new UnauthorizedError();
    if (res.status >= 500 || res.status === 429) {
      throw new ApiUnavailableError(`API answered ${res.status}`);
    }
    let code = "request_failed";
    let message = `API answered ${res.status}`;
    try {
      const body = await res.json();
      code = body.error ?? code;
      message = body.message ?? message;
    } catch {
    }
    throw new ApiRequestError(res.status, code, message);
  }
};

// ../../packages/vibefuel-core/src/mock.ts
var import_node_crypto = require("node:crypto");
var KEY_INDEX = "mock.adIndex";
var KEY_CREDITS = "mock.credits";
var KEY_SETTLED = "mock.settled";
var KEY_SEEN_EVENTS = "mock.seenEvents";
var KEY_WALLET = "mock.wallet";
var KEY_DEVICE_ID = "mock.deviceId";
var SETTLE_AFTER_MS = 10 * 6e4;
var CURRENCY = "FUEL";
var MockAdapter = class {
  constructor(ads, storage, log, now = () => Date.now()) {
    this.ads = ads;
    this.storage = storage;
    this.log = log;
    this.now = now;
  }
  ads;
  storage;
  log;
  now;
  mode = "mock";
  startDeviceAuth() {
    this.log.appendLine("[mock] device auth started (auto-approved locally)");
    return Promise.resolve({
      device_code: `mock-${(0, import_node_crypto.randomUUID)()}`,
      user_code: "MOCK-MODE",
      verification_uri: "https://localhost/mock-verification",
      expires_in: 600,
      interval: 1
    });
  }
  async pollDeviceToken(deviceCode) {
    let deviceId = this.storage.get(KEY_DEVICE_ID);
    if (!deviceId) {
      deviceId = (0, import_node_crypto.randomUUID)();
      await this.storage.update(KEY_DEVICE_ID, deviceId);
    }
    this.log.appendLine(`[mock] token issued for ${deviceCode.slice(0, 12)}\u2026`);
    return {
      status: "ok",
      token: {
        access_token: `mock-token-${deviceId}`,
        token_type: "Bearer",
        device_id: deviceId
      }
    };
  }
  async getNextAd(sessionId) {
    if (this.ads.length === 0) return null;
    const index = this.storage.get(KEY_INDEX) ?? 0;
    const ad = this.ads[index % this.ads.length];
    await this.storage.update(KEY_INDEX, (index + 1) % this.ads.length);
    if (!ad) return null;
    const fresh = {
      ...ad,
      expires_at: new Date(this.now() + 24 * 60 * 6e4).toISOString()
    };
    this.log.appendLine(
      `[mock] ads/next \u2192 ${fresh.id} (${fresh.advertiser}) for session ${sessionId.slice(0, 8)}`
    );
    return fresh;
  }
  async postEvents(events) {
    const seen = new Set(this.storage.get(KEY_SEEN_EVENTS) ?? []);
    const credits = this.storage.get(KEY_CREDITS) ?? [];
    for (const event of events) {
      const duplicate = seen.has(event.id);
      this.log.appendLine(
        `[mock] event ${event.type} ad=${event.ad_id} at=${event.occurred_at}${duplicate ? " (duplicate, ignored)" : ""}`
      );
      if (duplicate) continue;
      seen.add(event.id);
      if (event.type === "impression") {
        const ad = this.ads.find((a) => a.id === event.ad_id);
        if (ad) {
          credits.push({
            ad_id: ad.id,
            tokens: ad.reward_tokens,
            at: this.now()
          });
          this.log.appendLine(`[mock] credited ${ad.reward_tokens} ${CURRENCY}`);
        }
      }
    }
    await this.storage.update(KEY_SEEN_EVENTS, [...seen].slice(-1e3));
    await this.storage.update(KEY_CREDITS, credits);
    const balance = await this.getBalance();
    return { accepted: events.length, balance };
  }
  async getBalance() {
    const credits = this.storage.get(KEY_CREDITS) ?? [];
    let settled = this.storage.get(KEY_SETTLED) ?? 0;
    const cutoff = this.now() - SETTLE_AFTER_MS;
    const stillPending = [];
    for (const credit of credits) {
      if (credit.at <= cutoff) settled += credit.tokens;
      else stillPending.push(credit);
    }
    if (stillPending.length !== credits.length) {
      await this.storage.update(KEY_CREDITS, stillPending);
      await this.storage.update(KEY_SETTLED, settled);
    }
    const pending = stillPending.reduce((sum, c) => sum + c.tokens, 0);
    return {
      pending,
      settled,
      currency: CURRENCY,
      updated_at: new Date(this.now()).toISOString()
    };
  }
  async linkWallet(address) {
    const wallet = {
      address,
      linked_at: new Date(this.now()).toISOString()
    };
    await this.storage.update(KEY_WALLET, wallet);
    this.log.appendLine(`[mock] wallet linked ${address.slice(0, 4)}\u2026`);
    return wallet;
  }
  async unlinkWallet() {
    await this.storage.update(KEY_WALLET, void 0);
    this.log.appendLine("[mock] wallet unlinked");
  }
  /** Clears everything the mock accumulated. Used on opt-out. */
  async reset() {
    for (const key of [
      KEY_INDEX,
      KEY_CREDITS,
      KEY_SETTLED,
      KEY_SEEN_EVENTS,
      KEY_WALLET,
      KEY_DEVICE_ID
    ]) {
      await this.storage.update(key, void 0);
    }
  }
};

// ../../packages/vibefuel-core/data/mock-ads.json
var mock_ads_default = [
  {
    id: "mock-001",
    advertiser: "Quillstack Labs",
    headline: "Ship docs that stay in sync with your code",
    body: "Quillstack watches your repo and drafts reference docs on every merge. Fictional product for Vibefuel mock mode.",
    cta_label: "Try Quillstack",
    cta_url: "https://example.com/quillstack",
    image_url: "https://placehold.co/640x360/F4EBE3/EA580C.png?text=Quillstack",
    reward_tokens: 12,
    expires_at: "2099-01-01T00:00:00Z"
  },
  {
    id: "mock-002",
    advertiser: "Orbital Cache",
    headline: "A CDN that speaks your build tool's language",
    body: "Edge caching with zero config for Vite, Next and Bun. Fictional product for Vibefuel mock mode.",
    cta_label: "See pricing",
    cta_url: "https://example.com/orbital-cache",
    reward_tokens: 8,
    expires_at: "2099-01-01T00:00:00Z"
  },
  {
    id: "mock-003",
    advertiser: "Pinecone & Pixel",
    headline: "Mechanical keyboards tuned for long sessions",
    body: "Quiet switches, low-profile keys and a wrist rest that ships in the box. Fictional shop for Vibefuel mock mode.",
    cta_label: "Shop keyboards",
    cta_url: "https://example.com/pinecone-pixel",
    image_url: "https://placehold.co/640x360/F4EBE3/000000.png?text=Pinecone+%26+Pixel",
    reward_tokens: 10,
    expires_at: "2099-01-01T00:00:00Z"
  },
  {
    id: "mock-004",
    advertiser: "Ledgerline",
    headline: "Invoices for freelance developers, done in 60 seconds",
    body: "Track hours from your editor and send invoices in three currencies. Fictional product for Vibefuel mock mode.",
    cta_label: "Start free",
    cta_url: "https://example.com/ledgerline",
    reward_tokens: 15,
    expires_at: "2099-01-01T00:00:00Z"
  },
  {
    id: "mock-005",
    advertiser: "Nimbus Notebook",
    headline: "Run your data notebooks on a GPU by the minute",
    body: "Pay only while a cell is running. Spin up, train, tear down. Fictional product for Vibefuel mock mode.",
    cta_label: "Get 2 free hours",
    cta_url: "https://example.com/nimbus-notebook",
    image_url: "https://placehold.co/640x360/EA580C/F4EBE3.png?text=Nimbus",
    reward_tokens: 20,
    expires_at: "2099-01-01T00:00:00Z"
  }
];

// ../../packages/vibefuel-core/src/mock-ads.ts
var MOCK_ADS = mock_ads_default.map((item) => validateAd(item, 0)).filter((ad) => ad !== null);

// src/auth.ts
async function login(store, api, now = Date.now()) {
  if (store.getToken()) {
    return { status: "signed-in", deviceId: store.load().deviceId ?? "" };
  }
  let pending = store.load().pendingAuth;
  if (pending && pending.expires_at <= now) pending = null;
  if (!pending) {
    try {
      const res = await api.startDeviceAuth();
      pending = {
        device_code: res.device_code,
        user_code: res.user_code,
        verification_uri: res.verification_uri_complete ?? res.verification_uri,
        expires_at: now + res.expires_in * 1e3,
        interval_ms: Math.max(1, res.interval) * 1e3
      };
      const saved = pending;
      store.update((s) => {
        s.pendingAuth = saved;
      });
    } catch (error) {
      if (error instanceof ApiUnavailableError) return { status: "offline" };
      throw error;
    }
  }
  return poll(store, api, pending);
}
async function poll(store, api, pending) {
  let result;
  try {
    result = await api.pollDeviceToken(pending.device_code);
  } catch (error) {
    if (error instanceof ApiUnavailableError) return { status: "offline" };
    throw error;
  }
  if (result.status === "ok") {
    store.setToken(result.token.access_token);
    store.update((s) => {
      s.deviceId = result.token.device_id;
      s.pendingAuth = null;
    });
    store.log(`Signed in (${api.mode} mode).`);
    return { status: "signed-in", deviceId: result.token.device_id };
  }
  if (result.error === "expired_token") {
    store.update((s) => {
      s.pendingAuth = null;
    });
    return { status: "expired" };
  }
  if (result.error === "access_denied") {
    store.update((s) => {
      s.pendingAuth = null;
    });
    return { status: "denied" };
  }
  return {
    status: "waiting",
    userCode: pending.user_code,
    verificationUri: pending.verification_uri,
    expiresAt: pending.expires_at
  };
}

// src/state.ts
var fs = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path = __toESM(require("node:path"));
var DEFAULT_STATE = {
  optedIn: false,
  paused: false,
  deviceId: null,
  walletAddress: null,
  lastDeliveredAt: null,
  sessions: {},
  balance: null,
  pendingAuth: null,
  apiBaseUrl: "",
  frequencyMinutes: 30,
  quietPeriodMinutes: 10,
  mock: {},
  lastAd: null
};
var SESSION_TTL_MS = 24 * 60 * 6e4;
function vibefuelHome() {
  return process.env.VIBEFUEL_HOME ?? path.join(os.homedir(), ".vibefuel");
}
var StateStore = class {
  dir;
  statePath;
  tokenPath;
  logPath;
  cache = null;
  constructor(dir = vibefuelHome()) {
    this.dir = dir;
    this.statePath = path.join(dir, "state.json");
    this.tokenPath = path.join(dir, "token");
    this.logPath = path.join(dir, "log.txt");
  }
  load() {
    if (this.cache) return this.cache;
    let parsed = {};
    try {
      parsed = JSON.parse(
        fs.readFileSync(this.statePath, "utf8")
      );
    } catch {
    }
    const state = { ...DEFAULT_STATE, ...parsed };
    state.sessions = { ...parsed.sessions ?? {} };
    state.mock = { ...parsed.mock ?? {} };
    this.cache = state;
    return state;
  }
  save(state) {
    this.cache = state;
    fs.mkdirSync(this.dir, { recursive: true, mode: 448 });
    const tmp = `${this.statePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 384 });
    fs.renameSync(tmp, this.statePath);
  }
  update(mutate) {
    const state = this.load();
    mutate(state);
    this.save(state);
    return state;
  }
  getToken() {
    try {
      const token = fs.readFileSync(this.tokenPath, "utf8").trim();
      return token.length > 0 ? token : void 0;
    } catch {
      return void 0;
    }
  }
  setToken(token) {
    fs.mkdirSync(this.dir, { recursive: true, mode: 448 });
    if (token === null) {
      fs.rmSync(this.tokenPath, { force: true });
      return;
    }
    fs.writeFileSync(this.tokenPath, token, { mode: 384 });
  }
  log(line) {
    try {
      fs.mkdirSync(this.dir, { recursive: true, mode: 448 });
      fs.appendFileSync(this.logPath, `${(/* @__PURE__ */ new Date()).toISOString()} ${line}
`, {
        mode: 384
      });
    } catch {
    }
  }
  /** Remove every file Vibefuel wrote. Used on opt-out. */
  wipe() {
    this.cache = null;
    fs.rmSync(this.dir, { recursive: true, force: true });
  }
  /** Record a session start; prune sessions older than a day. */
  touchSession(sessionId, now) {
    const state = this.load();
    for (const [id, startedAt2] of Object.entries(state.sessions)) {
      if (now - startedAt2 > SESSION_TTL_MS) delete state.sessions[id];
    }
    const startedAt = state.sessions[sessionId] ?? now;
    state.sessions[sessionId] = startedAt;
    this.save(state);
    return startedAt;
  }
};
function mockStorage(store) {
  return {
    get(key) {
      return store.load().mock[key];
    },
    update(key, value) {
      store.update((s) => {
        if (value === void 0) delete s.mock[key];
        else s.mock[key] = value;
      });
      return Promise.resolve();
    }
  };
}

// src/client.ts
var PLUGIN_VERSION = "0.1.0";
var TERMINAL_HTTP_TIMEOUT_MS = 6e3;
function clientInfo() {
  return {
    editor: "Claude Code",
    editor_version: process.env.CLAUDE_CODE_VERSION ?? "unknown",
    extension_version: PLUGIN_VERSION,
    surface: "terminal"
  };
}
function apiBaseUrl(store) {
  return (process.env.VIBEFUEL_API_BASE_URL ?? store.load().apiBaseUrl).trim();
}
function createApi(store) {
  const baseUrl = apiBaseUrl(store);
  if (baseUrl) {
    return new HttpAdapter({
      baseUrl,
      client: clientInfo(),
      tokens: { getToken: () => Promise.resolve(store.getToken()) },
      timeoutMs: TERMINAL_HTTP_TIMEOUT_MS
    });
  }
  return new MockAdapter([...MOCK_ADS], mockStorage(store), {
    appendLine: (line) => store.log(line)
  });
}

// src/format.ts
function formatTokens(value) {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function formatSponsoredLine(ad) {
  const link = ad.click_url ?? ad.cta_url;
  return [
    `Sponsored \xB7 ${ad.advertiser}: ${ad.headline}`,
    `${ad.body}`,
    `${ad.cta_label}: ${link} \xB7 Earn ${formatTokens(ad.reward_tokens)} tokens \xB7 /vibefuel:pause to pause`
  ].join("\n");
}
function formatBalance(balance) {
  if (!balance) return "0 tokens";
  const total = balance.pending + balance.settled;
  return `${formatTokens(total)} ${balance.currency}`;
}
function formatStatusLine(input) {
  if (!input.optedIn) return "\u26FD Vibefuel off \xB7 /vibefuel:optin";
  const parts = [`\u26FD ${formatBalance(input.balance)}`];
  if (input.paused) parts.push("paused");
  else if (input.pending) parts.push("\u25CF new");
  return parts.join(" \xB7 ");
}
function formatWait(untilMs, now) {
  const minutes = Math.ceil(Math.max(0, untilMs - now) / 6e4);
  if (minutes <= 1) return "in about a minute";
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}
var PRIVACY_SUMMARY = `Vibefuel privacy summary (terminal plugin)

Collected
  - An anonymous device id
  - Ad events: impression, click, dismiss, with ad id, timestamp and a per-session id
  - Client name and version (Claude Code) and the plugin version

Never collected
  - File contents, file names, project names or paths
  - Prompts, chat messages, transcripts or AI completions
  - Keystrokes or clipboard
  - Git remotes or identities

Rules
  - The Stop hook reads only session_id and agent_id from the hook input. It never reads the transcript.
  - A terminal impression counts when the sponsored line is displayed. There is no view timer in a terminal.
  - Links are tracked by a redirect, so a click can be rewarded without any script in your terminal.
  - At most one sponsored line per 30 minutes, none in the first 10 minutes of a session, never mid-task, never inside subagents.
  - /vibefuel:optout deletes ~/.vibefuel entirely.
  - In mock mode (no API URL set) nothing is sent anywhere; events go to ~/.vibefuel/log.txt.`;

// src/hook.ts
var import_node_crypto2 = require("node:crypto");
function parseHookInput(raw) {
  try {
    const parsed = JSON.parse(raw);
    const pick = (key) => typeof parsed[key] === "string" ? parsed[key] : void 0;
    const input = {};
    const session_id = pick("session_id");
    const hook_event_name = pick("hook_event_name");
    const agent_id = pick("agent_id");
    const source = pick("source");
    if (session_id !== void 0) input.session_id = session_id;
    if (hook_event_name !== void 0) input.hook_event_name = hook_event_name;
    if (agent_id !== void 0) input.agent_id = agent_id;
    if (source !== void 0) input.source = source;
    return input;
  } catch {
    return {};
  }
}
function onSessionStart(input, ctx) {
  const now = ctx.now?.() ?? Date.now();
  if (!input.session_id) return {};
  if (input.source === "compact") return {};
  ctx.store.touchSession(input.session_id, now);
  return {};
}
function decide(sessionId, ctx) {
  const now = ctx.now?.() ?? Date.now();
  const state = ctx.store.load();
  const signedIn = ctx.store.getToken() !== void 0;
  const sessionStartedAt = ctx.store.touchSession(sessionId, now);
  const decision = evaluatePolicy({
    now,
    sessionStartedAt,
    lastDeliveredAt: state.lastDeliveredAt,
    enabled: state.optedIn && signedIn,
    paused: state.paused,
    debugActive: false,
    windowFocused: true,
    frequencyMinutes: state.frequencyMinutes,
    quietPeriodMinutes: state.quietPeriodMinutes
  });
  return { decision, signedIn };
}
async function onStop(input, ctx) {
  const { store, api } = ctx;
  const now = ctx.now?.() ?? Date.now();
  try {
    if (input.agent_id) return {};
    const sessionId = input.session_id ?? "unknown";
    const state = store.load();
    if (!state.optedIn) return {};
    if (!store.getToken() && state.pendingAuth) {
      if (state.pendingAuth.expires_at > now)
        await poll(store, api, state.pendingAuth);
      else store.update((s) => void (s.pendingAuth = null));
    }
    const { decision } = decide(sessionId, ctx);
    if (!decision.allowed) return {};
    const raw = await api.getNextAd(sessionId);
    if (raw === null) {
      store.log("No eligible sponsored message right now.");
      return {};
    }
    const ad = validateAd(raw, now);
    if (!ad) {
      store.log(
        `Dropped an ad that failed validation (${String(raw.id)}).`
      );
      return {};
    }
    store.update((s) => {
      s.lastDeliveredAt = now;
      s.lastAd = {
        id: ad.id,
        advertiser: ad.advertiser,
        headline: ad.headline,
        at: now
      };
    });
    store.log(`Showed sponsored message ${ad.id} from ${ad.advertiser}.`);
    try {
      const result = await api.postEvents([
        {
          id: ctx.newId?.() ?? (0, import_node_crypto2.randomUUID)(),
          ad_id: ad.id,
          type: "impression",
          occurred_at: new Date(now).toISOString(),
          session_id: sessionId
        }
      ]);
      if (result.balance) {
        const balance = result.balance;
        store.update((s) => void (s.balance = balance));
      }
    } catch (error) {
      store.log(`Could not report impression: ${describe(error)}`);
    }
    return { systemMessage: formatSponsoredLine(ad) };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      store.setToken(null);
      store.log("Device token rejected; signed out. Run /vibefuel:login.");
    } else if (error instanceof ApiUnavailableError) {
      store.log(`Offline: ${error.message}`);
    } else {
      store.log(`Stop hook failed: ${describe(error)}`);
    }
    return {};
  }
}
function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/cli.ts
var LANDING_URL = "https://vibefuel.app";
async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
function out(text) {
  process.stdout.write(text.endsWith("\n") ? text : `${text}
`);
}
async function main(argv) {
  const [command, ...rest] = argv;
  const store = new StateStore();
  switch (command ?? "") {
    case "hook": {
      const event = rest[0];
      const input = parseHookInput(await readStdin());
      const ctx = { store, api: createApi(store) };
      const output = event === "session-start" ? onSessionStart(input, ctx) : event === "stop" ? await onStop(input, ctx) : {};
      if (output.systemMessage) out(JSON.stringify(output));
      return 0;
    }
    case "statusline": {
      await readStdin();
      const state = store.load();
      const pending = state.lastAd !== null && Date.now() - state.lastAd.at < 10 * 6e4;
      out(
        formatStatusLine({
          optedIn: state.optedIn,
          paused: state.paused,
          balance: state.balance,
          pending
        })
      );
      return 0;
    }
    case "optin": {
      store.update((s) => {
        s.optedIn = true;
        s.paused = false;
      });
      out(
        "Vibefuel is on. One labelled sponsored line may appear after a task finishes, at most every 30 minutes and never in the first 10 minutes of a session."
      );
      return runLogin(store);
    }
    case "optout": {
      store.wipe();
      out(
        "Vibefuel is off. Everything under ~/.vibefuel was deleted, including the device token and any linked address."
      );
      return 0;
    }
    case "login":
      return runLogin(store);
    case "pause":
      store.update((s) => void (s.paused = true));
      out("Vibefuel paused. No sponsored lines until /vibefuel:resume.");
      return 0;
    case "resume":
      store.update((s) => void (s.paused = false));
      out("Vibefuel resumed.");
      return 0;
    case "status":
      return runStatus(store);
    case "wallet":
      return runWallet(store, rest);
    case "config":
      return runConfig(store, rest);
    case "privacy":
      out(PRIVACY_SUMMARY);
      return 0;
    case "statusline-snippet":
      out(
        [
          "Add this to ~/.claude/settings.json to show your Vibefuel balance in the status line:",
          "",
          JSON.stringify(
            {
              statusLine: {
                type: "command",
                command: `node "${process.env.CLAUDE_PLUGIN_ROOT ?? "<plugin root>"}/bin/vibefuel.cjs" statusline`
              }
            },
            null,
            2
          )
        ].join("\n")
      );
      return 0;
    default:
      out(
        "Usage: vibefuel <optin|optout|login|status|pause|resume|wallet|config|privacy|statusline|statusline-snippet|hook>"
      );
      return command ? 1 : 0;
  }
}
async function runLogin(store) {
  if (!store.load().optedIn) {
    out("Run /vibefuel:optin first.");
    return 0;
  }
  const api = createApi(store);
  try {
    const result = await login(store, api);
    switch (result.status) {
      case "signed-in":
        out(
          `Signed in (${api.mode} mode). Device id ${result.deviceId.slice(0, 8)}\u2026`
        );
        return 0;
      case "waiting":
        out(
          [
            `Open ${result.verificationUri} and enter the code ${result.userCode}.`,
            `This code expires ${formatWait(result.expiresAt, Date.now())}. Run /vibefuel:login again to check, or just keep working: sign-in completes on its own.`
          ].join("\n")
        );
        return 0;
      case "expired":
        out(
          "That sign-in code expired. Run /vibefuel:login again for a new one."
        );
        return 0;
      case "denied":
        out("Sign-in was declined in the browser.");
        return 0;
      case "offline":
        out(
          `Could not reach the Vibefuel API at ${apiBaseUrl(store)}. Sign-in will be retried after your next task.`
        );
        return 0;
    }
  } catch (error) {
    out(
      `Sign-in failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return 0;
  }
}
async function runStatus(store) {
  const state = store.load();
  const api = createApi(store);
  const signedIn = store.getToken() !== void 0;
  const lines = [];
  lines.push(
    `Vibefuel: ${state.optedIn ? "on" : "off (run /vibefuel:optin)"}${state.paused ? ", paused" : ""}`
  );
  lines.push(
    `Mode: ${api.mode === "mock" ? "mock (no API URL set; nothing is sent anywhere)" : apiBaseUrl(store)}`
  );
  lines.push(
    `Signed in: ${signedIn ? "yes" : state.pendingAuth ? "waiting for browser approval" : "no"}`
  );
  if (state.optedIn && signedIn) {
    try {
      const balance = await api.getBalance();
      store.update((s) => void (s.balance = balance));
      lines.push(
        `Balance: ${formatBalance(balance)} (pending ${formatTokens(balance.pending)}, settled ${formatTokens(balance.settled)})`
      );
    } catch (error) {
      lines.push(
        `Balance: ${formatBalance(state.balance)} (cached; ${error instanceof ApiUnavailableError ? "API offline" : "refresh failed"})`
      );
    }
  }
  lines.push(
    `Wallet: ${state.walletAddress ? shortenAddress(state.walletAddress) : "none linked (use /vibefuel:wallet <address>)"}`
  );
  if (state.lastAd) {
    lines.push(
      `Last sponsored line: ${state.lastAd.advertiser}, ${new Date(state.lastAd.at).toLocaleString()}`
    );
  }
  const { decision } = decide(process.env.CLAUDE_SESSION_ID ?? "status", {
    store,
    api
  });
  if (!decision.allowed) {
    const reason = decision.reason === "quiet-period" && decision.retryAt ? `quiet period ends ${formatWait(decision.retryAt, Date.now())}` : decision.reason === "frequency" && decision.retryAt ? `next sponsored line possible ${formatWait(decision.retryAt, Date.now())}` : decision.reason;
    lines.push(`Next: ${reason}`);
  } else {
    lines.push("Next: a sponsored line may appear after your next task");
  }
  lines.push(`Website: ${LANDING_URL}`);
  out(lines.join("\n"));
  return 0;
}
async function runWallet(store, args) {
  const api = createApi(store);
  if (args[0] === "--unlink" || args[0] === "unlink") {
    store.update((s) => void (s.walletAddress = null));
    if (store.getToken()) {
      try {
        await api.unlinkWallet();
      } catch {
      }
    }
    out("Wallet address unlinked.");
    return 0;
  }
  const input = args.join(" ");
  const result = validateSolanaAddress(input);
  if (!result.ok) {
    out(
      `${describeWalletError(result.reason)} Vibefuel only ever stores a public address, never a private key or seed phrase.`
    );
    return 0;
  }
  store.update((s) => void (s.walletAddress = result.address));
  if (store.getToken()) {
    try {
      await api.linkWallet(result.address);
      out(`Wallet ${shortenAddress(result.address)} linked.`);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        store.update((s) => void (s.walletAddress = null));
        out(`The API rejected that address: ${error.message}`);
      } else {
        out(
          `Wallet ${shortenAddress(result.address)} saved locally; it will sync when the API is reachable.`
        );
      }
    }
  } else {
    out(
      `Wallet ${shortenAddress(result.address)} saved. It syncs once you are signed in.`
    );
  }
  return 0;
}
function runConfig(store, args) {
  const [key, value] = args;
  const state = store.load();
  if (!key) {
    out(
      [
        `api: ${state.apiBaseUrl || "(empty, mock mode)"}`,
        `frequency: ${state.frequencyMinutes} minutes (min 15)`,
        `quiet: ${state.quietPeriodMinutes} minutes`
      ].join("\n")
    );
    return 0;
  }
  switch (key) {
    case "api": {
      const url = (value ?? "").trim();
      if (url && !/^https?:\/\//.test(url)) {
        out("The API URL must start with http:// or https://.");
        return 0;
      }
      store.update((s) => void (s.apiBaseUrl = url));
      store.setToken(null);
      store.update((s) => void (s.pendingAuth = null));
      out(
        url ? `API set to ${url}. Signed out; run /vibefuel:login.` : "API cleared; mock mode. Signed out."
      );
      return 0;
    }
    case "frequency": {
      const n = Math.max(15, Number(value) || 30);
      store.update((s) => void (s.frequencyMinutes = n));
      out(`Frequency set to ${n} minutes.`);
      return 0;
    }
    case "quiet": {
      const n = Math.max(0, Number(value) || 0);
      store.update((s) => void (s.quietPeriodMinutes = n));
      out(`Quiet period set to ${n} minutes.`);
      return 0;
    }
    default:
      out("Usage: config [api <url>|frequency <minutes>|quiet <minutes>]");
      return 0;
  }
}
main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    new StateStore().log(
      `CLI failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(0);
  }
);
