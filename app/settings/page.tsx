import Link from "next/link";
import type { Metadata } from "next";

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, getAccount } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { getPreferences } from "@/lib/server/notifications";
import { getProfile } from "@/lib/server/profiles";
import { latestCards, ownedBundles } from "@/lib/server/registry";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
import { SectionNote, SettingsSection } from "@/components/settings/controls";
import { AccountForm } from "@/components/settings/AccountForm";
import { ApiKeys } from "@/components/settings/ApiKeys";
import { DangerZone, type TransferableBundle } from "@/components/settings/DangerZone";
import { readSession } from "@/components/profile/session";
import { profileHref } from "@/components/profile/author";
import { SIGN_IN_PRIVACY_NOTE, SignInButtons } from "@/components/auth/SignInButtons";

/* ============================================================
   /settings — what the registry knows about you.

   Seven sections on the documentation rail, in the register the
   Learn pages and the two detail pages already use.

   ── THE ONE THING TO UNDERSTAND BEFORE EDITING THIS FILE ──
   There IS an account now, and every value below is a row in
   `account`, read per request for the reader who asked. Three
   surfaces write it: `Save changes` (§01-§04), a switch's own
   request (§06, minting and revoking a key), and a confirm step's
   own request (§07, deleting or transferring). **A control is
   enabled when a route exists for it and disabled when its only
   effect would be to save something nothing stores**, and it says
   which of the two it is either way. Never both enabled and inert,
   never both disabled and functional (AC2). Enabling everything
   passes a naive "nothing is disabled" check and fails that one.

   ── What T280 moved, and what it did not ──
   Three surfaces were still on the wrong side of AC2 going into this
   wave: §03's notification switches (no route wired), §06 API keys
   (did not exist), and what is now §07 Danger zone (routes existed
   since T120, never wired here). All three are live now — see
   `components/settings/AccountForm.tsx`, `ApiKeys.tsx` and
   `DangerZone.tsx`.

   What did NOT move: mail delivery. §03's switches save for real,
   and nothing sends because of them — `NotificationDelivery` is a
   published interface with no implementation. §05 validator status
   stays read-only, and Q14 took away the thing it used to be
   read-only ABOUT: the ballot route and its write path are gone, so
   the badge is a label the registry grants rather than a lever on
   any number.

   An Appearance section stood at §06 and was deleted before this
   wave — see the note that used to explain it, now gone with it: it
   drew three cards about how the interface already behaves, and a
   settings page is for settings.
   ============================================================ */

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Your DarkPrint account: public profile, handle, email, default visibility for new blueprints, notification preferences (no mail goes out yet) and API keys. Sign in to open it.",
};

/**
 * The rail, matching the section list one for one.
 *
 * Every `href` and every `:target` mark is a literal, for the two reasons the node page's
 * rail records: `components/site/anchors.test.ts` reads `href: "#…"` out of a table like
 * this one, and Tailwind only compiles a class it can see spelled out. A mark built from
 * `href` would produce a highlight that never ships.
 *
 * No `active`. There is no scroll spy here, so the rail claims a position only once a
 * reader has chosen one — `:target` is exactly that fact, and it costs no JavaScript.
 */
const SETTINGS_SECTIONS: readonly SideRailItem[] = [
  {
    href: "#public-profile",
    label: "Public profile",
    step: "01",
  },
  {
    href: "#account-handle",
    label: "Account & handle",
    step: "02",
  },
  {
    href: "#notifications",
    label: "Email & notifications",
    step: "03",
  },
  {
    href: "#default-visibility",
    label: "Default visibility",
    step: "04",
  },
  {
    href: "#api-keys",
    label: "API keys",
    step: "05",
  },
  {
    href: "#danger-zone",
    label: "Danger zone",
    step: "06",
    tone: "signal",
  },
];

/** What a reader who is not signed in gets, in place of somebody else's account. */
function SignedOut() {
  return (
    <div className="container-page flex flex-col gap-8 py-16">
      <SectionHeading
        as="h1"
        eyebrow="Account"
        title="Settings"
        lead="What DarkPrint stores about your account, and what each setting changes."
      />
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface-2/50 px-6 py-6">
        <p className="text-[15px] leading-relaxed text-muted">
          Settings belong to an account, so sign in first. The page then shows your
          profile, handle, email, default visibility and API keys.
        </p>
        <SignInButtons />
        <p className="font-mono text-[11px] leading-relaxed text-dim">{SIGN_IN_PRIVACY_NOTE}</p>
      </div>
    </div>
  );
}

