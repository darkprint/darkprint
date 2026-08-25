import { ProfileHeader } from "./ProfileHeader";
import { ProfileTabs } from "./ProfileTabs";
import type { ProfileView } from "./load";
import type { ProfileTabId } from "./tabs";

/**
 * What is real on the owner view, said once, above it.
 *
 * ── What this notice used to say, and why it could not stay ──
 * *"There is no sign-in. This is the owner view because `lib/data/account.ts` seeds this
 * handle as the signed-in account, and every profile on the site is prerendered the same
 * way."* Every clause of that became false at once: there is a sign-in, this is the owner
 * view because the reader's own session names this handle, and these routes are
 * request-time. The reason it was there — a reader finding Publish buttons and a private
 * list has every reason to think they are signed in as somebody — is not a reason any
 * more, because they are.
 *
 * **T280: re-derived clause by clause, not just narrowed again.** The pass that first
 * narrowed this (D-78, D-262-09) still called every community figure seeded. That is no
 * longer true of all of them: `0004_social` and `0007_drafts` gave watchers, support,
 * validated, downloads and stars each a real count (`components/profile/load.ts`'s own
 * header has the ledger). What is left unwired is narrower and different in kind — no mail
 * ever leaves this account, and no run pipeline instruments an actual execution behind the
 * self-reported cost a run report carries — so the badge and the marker come off, and the
 * one true residual sentence takes their place.
 */
function OwnerNotice() {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-line bg-surface-2/50 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="label">What is real here</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald">
          ✓ counted
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        This is your profile because your session names this handle. Your identity, your
        join date and your saved list are real, and so is everything counted on this page
        now: the published blueprints, the node cards and the vocabulary terms, and the
        watchers, support, validated, downloads and stars beside them. Two things are
        still absent: no notification mail goes out yet, and no run pipeline measures an
        actual execution behind a submitted run report&rsquo;s own numbers.
      </p>
    </div>
  );
}

/**
 * The chrome every profile tab shares: the honesty strip, the header, the tab strip.
 *
 * A component rather than a Next layout, deliberately. A layout at `app/u/[username]`
 * would also wrap `/u/[username]/[slug]`, which is a bundle page and has a header of its
 * own, so the profile chrome would appear above a page that is not a profile.
 */
export function ProfileShell({
  view,
  active,
  children,
}: {
  view: ProfileView;
  active: ProfileTabId;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page py-10 lg:py-12">
      {view.owner && <OwnerNotice />}

      <ProfileHeader
        author={view.author}
        blueprints={view.blueprints.length}
        cards={view.cards.length}
        /* T280: every one of these five is `ProfileView`'s own field now, computed in
           `load.ts` off `getProfile` (watchers, support, validated) and `getSignalsMany`
           (downloads, stars) — no fold over a seeded fixture left to run here. */
        downloads={view.downloads}
        stars={view.stars}
        validated={view.validated}
        joinedAt={view.joinedAt.toISOString()}
        watchers={view.watchers}
        support={view.support}
        owner={view.owner}
        viewerSignedIn={view.viewerSignedIn}
      />

      <ProfileTabs
        username={view.author.username}
        active={active}
        counts={view.counts}
        owner={view.owner}
        note={view.owner ? undefined : "Private blueprints and cards are not listed here"}
      />

      {children}
    </div>
  );
}
