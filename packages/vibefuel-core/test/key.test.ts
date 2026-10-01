import { describe, expect, it } from "vitest"
import {
  isSerialKeyShape,
  keyPrefix,
  normalizeSerialKey,
  validateSerialKey,
} from "../src/key"

describe("serial keys", () => {
  it("normalizes case and whitespace like the server", () => {
    expect(normalizeSerialKey("  vf-7k2m-abcd-efgh-jkmn \n")).toBe(
      "VF-7K2M-ABCD-EFGH-JKMN"
    )
  })

  it("accepts the VF-XXXX-XXXX-XXXX-XXXX shape only", () => {
    expect(isSerialKeyShape("VF-7K2M-ABCD-EFGH-JKMN")).toBe(true)
    expect(isSerialKeyShape("VF-7K2M-ABCD-EFGH")).toBe(false)
    expect(isSerialKeyShape("XX-7K2M-ABCD-EFGH-JKMN")).toBe(false)
    expect(validateSerialKey("")).toMatchObject({ ok: false })
    expect(validateSerialKey("vf-7k2m-abcd-efgh-jkmn")).toEqual({
      ok: true,
      key: "VF-7K2M-ABCD-EFGH-JKMN",
    })
  })

  it("shows only the prefix", () => {
    expect(keyPrefix("VF-7K2M-ABCD-EFGH-JKMN")).toBe("VF-7K2M")
  })
})
