import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
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
 * **So the notice is narrowed rather than deleted (D-78, D-262-09).** What is left is the
 * half that is still true: several figures on this page have no backend behind them, and a
 * reader looking at their own profile should be told which. Retiring a claim is not the
 * same act as deleting it, and where a sentence is still true in a narrower sense the true
 * half survives.
 */
function OwnerNotice() {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-line bg-surface-2/50 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="label">What is real here</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
          ◐ seeded
        </span>
        <ComingSoonBadge />
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        This is your profile because your session names this handle. Your identity, your
        join date and your saved list are real. What is counted is what the archive holds:
        the published blueprints, the node cards and the vocabulary terms. Every community
        figure here is still seeded, watchers and support and validated and downloads and
        stars alike, because nothing counts them yet: there is no telemetry, no ballot and
        no verified run report.
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
  /* Summed here rather than carried on `ProfileView`: it is a fold over the same
     `blueprints` and `cards` lists every tab already has, not a fact the loader needs to
     know to answer any other question, and `ProfileHeader` is the one place either is
     read. Both folds run over the PUBLIC lists only (`view.blueprints`/`view.cards`, not
     `owned`/`ownedCards`): a private row has never been seen by anyone else, so it
     contributes no stars by construction, and every private card's own support is seeded
     at `0` for exactly that reason — so including it would add nothing anyway.

     Both figures are still seeded and both keep their marker: `downloads` and `votes` come
     off the archive's own fixtures and `support` off `starsFor`, and no counter has run
     for any of them — `lib/server/counters` exists but `app/api/signals/**` does not
     (D-262-07). */
  const downloads = view.blueprints.reduce((n, b) => n + b.downloads, 0);
  const stars =
    view.blueprints.reduce((n, b) => n + b.votes, 0) +
    view.cards.reduce((n, c) => n + c.support, 0);

  return (
    <div className="container-page py-10 lg:py-12">
      {view.owner && <OwnerNotice />}

      <ProfileHeader
        author={view.author}
        blueprints={view.blueprints.length}
        cards={view.cards.length}
        downloads={downloads}
        stars={stars}
        validated={view.profile.validated}
        /* `view.joinedAt`, not `view.profile.joinedAt`: this is the account's own
           `created_at` now, off `getProfile`, and it is the one figure that has left the
           seeded four. The fixture's date is still in `view.profile` and is not read. */
        joinedAt={view.joinedAt.toISOString()}
        watchers={view.profile.watchers}
        support={view.profile.support}
        owner={view.owner}
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
