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
    super("Serial key rejected");
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
function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
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
  if (ad.click_url !== void 0 && !isHttpUrl(ad.click_url)) return null;
  if (ad.logo_url !== void 0 && !isHttpsUrl(ad.logo_url)) return null;
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const hex = (key) => typeof ad[key] === "string" && HEX.test(ad[key]) ? ad[key].toLowerCase() : void 0;
  const domain = typeof ad.domain === "string" && ad.domain.trim().length > 0 && ad.domain.length <= 80 ? ad.domain.trim() : void 0;
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
  if (ad.logo_url !== void 0) result.logo_url = ad.logo_url;
  const brand_bg = hex("brand_bg");
  const brand_fg = hex("brand_fg");
  if (brand_bg) result.brand_bg = brand_bg;
  if (brand_fg) result.brand_fg = brand_fg;
  if (domain) result.domain = domain;
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

// ../../packages/vibefuel-core/src/key.ts
var KEY_RE = /^VF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
function normalizeSerialKey(input) {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
function isSerialKeyShape(key) {
  return KEY_RE.test(key);
}
function validateSerialKey(input) {
  const key = normalizeSerialKey(input);
  if (key.length === 0)
    return { ok: false, message: "Paste your Vibefuel key." };
  if (!isSerialKeyShape(key)) {
    return {
      ok: false,
      message: "That doesn't look like a Vibefuel key (VF-XXXX-XXXX-XXXX-XXXX)."
    };
  }
  return { ok: true, key };
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
  async me() {
    const res = await this.request("GET", "/api/ext/me");
    return await res.json();
  }
  async heartbeat(activeSeconds) {
    await this.request("POST", "/api/ext/heartbeat", {
      body: {
        editor: this.client.editor,
        extension_version: this.client.extension_version,
        active_seconds: Math.max(0, Math.min(600, Math.floor(activeSeconds)))
      }
    });
  }
  async getNextAd(sessionId) {
    const query = new URLSearchParams({ session_id: sessionId });
    if (this.client.surface) query.set("surface", this.client.surface);
    const res = await this.request(
      "GET",
      `/api/ext/ads/next?${query.toString()}`
    );
    if (res.status === 204) return null;
    return await res.json();
  }
  async postEvents(events) {
    const res = await this.request("POST", "/api/ext/events", {
      body: { events, client: this.client }
    });
    return await res.json();
  }
  async linkWallet(address) {
    const res = await this.request("POST", "/api/ext/wallet", {
      body: { address }
    });
    return await res.json();
  }
  async unlinkWallet() {
    await this.request("DELETE", "/api/ext/wallet");
  }
  async request(method, path2, options = {}) {
    const headers = {
      Accept: "application/json",
      "X-Vibefuel-Client": `${this.client.editor}/${this.client.editor_version} vibefuel/${this.client.extension_version}`
    };
    if (options.body !== void 0) headers["Content-Type"] = "application/json";
    const token = await this.tokens.getToken();
    if (!token) throw new UnauthorizedError();
    headers.Authorization = `Bearer ${token}`;
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
      message = body.message ?? body.error ?? message;
    } catch {
    }
    throw new ApiRequestError(res.status, code, message);
  }
};

