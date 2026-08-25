import Link from "next/link";
import type { Metadata } from "next";

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, getAccount } from "@/lib/server/accounts";
import { getProfile } from "@/lib/server/profiles";
import { latestCards } from "@/lib/server/registry";
import { blueprints } from "@/lib/server/registry";
import { monthYear } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/Button";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
import { SectionNote, SettingsSection } from "@/components/settings/controls";
import { AccountForm } from "@/components/settings/AccountForm";
import { readSession } from "@/components/profile/session";
import { profileHref } from "@/components/profile/author";
import { SignInButtons } from "@/components/auth/SignInButtons";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-43 LIVE: GET /api/account, read in-process here rather than over HTTP.
// SEAM-52 / SEAM-111 LIVE: the authored counts, off `@/lib/server/profiles` and
//   `@/lib/server/registry` rather than a per-handle counts endpoint.
// SEAM-45, SEAM-46, SEAM-48 LIVE: see `components/settings/AccountForm.tsx`.
// SEAM-47 PLANNED: PATCH /api/account/notifications — no column holds one (T190).
// SEAM-49 PLANNED: GET /api/account/validator — needs a ballot (T160).
// SEAM-50 PLANNED: DELETE /api/account — no route deletes an account.
// SEAM-51 PLANNED: POST /api/bundles/{owner}/{slug}/transfer — no route moves ownership.

/* ============================================================
   /settings — what the registry knows about you.

   Six sections on the documentation rail, in the register the
   Learn pages and the two detail pages already use.

   ── THE ONE THING TO UNDERSTAND BEFORE EDITING THIS FILE ──
   There IS an account now, and this file used to open by saying
   there was not. Every value below is a row in `account`, read per
   request for the reader who asked, and `Save changes` writes it.

   That inverts the rule this file was built around, but it does not
   retire it — it moves the line. **A control is enabled when a
   route exists for it and disabled when its only effect would be to
   save something nothing stores**, and it says which of the two it
   is either way. Never both enabled and inert, never both disabled
   and functional (AC2). Enabling everything passes a naive "nothing
   is disabled" check and fails that one.

   Doc 2 §0.4 and this project's two HIGH findings are still about
   the same failure — a surface that looks like it works — and a
   settings form is still the worst possible place for it. What
   changed is which controls are on the wrong side of it: three, not
   all of them.

   ── The three that would not save even now ──
   §03's notification switches have no column (`AccountRecord`
   carries no `notifications` member) and §06's two actions have no
   route. They stay on the page, disabled, each naming what is
   actually missing rather than the page's old blanket reason —
   "no account to delete" became false the day accounts landed, and
   D-78 asks whether the CLAIM is still true, not whether the
   control still works.

   §05 validator status is a split: the badge and the weight are
   real reads off `AccountRecord` and their `◐` is gone, while
   "validator voting is not built" is still true and stays.

   An Appearance section stood at §06 and is deleted — see the note
   where it was. Nothing in it was a setting. The honesty strip went
   on naming it for weeks after it left; that is fixed here too.
   ============================================================ */

export const metadata: Metadata = {
  title: "Settings",
  description:
    "What the registry knows about you, and what it will never keep. Your profile, handle, email and default visibility are stored; notifications and validator voting are not built yet.",
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
    href: "#validator-status",
    label: "Validator status",
    step: "05",
  },
  {
    href: "#danger-zone",
    label: "Danger zone",
    step: "06",
    tone: "signal",
  },
];

/** One row of §06: a description, and the control that would carry it out. */
function DangerRow({
  title,
  children,
  action,
  why,
}: {
  title: string;
  children: React.ReactNode;
  action: string;
  /** Why the button is off. Printed rather than left in a `title` attribute. */
  why: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-md border border-line bg-surface p-4">
      <div className="flex min-w-[280px] flex-1 flex-col gap-1">
        <span className="text-sm text-fg">{title}</span>
        <span className="text-[13px] leading-relaxed text-muted">{children}</span>
      </div>
      <div className="flex flex-col items-end gap-2">
        {/* The `!` is load-bearing, not shorthand. `outline` carries
            `hoverable:hover:border-cyan hoverable:hover:text-cyan`, and `:hover` still
            matches a disabled button — so without `!important` this destructive control
            would turn the interactive colour under the pointer. */}
        <Button variant="outline" disabled className="border-signal/50! text-signal!">
          {action}
        </Button>
        <span className="font-mono text-[11px] text-dim">{why}</span>
      </div>
    </div>
  );
}

