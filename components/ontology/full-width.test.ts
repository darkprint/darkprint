import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
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
   FAILS on the first composed class list in these files and says to
   extend the reader. A guard that quietly stops covering its subject is
   worse than no guard.

   ── the premise is parsed, and the reason is worth reading once ──
   That premise used to be a substring match, and its needle was the
   backtick spelling itself, which is the one needle a comment cannot be
   distinguished from: prose quoting it is byte-identical to the code it
   forbids. `app/spec/card/page.tsx` joined this list already converted to
   `cx(…)` and carrying a docblock that said so, and the docblock failed
   the guard the conversion was made for. So the premise asks the
   TypeScript parser for a `className` or a `cx()` argument built from a
   template literal. Comments cannot reach an AST, so prose is invisible
   without a stripping pass that would have to be right about strings and
   regex literals to avoid eating code. `templateClassLists` is driven in
   both directions by the first cell below before anything is measured
   with it.
   ============================================================ */

/**
 * The whole vocabulary surface: the two routes that draw it and the four
 * components they mount. Listed by hand rather than globbed, so a new
 * file in the lane is a deliberate addition to this list and not
 * something that silently escapes the rule.
 *
 * ── The list has changed with the route TWICE on 2026-09-06, and it has
 *    not shrunk either time ──
 * First `app/ontology/page.tsx` was deleted when the owner moved the
 * vocabulary browser onto `/spec/ontology`. Then `/spec/ontology` was
 * itself folded into `/spec/card`, on the owner's acceptance of the
 * reframing ("The motivations you provided are sound. Apply them.") that
 * keeps the vocabulary and puts each term beside the card field that
 * consumes it.
 *
 * Striking a deleted route out and stopping there would leave the page
 * that now mounts the browser unguarded, which is exactly how
 * `copy-rules.test.ts` describes a rule quietly ceasing to apply: moving
 * a file out of a guarded set is not the same decision as deciding it no
 * longer needs guarding. So each time the departing route came off and
 * the arriving one went on in the same edit.
 *
 * THE RULE IS FOLLOWING ITS SURFACE AND IS NOT BEING WIDENED. What this
 * list holds is wherever the vocabulary is drawn, and the vocabulary is
 * drawn on `/spec/card` now. That page is subject to the owner's standing
 * rule the moment the terms land on it, and it arrived already satisfying
 * it: no quoted `max-w-*`, no `.prose-lane`, no template-literal class
 * list, no `.since` read. The fold lane had itself taken three paragraphs
 * and the field list off `.prose-lane` in the same pass, so admitting the
 * page cost nothing rather than being negotiated down.
 *
 * `app/spec/ontology/page.tsx` had cost one change to admit at the
 * previous repoint, worth keeping because the same trap is waiting for
 * the next page: it built three class lists from template literals, which
 * the reader below cannot see into and which its own premise cell fails
 * on; they became `cx(BAND_H2, "scroll-mt-24")`, the spelling this file
 * reads. A `min-w-[40rem]` on a kinds table is a MINIMUM and is not what
 * the rule is about: a table that refuses to fold below its own column
 * widths scrolls inside `overflow-x-auto`, it does not stop short of the
 * band's right edge.
 */