// ../../packages/vibefuel-core/src/mock.ts
var KEY_INDEX = "mock.adIndex";
var KEY_CREDITS = "mock.credits";
var KEY_PAID = "mock.paid";
var KEY_SEEN_EVENTS = "mock.seenEvents";
var KEY_WALLET = "mock.wallet";
var KEY_ACTIVE = "mock.activeSeconds";
var KEY_LAST_REWARD = "mock.lastReward";
var REWARD_COOLDOWN_MS = 6 * 60 * 6e4;
var PAYOUT_AFTER_MS = 10 * 6e4;
var CURRENCY = "tokens";
var MOCK_KEY_PREFIX = "VF-MOCK";
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
  async me() {
    const balance = await this.balance();
    const wallet = this.storage.get(KEY_WALLET);
    const credits = this.storage.get(KEY_CREDITS) ?? [];
    const paid = this.storage.get(KEY_PAID) ?? 0;
    return {
      developer_id: "mock-developer",
      key_prefix: MOCK_KEY_PREFIX,
      wallet_address: wallet?.address ?? null,
      balance,
      earned: paid + credits.reduce((s, c) => s + c.tokens, 0),
      active_seconds: this.storage.get(KEY_ACTIVE) ?? 0
    };
  }
  async heartbeat(activeSeconds) {
    const total = (this.storage.get(KEY_ACTIVE) ?? 0) + Math.max(0, activeSeconds);
    await this.storage.update(KEY_ACTIVE, total);
    this.log.appendLine(`[mock] heartbeat +${activeSeconds}s (total ${total}s)`);
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
    const lastReward = this.storage.get(KEY_LAST_REWARD) ?? {};
    let accepted = 0;
    let rewarded = 0;
    for (const event of events) {
      const duplicate = seen.has(event.id);
      this.log.appendLine(
        `[mock] event ${event.type} ad=${event.ad_id} at=${event.occurred_at}${duplicate ? " (duplicate, ignored)" : ""}`
      );
      if (duplicate) continue;
      seen.add(event.id);
      accepted++;
      if (event.type === "impression") {
        const ad = this.ads.find((a) => a.id === event.ad_id);
        const last = lastReward[event.ad_id] ?? -Infinity;
        if (ad && this.now() - last >= REWARD_COOLDOWN_MS) {
          credits.push({
            ad_id: ad.id,
            tokens: ad.reward_tokens,
            at: this.now()
          });
          lastReward[event.ad_id] = this.now();
          rewarded += ad.reward_tokens;
          this.log.appendLine(`[mock] credited ${ad.reward_tokens} ${CURRENCY}`);
        } else if (ad) {
          this.log.appendLine(
            `[mock] impression not rewarded: ${ad.id} rewarded within the last 6 hours`
          );
        }
      }
    }
    await this.storage.update(KEY_SEEN_EVENTS, [...seen].slice(-1e3));
    await this.storage.update(KEY_CREDITS, credits);
    await this.storage.update(KEY_LAST_REWARD, lastReward);
    return { accepted, rewarded, balance: await this.balance() };
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
      KEY_PAID,
      KEY_SEEN_EVENTS,
      KEY_WALLET,
      KEY_ACTIVE,
      KEY_LAST_REWARD
    ]) {
      await this.storage.update(key, void 0);
    }
  }
  async balance() {
    const credits = this.storage.get(KEY_CREDITS) ?? [];
    let paid = this.storage.get(KEY_PAID) ?? 0;
    const cutoff = this.now() - PAYOUT_AFTER_MS;
    const open = [];
    for (const credit of credits) {
      if (credit.at <= cutoff) paid += credit.tokens;
      else open.push(credit);
    }
    if (open.length !== credits.length) {
      await this.storage.update(KEY_CREDITS, open);
      await this.storage.update(KEY_PAID, paid);
    }
    return {
      pending: open.reduce((sum, c) => sum + c.tokens, 0),
      settled: paid,
      currency: CURRENCY,
      updated_at: new Date(this.now()).toISOString()
    };
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
    expires_at: "2099-01-01T00:00:00Z",
    domain: "example.com"
  },
  {
    id: "mock-002",
    advertiser: "Orbital Cache",
    headline: "A CDN that speaks your build tool's language",
    body: "Edge caching with zero config for Vite, Next and Bun. Fictional product for Vibefuel mock mode.",
    cta_label: "See pricing",
    cta_url: "https://example.com/orbital-cache",
    reward_tokens: 8,
    expires_at: "2099-01-01T00:00:00Z",
    domain: "example.com"
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
    expires_at: "2099-01-01T00:00:00Z",
    domain: "example.com"
  },
  {
    id: "mock-004",
    advertiser: "Ledgerline",
    headline: "Invoices for freelance developers, done in 60 seconds",
    body: "Track hours from your editor and send invoices in three currencies. Fictional product for Vibefuel mock mode.",
    cta_label: "Start free",
    cta_url: "https://example.com/ledgerline",
    reward_tokens: 15,
    expires_at: "2099-01-01T00:00:00Z",
    domain: "example.com"
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
    expires_at: "2099-01-01T00:00:00Z",
    domain: "example.com"
  }
];