export default async function Page() {
  /* Per-request, which is what `readSession` costs and buys: this route renders a
     different page for every reader, so it cannot be prerendered and does not try. */
  const session = await readSession();
  if (session === undefined) return <SignedOut />;

  const { db } = getSharedDbClient();
  const actor = actorFrom(session);
  const account = await getAccount(db, actor, session.accountId);
  /* A cookie that verifies against an account row that is gone — deleted, or a database
     restored under a session that outlived it. The signed-out page is the honest answer:
     there is nothing to show and the sign-in re-establishes both halves. */
  if (account === undefined) return <SignedOut />;

  const handle = account.author.handle;

  /* Counted, not seeded, and marked `✓ counted` where it renders. What a handle has
     authored is a registry fact — `/u/[username]` counts the same figures the same way —
     and seeding a number the registry can count is how the two markers stop meaning
     anything.

     `getProfile` answers blueprints and terms; the card figure has no published counter,
     because D-130-04 removed `counts.cards` from `ProfileRecord` rather than let this task
     re-implement T080's visibility filter against `card_version`. Counting the actor's own
     visible cards by their AUTHOR field is a different question and the one this section
     asks — its heading is "Authored under this handle" — so the filter runs over a list
     T080 has already narrowed rather than beside it.

     A handle-less account has authored nothing under a handle it does not have, so the
     three figures are zero without a query. */
  const profile = handle === null ? undefined : await getProfile(db, actor, handle);
  const cards =
    handle === null
      ? 0
      : (await latestCards(db, actor)).filter((card) => card.card.author === handle).length;

  /* §03's four switches: the account's own stored preferences, filled from the published
     default for any key its row has never written (`getPreferences`, T190). */
  const preferences = await getPreferences(db, actor, session.accountId);

  /* §07's Transfer picker: every bundle this account owns, joined against `getBundle` for the
     id `POST /api/transfer` addresses by. `ownedBundles` is keyed by handle and serves the
     profile shelf, which never needs a bundle id — so a handle-less account (T050 AC1) has
     nothing to look it up by, and simply owns nothing transferable until it has one. */
  const transferable: TransferableBundle[] =
    handle === null
      ? []
      : (
          await Promise.all(
            (await ownedBundles(db, actor, handle)).map(async (row) => {
              const bundle = await getBundle(db, account.accountId, row.slug);
              if (bundle === undefined) return undefined;
              const option: TransferableBundle = {
                bundleId: bundle.id,
                slug: row.slug,
                visibility: row.visibility,
              };
              if (row.title !== undefined) option.title = row.title;
              return option;
            }),
          )
        ).filter((option): option is TransferableBundle => option !== undefined);

  return (
    <SideRail
      label="Settings"
      items={SETTINGS_SECTIONS}
      ariaLabel="Settings sections"
      /* The one caller that takes the compact list. Seven sections, no footer sequence, and
         below `xl` the rail is not drawn at all — see `SideRail`'s own note. */
      compact
      footer={
        /* Omitted rather than pointed at `/u/null`: an account can be signed in with no
           handle yet (T050 AC1), and there is no profile to go back to until §02 has one.
           `profileHref` is what makes that the only available answer. */
        profileHref(handle) === undefined ? undefined : (
          <Link
            href={profileHref(handle) as string}
            className="font-mono text-[11px] text-dim transition-colors hoverable:hover:text-cyan"
          >
            ← Back to your profile
          </Link>
        )
      }
    >
      <div className="container-page flex flex-col gap-10 py-10 lg:py-12">
        <SectionHeading
          as="h1"
          eyebrow="Account"
          title="Settings"
          lead="What DarkPrint stores about your account, and what each setting changes."
        />

        {/* The "What saves" strip stood here and came off on the owner's instruction
            (2026-08-26). It summarised, at the top of the page, what each section below
            already says for itself. The one clause with nothing behind it either way —
            no mailer exists, so a preference saves and no mail goes out regardless — is
            NOT lost with it: §03 carries it in its own copy and in its `◐ no mail sends`
            note, which is where a reader meets the switches it qualifies. */}

        <AccountForm
          account={account}
          notifications={preferences}
          counts={
            <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-4">
              {/* The `✓ counted` marker beside this heading came off on the owner's
                  instruction (2026-08-25): once every figure here is a real count, a
                  badge saying so is noise on a number nobody doubts. */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="label">Authored under this handle</span>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[13px] text-muted">
                <span>
                  {profile?.counts.blueprints ?? 0} blueprint
                  {(profile?.counts.blueprints ?? 0) === 1 ? "" : "s"}
                </span>
                <span>
                  {cards} card{cards === 1 ? "" : "s"}
                </span>
                <span>
                  {profile?.counts.terms ?? 0} ontology term
                  {(profile?.counts.terms ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted">
                Counted from the registry each time this page loads.
              </p>
            </div>
          }
        >
          {/* §05 Validator status stood here and is deleted on the owner's instruction,
              2026-09-06: "remove 05 · Validator status in the user settings".

              It drew the account's validator badge, the grant date, and a paragraph saying
              the badge is all it is now — the weight beside it multiplied nothing once the
              ballot was deleted (Q14). So the section had already been reduced to a status
              a reader could not act on and a sentence explaining that.

              NOTHING ELSE MOVED. `account.author.validator` and `account.validatorSince` are
              still read and still stored, and the `✦ validator` mark still renders beside a
              handle where the profile draws it. What went is the settings VIEW of it, which
              was read-only by its own note. The steps below renumbered rather than leaving a
              gap: these are positions in a sequence a reader counts, not stable ids. */}

          {/* §06 Appearance stood here once and is deleted on the author's instruction.
              ------------------------------------------------------------
              It drew three cards — the dark ground, the cyanotype register and reduced
              motion — and none of them was a setting. The site has one theme, the blueprint
              register is opted into per section by the pages that use it, and reduced motion
              is the browser's answer rather than this page's. So the panel was three
              statements about how the interface already behaves, sitting in a list of things
              a reader came here to change. Removed rather than reworded: a settings page is
              for settings.

              The two sentences it carried that were worth keeping are already elsewhere —
              `app/globals.css` documents both poles, and the reduced-motion rule is written
              where it is honoured. §06 is API keys now, new at T280 — a different section
              entirely, which happens to reuse the number Appearance left open. */}

          {/* ---------- 06 ---------- */}
          <SettingsSection
            id="api-keys"
            className="scroll-mt-24"
            step="05"
            title="API keys"
            note={<SectionNote>applies immediately</SectionNote>}
          >
            <ApiKeys />
          </SettingsSection>

          {/* ---------- 07 ---------- */}
          <SettingsSection
            id="danger-zone"
            className="scroll-mt-24"
            step="06"
            title="Danger zone"
            tone="signal"
            note={<SectionNote tone="signal">irreversible</SectionNote>}
          >
            <DangerZone handle={handle} transferable={transferable} />
          </SettingsSection>
        </AccountForm>
      </div>
    </SideRail>
  );
}
