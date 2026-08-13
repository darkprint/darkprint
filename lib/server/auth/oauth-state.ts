/* ============================================================
   DarkPrint backend — OAuth CSRF state
   The GitHub authorize step and the callback are two separate
   requests; this is what proves the callback is answering a
   redirect this server actually issued, not one an attacker
   constructed (the "login CSRF" GitHub's own docs warn about).
   ============================================================ */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { buildCookieHeader, parseCookieHeader, type CookieOptions } from "./cookie";

export const OAUTH_STATE_COOKIE_NAME = "darkprint_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60; // the round trip through GitHub, generously

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function oauthStateCookieHeader(state: string, options: Partial<CookieOptions> = {}): string {
  return buildCookieHeader(OAUTH_STATE_COOKIE_NAME, state, {
    maxAgeSeconds: STATE_MAX_AGE_SECONDS,
    ...options,
  });
}

export function clearOAuthStateCookieHeader(options: Partial<CookieOptions> = {}): string {
  return buildCookieHeader(OAUTH_STATE_COOKIE_NAME, "", { maxAgeSeconds: 0, ...options });
}

export function readOAuthStateCookie(request: Request): string | undefined {
  return parseCookieHeader(request.headers.get("cookie"))[OAUTH_STATE_COOKIE_NAME];
}

/** Constant-time comparison — the whole point of a CSRF token is that guessing it is hard. */
export function verifyOAuthState(cookieState: string | undefined, queryState: string | null): boolean {
  if (!cookieState || !queryState) return false;
  const a = Buffer.from(cookieState);
  const b = Buffer.from(queryState);
  return a.length === b.length && timingSafeEqual(a, b);
}
