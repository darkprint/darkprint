/* ============================================================
   Doc 1 §4, worked on a real card: what one edit costs.

   Spec §3.5 asks the update panel to "show a concrete
   before/after", and the concrete part is the whole point. A
   landing that asserts "adding a prohibition is a major bump"
   is a claim; a landing that hands the engine two cards and
   prints what came back is the same sentence with the working
   attached, and it goes stale the moment `inferBump` changes its
   mind rather than the moment somebody remembers to reread it.

   The "after" card is assembled here and never written anywhere.
   `components/explain/starter-isolation.ts` does the same thing
   one level up — it builds the leaked variant of the starter
   bundle during the build to show what the analyzer says about it
   — and the reason is the same: the interesting document is the
   one the archive deliberately does not contain.

   PURE. No filesystem, no clock, no randomness. The caller reads
   the published card out of the archive and hands it over, which
   is what lets `bump-demo.test.ts` run the real card through this
   without a renderer.
   ============================================================ */

import {
  formatSemver,
  inferBump,
  parseSemver,
  type BumpLevel,
  type NodeCard,
} from "@/lib/core";

/**
 * The card the demonstration edits, and the entry it adds.
 *
 * `code-builder` because §3.2 has just spent a whole section on it: the reader arrives
 * here having read its `cannot` list line by line, so the edit lands on a card they know.
 *
 * `report` because the prohibition is one the starter blueprint already keeps and keeps
 * only by omission. `content/blueprints/starter-software-factory/blueprint.dot` says it in
 * a comment: the tester's failure evidence goes to the debugger and "the builder stays
 * isolated from every fact about the failures for the whole run". `acceptance-tester@1.0.0`
 * types that evidence port as `report`, which is a core data type, so putting `report` in
 * `cannot` promotes the comment into a rule the resolver holds every graph to. That is a
 * real edit with a real consequence, which a made-up one would not be.
 */
export const DEMO_CARD_ID = "code-builder";
export const DEMO_CARD_VERSION = "1.0.0";
export const DEMO_PROHIBITION = "report";

export interface BumpDemo {
  /** The published ref the edit starts from, e.g. "code-builder@1.0.0". */
  ref: string;
  /** The version the engine's verdict forces, e.g. "2.0.0". */
  nextVersion: string;
  /** The same, as a ref. */
  nextRef: string;
  /** The `cannot` list before and after, in card order. */
  before: readonly string[];
  after: readonly string[];
  /** The entry the edit adds. */
  added: string;
  /** What `inferBump` demands. */
  level: BumpLevel;
  /** The engine's own sentence for the strongest reason, with its `backticks` intact. */
  reason: string;
  /** Every reason it gave, strongest first. One entry, while only `cannot` moves. */
  reasons: readonly string[];
}

/**
 * The next version a bump of this size lands on.
 *
 * Semver's own arithmetic: a major zeroes the two fields under it, a minor zeroes the
 * patch, and a prerelease suffix is dropped because the bumped version is a release. An
 * unparseable version has no successor to compute, so the caller gets `undefined` and
 * shows the card without a number rather than an invented one.
 *
 * `nextVersionFor` in `lib/core/card/validate.ts` is the same arithmetic, private to that
 * module, and used to write the hint on a `card/version-bump-too-small` diagnostic. It is
 * duplicated here rather than reached for, because promoting it out of `lib/core` is an
 * edit to a file this component does not own. The one difference is `none`, which the
 * engine's copy answers `undefined` for and this one answers with the version unchanged:
 * a diagnostic has nothing to suggest when nothing changed, while a panel still has a card
 * to name.
 */
export function nextVersion(version: string, level: BumpLevel): string | undefined {
  const current = parseSemver(version);
  if (current === undefined) return undefined;
  switch (level) {
    case "major":
      return formatSemver({ major: current.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatSemver({ major: current.major, minor: current.minor + 1, patch: 0 });
    case "patch":
      return formatSemver({
        major: current.major,
        minor: current.minor,
        patch: current.patch + 1,
      });
    case "none":
      return formatSemver(current);
  }
}

/**
 * Add one prohibition to a published card and ask the engine what that costs.
 *
 * Only `cannot` moves. Every other field is carried across untouched so the verdict has
 * one cause, which is what makes the reason list a single line the reader can check
 * against the two lists drawn beside it. `version` is left alone as well: `inferBump`
 * excludes it from the comparison (`NOT_CONTENT` in `lib/core/version/bump.ts`), and
 * setting it here would only invite the reader to think the number is what produced the
 * verdict rather than the other way round.
 *
 * Returns `undefined` when the card already declares the entry, and when the engine finds
 * nothing to report. A diff of nothing demonstrates nothing, and the caller renders a
 * panel that quotes the engine's sentence, so an empty reason list is the one shape it
 * cannot draw.
 */
export function tightenProhibition(card: NodeCard, entry: string): BumpDemo | undefined {
  if (card.cannot.includes(entry)) return undefined;

  const after = [...card.cannot, entry];
  const analysis = inferBump(card, { ...card, cannot: after });
  const reason = analysis.reasons[0];
  if (reason === undefined) return undefined;
  const next = nextVersion(card.version, analysis.level);

  return {
    ref: `${card.id}@${card.version}`,
    nextVersion: next ?? card.version,
    nextRef: `${card.id}@${next ?? card.version}`,
    before: card.cannot,
    after,
    added: entry,
    level: analysis.level,
    reason,
    reasons: analysis.reasons,
  };
}
