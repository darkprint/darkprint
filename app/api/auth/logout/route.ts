/* ============================================================
   POST /api/auth/logout
   Clears the session cookie. No database or GitHub involved, so
   unlike the login/callback pair this is fully exercisable today.

   ── 303 to `/`, not a JSON body ──
   Its only caller is an ordinary HTML `<form method="post">` in
   the account menu (`components/site/SiteHeader.tsx`), and a form
   submission NAVIGATES: answering `200 {"signedOut":true}` left
   the reader looking at raw JSON on a blank page with the site
   gone. A signed-out reader belongs on the site, signed out.

   **303 and not 302**, which is the one detail worth stating: 303
   is the status that tells a browser to follow up with a GET.
   After a POST a 302 leaves the method to the client's discretion
   — historically some re-POST to the target — and `/` is a page,
   not something to POST to. The cookie is cleared on the redirect
   response itself, so it is gone before the GET that follows.

   The API-shaped answer is not owed to anybody: no test pinned the
   body, nothing in the repository reads it, and a caller that
   wants a machine answer can read the 303 and the `set-cookie`,
   which are the two facts this route actually produces.
   ============================================================ */

import { clearSessionCookieHeader } from "@/lib/server/auth";

export async function POST(request: Request): Promise<Response> {
  const response = new Response(null, {
    status: 303,
    headers: { location: new URL("/", request.url).toString() },
  });
  response.headers.append("set-cookie", clearSessionCookieHeader());
  return response;
}
