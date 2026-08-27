import { DraftLanding } from "darkprint";

/* Real seeded people, lib/data/users.ts. */
const mara = {
  username: "mara-veil",
  displayName: "Mara Veiga",
  avatarHue: 268,
  validator: true,
  bio: "Orchestration researcher. Builds closed-loop agent lines and breaks them for a living.",
};

const orin = {
  username: "orin",
  displayName: "Orin Vasquez",
  avatarHue: 208,
  validator: false,
  bio: "Turning natural-language goals into runnable blueprints for non-technical teams.",
};

/** The owner's own draft, quick setup open: a name and nothing released under it yet. */
export const OwnerDraft = () => (
  <DraftLanding
    draft={{
      ownerHandle: "mara-veil",
      slug: "incident-commander-draft",
      visibility: "private",
      title: "Incident Commander, next",
      summary:
        "Unfinished: two nodes have no card in the bundle, so it will not resolve and cannot publish.",
      createdAt: "2026-06-30T00:00:00.000Z",
    }}
    owner={mara}
    isOwner
    visibilityApi="/api/bundles/mara-veil/incident-commander-draft/visibility"
  />
);

/** A visitor's read of somebody else's draft: no title chosen yet, no owner controls. */
export const VisitorDraft = () => (
  <DraftLanding
    draft={{
      ownerHandle: "orin",
      slug: "warehouse-nightly-sync",
      visibility: "public",
      createdAt: "2026-08-02T00:00:00.000Z",
    }}
    owner={orin}
    isOwner={false}
  />
);
