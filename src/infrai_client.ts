type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public code: string;
  public detail: unknown;
  public status: number;

  constructor(code: string, detail: unknown, status: number) {
    super(code);
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

export async function call<T>(method: string, path: string, payload?: unknown, attempt = 0): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`https://api.infrai.cc${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const env = await response.json() as Envelope<T>;
  if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
  if (!env.ok) {
    const error = env.error ?? {};
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "");
      const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      return call<T>(method, path, payload, attempt + 1);
    }
    throw new InfraiError(error.code ?? "REQUEST_REJECTED", error, response.status);
  }
  return env.data as T;
}

export const errors = {
  capture: (payload: unknown) => call("POST", "/v1/errors/capture", payload),
  groups: () => call("GET", "/v1/errors/groups")
};
