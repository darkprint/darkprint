/* ============================================================
   DarkPrint data — a private node card, seeded

   A node card in `content/cards/` is public by definition: `OwnedCards.tsx` used to state
   there was no private half to a card because the archive has none — every file there
   names its author and nothing hides it. The author asked for private cards to exist, and
   the archive is the wrong place to put one: `content/` is what `lib/content` reads at
   build time and treats as published, so a "private" row there would be a contradiction in
   terms rather than a feature.

   So a private card lives here instead, the same way a private bundle lives in
   `lib/data/bundles.ts` and not in `content/blueprints/`. The asymmetry that file's header
   states — "a seeded bundle is always private, because a public one is a claim about the
   registry a fixture cannot make true" — holds here without change: every row below is
   private, because a public row would claim a document in `content/cards/` that does not
   exist.

   ── Why `usedIn` and `support` are always zero ──
   `usedIn` counts blueprints that pin this exact ref, and nothing can pin a ref the archive
   does not carry. `support` is stars from other readers, and nobody but the owner has ever
   seen a private card to star it. Both are `0` on every row rather than an invented figure
   — the same discipline `OwnedBundle.draft` follows for a bundle that does not resolve.

   PLAIN DATA: no `@/lib/content`, no filesystem, importable from a client component, same
   as its two siblings.
   ============================================================ */

/** One node card that has never been published, held by its owner alone. */
export interface PrivateCard {
  owner: string;
  id: string;
  version: string;
  name: string;
  action: string;
  /** `node-type` term id and its label, spelled out rather than resolved: this card is
      not in the ontology-indexed archive for `getOntologyView().resolve` to find. */
  type: string;
  typeLabel: string;
  phases: { id: string; label: string }[];
  tools: string[];
  requiresHuman: boolean;
  riskMarkers: string[];
}

/**
 * `mara-veil`'s two unfinished cards, for the two nodes `incident-commander-draft`
 * (`lib/data/bundles.ts`) says have none: "sketch the two nodes that replace the on-call
 * escalation." They are drafted here, privately, and not yet pinned into that bundle's
 * `cards/` folder — which is exactly why the draft still does not resolve. Writing the
 * card is not the same act as pinning it.
 */
export const PRIVATE_CARDS: readonly PrivateCard[] = [
  {
    owner: "mara-veil",
    id: "oncall-severity-router",
    version: "v0.1.0",
    name: "On-call Severity Router",
    action:
      "Score an incoming page against the severity rubric and pick which escalation class it enters, replacing the fixed on-call rotation.",
    type: "decision",
    typeLabel: "Decision",
    phases: [{ id: "plan", label: "Plan" }],
    tools: [],
    requiresHuman: false,
    riskMarkers: [],
  },
  {
    owner: "mara-veil",
    id: "oncall-context-brief",
    version: "v0.1.0",
    name: "On-call Context Brief",
    action:
      "Assemble the paged responder's brief from recent alerts, the linked runbook, and what changed in the last hour.",
    type: "agent",
    typeLabel: "Agent",
    phases: [{ id: "build", label: "Build" }],
    tools: ["http-fetch"],
    requiresHuman: true,
    riskMarkers: [],
  },
];

/** Every private card a handle holds. Empty for every handle but the one seeded above. */
export function privateCardsOwnedBy(username: string): PrivateCard[] {
  return PRIVATE_CARDS.filter((c) => c.owner === username);
}
