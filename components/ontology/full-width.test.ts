import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/* ============================================================
   The vocabulary surfaces fill the band, and carry no version.

   Two rules the owner has now stated twice, neither of which anything
   in the repository was checking.

   ── Why a source-text cell and not a render ──
   Both rules are about markup a reader sees the *width* of, and there is
   no DOM in this suite and no layout in jsdom: a rendered assertion
   would have to re-implement Tailwind to say anything. What can be
   checked exactly is which utility classes the files hand to the
   browser, and that is what a reviewer would look for anyway.

   ── What this reads, and what it deliberately cannot see ──
   Every DOUBLE-QUOTED string literal in each file. That is every class
   list these six files ship, in both spellings they use — the
   `className="…"` attribute and the `cx("…", …)` argument — and it is
   also the one form that steps over the prose: the comments here quote
   `max-w-4xl` and `.prose-lane` by name, in backticks, because they
   record why those came off. A checker that read raw source would
   charge this file for its own explanation and go red against a correct
   tree.

   The cost is that a class list built from a template literal is
   invisible to it. Rather than pass blind over one, the premise below
   FAILS on the first `className={`…`}` in these files, and says to
   extend the reader. A guard that quietly stops covering its subject is
   worse than no guard.
   ============================================================ */

/**
 * The whole vocabulary surface: the two routes that draw it and the four
 * components they mount. Listed by hand rather than globbed, so a new
 * file in the lane is a deliberate addition to this list and not
 * something that silently escapes the rule.
 *
 * ── The list changed with the route, 2026-09-06, and it did not shrink ──
 * `app/ontology/page.tsx` was deleted when the owner moved the vocabulary
 * browser onto `/spec/ontology`. Striking it out and stopping there would
 * have left the page that now mounts the browser unguarded, which is
 * exactly how `copy-rules.test.ts` describes a rule quietly ceasing to
 * apply: moving a file out of a guarded set is not the same decision as
 * deciding it no longer needs guarding. So the deleted route came off and
 * the merged route went on in the same edit.
 *
 * `app/spec/ontology/page.tsx` cost one change to admit. It built three
 * class lists from template literals, which the reader below cannot see
 * into and which its own premise cell fails on; they are `cx(BAND_H2,
 * "scroll-mt-24")` now, the spelling this file already reads. Its
 * `min-w-[40rem]` on the kinds table is a MINIMUM and is not what the
 * rule is about: a table that refuses to fold below its own column widths
 * scrolls inside `overflow-x-auto`, it does not stop short of the band's
 * right edge.
 */
const SURFACES = [
  "app/spec/ontology/page.tsx",
  "app/ontology/[...term]/page.tsx",
  "components/ontology/OntologyCatalog.tsx",
  "components/ontology/TermTable.tsx",
  "components/ontology/TermTree.tsx",
  "components/ontology/VocabularyBrowser.tsx",
] as const;

function read(file: string): string {
  return readFileSync(`${ROOT}${file}`, "utf8");
}

/** Every double-quoted literal in a source file, unescaped quotes excluded. */
function quotedStrings(source: string): string[] {
  return [...source.matchAll(/"([^"\n]*)"/g)].map((m) => m[1] ?? "");
}

describe("the vocabulary surfaces run the full container width", () => {
  /**
   * The instrument, before the rule it measures.
   *
   * `quotedStrings` is blind to a class list assembled in a template
   * literal, and a lane that grew one would leave every cell below
   * green while the width came back. This is the tell.
   */
  it.each(SURFACES)("%s builds its class lists from plain strings", (file) => {
    expect(
      read(file).includes("className={`"),
      `${file} now builds a className from a template literal, which the reader in ` +
        `this file cannot see into. Extend \`quotedStrings\` to cover it, or the width ` +
        `cells below stop covering this file without going red.`,
    ).toBe(false);
  });

  /**
   * The owner's standing rule, stated again on 2026-09-05 as "the panel
   * in /ontology do not occupy full horizontal space, fix them". The
   * route it named is gone and the rule is not: it is about these
   * panels, which draw the same way a route later.
   *
   * `container-page` is 1200px and is the only width on the site. Every
   * cap this lane carried was defended in a comment as a reading
   * measure, with measurements, and the rule beats the measurement: a
   * panel capped at 896px inside a 1200px band stops ~300px short of
   * every other edge on the page.
   *
   * `.prose-lane` is named alongside `max-w-*` because it is the same
   * rule wearing the design system's clothes — one token, 36rem, and
   * the paragraph it caps is inside a panel that no longer stops there.
   */
  it.each(SURFACES)("%s ships no width cap and no reading lane", (file) => {
    const offenders = quotedStrings(read(file)).filter(
      (s) => /(^|\s)max-w-/.test(s) || /(^|\s)prose-lane(\s|$)/.test(s),
    );
    expect(
      offenders,
      `${file} ships a width cap: ${offenders.map((s) => JSON.stringify(s)).join(", ")}\n\n` +
        `Text and panels on this site run the full width of \`container-page\`. There is ` +
        `no reading-measure lane, and a comment defending one as a measured reading ` +
        `column is the argument the owner has now overruled twice. Remove the cap and ` +
        `record what changed in the comment; do not loosen this cell.`,
    ).toEqual([]);
  });

  /**
   * The vocabulary is not versioned, so no surface prints a version of
   * it.
   *
   * `Ontology.version` is gone from `lib/core`, so a page reading it
   * fails the typecheck. `OntologyTerm.since` and
   * `TermDeprecation.since` are still on the type — they are the
   * ontology version a term was introduced or deprecated in — and
   * nothing stops a page rendering one again. This does.
   *
   * The reason, kept here as well as in `OntologyCatalog` because this
   * is what a reviewer reaches first: the vocabulary names what an
   * Attractor node is, Attractor fixes those shapes in its own spec,
   * and a DarkPrint-only version number on top was a second thing to
   * keep in step with nothing.
   */
  it.each(SURFACES)("%s reads no ontology version off a term", (file) => {
    const source = read(file);
    const hits = [...source.matchAll(/\w+\.(?:deprecated\.)?since\b/g)].map((m) => m[0]);
    expect(
      hits,
      `${file} reads ${hits.join(", ")}. That is the ontology version a term was ` +
        `introduced or deprecated in, and the vocabulary has no version any more ` +
        `(owner, 2026-09-05). A deprecated term is signposted by its successor, which ` +
        `is the half a reader can act on.`,
    ).toEqual([]);
  });
});