// ../../packages/vibefuel-core/src/mock-ads.ts
var MOCK_ADS = mock_ads_default.map((item) => validateAd(item, 0)).filter((ad) => ad !== null);

// src/auth.ts
var MOCK_KEY = "VF-MOCK-MOCK-MOCK-MOCK";
async function login(store, api, input) {
  let key;
  if (api.mode === "mock") {
    key = MOCK_KEY;
  } else {
    const result = validateSerialKey(input);
    if (!result.ok) return { status: "invalid", message: result.message };
    key = result.key;
  }
  store.setToken(key);
  try {
    const me = await api.me();
    store.update((s) => {
      s.keyPrefix = me.key_prefix;
      s.balance = me.balance;
      s.walletAddress = me.wallet_address;
    });
    store.log(`Signed in as ${me.key_prefix} (${api.mode} mode).`);
    return { status: "signed-in", keyPrefix: me.key_prefix };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      store.setToken(null);
      return { status: "rejected" };
    }
    if (error instanceof ApiUnavailableError) {
      return { status: "offline" };
    }
    store.setToken(null);
    throw error;
  }
}

// src/state.ts
var fs = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path = __toESM(require("node:path"));
var DEFAULT_STATE = {
  optedIn: false,
  paused: false,
  keyPrefix: null,
  walletAddress: null,
  lastDeliveredAt: null,
  sessions: {},
  balance: null,
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
var DEFAULT_API_BASE_URL = "https://vibefuel.app";
function apiBaseUrl(store) {
  const raw = (process.env.VIBEFUEL_API_BASE_URL ?? store.load().apiBaseUrl ?? "").trim();
  if (raw === "") return DEFAULT_API_BASE_URL;
  if (raw.toLowerCase() === "mock") return "";
  return raw;
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
  const body = ad.body.endsWith(".") ? ad.body : `${ad.body}.`;
  return `Sponsored \xB7 ${ad.advertiser}: ${ad.headline} \u2014 ${body} ${ad.cta_label}: ${link} \xB7 Earn ${formatTokens(ad.reward_tokens)} tokens \xB7 /vibefuel:pause to pause`;
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
  - Your serial key, stored hashed on the server, to tie events to your dashboard
  - Ad events: impression, click, dismiss, with campaign id, timestamp and a per-session id
  - Client name (Claude Code) and the plugin version. No active time is reported from the terminal

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
  - In mock mode (/vibefuel:config api mock) nothing is sent anywhere; events go to ~/.vibefuel/log.txt.
  - Full summary: https://vibefuel.app/privacy`;

// src/hook.ts
var import_node_crypto = require("node:crypto");
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
    if (!store.getToken()) return {};
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
          id: ctx.newId?.() ?? (0, import_node_crypto.randomUUID)(),
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
    try {
      await api.heartbeat(0);
    } catch {
    }
    try {
      await api.heartbeat(0);
    } catch {
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
      return runLogin(store, rest);
    }
    case "optout": {
      store.wipe();
      out(
        "Vibefuel is off. Everything under ~/.vibefuel was deleted, including the device token and any linked address."
      );
      return 0;
    }
    case "login":
      return runLogin(store, rest);
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
async function runLogin(store, args) {
  if (!store.load().optedIn) {
    out("Run /vibefuel:optin first.");
    return 0;
  }
  const api = createApi(store);
  const input = args.join(" ").trim();
  if (api.mode === "http" && !input) {
    if (store.getToken()) {
      out(
        `Already signed in as ${store.load().keyPrefix ?? "your key"}. To switch keys: /vibefuel:login VF-XXXX-XXXX-XXXX-XXXX`
      );
      return 0;
    }
    out(
      [
        `Create a free serial key at ${LANDING_URL}/start (no email, no password), then run:`,
        "  /vibefuel:login VF-XXXX-XXXX-XXXX-XXXX"
      ].join("\n")
    );
    return 0;
  }
  try {
    const result = await login(store, api, input);
    switch (result.status) {
      case "signed-in":
        out(`Signed in as ${result.keyPrefix} (${api.mode} mode).`);
        return 0;
      case "invalid":
        out(result.message);
        return 0;
      case "rejected":
        out(
          `That key was not accepted. Create one at ${LANDING_URL}/start and try again.`
        );
        return 0;
      case "offline":
        out(
          `Could not reach the Vibefuel API at ${apiBaseUrl(store)}. The key is saved and will be checked after your next task.`
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
    `Mode: ${api.mode === "mock" ? "mock (fictional ads, nothing is sent anywhere)" : apiBaseUrl(store)}`
  );
  lines.push(
    `Signed in: ${signedIn ? `yes (${state.keyPrefix ?? "key saved"})` : "no (run /vibefuel:login <key>)"}`
  );
  let wallet = state.walletAddress;
  if (state.optedIn && signedIn) {
    try {
      const me = await api.me();
      wallet = me.wallet_address;
      store.update((s) => {
        s.balance = me.balance;
        s.keyPrefix = me.key_prefix;
        s.walletAddress = me.wallet_address;
      });
      lines.push(
        `Balance: ${formatBalance(me.balance)} (available ${formatTokens(me.balance.pending)}, paid out ${formatTokens(me.balance.settled)}, earned ${formatTokens(me.earned)} all time)`
      );
    } catch (error) {
      lines.push(
        `Balance: ${formatBalance(state.balance)} (cached; ${error instanceof ApiUnavailableError ? "API offline" : "refresh failed"})`
      );
    }
  }
  lines.push(
    `Wallet: ${wallet ? shortenAddress(wallet) : "none linked (use /vibefuel:wallet <address>)"}`
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
  lines.push(`Dashboard: ${LANDING_URL}/dashboard`);
  out(lines.join("\n"));
  return 0;
}
async function runWallet(store, args) {
  const api = createApi(store);
  if (!store.getToken()) {
    out("Sign in first: /vibefuel:login VF-XXXX-XXXX-XXXX-XXXX");
    return 0;
  }
  if (args[0] === "--unlink" || args[0] === "unlink") {
    try {
      await api.unlinkWallet();
      store.update((s) => void (s.walletAddress = null));
      out("Wallet address unlinked.");
    } catch {
      out("Could not reach the Vibefuel API. Try again in a moment.");
    }
    return 0;
  }
  const result = validateSolanaAddress(args.join(" "));
  if (!result.ok) {
    out(
      `${describeWalletError(result.reason)} Vibefuel only ever stores a public address, never a private key or seed phrase.`
    );
    return 0;
  }
  try {
    await api.linkWallet(result.address);
    store.update((s) => void (s.walletAddress = result.address));
    out(`Wallet ${shortenAddress(result.address)} linked.`);
  } catch (error) {
    if (error instanceof ApiRequestError)
      out(`The API rejected that address: ${error.message}`);
    else out("Could not reach the Vibefuel API. Try again in a moment.");
  }
  return 0;
}
function runConfig(store, args) {
  const [key, value] = args;
  const state = store.load();
  if (!key) {
    out(
      [
        `api: ${apiBaseUrl(store) || "mock"}`,
        `frequency: ${state.frequencyMinutes} minutes (min 15)`,
        `quiet: ${state.quietPeriodMinutes} minutes`
      ].join("\n")
    );
    return 0;
  }
  switch (key) {
    case "api": {
      const raw = (value ?? "").trim();
      const url = raw.toLowerCase() === "mock" ? "mock" : raw;
      if (url && url !== "mock" && !/^https?:\/\//.test(url)) {
        out("The API URL must start with http:// or https://, or be 'mock'.");
        return 0;
      }
      store.update((s) => void (s.apiBaseUrl = url));
      store.setToken(null);
      out(
        url === "mock" ? "Mock mode: fictional ads, nothing is sent anywhere. Signed out." : url ? `API set to ${url}. Signed out; run /vibefuel:login <key>.` : `API reset to ${DEFAULT_API_BASE_URL}. Signed out; run /vibefuel:login <key>.`
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
      out("Usage: config [api <url|mock>|frequency <minutes>|quiet <minutes>]");
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
