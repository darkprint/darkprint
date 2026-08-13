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
} from "./session";

export { withSession } from "./guard";

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
