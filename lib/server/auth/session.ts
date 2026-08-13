/* ============================================================
   DarkPrint backend — session cookie
   B-02: the session is a GitHub OAuth cookie exposing
   `{ accountId, handle }` or nothing. Signed rather than opaque
   so a request never needs a database round trip just to answer
   "is anyone signed in" — the guard below is pure.
   ============================================================ */

import { createHmac, timingSafeEqual } from "node:crypto";
import { buildCookieHeader, parseCookieHeader, type CookieOptions } from "./cookie";

export const SESSION_COOKIE_NAME = "darkprint_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * `handle: null` is a real, reachable state — T050 AC1: sign-in cannot *complete*
 * until a handle is chosen, so the session exists before the handle does.
 *
 * `exp` (unix seconds) is expiry, not revocation: `withSession` rejects a token past
 * it exactly as it rejects a forged one, but a stolen cookie is still valid *until*
 * it expires, and sign-out only clears the browser's copy. True invalidation needs
 * server-side session state, which is a storage and scale decision the owner has not
 * taken — recorded open in the T000 contract, not built here.
 */
export interface SessionPayload {
  accountId: string;
  handle: string | null;
  exp: number;
}

/** What a caller mints a session from — `exp` is this module's to set, not theirs. */
export type SessionClaims = Omit<SessionPayload, "exp">;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accountId === "string" &&
    (typeof candidate.handle === "string" || candidate.handle === null) &&
    typeof candidate.exp === "number"
  );
}

/**
 * Encodes and HMAC-signs a session payload into an opaque cookie value. `exp`
 * defaults to now plus the session lifetime; the third argument exists so a test can
 * mint an already-expired token without waiting on the clock, not for ordinary
 * minting call sites to set their own expiry.
 */
export function encodeSession(
  claims: SessionClaims,
  secret: string = requiredEnv("SESSION_SECRET"),
  exp: number = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
): string {
  const payload: SessionPayload = { ...claims, exp };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/**
 * Verifies and decodes a cookie value. `undefined` on anything that fails to prove
 * itself — a missing cookie, a bad signature, a tampered or malformed body, or an
 * expired one — never throws, which is what lets `getSession` answer "no session"
 * instead of erroring.
 */
export function decodeSession(
  cookieValue: string | undefined,
  secret: string = requiredEnv("SESSION_SECRET"),
): SessionPayload | undefined {
  if (!cookieValue) return undefined;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return undefined;

  const body = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  const expected = sign(body, secret);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return undefined;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!isSessionPayload(parsed)) return undefined;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Reads and verifies the session cookie straight off a `Request`. The session guard
 * every other route builds on: `undefined` means "no session," not "error" — AC3's
 * 401 is the caller's job, not this function's.
 */
export function getSession(request: Request, secret?: string): SessionPayload | undefined {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return decodeSession(cookies[SESSION_COOKIE_NAME], secret);
}

/** The `Set-Cookie` header value that establishes a session (the OAuth callback). */
export function sessionCookieHeader(
  payload: SessionClaims,
  options: Partial<CookieOptions> = {},
  secret?: string,
): string {
  return buildCookieHeader(SESSION_COOKIE_NAME, encodeSession(payload, secret), {
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    ...options,
  });
}

/** The `Set-Cookie` header value that clears a session (sign-out). */
export function clearSessionCookieHeader(options: Partial<CookieOptions> = {}): string {
  return buildCookieHeader(SESSION_COOKIE_NAME, "", { maxAgeSeconds: 0, ...options });
}
