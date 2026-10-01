import "server-only"

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export function unauthorized(): Response {
  return json({ error: "Invalid or missing serial key" }, 401)
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400)
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

export function tooMany(): Response {
  return json({ error: "Too many requests" }, 429)
}
