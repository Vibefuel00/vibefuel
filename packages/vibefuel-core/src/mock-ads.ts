import mockAdsJson from "../data/mock-ads.json"
import type { Ad } from "./types"
import { validateAd } from "./validate"

/** Five clearly fictional ads used in mock mode. Validated at load time. */
export const MOCK_ADS: readonly Ad[] = (mockAdsJson as unknown[])
  .map((item) => validateAd(item, 0))
  .filter((ad): ad is Ad => ad !== null)
