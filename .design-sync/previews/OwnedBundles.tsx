import { OwnedBundles } from "darkprint";

/* Rows with no `blueprint` render through the summary branch — a live projection of the
   `bundle` row rather than a full resolved archive entry, and the only shape this preview
   can build without a graph, an author and a scorecard behind it. That branch is also the
   one an owner's own shelf shows most often: a draft with no release yet. */

/** The owner's own view: draft, public and private rows, with the delete and publish
    controls only an owner sees. */
export const OwnerShelf = () => (
  <OwnedBundles
    ownerHandle="orin"
    owner
    rows={[
      {
        summary: {
          slug: "docs-review-loop",
          title: "Docs review loop",
          summary: "Drafts a PR, waits on one human review, merges on approval.",
          visibility: "private",
          updatedAt: new Date("2026-08-24"),
          releaseCount: 0,
        },
      },
      {
        summary: {
          slug: "guarded-merge-bot",
          title: "Guarded merge bot",
          summary: "Six nodes, one gate. Nothing merges without a human approve.",
          visibility: "public",
          updatedAt: new Date("2026-08-18"),
          releaseCount: 3,
          currentVersion: "1.2.0",
          digest: "9f3a1c7e0b2d",
          nodeCount: 6,
        },
      },
      {
        summary: {
          slug: "nightly-data-janitor",
          title: "Nightly data janitor",
          summary: "Sweeps stale rows on a schedule, unattended end to end.",
          visibility: "private",
          updatedAt: new Date("2026-08-10"),
          releaseCount: 1,
          currentVersion: "1.0.0",
          digest: "44e7bb210a9c",
          nodeCount: 4,
        },
      },
    ]}
  />
);

/** A visitor's view: public rows only, no controls, and the disclosure panel explaining
    that private bundles are never listed here. */
export const VisitorShelf = () => (
  <OwnedBundles
    ownerHandle="orin"
    owner={false}
    rows={[
      {
        summary: {
          slug: "guarded-merge-bot",
          title: "Guarded merge bot",
          summary: "Six nodes, one gate. Nothing merges without a human approve.",
          visibility: "public",
          updatedAt: new Date("2026-08-18"),
          releaseCount: 3,
          currentVersion: "1.2.0",
          digest: "9f3a1c7e0b2d",
          nodeCount: 6,
        },
      },
    ]}
  />
);
