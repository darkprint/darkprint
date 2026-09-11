/* ============================================================
   DarkPrint backend — GitHub OAuth exchange
   B-02: sign-in is GitHub OAuth, credentials only — the handle
   is a separate concern (B-05, T070/T050). Nothing here creates
   or looks up an `account` row; it only turns an authorization
   code into a verified GitHub identity. `GITHUB_CLIENT_ID` and
   `GITHUB_CLIENT_SECRET` are read from the environment and
   nothing here can be exercised end to end until they exist —
   expected, per T000's contract.
   ============================================================ */

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

export interface GithubOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export function githubOAuthConfigFromEnv(): GithubOAuthConfig {
  return {
    clientId: requiredEnv("GITHUB_CLIENT_ID"),
    clientSecret: requiredEnv("GITHUB_CLIENT_SECRET"),
  };
}

/** Where the login route sends the browser. `state` must be the OAuth CSRF token. */
export function githubAuthorizeUrl(
  params: { redirectUri: string; state: string },
  config: GithubOAuthConfig = githubOAuthConfigFromEnv(),
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", "read:user user:email");
  return url.toString();
}

export interface GithubIdentity {
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
}

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GithubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

/** Exchanges the callback's `code` for a token, then resolves the GitHub identity behind it. */
export async function resolveGithubIdentity(
  params: { code: string; redirectUri: string },
  config: GithubOAuthConfig = githubOAuthConfigFromEnv(),
): Promise<GithubIdentity> {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`GitHub token exchange failed with status ${tokenResponse.status}`);
  }
  const tokenBody = (await tokenResponse.json()) as GithubTokenResponse;
  if (!tokenBody.access_token) {
    throw new Error(tokenBody.error_description ?? tokenBody.error ?? "GitHub returned no access_token");
  }

  const userResponse = await fetch(USER_URL, {
    headers: {
      authorization: `Bearer ${tokenBody.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "darkprint",
    },
  });
  if (!userResponse.ok) {
    throw new Error(`GitHub user lookup failed with status ${userResponse.status}`);
  }
  const user = (await userResponse.json()) as GithubUserResponse;

  return {
    githubId: String(user.id),
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    email: user.email,
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
