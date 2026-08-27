import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, decodeSession, type SessionPayload } from "@/lib/server/auth";

/* ============================================================
   The one server-side session read behind T262's surfaces.

   SERVER ONLY. `next/headers` is a request-time API, so importing this anywhere
   opts that route into dynamic rendering — which is the mechanism AC1 needs and
   not a side effect to work around: a prerendered page cannot render a different
   view per reader, so `dynamicParams`/`generateStaticParams` came off the five
   profile routes in the same change that added this.

   ── Why one file, and why here ──
   D-263-09 asks for the session read to sit in ONE file so a later task can lift
   it whole rather than find three copies disagreeing about what "signed in"
   means. `/settings` imports it from `components/profile/` rather than the other
   way round because the profile routes are four of its five callers; the folder
   is the address, not a claim that settings is part of a profile.

   **`components/site/SiteHeader.tsx` does NOT use this, and that is deliberate.**
   It is a client component in the ROOT layout, so a server-side session read
   there would opt every route in the repository into dynamic rendering — T260's
   browse shelves included, which B-15 keeps static with tag-based revalidation.
   The header reads `GET /api/auth/session` from the browser instead. Two
   transports, one for each constraint, and neither is a second idea of what a
   session is: both end at `SessionPayload`.

   ── The absent cookie is answered before the secret is consulted ──
   `decodeSession`'s second parameter defaults to `requiredEnv("SESSION_SECRET")`,
   and a default argument is evaluated on ENTRY — before the function's own
   `if (!cookieValue) return undefined` can run. So calling it with no cookie
   throws where `SESSION_SECRET` is unset, and the signed-out path is the one
   path that should never depend on a secret being configured. Returning here
   first makes "no session" answerable on a machine that could not verify one
   anyway.
   ============================================================ */

/**
 * The verified session for this request, or `undefined` when there is none.
 *
 * `undefined` means *no session*, never *error* — the same contract
 * `lib/server/auth`'s own `getSession` publishes for a `Request`. A caller that
 * needs a signed-in reader decides what to do about it; this function does not
 * redirect, throw or 401, because the three callers want three different answers
 * (the visitor view, the owner view, and a 404).
 */
export async function readSession(): Promise<SessionPayload | undefined> {
  const value = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (value === undefined) return undefined;
  return decodeSession(value);
}
