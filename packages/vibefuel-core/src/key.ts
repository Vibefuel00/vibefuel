const KEY_RE = /^VF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

/** Uppercase and strip whitespace, matching what the server does. */
export function normalizeSerialKey(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "")
}

/** A Vibefuel serial key looks like `VF-XXXX-XXXX-XXXX-XXXX`. */
export function isSerialKeyShape(key: string): boolean {
  return KEY_RE.test(key)
}

export function validateSerialKey(
  input: string
): { ok: true; key: string } | { ok: false; message: string } {
  const key = normalizeSerialKey(input)
  if (key.length === 0)
    return { ok: false, message: "Paste your Vibefuel key." }
  if (!isSerialKeyShape(key)) {
    return {
      ok: false,
      message:
        "That doesn't look like a Vibefuel key (VF-XXXX-XXXX-XXXX-XXXX).",
    }
  }
  return { ok: true, key }
}

export function keyPrefix(key: string): string {
  return key.slice(0, 7)
}
