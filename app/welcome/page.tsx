import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WelcomeForm } from "@/components/welcome/WelcomeForm";
import { SignInButtons } from "@/components/auth/SignInButtons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { readSession } from "@/components/profile/session";

/* ============================================================
   /welcome — where sign-in lands when sign-up is not finished.

   T050 AC1 makes a session with `handle: null` "signed in and
   INCOMPLETE". `app/api/auth/github/callback/route.ts` recorded
   the missing half as a known gap in its own header — "the
   redirect stays `/` … AC1 reads as though sign-in should land
   somewhere that asks for a handle" — and until this route existed
   there was nowhere to send that reader. They arrived on the
   landing page signed in, with no visible difference from being
   signed out, and had to find `/settings` unaided to discover that
   the field gating publishing was sitting there unfilled.

   ── The route is a redirect, not a wall ──
   It is reachable at any time and answers three states rather than
   rendering one page: no session sends the reader to sign in, a
   session that already HAS a handle bounces to `/` (there is
   nothing to finish, and a form that re-asks a settled question
   invites an accidental rename of a permanently reserved name),
   and only the incomplete state renders the form. So a bookmark
   of this URL is harmless and the callback can point at it
   unconditionally for a null-handle session.

   ── Server-rendered per request, by construction ──
   `readSession` reads `next/headers`' cookies, which opts this
   route into dynamic rendering on its own — the same mechanism the
   profile routes use, and the reason none of them declare
   `force-dynamic` beside it.
   ============================================================ */

export const metadata: Metadata = {
  title: "Finish signing up",
  description:
    "Choose the handle the registry will reserve for you, and the name shown beside what you publish.",
};

function SignedOut() {
  return (
    <div className="container-page flex flex-col gap-8 py-16">
      <SectionHeading
        as="h1"
        eyebrow="Account"
        title="Sign in"
      />
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface-2/50 px-6 py-6">
        <SignInButtons />
        <p className="font-mono text-[11px] leading-relaxed text-dim">
          DarkPrint reads your GitHub handle and nothing else. Everything you publish here
          stays here.
        </p>
      </div>
    </div>
  );
}

export default async function WelcomePage() {
  const session = await readSession();
  if (session === undefined) return <SignedOut />;

  /* Already finished. `redirect` rather than a rendered "nothing to do here" panel: the
     handle is permanent once allocated (T070 reserves it even after a release), so a form
     that re-opens on it is an invitation to rename by accident. `/settings` is where a
     deliberate change belongs, next to the warning that the old name stays reserved. */
  if (session.handle !== null) redirect("/");

  return (
    <div className="container-page flex flex-col gap-2 py-16">
      <SectionHeading
        as="h1"
        eyebrow="One step left"
        title="Choose your handle"
        lead="You are signed in. The registry needs a handle before you can publish under it: it is your address here, and it goes inside every card you publish, so it is reserved to you for good."
      />
      {/* Empty rather than seeded from the GitHub login: nothing published exposes that
          field, and inventing a reader to pre-fill one input would put a second source on
          an identity the account row already owns. The availability line below the field
          does the work instead — it names the rule when a name is refused and offers a free
          variant to take in one click. */}
      <WelcomeForm suggestedHandle="" />
    </div>
  );
}
