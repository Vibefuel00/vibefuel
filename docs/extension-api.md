# Vibefuel extension API

The full contract is `packages/vibefuel-core/api/openapi.yaml` (OpenAPI 3.1).
This page is the short version.

Base URL: the deployed web app (`https://vibefuel.app`, locally `http://localhost:3000`).
Every request carries the developer's serial key:

```
Authorization: Bearer VF-XXXX-XXXX-XXXX-XXXX
```

A missing or unknown key returns `401 {"error": "..."}`.
Per-key rate limits (per minute): heartbeat 30, events 60, ads/next 60, me 60, wallet 10.
Over the limit returns `429`; back off and retry on the next tick.

## GET /api/ext/me

Account summary for the key. Clients call this to verify a pasted key.

```json
{ "developer_id": "uuid", "key_prefix": "VF-7K2M", "wallet_address": null,
  "balance": { "pending": 128, "settled": 0, "currency": "tokens" },
  "earned": 128, "active_seconds": 5400 }
```

`balance.pending` is available for payout; `balance.settled` has been paid out.

## POST /api/ext/heartbeat

Send about once a minute while the editor window is focused and Vibefuel is on.
`active_seconds` is the focused time since the previous heartbeat (capped at 600).

```json
{ "editor": "Cursor", "extension_version": "0.1.0", "active_seconds": 60 }
```

Returns `{ "ok": true }`. Time is aggregated per UTC day and shown as "hours of work".

## GET /api/ext/ads/next?session_id=…&surface=sidebar|terminal

Returns the next eligible sponsored message, or `204 No Content` when nothing is
available. A campaign is eligible when it is live, has budget left, and this
developer has not had a rewarded impression of it in the last 6 hours.

```json
{ "id": "campaign-uuid", "advertiser": "Zed", "domain": "zed.dev",
  "headline": "...", "body": "...", "cta_label": "Visit zed.dev", "cta_url": "https://zed.dev/",
  "logo_url": "https://...", "brand_bg": "#dae4f8", "brand_fg": "#1b1e23",
  "click_url": "https://vibefuel.app/api/go/<id>?t=<token>",
  "reward_tokens": 9, "expires_at": "2026-10-01T11:00:00Z" }
```

Render it with the brand colors, a visible "Sponsored" label, and the reward.
`click_url` is a tracked link for surfaces that cannot send a click event
(terminals). Surfaces that send events open `cta_url` directly.

## POST /api/ext/events

Batch of events (max 100), at most one request per minute. `id` makes a retry
idempotent. A sidebar `impression` counts only after the card has been visible
for 3 continuous seconds with the window focused; a terminal impression counts
on display. The server pays the reward at most once per campaign per developer
per 6 hours and never beyond the campaign budget.

```json
{ "events": [
    { "id": "uuid", "ad_id": "campaign-uuid", "type": "impression",
      "occurred_at": "2026-10-01T10:00:00Z", "session_id": "uuid" } ],
  "client": { "editor": "Cursor", "editor_version": "1.4.0", "extension_version": "0.1.0", "surface": "sidebar" } }
```

Returns `{ "accepted": 1, "rewarded": 9, "balance": { ... } }`.

## POST /api/ext/wallet · DELETE /api/ext/wallet

`{ "address": "<base58 public key>" }` links the payout wallet; `DELETE` unlinks it.
Only a public address is ever sent or stored.

## GET /api/go/{ad_id}?t=<token>

Records one click for the token and redirects (302) to the campaign URL. The
token is minted by the server when the ad is served and never contains the key.
