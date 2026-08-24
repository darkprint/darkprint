/* ============================================================
   DarkPrint backend — the MCP surface's published record shapes
   Two shapes, both from the task's published block with D-220-04
   and D-220-05 applied.

   Neither restates anything. `McpSearchHit` is a PROJECTION of
   T200's `Hit<BlueprintSummary>` and `Hit<CardSummary>` onto the
   four fields `/mcp` advertises plus the evidence that makes the
   order checkable; `Provenance` is a projection of T010's
   `BundleRecord` and `ReleaseRecord`. Nothing here is a second
   opinion about a shape another module owns, which is why neither
   `BlueprintSummary` nor `ReleaseRecord` is re-exported from this
   module's barrel.
   ============================================================ */

/**
 * One result, flattened for an agent, and the reason it sits where it sits.
 *
 * ── `evidence` was missing from the published block and D-220-04 put it back ──
 *
 * AC5 is *results carry evidence or declare themselves unordered*, and D-220-02 rules
 * `ordered` to be T200's own law composed through rather than a new quantity:
 *
 *     ordered === hits.every((h) => h.evidence.length > 0)
 *
 * That law is not even stateable over a hit shape with no evidence. Worse, an agent handed
 * `ordered: true` and nothing beside it has been given exactly the relevance number with no
 * published derivation that SEAM-88 exists to refuse — and unlike a reader on `/blueprints`,
 * an agent consuming a ranked list has no way to ask. The field is already computed on
 * `Hit<T>`, so dropping it was pure loss; SEAM-93's own sketch of this surface carried it.
 *
 * It is also what keeps T300 auditable. When the semantic channel lands it feeds THIS
 * surface (D-300-01), and a cosine distance is the one ranking that cannot explain itself
 * from the archive. Evidence on the wire is where that will show.
 *
 * The format is T200's, unaltered: `<field>:<token>`, naming the field that matched and the
 * word in the DOCUMENT it matched, one entry per place the query was found. Empty when the
 * response makes no ranking claim, which is the other admissible state of AC5's honesty
 * clause and not a degraded one.
 *
 * ── `author` is OPTIONAL, and the asymmetry is structural rather than an omission ──
 *
 * D-220-05: the owner's handle for a blueprint hit, and OMITTED — not `undefined`, not `""`
 * — for a card hit. `BlueprintSummary` carries `ownerHandle`; `CardSummary` carries no
 * owner field at all, so filling the card half needs a per-hit join against T050 that
 * D-220-02 tells this task not to invent.
 *
 * The two fields that could have stood in for it are the stale claims T250 deliberately
 * left (D-250-18), naming six handles no account holds. An agent must be able to ACT on
 * what a hit carries: `ownerHandle` joins to `mcpProvenance` and to `/u/`, and a fixture
 * name joins to nothing. An absent field says *this surface does not know*, which is true;
 * a populated one would say something false in a shape that looks actionable.
 *
 * ── `ref` is the two-part key ──
 *
 * `ownerHandle/slug` for a blueprint and `id@version` for a card (D-220-13). B-09 made the
 * blueprint key two-part, so a slug alone cannot tell `alice/foo` from `bob/foo`; a bare
 * card id collides on four of the archive's 53. The `/mcp` page's slug-only and bare-id
 * spellings predate B-09 and are stale — the block governs, and the page is Forbidden.
 */
export interface McpSearchHit {
  kind: "blueprint" | "card";
  ref: string;
  /** The owner's handle on a blueprint hit. Absent on a card hit; see above. */
  author?: string;
  digest: string;
  evidence: readonly string[];
}

/**
 * Where a bundle came from: who published it, what it was forked from, and every release.
 *
 * `publishedBy` is a HANDLE and never an account id. The store keys ownership by uuid, and
 * a uuid is not something an agent can do anything with — it addresses no route on this
 * site. A bundle whose owner holds no handle refuses the whole read rather than rendering a
 * hole here, which is T080's own exclusion (*a bundle whose owner has no handle is
 * excluded*) applied at the one surface that would otherwise have to invent a value for it.
 *
 * ── `forkedFrom` is OMITTED WHOLE when the upstream is unreadable ──
 *
 * The lineage is three columns on the FORK's own row, so rendering it names an upstream
 * owner, slug and version WITHOUT ever reading the upstream — which is how AC3 leaks by
 * lineage: a fork of a private or deleted bundle would publish that bundle's existence
 * through a verb that never touched it.
 *
 * `searchBlueprints`' `forkedKeys` already settled the analogous case one module over, and
 * this follows its precedent rather than inventing a second rule: a fork whose upstream is
 * not in the public set presents as an original. It has no upstream a reader could be sent
 * to instead. Omitted whole rather than partially, for the same reason the handle case
 * refuses: two of the three fields with the third missing is a shape nothing downstream can
 * use and every reader has to special-case.
 *
 * `releases` is every release of the bundle, so an agent can pin one. `version` and `digest`
 * together, because those are the two ways to name a release and the distinction between
 * them is what `mcpFetchRelease` exists to honour.
 */
export interface Provenance {
  publishedBy: string;
  forkedFrom?: { owner: string; slug: string; version: string };
  releases: readonly { version: string; digest: string }[];
}
