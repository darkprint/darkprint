/* ============================================================
   The site's copy rules, held over the trees they apply to.
   ------------------------------------------------------------
   This is the tree-wide half of `components/build/workspace.test.ts`, moved out whole when
   the owner deleted `/build` and `components/build/**` on 2026-09-06 ("it is not useful and
   make confusion").

   Nothing here was ever about that route. Doc 2 §2.5 rules the em dash used as a pause out
   of the site's copy, and doc 2 §1.1 rules evaluative language about the autonomy reading
   out of every sentence that describes one; both are enforced over directory walks that
   reach `components/`, every route's `page.tsx` and two files in `lib/`. The guard happened to
   live in the workspace's own suite because that is the pass that wrote it, and deleting a
   route would have taken the site's punctuation rule with it — silently, because a walk
   that no longer runs reports nothing rather than failing.

   `components/site` is the home because that is where the site-wide guards already are:
   `honesty.test.ts` reads every route's disclaimers from here and `anchors.test.ts` walks
   every `.tsx` in the tree from here. This file walks the same way.

   ── What did NOT move, and why ──
   The eighty-combination enumeration, the score arithmetic, the two exits' copy and the
   README round trip were all claims about the deleted workspace and went with it. What is
   below is every cell in that file whose subject was the tree.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN = [
  "out of 4",
  "out of four",
  "score of 4",
  "fully autonomous",
  "not autonomous",
  "more autonomous",
  "less autonomous",
  "maximum autonomy",
  "highest level",
  "falls short",
  "fall short",
  "shortfall",
  "room for improvement",
  "should automate",
  "penalty",
  "penalis",
  "penaliz",
  "downgrade",
];

/**
 * Every file that writes a sentence about the autonomy reading.
 *
 * This used to be the nine files a reader of `/build` could end up looking at, headed by
 * `ScorePanel.tsx` and `choices.ts`. The owner deleted that route and its component tree on
 * 2026-09-06 ("it is not useful and make confusion"), and a list of nine deleted paths is a
 * check that throws ENOENT, or worse, an empty `it.each` that passes.
 *
 * So the rule moved to where the sentences are written rather than to where they were
 * displayed. `lib/core/analysis/autonomy.ts` composes the rationale and the per-node
 * explanation; `lib/format.ts` is the presentation transform every surface puts them
 * through; `components/upload/ValidationReport.tsx` is the one page left that draws the
 * autonomy block, over a graph the reader is holding rather than one the registry
 * published. Doc 2 §1.1 is a rule about what those sentences may say, and all three were
 * measured clean when this list was written.
 *
 * A guard held at the composer is stronger than one held at a surface: a phrase added to
 * `autonomyStatement` reaches every reader of it, and adding a fourth surface later cannot
 * silently escape a check that never named it.
 */
const AUTONOMY_COPY_FILES = [
  "lib/core/analysis/autonomy.ts",
  "lib/format.ts",
  "components/upload/ValidationReport.tsx",
];

/**
 * Where the em-dash rule is enforced, as trees rather than as a list of files.
 *
 * The list below it used to be the whole of it: fifteen paths under `components/build`
 * and `components/panes`, named one at a time. Doc 2 §2.5 is a rule about the site's copy
 * and the constraint sheet cites this test as what keeps it, so a pass that wrote a new
 * landing, `/spec` and `/how-to-build-a-dark-factory` added several thousand words that
 * the guard could not see. A directory is added once and covers every file put in it
 * afterwards, which is the property a hardcoded list does not have.
 *
 * What is deliberately outside: `components/nodes`, `components/upload`,
 * `components/blueprint`, `app/ontology` and `app/nodes` carry em dashes in copy that
 * predates the rule, so adding them here would fail on text nobody in this pass wrote.
 * They are a copy edit, not a guard, and putting them in the list before the edit would
 * only produce a skipped test.
 *
 * `components/blueprint/ForkAction.tsx` is the one file under an exempt tree this rule
 * does hold, named explicitly in `EM_DASH_FILES` below rather than folded into
 * `COPY_TREES`. It is brand new copy from the lifecycle-scoring pass (spec §3.2, doc 2
 * §2.5), not text that predates the rule like the rest of `components/blueprint` — a
 * reviewer found that the directory-level exemption above, written before this pass
 * existed, silently covered it too, so a pause dash typed into this file today would
 * ship past a guard the constraint sheet cites as enforcing exactly that. Naming the file
 * rather than the tree keeps the fix scoped to the new copy and leaves the sibling
 * files' pre-existing violations (`Explainability.tsx`, `Comments.tsx`, `Requirements.tsx`,
 * `BundlePanel.tsx`, `DownloadPanel.tsx`, `BlueprintCanvas.tsx`) as the copy edit they
 * still are, not a guard this fix is not scoped to make.
 */
