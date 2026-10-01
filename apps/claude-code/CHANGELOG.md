# Changelog

## [0.1.0] - 2026-10-01

### Added

- Stop hook that shows one labelled sponsored line after a task finishes,
  under the shared delivery policy (30 minute frequency, 10 minute quiet
  period, never in subagents, never while paused).
- SessionStart hook that records the session start for the quiet period.
- Commands: optin, optout, login, status, pause, resume, wallet, config,
  statusline, privacy.
- Status line script showing the token balance and a marker for a new line.
- Serial-key sign-in against the shared OpenAPI contract served by vibefuel.app,
  with an offline mock mode. State in `~/.vibefuel` with owner-only permissions.
