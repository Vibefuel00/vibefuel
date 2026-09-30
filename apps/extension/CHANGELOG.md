# Changelog

All notable changes to the Vibefuel extension are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-09-30

### Added

- Vibefuel sidebar view with opt-in onboarding, sponsored card, earnings
  summary, wallet status, pause toggle and privacy summary.
- Status bar item showing the token balance and a dot when a new sponsored
  message is waiting.
- Delivery policy: one message per 30 minutes at most, a 10 minute quiet
  period, nothing while debugging, unfocused or paused. All values are
  configurable.
- Impressions count only after 3 continuous seconds visible with the window
  focused.
- Device code sign-in against the OpenAPI contract in `api/openapi.yaml`, with
  a mock adapter that runs fully offline.
- Solana public address linking with base58 and length validation. Only the
  public address is stored, in the editor's SecretStorage.
- Event batching at most once per minute, dropped on opt-out, and hard-off when
  editor telemetry is disabled.
- Commands: open feed, pause, resume, link wallet, unlink wallet, sign out, open
  website.
