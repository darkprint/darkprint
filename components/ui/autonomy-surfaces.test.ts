/* ============================================================
   Doc 2 §1.1, held to the surfaces rather than to a function.

   Three of the rules the principle imposes are properties of the
   rendered page and of nothing else: which colour a row wears,
   whether a component was handed the data that lets it say where
   the people are, and what a page asks a visitor to bring. None of
   them is reachable through a pure function, and all three were
   broken by call sites that never read the comment stating the
   rule. So this file reads the source.

   Deliberately narrow. Each rule is a literal search with a stated
   window, not a parser, and each one names the defect it was
   written for. A source scan that grows into a style checker is a
   file people start deleting assertions from; these three exist
   because each one caught something.

   No DOM and no renderer: the suite is `environment: "node"` by
   design (`vitest.config.ts`), and reading a file needs neither.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { HUMAN_PRESENCE_MARK } from "@/lib/format";

/** Repo root: this file is `<root>/components/ui/`. */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The two trees that render pages. `lib/` holds no JSX. */
const TREES = ["app", "components"] as const;

interface SourceFile {
  /** Repo-relative, for the failure message. */
  path: string;
  text: string;
}

function collect(dir: string, rel: string, out: SourceFile[]): void {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collect(child, `${rel}/${entry.name}`, out);
      continue;
    }
    if (!entry.name.endsWith(".tsx")) continue;
    out.push({ path: child, text: readFileSync(join(ROOT, child), "utf8") });
  }
}

const SOURCES: SourceFile[] = [];
for (const tree of TREES) collect(tree, tree, SOURCES);

/**
 * Block comments removed, everything else left where it was.
 *
 * `{/* … *\/}` is how a JSX file writes prose about its own markup, and three of them
 * discuss the alarm colour by name while describing the bug this file guards against.
 * Positions shift, which is why every rule below works on line numbers taken from the
 * stripped text rather than from the original.
 */
function withoutBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

const STRIPPED = SOURCES.map((file) => ({
  path: file.path,
  text: withoutBlockComments(file.text),
}));

describe("the file tree renders something", () => {
  it("found the pages", () => {
    // A scan that silently matched nothing passes every rule below.
    expect(SOURCES.length).toBeGreaterThan(40);
    expect(SOURCES.map((f) => f.path)).toContain("components/ui/AutonomyMeter.tsx");
  });
});

/* --------------------- 1. the indicator's colour --------------------- */

/**
 * The alarm colour, in both spellings the codebase uses for it.
 *
 * `--color-signal` is #ff5470 and it is spent on defects: the criteria-leak marker, the
 * degraded security reading, the error count on the download step, the top penalty tier.
 */
const ALARM = ["text-signal", "--color-signal"];

/**
 * How far back an element's colour can sit from the glyph inside it.
 *
 * In every one of the four defects this was written for the class list was on the wrapping
 * element, between 25 and 90 characters before the glyph. 260 covers a wrapper with a few
 * more attributes on it without reaching the previous sibling.
 */
const LOOKBACK = 260;

describe("where a person acts is never painted in the alarm colour", () => {
  /**
   * Doc 2 §1.1: "L'indicatore di autonomia mostra dove sono gli interventi umani." An
   * indicator row in the colour reserved for defects says the graph has one, and the
   * rule against it was already written twice in the repo — in
   * `components/blueprint/Explainability.tsx` and in `app/nodes/[...id]/page.tsx` — while
   * four components that never read either comment kept doing it: the autonomy meter on
   * the gallery grid and the blueprint header, the node library tile, an author's shelf
   * and the ontology term page.
   *
   * The glyph is the anchor because it is what the rule is about. `NODE_KIND_META.gate`
   * keeps signal pink for the schematic's own node palette and is reached through an
   * inline `style` from a colour table, so it is not a `⏸` with a class list in front of
   * it and this rule does not touch it.
   */
  it("has no ⏸ with a signal colour in front of it", () => {
    // Two anchors, because a call site can write the glyph either way and a rule that
    // only sees the literal stops working on exactly the files that adopted the constant.
    const anchors = [HUMAN_PRESENCE_MARK.glyph, "HUMAN_PRESENCE_MARK.glyph"];
    const offences: string[] = [];
    for (const { path, text } of STRIPPED) {
      for (const anchor of anchors) {
        let at = text.indexOf(anchor);
        while (at >= 0) {
          const before = text.slice(Math.max(0, at - LOOKBACK), at);
          for (const alarm of ALARM) {
            if (!before.includes(alarm)) continue;
            const line = text.slice(0, at).split("\n").length;
            offences.push(`${path}:${line} — ${alarm} within ${LOOKBACK} chars of ⏸`);
          }
          at = text.indexOf(anchor, at + 1);
        }
      }
    }
    expect(offences).toEqual([]);
  });
});

