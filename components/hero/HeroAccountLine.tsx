"use client";

/* ============================================================
   The line under the hero's claim, per reader.

   Read in the browser because `/` must stay prerendered for every visitor, the same way
   `SiteHeader` reads it through `useUploadSession`. The loading and unreachable states say
   nothing, because neither is evidence about who the reader is.
   ============================================================ */

import Link from "next/link";

import { profileHref } from "@/components/profile/author";
import { useUploadSession } from "@/components/upload/session";

const LINK =
  "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan";

export function HeroAccountLine() {
  const session = useUploadSession();

  if (session.state === "loading") {
    /* One line of `text-sm` high, so the cue under it does not move when the answer lands. */
    return <div aria-hidden className="h-5 w-64 max-w-full animate-pulse rounded bg-surface-2/60" />;
  }

  if (session.state === "unreachable") return null;

  if (session.state === "ready") {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Welcome back,{" "}
        <Link href={profileHref(session.handle) ?? "/settings"} className={LINK}>
          {session.handle}
        </Link>
        .
      </p>
    );
  }

  if (session.state === "no-handle") {
    return (
      <p className="text-sm leading-relaxed text-muted">
        You are signed in.{" "}
        <Link href="/welcome" className={LINK}>
          Choose a handle
        </Link>{" "}
        to finish.
      </p>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-muted">
      <Link href="/welcome" className={LINK}>
        Sign in
      </Link>{" "}
      to publish your own blueprints, public or private.
    </p>
  );
}