/** What a reader who is not signed in gets, in place of somebody else's account. */
function SignedOut() {
  return (
    <div className="container-page flex flex-col gap-8 py-16">
      <SectionHeading
        as="h1"
        eyebrow="Account"
        title="Settings"
        lead="What the registry knows about you, and what it will never keep."
      />
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface-2/50 px-6 py-6">
        <p className="text-[15px] leading-relaxed text-muted">
          This page is your account, so it needs to know who you are. Sign in with GitHub
          and it opens on your own profile, handle, email and default visibility.
        </p>
        <SignInButtons />
        <p className="font-mono text-[11px] leading-relaxed text-dim">
          DarkPrint reads your GitHub handle and nothing else. Everything you publish here
          stays here.
        </p>
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
  const published = (await blueprints(db, actor)).length;

  return (
    <SideRail
      label="Settings"
      items={SETTINGS_SECTIONS}
      ariaLabel="Settings sections"
      /* The one caller that takes the compact list. Six sections, no footer sequence, and
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
          lead="What the registry knows about you, and what it will never keep."
        />

        {/* The honesty strip, narrowed to what is still true.
            ------------------------------------------------------------
            It used to say nothing on this page was stored, that every value was a row in
            `lib/data/account.ts`, and that Save was switched off. All three became false
            together, so all three came off (D-78). What replaced them is the same kind of
            statement about the same page: which controls write, and which two are still
            waiting on something nobody has built.

            It also named `appearance` as a section that "stays in this browser". §06
            Appearance was deleted on the author's instruction well before this cutover —
            see the note where it stood — so the strip has been naming a section that is
            not on the page. Fixed here rather than quietly: a reader who went looking for
            it found nothing, twice over. */}
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label">What saves</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald">
              ✓ stored
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            Your profile, handle, email and default visibility are stored on your account
            and <span className="text-fg">Save changes</span> writes them. Two things here
            still do not save, and both say so in their own head:{" "}
            <span className="text-fg">notifications</span>, which nothing stores and which
            send no mail, and <span className="text-fg">validator status</span>, which
            needs a ballot nobody has built. The{" "}
            <span className="text-fg">danger zone</span>&rsquo;s two actions have no route
            behind them yet and are switched off rather than quietly doing nothing.
          </p>
        </div>

        <AccountForm
          account={account}
          counts={
            <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="label">Authored under this handle</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald">
                  ✓ counted
                </span>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[13px] text-muted">
                <span>
                  {profile?.counts.blueprints ?? 0} blueprint
                  {(profile?.counts.blueprints ?? 0) === 1 ? "" : "s"}
                </span>
                <span>
                  {cards} node card{cards === 1 ? "" : "s"}
                </span>
                <span>
                  {profile?.counts.terms ?? 0} vocabulary term
                  {(profile?.counts.terms ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted">
                Counted from the registry when this page was asked for. A published card
                carries the handle inside its own bytes, which is why the old one stays
                reserved.
              </p>
            </div>
          }
        >
          {/* ---------- 05 ---------- */}
          <SettingsSection
            id="validator-status"
            className="scroll-mt-24"
            step="05"
            title="Validator status"
            tone="amber"
            note={<ComingSoonBadge />}
          >
            <div className="flex flex-col gap-4">
              {/* The badge and the weight are real reads off `AccountRecord`, so the `◐`
                  that stood over them is gone. The paragraph under them has not moved: the
                  ballot is T160 and is not built, so the three community metrics on every
                  scorecard are still seeded. Two claims, one section, opposite directions
                  (D-262-15). */}
              <div className="flex flex-wrap items-center gap-5">
                {account.author.validator ? (
                  <Badge
                    color="var(--color-cyan)"
                    className="border-cyan/40! bg-cyan/10! text-cyan!"
                  >
                    ✦ Validator
                  </Badge>
                ) : (
                  <Badge color="var(--color-dim)">Not a validator</Badge>
                )}
                <span className="font-mono text-[11px] text-dim">
                  {account.validatorSince === undefined
                    ? "not granted"
                    : `granted ${monthYear(account.validatorSince.toISOString())}`}{" "}
                  · weight ×{account.validatorWeight} on community metrics
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted">
                The status above is your account&rsquo;s. What it does not do yet is
                anything: validator voting is not built, so the three community metrics on
                every scorecard are seeded and this weight carries nothing over anyone
                else&rsquo;s reading.
              </p>
            </div>
          </SettingsSection>

          {/* §06 Appearance stood here and is deleted on the author's instruction.
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
              where it is honoured. */}

          {/* ---------- 06 ---------- */}
          <SettingsSection
            id="danger-zone"
            className="scroll-mt-24"
            step="06"
            title="Danger zone"
            tone="signal"
            note={<SectionNote tone="signal">irreversible</SectionNote>}
          >
            <div className="flex flex-col gap-3">
              {/* Both reasons are REWRITTEN, not deleted, and the distinction is D-78's.
                  They read "no account to delete" and "no ownership to move", and both
                  became false the day accounts and ownership landed — there is an account
                  and there is ownership; what is missing is the route. The limitation
                  genuinely survives, so the control stays off and only its reason moves
                  (D-262-15). */}
              <DangerRow
                title="Delete account"
                action="Delete account"
                why="no route deletes an account yet"
              >
                Your handle is reserved, your private bundles are destroyed, and everything
                you published stays. A pinned card cannot be withdrawn: {published} bundles
                in the registry would stop resolving.
              </DangerRow>
              <DangerRow
                title="Transfer a blueprint"
                action="Transfer"
                why="no route moves ownership yet"
              >
                Hand ownership to another handle. The digest does not change, because the
                bundle is the same bytes. Only the author line moves.
              </DangerRow>
            </div>
          </SettingsSection>
        </AccountForm>
      </div>
    </SideRail>
  );
}