/* --------------------- 2. the meter's second half --------------------- */

describe("AutonomyMeter is always given the per-node reading", () => {
  /**
   * The dark factory token is gated on `isDarkFactory` alone; both counterpart statements
   * are gated on `contributions !== undefined`. Omit the prop and a closed-loop graph
   * answers with two tokens while a graph with a person in it answers with one and nothing
   * in its place, which is the asymmetry the meter exists to avoid and which doc 2 §1.1
   * makes a product problem rather than a layout one. `/upload` omitted it, on the one
   * surface where somebody is looking at their own graph.
   *
   * Matched on the opening tag rather than on the whole element: the props are all inside
   * it, self-closing in every call site, and a `>` cannot appear in a JSX attribute name.
   */
  it("passes contributions at every call site", () => {
    const calls: { path: string; tag: string }[] = [];
    for (const { path, text } of STRIPPED) {
      let at = text.indexOf("<AutonomyMeter");
      while (at >= 0) {
        const close = text.indexOf("/>", at);
        expect(close, `${path}: unterminated <AutonomyMeter`).toBeGreaterThan(at);
        calls.push({ path, tag: text.slice(at, close) });
        at = text.indexOf("<AutonomyMeter", at + 1);
      }
    }

    /* The component's own file declares it and does not call it, so a scan that found
       nothing is a scan that is looking in the wrong place.

       AMENDED (owner-instructed, the scoring reading comes off the blueprint page): the
       floor was 3 and the three were the blueprint header, `ContentCard` and `Pinned`. All
       three mounts are gone with the reading they belonged to. `components/upload/
       ValidationReport.tsx` is the one surface left that draws the meter, over a graph
       somebody is about to publish. The floor tracks that count rather than being deleted:
       it is still the blind-scan premise this cell needs, and the rule it guards — every
       call site passes `contributions` — is untouched and still applies to every mount a
       future surface adds. */
    expect(calls.length).toBeGreaterThanOrEqual(1);
    for (const call of calls) {
      expect(call.tag.includes("contributions"), `${call.path} omits contributions`).toBe(
        true,
      );
    }
  });
});

/* --------------------- 3. what a page asks a visitor to bring --------------------- */

describe("no page makes the classification a condition of entry", () => {
  /**
   * Doc 2 §1.1 names the barrier in as many words: somebody looks at their own pipeline,
   * sees a manual step, and concludes they are not far enough along to publish. The
   * blueprints index opened "Every dark factory in the registry" and was rewritten for
   * exactly this; `/upload` kept "Upload the DOT graph of your dark factory" through that
   * change, on the page where the reader is being asked to hand something over. Since
   * `isDarkFactory` is a literal zero-human-node test, the sentence was false besides
   * about any bundle with a gate in it.
   *
   * Both the visible copy and the `metadata.description` are in scope: the second is what
   * a search result and a link preview show, which is a page's first sentence more often
   * than its first sentence is.
   */
  it("does not address the reader's own graph as a dark factory", () => {
    const banned = ["your dark factory", "your own dark factory", "a dark factory of your"];
    const offences: string[] = [];
    for (const { path, text } of STRIPPED) {
      const lower = text.toLowerCase();
      for (const phrase of banned) {
        if (lower.includes(phrase)) offences.push(`${path} — "${phrase}"`);
      }
    }
    expect(offences).toEqual([]);
  });
});

/* --------------------- 4. what stands behind a number --------------------- */

