# Vibefuel for VS Code and Cursor

See sponsored messages in your coding workflow and earn Solana tokens to put
toward your next AI credits.

Vibefuel shows one clearly labelled sponsored card at a time, only in its own
sidebar view. Advertisers fund the tokens; you decide when it runs. Nothing is
injected into your editor, your chat, your completions or your terminal.

> Vibefuel is an independent product. It is not affiliated with, endorsed by or
> partnered with the makers of VS Code, Cursor or any AI assistant.

![Feed view](docs/screenshots/feed.png)
_Screenshot placeholder: the feed view with a sponsored card, earnings and wallet._

![Status bar](docs/screenshots/status-bar.png)
_Screenshot placeholder: the status bar item with balance and the new message dot._

## Install

### VS Code

1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search for **Vibefuel** and click **Install**.
3. Or from a VSIX: `code --install-extension vibefuel-0.1.0.vsix`.

### Cursor

Cursor installs extensions from Open VSX, where Vibefuel is also published.

1. Open the Extensions view in Cursor.
2. Search for **Vibefuel** and click **Install**.
3. Or from a VSIX: Extensions view → `…` menu → **Install from VSIX…**, or run
   `cursor --install-extension vibefuel-0.1.0.vsix`.

Vibefuel uses only the stable VS Code extension API, so it behaves the same in
both editors.

## How it works

1. **Opt in.** On first launch the Vibefuel view opens with a plain explanation
   of what is shown, collected and earned. Nothing runs until you click
   **Opt in**. Opting out is one click in the same view and clears all state.
2. **Sign in.** A short device code is shown in the sidebar; approve it in your
   browser. In mock mode (the default) a local device id is generated instead.
3. **Sponsored cards.** At most one new card every 30 minutes, none in the first
   10 minutes of a session, none while debugging, none while the window is not
   focused, none while paused.
4. **Earn.** A view counts after the card has been visible for 3 continuous
   seconds with the window focused. The reward is shown on every card as
   **Earn N tokens**. Clicking the CTA opens the advertiser in your browser;
   nothing is ever auto-opened. **Not interested** dismisses the card.
5. **Wallet.** Link a Solana public address to receive settled tokens. Vibefuel
   validates the base58 address and stores only that address in the editor's
   SecretStorage. It never asks for, reads or stores private keys or seed
   phrases.

Tokens can be put toward your next AI credits. Vibefuel does not buy credits on
your behalf and does not claim to cover your costs.

## Settings

| Setting                       | Default | Description                                                          |
| ----------------------------- | ------- | -------------------------------------------------------------------- |
| `vibefuel.enabled`            | `false` | Set by the opt-in button. Off until you opt in.                      |
| `vibefuel.frequencyMinutes`   | `30`    | Minimum minutes between new sponsored messages. Minimum 15.          |
| `vibefuel.quietPeriodMinutes` | `10`    | Minutes after the editor starts before the first message can appear. |
| `vibefuel.showStatusBar`      | `true`  | Show the balance in the status bar.                                  |
| `vibefuel.apiBaseUrl`         | `""`    | Base URL of the Vibefuel API. Empty selects mock mode.               |
| `vibefuel.telemetry`          | `true`  | Send ad events. Always off when editor telemetry is disabled.        |

## Commands

| Command                    | Title                           |
| -------------------------- | ------------------------------- |
| `vibefuel.openFeed`        | Vibefuel: Open Feed             |
| `vibefuel.pause`           | Vibefuel: Pause                 |
| `vibefuel.resume`          | Vibefuel: Resume                |
| `vibefuel.linkWallet`      | Vibefuel: Link Solana Wallet    |
| `vibefuel.unlinkWallet`    | Vibefuel: Unlink Wallet         |
| `vibefuel.signOut`         | Vibefuel: Sign Out              |
| `vibefuel.openLandingPage` | Vibefuel: Open Vibefuel Website |

## Privacy

The same summary is shown inside the extension under **What Vibefuel collects**.

**Collected**

- An anonymous device id
- Ad events: impression, click and dismiss, each with the ad id, a timestamp
  and a random per-session id
- Editor name and version
- Extension version

**Never collected**

- File contents, file names, project names or paths
- Prompts, chat messages or AI completions
- Keystrokes or clipboard
- Git remotes or identities

**Rules**

- Events are batched and sent at most once per minute. The queue is dropped on
  opt-out and sign-out.
- If editor telemetry is disabled (`telemetry.telemetryLevel` is `off`), no
  events are sent at all. The sidebar tells you that views cannot be rewarded.
- Only a Solana public address is stored, in the editor's SecretStorage. You can
  unlink it at any time.
- In mock mode no events or ids are sent anywhere; they are written to the
  **Vibefuel** output channel. Card images still load from their https URL.

## Mock mode and the API contract

The backend is defined by [`api/openapi.yaml`](api/openapi.yaml) (OpenAPI 3.1).
Client types are generated from it with `npm run generate:api`. Two adapters
implement the same interface:

- **MockAdapter** (default): serves five clearly fictional ads from
  [`media/mock-ads.json`](media/mock-ads.json), keeps the balance locally and
  logs events to the Vibefuel output channel.
- **HttpAdapter**: used when `vibefuel.apiBaseUrl` is set. If the host cannot be
  reached the sidebar shows an offline notice and retries quietly; no error
  dialogs are shown.

## Development

```bash
npm install                # from the repository root
cd apps/extension
npm run build              # bundle with esbuild into dist/
npm run watch              # rebuild on change
npm run lint
npm run typecheck
npm test                   # unit tests (vitest)
npm run test:integration   # downloads VS Code and runs the extension host test
npm run package            # dist/vibefuel-<version>.vsix
```

Press `F5` in this folder to launch an Extension Development Host.

### Publishing

```bash
npx vsce publish --no-dependencies      # VS Code Marketplace (needs VSCE_PAT)
npx ovsx publish dist/*.vsix -p $OVSX_PAT   # Open VSX, used by Cursor
```

## License

MIT. See [LICENSE](LICENSE).
