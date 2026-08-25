"use client";

/* ============================================================
   What the landing offers above the fold, per reader.

   Signed out it is the two providers; signed in it is the reader's
   own name. The owner's instruction, and it replaces the pair of
   route buttons ("Find a blueprint" / "Create a blueprint") that
   stood here — those two doors still close the page in
   `SectionDoors`, so the routes remain one scroll away rather than
   gone.

   ── why the session is read in the BROWSER ──
   `app/page.tsx` is static, and it is the one page on the site
   that has to stay that way. A server-side session read here
   would opt the landing into dynamic rendering for every visitor,
   which is what `components/profile/session.ts`'s own header warns
   about one layer up. `SiteHeader` already solved this: it reads
   `GET /api/auth/session` from the browser through
   `useUploadSession`, and this component reuses that hook rather
   than inventing a second opinion about what a session is.

   ── the loading frame states nothing ──
   `useUploadSession`'s docblock is explicit that `loading` is not
   `anonymous`: rendering "sign in" for the frame before the fetch
   lands tells a signed-in reader something false. So the mount
   state is a placeholder the size of the row it will become —
   `SiteHeader` uses the same dimmed-disc trick so its row does not
   reflow when the account arrives — and it makes no claim at all.

   `unreachable` renders NOTHING for the same reason: a dropped
   connection is not evidence about who the reader is, and offering
   sign-in to somebody who IS signed in is the wrong sentence with
   a working link under it.
   ============================================================ */

import Link from "next/link";

import { SignInButtons } from "@/components/auth/SignInButtons";
import { useUploadSession } from "@/components/upload/session";

export function HeroAction() {
  const session = useUploadSession();

  if (session.state === "loading") {
    /* Same height as the button row below, so the fold does not jump when the answer
       arrives. `aria-hidden` because there is nothing here to act on yet. */
    return <div aria-hidden className="h-[46px] w-full animate-pulse rounded-md bg-surface-2/60" />;
  }

  if (session.state === "unreachable") return null;

  if (session.state === "ready") {
    return (
      <p className="text-lg leading-relaxed text-fg">
        Welcome, <span className="font-medium text-cyan">{session.handle}</span>.
      </p>
    );
  }

  if (session.state === "no-handle") {
    /* Signed in, sign-up unfinished (T050 AC1). There is no name to greet with yet, and
       greeting an account by a handle it has not chosen would be inventing one — so this
       state says what is missing and links to the one route that asks for it. */
    return (
      <p className="text-lg leading-relaxed text-fg">
        You are signed in.{" "}
        <Link
          href="/welcome"
          className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
        >
          Choose a handle
        </Link>{" "}
        to finish.
      </p>
    );
  }

  return <SignInButtons size="lg" />;
}
