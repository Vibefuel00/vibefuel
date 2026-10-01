# Deploying Vibefuel

Three deliverables ship from this repository: the web app (site, dashboards and
API), the VS Code / Cursor extension, and the Claude Code plugin.

## Web app (Railway)

The root `Dockerfile` builds `apps/web` as a standalone Next.js server.

1. Create a Railway service from this repository with the Dockerfile path set
   to `/Dockerfile` and a Postgres plugin attached.
2. Set the variables from `apps/web/.env.example`:
   - `DATABASE_URL` (from the Postgres plugin)
   - `AUTH_SECRET` (64 random characters; rotating it signs everyone out)
   - `NEXT_PUBLIC_APP_URL=https://vibefuel.app`
   - `SOLANA_RPC_URL` (a paid RPC is recommended for payment checks)
   - `VIBEFUEL_TREASURY_ADDRESS` (advertiser payments stay disabled until set)
   - `LAMPORTS_PER_TOKEN` (reward economics; default 100000 = 0.0001 SOL)
3. Apply the schema before the first deploy and after any change to
   `apps/web/db/schema.ts`:

   ```bash
   cd apps/web && DATABASE_URL=... npx drizzle-kit push
   ```

   Railway can run this as a pre-deploy command: `npm run db:push --workspace web`.
4. Point the `vibefuel.app` domain at the service and confirm
   `https://vibefuel.app/api/health` returns `{"ok":true}`.

The in-memory rate limiter assumes one instance. Scale to one replica, or swap
`apps/web/lib/ratelimit.ts` for Redis before scaling out.

## VS Code / Cursor extension

```bash
cd apps/extension
npm run package                        # dist/vibefuel-<version>.vsix
npx vsce publish --no-dependencies     # VS Code Marketplace (publisher: vibefuel)
npx ovsx publish dist/*.vsix -p $OVSX_PAT   # Open VSX, used by Cursor and Windsurf
```

The extension talks to `https://vibefuel.app` by default, so the web app must
be live before users can sign in.

## Claude Code plugin

```bash
cd apps/claude-code
npm run export -- ../../../vibefuel-claude-code --repo vibefuel/vibefuel-claude-code
cd ../../../vibefuel-claude-code && git add -A && git commit -m "vibefuel <version>" && git push
```

Users install with `claude plugin marketplace add vibefuel/vibefuel-claude-code`
then `claude plugin install vibefuel@vibefuel`.

## Release checklist

- `npm run lint && npm run typecheck && npm test` from the repository root.
- `npm run build --workspace web` succeeds.
- Bump versions: `apps/extension/package.json`, `apps/claude-code/.claude-plugin/plugin.json`.
- Update both CHANGELOGs.
