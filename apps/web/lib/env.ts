// Central place for runtime configuration. Server-only.

function num(name: string, fallback: number): number {
  const v = process.env[name]
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const env = {
  authSecret: process.env.AUTH_SECRET ?? "",
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  treasuryAddress: process.env.VIBEFUEL_TREASURY_ADDRESS ?? "",
  lamportsPerToken: num("LAMPORTS_PER_TOKEN", 100_000),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  isProd: process.env.NODE_ENV === "production",
}

export const LAMPORTS_PER_SOL = 1_000_000_000

export function tokensToSol(tokens: number): number {
  return (tokens * env.lamportsPerToken) / LAMPORTS_PER_SOL
}

export function solToTokens(sol: number): number {
  return Math.floor((sol * LAMPORTS_PER_SOL) / env.lamportsPerToken)
}

export function assertServerConfig() {
  if (!env.authSecret || env.authSecret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters")
  }
}
