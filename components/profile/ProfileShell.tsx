import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileTabs } from "./ProfileTabs";
import type { ProfileView } from "./load";
import type { ProfileTabId } from "./tabs";

/**
 * What the owner view is, said once, above it.
 *
 * The owner view is the one fiction on this route: there is no sign-in, so "your profile"
 * means "the handle `lib/data/account.ts` happens to name". A reader who lands on
 * `/u/mara-veil` and finds Publish buttons and a private list has every reason to think
 * they are signed in as somebody, and nothing else on the page would tell them otherwise.
 *
 * Two markers because there are two different claims: the values are seeded rows, and the
 * thing that would make them real is not built.
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
        There is no sign-in. This is the owner view because{" "}
        <span className="font-mono text-fg">lib/data/account.ts</span> seeds this handle as
        the signed-in account, and every profile on the site is prerendered the same way.
        What is counted here is what the archive holds: the published blueprints, the node
        cards and the vocabulary terms. What is seeded is everything an account would have
        stored, and nothing on this page writes anything back.
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
        joinedAt={view.profile.joinedAt}
        watchers={view.profile.watchers}
        support={view.profile.support}
        owner={view.owner}
      />

      <ProfileTabs
        username={view.author.username}
        active={active}
        counts={view.counts}
        owner={view.owner}
        note={view.owner ? undefined : "Private blueprints are not listed here"}
      />

      {children}
    </div>
  );
}
