/* ============================================================
   DarkPrint backend — lib/server/auth public surface
   ============================================================ */

export type { CookieOptions } from "./cookie";
export { buildCookieHeader, parseCookieHeader } from "./cookie";

export type { SessionPayload } from "./session";
export {
  SESSION_COOKIE_NAME,
  clearSessionCookieHeader,
  decodeSession,
  encodeSession,
  getSession,
  sessionCookieHeader,
  sessionSecretState,
} from "./session";

export { withSession, withSessionOrWriteKey } from "./guard";
export { AuthStoreError } from "./errors";

export {
  OAUTH_STATE_COOKIE_NAME,
  clearOAuthStateCookieHeader,
  createOAuthState,
  oauthStateCookieHeader,
  readOAuthStateCookie,
  verifyOAuthState,
} from "./oauth-state";

export type { GithubIdentity, GithubOAuthConfig } from "./github";
export { githubAuthorizeUrl, githubOAuthConfigFromEnv, resolveGithubIdentity } from "./github";
export type { GoogleIdentity, GoogleOAuthConfig } from "./google";
export { googleAuthorizeUrl, googleOAuthConfigFromEnv, resolveGoogleIdentity } from "./google";