/**
 * The reads that put a seeded index figure on a page.
 *
 * `votes` and `downloads` come out of `lib/data/community.ts` and nothing counts them:
 * there is no ballot, no account and no download counter, which doc 2 §0.4 makes a
 * product rule and which `/how-to-build-a-dark-factory` states on the page in as many
 * words. Matched on the property read rather than on the word, so a file discussing votes
 * in prose is not caught and a file printing one cannot escape by renaming its variable.
 */
const SEEDED_READS = [".votes", ".downloads", "compact(votes)", "compact(downloads)"];

describe("no surface prints a seeded index figure as a fact", () => {
  /**
   * Four surfaces printed one with no marker anywhere near it: the gallery's two sort
   * options, every tile in the grid, the blueprint header line, and the Registry stats
   * panel with the Community notes above it. The scorecard and `/u/` had the marker all
   * along, which is what made the omission a contradiction rather than an oversight.
   *
   * The rule is per file rather than per line: `◐ seeded` sits on a panel heading or a
   * note under a list, several lines from the figure it governs, so a proximity window
   * would report the correct arrangement. What it catches is a surface that prints one of
   * these numbers and never says the word.
   */
  /* AMENDED at T280 (owner-instructed wiring wave, 2026-08-25; blob re-pinned in
     tests/server/t260/frozen-tests.test.ts in the same commit, cause named there). The
     two profile surfaces now sum REAL signals — `getSignalsMany` over the account's own
     bundles, watchers/support off `getProfile` — so demanding the word "seeded" of them
     would demand the false claim this rule exists to prevent, in the other direction.
     They are exempted BY NAME, not by category: any new file printing one of these reads
     still owes the word until it can show a live source the way load.ts does. */
  const LIVE_PRINTERS = new Set([
    "components/profile/ProfileHeader.tsx",
    "components/profile/ProfileShell.tsx",
  ]);

  it("says seeded in every file that reads one", () => {
    const printers: string[] = [];
    for (const { path, text } of STRIPPED) {
      if (!SEEDED_READS.some((read) => text.includes(read))) continue;
      printers.push(path);
      if (LIVE_PRINTERS.has(path)) continue;
      expect(text.toLowerCase(), `${path} prints an index figure and never says seeded`)
        .toContain("seeded");
    }
    // The detail header and discovery cards deliberately stopped printing these fixture
    // counters. The remaining social surfaces must still identify seeded values.
    //
    // `app/u/[username]/page.tsx` read `.downloads` here until the accounts pass folded
    // Preview signals into the account header: the sum moved once into `ProfileShell.tsx`
    // (every profile tab shares it) rather than the overview page alone, and this list
    // followed the read to where it had moved rather than dropping it.
    //
    // AMENDED 2026-09-06, owner-instructed: "just show the number of blueprints, cards and
    // stars, remove downloads and validated". `ProfileShell.tsx` stopped passing
    // `view.downloads` and `view.validated`, so it no longer matches `SEEDED_READS` at all
    // and naming it here would demand a read the owner just removed. It is replaced rather
    // than deleted, and by TWO survivors rather than one, because this list's whole job is
    // to keep the walk above from going vacuous: if every printer disappeared, the `for`
    // loop would assert nothing and pass. `Pinned.tsx` keeps a profile-side witness so the
    // replacement is not a retreat to a different area of the site.
    //
    // `LIVE_PRINTERS` deliberately still names both profile files. Neither prints one of
    // these reads today, so the exemption is inert — but it is an exemption for surfaces
    // that sum REAL signals, which is still what they do with `stars`, so it stays correct
    // for the day one of them prints a live sum again rather than being re-earned then.
    expect(printers).toEqual(
      expect.arrayContaining([
        "components/blueprint/Comments.tsx",
        "components/profile/Pinned.tsx",
        "app/blueprints/[owner]/[slug]/page.tsx",
      ]),
    );
  });

  /**
   * The gallery offers to order the shelf by two of those numbers, and the offer is made
   * in `<option>` text where no glyph or note can reach. So the option itself carries the
   * word.
   */
  it("does not offer popularity sorting until event semantics are defined", () => {
    const gallery = STRIPPED.find((f) => f.path === "components/gallery/GalleryBrowser.tsx");
    expect(gallery).toBeDefined();
    for (const option of ["downloads", "votes"]) {
      expect(gallery!.text).not.toContain(`value: "${option}"`);
    }
  });
});
