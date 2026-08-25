import type { Metadata } from "next";
import Link from "next/link";

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, getAccount } from "@/lib/server/accounts";
import { SignInButtons } from "@/components/auth/SignInButtons";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { CreateBundleForm } from "@/components/upload/CreateBundleForm";
import { readSession } from "@/components/profile/session";

/* ============================================================
   /new — the GitHub-style "Create repository" verb for a blueprint.

   T280 0007_drafts made a bundle a row before it has a release: a title, a slug and a
   visibility, with the graph and its cards to follow on `/upload`. This route is the door
   to that row. `POST /api/bundles/draft` is the write (`components/upload/
   CreateBundleForm.tsx`); this file is the gate in front of it and the account read the
   form's starting visibility comes from.

   ── Server-rendered per request, by construction ──
   `readSession` reads `next/headers`' cookies, which opts this route into dynamic
   rendering on its own — the same mechanism `/welcome` and the profile routes rely on,
   and the reason neither declares `force-dynamic` beside it.

   ── Three states, not one ──
   No session: there is nothing to create into, so the reader is shown the door in rather
   than a form that would 401 the moment it is submitted. A session with `handle: null`
   (T050 AC1: signed in, sign-up unfinished) cannot name an owner either — `draft` resolves
   the owner from the handle — so that reader is sent to finish the one field that is
   missing rather than shown a form that cannot work. Only a complete session sees the form.
   ============================================================ */

export const metadata: Metadata = {
  title: "Create a blueprint",
  description:
    "Reserve a slug under your account and choose who can see it. The graph and its cards come next, on the upload step.",
};

function SignedOut() {
  return (
    <div className="mt-10 flex flex-col gap-5 rounded-xl border border-line bg-surface-2/50 px-6 py-7 sm:max-w-md">
      <p className="text-sm leading-relaxed text-muted">
        A blueprint is created under your account, so DarkPrint needs to know who you are
        first.
      </p>
      <SignInButtons />
    </div>
  );
}

function HandleRequired() {
  return (
    <div className="mt-10 flex flex-col gap-3 rounded-xl border border-line bg-surface-2/50 px-6 py-7 sm:max-w-md">
      <p className="text-sm leading-relaxed text-muted">
        Your account has not chosen the handle a blueprint is published under yet, and a
        new one is stored beneath it.
      </p>
      <Link
        href="/welcome"
        className="w-fit text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
      >
        Finish signing up →
      </Link>
    </div>
  );
}

export default async function NewBundlePage() {
  const session = await readSession();

  const header = (
    <header>
      <Eyebrow>New</Eyebrow>
      <SectionHeading
        as="h1"
        className="mt-3"
        title="Create a blueprint"
        lead="Reserve a slug under your handle and choose who can see it. The graph and its cards come next, on the upload step."
      />
    </header>
  );

  if (session === undefined) {
    return (
      <div className="container-page py-12">
        {header}
        <SignedOut />
      </div>
    );
  }

  if (session.handle === null) {
    return (
      <div className="container-page py-12">
        {header}
        <HandleRequired />
      </div>
    );
  }

  /* The account's own default (D-100-01's rule, read here the same way `POST
     /api/bundles/draft` reads it): a reader whose account is set to private must see that
     reflected in the form's starting choice, not a route-level constant. */
  const { db } = getSharedDbClient();
  const account = await getAccount(db, actorFrom(session), session.accountId);
  const defaultVisibility = account?.defaultVisibility ?? "private";

  return (
    <div className="container-page py-12">
      {header}
      <div className="mt-10">
        <CreateBundleForm ownerHandle={session.handle} defaultVisibility={defaultVisibility} />
      </div>
    </div>
  );
}