const COPY_TREES = [
  "components/home",
  "components/hero",
  "components/spec",
  // `components/howto` stood here. The directory is gone: every file in it existed for
  // `/towards-a-dark-factory/the-climb`, which the author deleted on 2026-08-07.
  "components/viz",
  "components/explain",
  "components/site",
  "components/gallery",
  // Added 2026-08-07 with `components/skill/SkillSetup.tsx`, the tutorial that turned
  // `/install` from a preview of an unbuilt server into a route with a working command at
  // the top of it. Two files were already in that directory and neither carried a pause
  // dash in visible copy, so the tree went in whole rather than the one new file being
  // named the way `ForkAction.tsx` is below: there was no legacy punctuation to
  // grandfather, and a tree covers whatever the next pass writes into it.
  //
  // `components/install` became these two on 2026-08-07, when the author split the route
  // in two: "I prefer two pages, one for the skill and one for the mcp." Both halves keep
  // the coverage the single tree had — the split moved files, and moving a file out of a
  // guarded tree into an unguarded one is how a rule quietly stops applying.
  "components/skill",
  "components/mcp",
  // Added with `/settings`, whole rather than file by file, for the same reason
  // `components/skill` went in whole: the directory is new, so there is no pre-existing
  // punctuation to grandfather, and a tree covers whatever the account pass writes into
  // it next. Every string in it is product copy — section heads, field hints, the words
  // beside a switch — which is exactly the material §2.5 is about.
  "components/settings",
  // `components/profile` is older but its copy is not: the accounts pass rewrote every
  // string in it and added six files, and a check confirmed the tree carries no pause dash
  // in visible text today. `app/u/` stays in `APP_EXEMPT` below — the route files are a
  // separate question and were not part of that check.
  "components/profile",
  // Added 2026-09-02 with `/capabilities` and `/tutorial`, whole and for the reason this
  // list already gives twice: both directories are new, so there is no legacy punctuation
  // to grandfather, and a tree covers whatever the next pass writes into it. The two page
  // files were covered from the day they appeared, because `appPages()` walks; the trees
  // beside them were not, and `GraphStrip.tsx` was already carrying a pause dash in the
  // one string a reader sees before a node has a card. That is what these two lines catch.
  "components/capabilities",
  "components/tutorial",
];

/**
 * Routes whose page copy predates the rule, kept out for the reason `COPY_TREES` records.
 *
 * `app/nodes`, `app/ontology` and `app/upload` are the page halves of the component trees
 * already named above. `app/blueprints/[owner]` and `app/u` carry the same kind of legacy
 * punctuation. All five are a copy edit rather than a guard, and adding them here before
 * that edit would only fail on text nobody in this pass wrote.
 *
 * **The blueprint entry says `[owner]` because the page moved there, and the exemption
 * followed it (B-09, D-261-01/05).** It was granted to that page's legacy copy, and a URL
 * migration must not silently revoke a grandfather nobody decided to revoke. What is left
 * behind at `app/blueprints/[slug]/` is the redirector, which is new code that renders no
 * copy at all, so it is guarded rather than exempt: the exemption tracks the prose, not
 * the path it used to sit at.
 */
