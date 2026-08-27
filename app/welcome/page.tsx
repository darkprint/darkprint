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

/**
 * The centred column both states stand in.
 *
 * This route is the one place on the site that is a DOOR rather than a document: it holds
 * two buttons or two fields and nothing a reader scans. So it is the one place a bounded,
 * centred column is right — the site's own rule that text runs the full width is about
 * prose, and there is none here. Everything else on DarkPrint keeps that rule.
 *
 * `min-h` rather than a fixed height: the column centres in the viewport on a laptop and
 * simply flows on a phone, where vertical centring would push the heading under the fold.
 */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page flex min-h-[72vh] flex-col items-center justify-center py-16">
      <div className="flex w-full max-w-[26rem] flex-col gap-8">{children}</div>
    </div>
  );
}

function SignedOut() {
  return (
    <AuthShell>
      <SectionHeading as="h1" align="center" eyebrow="Account" title="Sign in" />
      <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface-2/50 px-6 py-7">
        {/* Stacked and full width: two equal doors, which is what a reader is choosing
            between. Side by side in a 26rem column the second one wraps anyway. */}
        <SignInButtons block />
        <p className="text-center font-mono text-[11px] leading-relaxed text-dim">
          DarkPrint reads your handle and nothing else. Everything you publish here stays
          here.
        </p>
      </div>
    </AuthShell>
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
    <AuthShell>
      <SectionHeading
        as="h1"
        align="center"
        eyebrow="One step left"
        title="Choose your handle"
        lead="It is your address on the registry, and it goes inside every card you publish, so it is reserved to you for good."
      />
      {/* Empty rather than seeded from the GitHub login: nothing published exposes that
          field, and inventing a reader to pre-fill one input would put a second source on
          an identity the account row already owns. The availability line below the field
          does the work instead — it names the rule when a name is refused and offers a free
          variant to take in one click. */}
      <div className="rounded-xl border border-line bg-surface-2/50 px-6 py-7">
        <WelcomeForm suggestedHandle="" />
      </div>
    </AuthShell>
  );
}
