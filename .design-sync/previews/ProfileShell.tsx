import { Pinned, ProfileShell } from "darkprint";
import { getNodeCard } from "@/lib/content";
import type { ProfileView } from "@/components/profile/load";

/**
 * `ProfileShell` is the chrome every profile tab shares (`app/u/[username]/page.tsx`):
 * the header and the tab strip, with the tab's own content passed as `children`. The
 * pinned card below is the real `code-builder@1.0.0` off the archive, in the same
 * `Pinned` shelf the blueprints tab renders it in.
 */
const nodeCard = getNodeCard("code-builder", "1.0.0");
if (nodeCard === undefined) throw new Error("code-builder@1.0.0 fixture is missing from the content shim");

const view: ProfileView = {
  author: { username: "orin", displayName: "orin", avatarHue: 210, validator: true, bio: "Builds dark factories." },
  owner: true,
  viewerSignedIn: true,
  joinedAt: new Date("2026-06-01T00:00:00Z"),
  blueprints: [],
  cards: [],
  terms: [],
  owned: [],
  ownedCards: [],
  saves: [],
  pinned: [
    {
      kind: "node",
      record: {
        ref: nodeCard.ref,
        id: nodeCard.id,
        version: nodeCard.version,
        digest: nodeCard.digest,
        card: nodeCard.card,
        usedIn: nodeCard.usedIn,
      },
      typeLabel: "Agent",
      usedIn: nodeCard.usedIn.length,
      support: 12,
    },
  ],
  counts: { blueprints: 3, cards: 7, saved: 2, terms: 1 },
  watchers: 9,
  support: 21,
  validated: 4,
  downloads: 214,
  stars: 38,
};

/** The owner's own view of their blueprints tab, pinned card and all. */
export const OwnerBlueprintsTab = () => (
  <ProfileShell view={view} active="blueprints">
    <section className="mt-10 flex flex-col gap-5">
      <Pinned items={view.pinned} />
    </section>
  </ProfileShell>
);
