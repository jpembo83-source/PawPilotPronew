export interface PortalApiOptions {
  projectId: string;
  anonKey: string;
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

const FUNCTION_NAME = "make-server-fc003b23";

export function createPortalApi(opts: PortalApiOptions) {
  const f = opts.fetch ?? fetch;
  const base = `https://${opts.projectId}.supabase.co/functions/v1/${FUNCTION_NAME}`;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await opts.getAccessToken();
    const res = await f(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${opts.anonKey}`,
        ...(token ? { "X-User-Token": `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const parsed = text ? safeJson(text) : null;
    if (!res.ok) {
      const msg = (parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as any).error === "string")
        ? (parsed as any).error
        : `HTTP ${res.status}`;
      throw new ApiError(res.status, msg, parsed);
    }
    return parsed as T;
  }

  function safeJson(text: string): unknown {
    try { return JSON.parse(text); } catch { return text; }
  }

  return {
    get: <T>(path: string) => call<T>("GET", path),
    post: <T>(path: string, body?: unknown) => call<T>("POST", path, body),
    patch: <T>(path: string, body?: unknown) => call<T>("PATCH", path, body),
    del:  <T>(path: string) => call<T>("DELETE", path),
  };
}

export type PortalApi = ReturnType<typeof createPortalApi>;