const APP_EXEMPT = [
  "app/nodes/",
  "app/ontology/",
  "app/upload/",
  "app/blueprints/[owner]/",
  "app/u/",
];

/**
 * Every route page the rule is held over, walked rather than listed.
 *
 * This replaced six paths typed out one at a time, two of which named routes that the
 * redesign renames (`/how-to-build-a-dark-factory` and `/which-tasks` fold into
 * `/towards-a-dark-factory`). A guard that throws ENOENT the day a route moves is a guard
 * the next author deletes rather than fixes, and a hardcoded list covers no page added
 * after it was written. A walk covers a new sub-route on the day it appears, which is what
 * the `/spec` and `/towards-a-dark-factory` splits need from it.
 */
function appPages(): string[] {
  return sourcesUnder("app").filter(
    (path) =>
      path.endsWith("/page.tsx") && !APP_EXEMPT.some((dir) => path.startsWith(dir)),
  );
}

/**
 * Every `.ts`/`.tsx` under `dir`, tests excluded.
 *
 * A test that asserts on the character has to be able to name it, and three of them do
 * (`nodecard.test.ts`, `graph.test.ts` and this file). Including them would make the guard
 * report itself.
 */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourcesUnder(child));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    out.push(child);
  }
  return out;
}

/**
 * The two files outside `components/` and `app/` that write sentences a reader reads.
 *
 * `lib/core/analysis/autonomy.ts` composes the autonomy rationale and the per-node
 * explanation, and `lib/format.ts` is the presentation transform every surface puts them
 * through. Both print onto `/blueprints`, `/build`, `/what-a-blueprint-is`, every
 * blueprint detail page
 * and every generated `README.md`, and neither was covered: the guard walked
 * `components/` trees and `app/**` pages and stopped there, so
 * "… (type: human-gate) — a person acts here." shipped on three blueprint pages against
 * doc 2 §2.5 for as long as the rule has existed.
 *
 * The rest of `lib/` stays out for the reason `COPY_TREES` records about
 * `components/nodes`: `lib/content/view.ts`, `lib/data/*` and the diagnostic hints in
 * `lib/core/bundle`, `lib/core/card` and `lib/core/ontology` carry em dashes in copy that
 * predates the rule. Those are a copy edit rather than a guard, and adding them here
 * before that edit would only produce a failing test on text nobody in this pass wrote.
 */
const LIB_COPY_FILES = ["lib/core/analysis/autonomy.ts", "lib/format.ts"];

/** Every file the em-dash rule is held over, deduplicated and stable. */
const EM_DASH_FILES = [
  ...new Set([
    ...LIB_COPY_FILES,
    ...AUTONOMY_COPY_FILES,
    "components/panes/GraphPane.tsx",
    // The port descriptions the skeleton prints are composed here, one line per port.
    "components/panes/build.ts",
    // Product copy that is not a component: one paragraph per card field, rendered on
    // `/nodes/<id>` and inside the blueprint page's card skeleton. Named here for the
    // same reason `ForkAction.tsx` is, and because a `.ts` file of prose is exactly the
    // shape a tree-based walk misses.
    "components/panes/field-notes.ts",
    "components/panes/SkeletonPane.tsx",
    "components/panes/SynchronisedPanes.tsx",
    // New copy from this pass inside an otherwise-exempt tree — see the comment on
    // `COPY_TREES` above for why it is named here rather than by widening that list.
    ...COPY_TREES.flatMap(sourcesUnder),
    ...appPages(),
  ]),
].sort();

