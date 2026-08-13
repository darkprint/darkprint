/* ============================================================
   DarkPrint backend — cookie plumbing shared by the session and
   the OAuth CSRF-state cookie. No framework dependency: reads a
   raw `Cookie` header, writes a raw `Set-Cookie` value, so both
   this module and its callers stay testable off plain `Request`.
   ============================================================ */

export interface CookieOptions {
  maxAgeSeconds: number;
  /** Defaults to `NODE_ENV === "production"` — local `http://` dev needs it off. */
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
}

export function buildCookieHeader(name: string, value: string, options: CookieOptions): string {
  const secure = options.secure ?? process.env.NODE_ENV === "production";
  const attrs = [
    `${name}=${value}`,
    `Path=${options.path ?? "/"}`,
    `Max-Age=${options.maxAgeSeconds}`,
    `SameSite=${options.sameSite ?? "Lax"}`,
  ];
  if (options.httpOnly ?? true) attrs.push("HttpOnly");
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function parseCookieHeader(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) result[name] = decodeURIComponent(value);
  }
  return result;
}
