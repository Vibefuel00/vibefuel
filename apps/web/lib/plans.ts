// Advertiser plans, priced in SOL. Tokens and impressions derive from the
// reward economics in env (LAMPORTS_PER_TOKEN) at launch time.

export type PlanId = "starter" | "growth" | "scale"

export type Plan = {
  id: PlanId
  name: string
  sol: number
  rewardTokens: number
  blurb: string
}

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Starter",
    sol: 0.25,
    rewardTokens: 10,
    blurb: "Test the format with a small, focused run.",
  },
  {
    id: "growth",
    name: "Growth",
    sol: 1,
    rewardTokens: 10,
    blurb: "A steady presence across a week of builds.",
  },
  {
    id: "scale",
    name: "Scale",
    sol: 3,
    rewardTokens: 12,
    blurb: "Maximum reach, with a higher reward so developers notice.",
  },
]

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id)
}