/**
 * Comments out, so what is left is roughly what a reader sees.
 *
 * A block comment is the house style for the header of every file here and a line comment
 * explains a decision beside it; neither is product copy, and both are allowed the
 * punctuation §2.5 keeps out of the page. The line-comment rule skips a `//` that follows
 * a colon or a quote, which is what a URL inside a string looks like.
 *
 * The block rule wants a whitespace or bracket boundary in front of the comment opener for
 * the same class of reason. `SpecLayers` named its figure with a glob over the card
 * directory, and that glob put a slash-star inside a string literal: an opener with no
 * boundary in front of it matches there and swallows everything up to the next real
 * closer, which on that file was the caption and the whole of lane 1. A guard that is
 * silently blind over the span it ate is the worst way for a check to fail. That file
 * went with `/spec` in the IA pass; the rule stays, because the shape it catches is a
 * path inside a string and this repo writes those everywhere.
 */
function visibleCopy(source: string): string {
  return source
    .replace(/(^|[\s{(=,])\/\*[\s\S]*?\*\//g, "$1")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"])\/\/.*$/, "$1"))
    .join("\n");
}

/**
 * A lone em dash standing in for an empty cell, removed before the pause check.
 *
 * §2.5 rules out the em dash "usato come pausa", and a pause has text on at least one side
 * of it. `{edge.label ?? "—"}` puts the character in a table cell that has nothing in it,
 * which is a glyph and not a sentence: `SectionAbsentEdge` and the security ledger both
 * write one. Only the exact one-character string is stripped, so `"— and then"` is still
 * caught.
 */
function withoutPlaceholders(source: string): string {
  return source.replace(/"—"/g, '""').replace(/>\s*—\s*</g, "><");
}

describe("the copy rules the whole site is held to", () => {
  it.each(AUTONOMY_COPY_FILES)("%s carries no evaluative language about the level", (path) => {
    // Through `visibleCopy`, like the em-dash check below: the rule is about what a reader
    // sees. A comment quoting §5.3's "must not read as a penalty" is the rule being
    // honoured, and reading it as a breach would push the next author to stop writing the
    // reason down.
    const text = visibleCopy(readFileSync(join(process.cwd(), path), "utf8")).toLowerCase();
    for (const phrase of FORBIDDEN) {
      expect(text, `${path} contains "${phrase}"`).not.toContain(phrase);
    }
  });

  /**
   * Doc 2 §2.5: "trattini lunghi usati come pausa" is one of the four AI-writing patterns
   * to strip from the site's text, and the audience is developers who recognise them. The
   * panel shipped one, between a status token and the sentence explaining it.
   */
  it("covers the surfaces this pass wrote, not a list somebody has to remember", () => {
    // A walk that matched nothing passes every case below. The four named files are the
    // ones a rename cannot move, and the route count is what notices a walk that stopped
    // finding pages: `app` carries more than six guarded routes and always has.
    expect(EM_DASH_FILES.length).toBeGreaterThan(40);
    expect(appPages().length).toBeGreaterThan(6);
    for (const path of [
      "app/page.tsx",
      /* `app/spec/ontology/page.tsx` until 2026-09-06, when the vocabulary folded into the
         card spec and that route was deleted. The card page is the one that inherited the
         prose, so it is the one this cell holds: the point of the four paths below is that
         the list is not a memory, and a path naming a deleted file proves nothing. */
      "app/spec/card/page.tsx",
      "components/site/SiteHeader.tsx",
      "components/viz/Sheet.tsx",
    ]) {
      expect(EM_DASH_FILES, `${path} is not guarded`).toContain(path);
    }
  });

  it.each(EM_DASH_FILES)(
    "%s uses no em dash as a pause in what a reader sees",
    (path) => {
      const text = withoutPlaceholders(
        visibleCopy(readFileSync(join(process.cwd(), path), "utf8")),
      );
      const offending = text
        .split("\n")
        .map((line, i) => ({ line: line.trim(), at: i + 1 }))
        .filter((entry) => entry.line.includes("—"));
      expect(offending.map((e) => `${path}:${e.at}  ${e.line}`)).toEqual([]);
    },
  );
});
