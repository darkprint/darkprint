/* ============================================================
   DarkPrint backend — Google OAuth
   The mirror of `github.ts`, deliberately shaped the same way so
   the two providers are comparable at a glance and the callback
   routes differ only in which resolver they call.

   ── what is asked for, and what is not ──
   `openid email profile`, which are Google's NON-SENSITIVE scopes:
   they need no security review, and they are the whole of what an
   identity is here — a stable subject id, an address, a name to
   seed a profile with. Nothing about Drive, contacts or calendars
   is requested, so no consent screen this app shows can grow into
   one by accident.

   ── the id token is not parsed here ──
   Google returns a signed JWT alongside the access token, and
   reading `sub` out of it would mean verifying a signature against
   a rotating JWKS — a second cryptographic surface for a fact the
   userinfo endpoint states directly over a channel already
   authenticated by the token exchange. `github.ts` calls a user
   endpoint for the same reason; this file does the same thing.

   ── email_verified is carried, not assumed ──
   Google will assert an address for accounts that have not proved
   it. Account LINKING turns on that flag (see
   `lib/server/accounts/identities.ts`), so it travels with the
   identity rather than being dropped here and guessed at later.
   ============================================================ */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USER_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export function googleOAuthConfigFromEnv(): GoogleOAuthConfig {
  return {
    clientId: requiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
  };
}

/** Where the login route sends the browser. `state` must be the OAuth CSRF token. */
export function googleAuthorizeUrl(
  params: { redirectUri: string; state: string },
  config: GoogleOAuthConfig = googleOAuthConfigFromEnv(),
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  return url.toString();
}

export interface GoogleIdentity {
  /** Google's `sub`: stable for the life of the account, and never an email. */
  googleId: string;
  email: string | null;
  /** Whether Google says the address is proven. Account linking turns on this. */
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/** Exchanges the callback's `code` for a token, then resolves the Google identity behind it. */
export async function resolveGoogleIdentity(
  params: { code: string; redirectUri: string },
  config: GoogleOAuthConfig = googleOAuthConfigFromEnv(),
): Promise<GoogleIdentity> {
  /* Form-encoded, unlike GitHub's JSON: Google's token endpoint accepts only
     `application/x-www-form-urlencoded`, and sending JSON answers 400 with a message about
     a missing grant_type that reads like a caller error rather than a content-type one. */
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed with status ${tokenResponse.status}`);
  }
  const tokenBody = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenBody.access_token) {
    throw new Error(
      tokenBody.error_description ?? tokenBody.error ?? "Google returned no access_token",
    );
  }

  const userResponse = await fetch(USER_URL, {
    headers: { authorization: `Bearer ${tokenBody.access_token}`, accept: "application/json" },
  });
  if (!userResponse.ok) {
    throw new Error(`Google userinfo lookup failed with status ${userResponse.status}`);
  }
  const user = (await userResponse.json()) as GoogleUserResponse;

  return {
    googleId: user.sub,
    email: user.email ?? null,
    /* Absent is NOT verified. Google omits the flag rather than sending `false` in some
       responses, and defaulting an absent claim to "proven" is how an unverified address
       becomes a link into somebody else's account. */
    emailVerified: user.email_verified === true,
    name: user.name ?? null,
    avatarUrl: user.picture ?? null,
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
