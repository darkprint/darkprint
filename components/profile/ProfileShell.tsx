import { ProfileHeader } from "./ProfileHeader";
import { ProfileTabs } from "./ProfileTabs";
import type { ProfileView } from "./load";
import type { ProfileTabId } from "./tabs";

/* The owner notice stood here: a `✓ counted` badge over a paragraph naming what was
   real on this page. It came off on the owner's instruction (2026-08-25) — once every
   figure IS a count, a strip saying so is chrome explaining itself. The two residual
   absences it also carried are unchanged and stated where they belong: no notification
   mail on /settings, no instrumented run behind a self-reported cost on
   /reading-the-radar. If a figure on this page ever goes back to standing for nothing,
   the disclosure comes back with it. */

/**
 * The chrome every profile tab shares: the header and the tab strip.
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
      <ProfileHeader
        author={view.author}
        /* The COUNTS, not the archive-derived lists. `view.blueprints`/`view.cards` are
           what `content/` carries for this handle, which is zero for every account that
           did not author the seed archive — so the header read 0 while the tab strip two
           rows below read the live registry's 10. One number, one source: `view.counts`
           is what `ProfileTabs` renders, and it is actor-scoped (the owner's private half
           included, a visitor's not). */
        blueprints={view.counts.blueprints ?? 0}
        cards={view.counts.cards ?? 0}
        /* T280: each of these is `ProfileView`'s own field now, computed in `load.ts` off
           `getProfile` (watchers, support) and `getSignalsMany` (stars) — no fold over a
           seeded fixture left to run here.

           `downloads` and `validated` are NOT passed any more. The owner cut them from the
           header on 2026-09-06 ("just show the number of blueprints, cards and stars"), and
           a prop nothing renders is a prop that goes stale silently. Both are still computed
           and still on `ProfileView`, so nothing upstream was torn out to satisfy a layout
           change and a later surface can read them without re-deriving anything. */
        stars={view.stars}
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
