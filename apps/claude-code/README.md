# Vibefuel for Claude Code

A short, clearly labelled sponsored line after a task finishes, never
mid-task. Earn Solana tokens toward your next AI credits on the same balance as
the Vibefuel editor extension.

> Vibefuel is an independent product. It is not affiliated with, endorsed by or
> partnered with Anthropic or any AI tool.

## What you see

After Claude finishes a task, at most once every 30 minutes and never in the
first 10 minutes of a session, one message like this appears:

```
Sponsored · Quillstack Labs: Ship docs that stay in sync with your code — Quillstack watches your repo and drafts reference docs on every merge. Try Quillstack: https://example.com/quillstack · Earn 12 tokens · /vibefuel:pause to pause
```

Nothing is ever inserted into Claude's context, your prompts or your files. The
line is shown through the hook `systemMessage` channel, which Claude Code
displays to you and does not feed to the model.

Optionally, your balance shows in the status line: `⛽ 128 FUEL · ● new`.

## Install

```
claude plugin marketplace add vibefuel/vibefuel-claude-code
claude plugin install vibefuel@vibefuel
```

Or from inside a session: `/plugin install vibefuel --marketplace vibefuel/vibefuel-claude-code`.

Then opt in and sign in with a free serial key from
[vibefuel.app/start](https://vibefuel.app/start). Nothing runs before this:

```
/vibefuel:optin
/vibefuel:login VF-XXXX-XXXX-XXXX-XXXX
```

The key is stored in `~/.vibefuel/token` with owner-only permissions. For a
fully offline try-out with fictional ads: `/vibefuel:config api mock`.

## Commands

| Command                      | What it does                                                   |
| ---------------------------- | -------------------------------------------------------------- |
| `/vibefuel:optin`            | Turn Vibefuel on and sign this device in                       |
| `/vibefuel:optout`           | Turn it off and delete everything under `~/.vibefuel`          |
| `/vibefuel:login`            | Start or finish device sign-in                                 |
| `/vibefuel:status`           | Balance, wallet, mode and when the next line can appear        |
| `/vibefuel:pause` / `resume` | Pause or resume sponsored lines                                |
| `/vibefuel:wallet <address>` | Link a Solana public address (`unlink` to remove)              |
| `/vibefuel:config`           | `api <url>`, `frequency <minutes>` (min 15), `quiet <minutes>` |
| `/vibefuel:statusline`       | Show the settings snippet for the status line balance          |
| `/vibefuel:privacy`          | What is collected and what never is                            |

The status line cannot be set by a plugin, so `/vibefuel:statusline` prints
the `statusLine` entry for `~/.claude/settings.json` and offers to add it.

## Delivery rules

- At most one sponsored line per 30 minutes. Configurable, minimum 15.
- None in the first 10 minutes of a session. Configurable.
- Only after a task finishes (the `Stop` hook). Never mid-task, never while
  Claude is working, never inside subagents.
- Never while paused. Opt-out is one command.
- A terminal impression counts when the line is displayed. There is no view
  timer in a terminal, and the privacy summary says so.
- Clicks are tracked by a redirect link from the API, so nothing runs in your
  terminal to detect a click.

## Privacy

Collected: your serial key (stored hashed on the server), ad events
(impression, click, dismiss) with the campaign id, a timestamp and a random
per-session id, the client name and plugin version. No active time is reported
from the terminal.

Never collected: file contents, file names, project names or paths, prompts,
chat messages, transcripts or AI completions, keystrokes or clipboard, git
remotes or identities. The hook reads only `session_id` and `agent_id` from
the hook input and never opens the transcript.

State lives in `~/.vibefuel` with owner-only permissions. The serial key is the
only secret, and `/vibefuel:optout` deletes the directory. Vibefuel never asks
for a private key or seed phrase. Full summary: https://vibefuel.app/privacy

## Development

```bash
npm install            # repository root
cd apps/claude-code
npm run build          # bundles src/cli.ts into bin/vibefuel.cjs
npm test               # builds, then runs unit and CLI tests (vitest)
npm run lint && npm run typecheck
claude plugin validate .
```

To try it locally without installing from the marketplace:

```bash
claude --plugin-dir apps/claude-code
```

Set `VIBEFUEL_HOME` to use a scratch state directory, and
`VIBEFUEL_API_BASE_URL` to override the API.

The shared client code (contract, adapters, policy, validation) lives in
`packages/vibefuel-core` and is the same code the VS Code extension uses.

### Publishing

The plugin is published from its own repository, generated from this folder:

```bash
node scripts/export.mjs ../../../vibefuel-claude-code --repo vibefuel/vibefuel-claude-code
cd ../../../vibefuel-claude-code && git add -A && git commit -m "vibefuel 0.1.0" && git push
```

Bump `version` in `.claude-plugin/plugin.json` before each release.

## License

MIT. See [LICENSE](LICENSE).