const SURFACES = [
  "app/spec/card/page.tsx",
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

/**
 * Does this source hand a `className` a template literal?
 *
 * ── why this is parsed and the two rules below are still grepped ──
 * The width and version cells read double-quoted strings, and the prose in these files
 * quotes class names in BACKTICKS, so those two step over comments by construction. The
 * premise cell had no such luck: its needle is the backtick spelling itself, so a comment
 * quoting it is byte-identical to the code it forbids, and there is no textual discriminator
 * between the two.
 *
 * That is not hypothetical and it is not a near miss. `app/spec/card/page.tsx` arrived in
 * this list already converted to `cx(...)`, with a docblock explaining that it had been
 * converted BECAUSE of this cell and naming the spelling it avoided. The considerate comment
 * failed the guard it was written to respect, and it would have failed it in a way that
 * reads as the page's fault rather than the reader's.
 *
 * So the premise asks the compiler instead of the text. Comments are trivia to a parser and
 * cannot reach an AST, which makes prose invisible for free rather than by a stripping pass
 * that has to be right about strings, template literals and regex literals to avoid eating
 * code. What is matched is the thing the rule is actually about: a `className` whose value
 * is built from a template literal anywhere in its expression, and the same for a `cx()`
 * argument, which is how these files spell a composed class list.
 *
 * The direction matters and is deliberate. The premise reads LESS than the assertions do:
 * everything it can see is code, and every class list the assertions read is code too. A
 * premise reading raw text beside an assertion reading stripped code would be the dangerous
 * arrangement, because the premise would fire on prose the assertion could never charge; this
 * is the reverse, and it can only stop false alarms rather than open a blind spot.
 */
function templateClassLists(path: string, source: string): string[] {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  const hasTemplate = (node: ts.Node): boolean => {
    if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) return true;
    return node.getChildren().some(hasTemplate);
  };

  const walk = (node: ts.Node) => {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      /^class(Name)?$/.test(node.name.text) &&
      node.initializer !== undefined &&
      hasTemplate(node.initializer)
    ) {
      found.push(node.getText());
    }
    /* `cx(…)` reaches a `className` one hop away, and a template literal handed to it is
       exactly as invisible to `quotedStrings` as one written in the attribute. */
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "cx" &&
      node.arguments.some(hasTemplate)
    ) {
      found.push(node.getText());
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return found;
}

describe("the vocabulary surfaces run the full container width", () => {
  /**
   * The instrument's own instrument, before either is trusted.
   *
   * `templateClassLists` replaced a substring match, and a detector that
   * answered "no" to everything would make the premise below vacuous and
   * the three rules after it blind in the one way they cannot see. So it
   * is driven in both directions over sources written here, which is the
   * only pair this file can build without editing a page it does not own.
   *
   * The second case is the whole reason the detector exists: the same
   * bytes, in a comment.
   *
   * TWO SOURCES WRITTEN HERE ARE NOT ENOUGH ON THEIR OWN, and the gap was
   * closed rather than noted: a condition hand-built by the guard's own
   * author proves the detector separates what its author imagined, never
   * that the cell below fires on a real file. So it was also driven once
   * against `app/spec/card/page.tsx` with a template className added to
   * the browser's own element. The surface cell red BY NAME and echoed
   * the offending text, the page was restored from a `cp` copy and
   * verified byte-identical, and the suite went green again.
   */
  it("separates a template class list from a comment quoting one", () => {
    const code = "const A = () => <p className={`${B} scroll-mt-24`}>x</p>;";
    const prose = [
      "/* Composed with `cx` rather than a className={`…`} template, for the width rule. */",
      'const A = () => <p className="text-sm">x</p>;',
    ].join("\n");

    expect(
      templateClassLists("code.tsx", code),
      "the detector cannot see a className built from a template literal, so the premise " +
        "below passes on every file and the width rule stops covering composed class lists",
    ).toHaveLength(1);
    expect(
      templateClassLists("prose.tsx", prose),
      "the detector charges a file for a comment that merely quotes the spelling it " +
        "forbids. That is the false red this parse replaced a substring match to avoid, " +
        "and it lands on the page that documented the rule rather than on one that broke it.",
    ).toEqual([]);
  });

  /**
   * The instrument, before the rule it measures.
   *
   * `quotedStrings` is blind to a class list assembled in a template
   * literal, and a lane that grew one would leave every cell below
   * green while the width came back. This is the tell.
   */
  it.each(SURFACES)("%s builds its class lists from plain strings", (file) => {
    const composed = templateClassLists(file, read(file));
    expect(
      composed,
      `${file} now builds a className from a template literal, which the reader in ` +
        `this file cannot see into: ${composed.join(" | ")}\n\n` +
        `Compose it with \`cx(…)\` over plain strings, the spelling the other surfaces ` +
        `use, or extend \`quotedStrings\` to cover it. Left alone, the width cells below ` +
        `stop covering this file without going red.`,
    ).toEqual([]);
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
