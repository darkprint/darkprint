/**
 * The session cookie: `{ accountId, handle }` or nothing. Signed rather than opaque so a
 * request never needs a database round trip to answer "is anyone signed in".
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { buildCookieHeader, parseCookieHeader, type CookieOptions } from "./cookie";

export const SESSION_COOKIE_NAME = "darkprint_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Generous enough that no real session ever approaches it, tight enough that a
 * seconds/milliseconds mixup at the mint site cannot pass silently. Not attacker-reachable
 * (minting needs the secret); it guards against a bug in this module.
 */
const MAX_SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 365; // 1 year

/** The value `.env.example` ships. Public by definition, so a production process must never sign with it. */
const EXAMPLE_SECRET = "0".repeat(64);

/**
 * What gets signed, decoded and verified. `exp` (unix seconds) is a claim the decoder
 * alone checks, which is why it never reaches `SessionPayload`.
 */
interface SessionToken {
  accountId: string;
  handle: string | null;
  exp: number;
}

/**
 * What `withSession` hands the handler. `handle: null` is a real state: sign-in cannot
 * complete until a handle is chosen, so the session exists before the handle does.
 */
export interface SessionPayload {
  accountId: string;
  handle: string | null;
}

/**
 * Read at first use rather than at import, and only by the code paths that sign or verify
 * a cookie: an anonymous request carrying no cookie must not depend on the secret being
 * set. In production the published example value is refused so a deployment that copied
 * `.env.example` fails at the first sign-in instead of minting forgeable cookies.
 */
function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  if (process.env.NODE_ENV === "production" && value === EXAMPLE_SECRET) {
    throw new Error(
      "SESSION_SECRET is the all-zero example value from .env.example, which is public. Generate one with `openssl rand -hex 32` and set it in the deployment.",
    );
  }
  return value;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function isSessionToken(value: unknown): value is SessionToken {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accountId === "string" &&
    (typeof candidate.handle === "string" || candidate.handle === null) &&
    typeof candidate.exp === "number"
  );
}

/**
 * Encodes and HMAC-signs a session payload into an opaque cookie value. `exp` defaults to
 * now plus the session lifetime; the third argument exists so a test can mint an
 * already-expired token without waiting on the clock. Throws if `exp` is implausibly far
 * in the future rather than minting a token that would outlive every legitimate session.
 */
export function encodeSession(
  payload: SessionPayload,
  secret?: string,
  exp: number = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
): string {
  const now = Math.floor(Date.now() / 1000);
  if (exp > now + MAX_SESSION_LIFETIME_SECONDS) {
    throw new Error(
      `exp ${exp} is more than ${MAX_SESSION_LIFETIME_SECONDS}s (1 year) from now: ` +
        `implausible for a session token, and likely milliseconds where seconds were meant.`,
    );
  }
  const token: SessionToken = { ...payload, exp };
  const body = Buffer.from(JSON.stringify(token), "utf8").toString("base64url");
  return `${body}.${sign(body, secret ?? sessionSecret())}`;
}

/**
 * Verifies and decodes a cookie value into the session it names. `undefined` on anything
 * that fails to prove itself (a missing cookie, a bad signature, a tampered or malformed
 * body, an expired one) and never throws for those, which is what lets `getSession`
 * answer "no session" instead of erroring. Strips `exp` on the way out.
 */
export function decodeSession(cookieValue: string | undefined, secret?: string): SessionPayload | undefined {
  if (!cookieValue) return undefined;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return undefined;

  const body = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  const expected = sign(body, secret ?? sessionSecret());
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return undefined;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!isSessionToken(parsed)) return undefined;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return undefined;
    return { accountId: parsed.accountId, handle: parsed.handle };
  } catch {
    return undefined;
  }
}

/**
 * Reads and verifies the session cookie straight off a `Request`. `undefined` means
 * "no session", not "error"; the 401 is the caller's job.
 */
export function getSession(request: Request, secret?: string): SessionPayload | undefined {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return decodeSession(cookies[SESSION_COOKIE_NAME], secret);
}

/** The `Set-Cookie` header value that establishes a session (the OAuth callback). */
export function sessionCookieHeader(
  payload: SessionPayload,
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
