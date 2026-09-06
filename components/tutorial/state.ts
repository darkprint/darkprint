/* ============================================================
   Everything /tutorial derives from what the reader has typed
   ------------------------------------------------------------
   Pure functions over `BlankValues`, so the rules the page enforces
   can be tested without a DOM and cannot quietly differ between the
   graph, the error list and the download button. The page holds two
   pieces of state, the values and the step, and everything else on
   the screen is one of these.

   ── the vocabulary is the core one, and NOT `getOntologyView()` ──
   The handoff named `getOntologyView()`. It exists, at
   `lib/content/index.ts`, and it is the wrong one twice over. It is
   annotated SERVER ONLY, because it reaches `./read` and the
   filesystem, and this runs in the tab. And it layers the ARCHIVE's
   local vocabulary on top of the core, so it would offer a reader
   terms like `lupo/pii-handling` for a bundle that ships no
   `ontology/extensions.yaml` of its own. `ontologyView(CORE_ONTOLOGY)`
   is isomorphic and is the exact set the reader's download will be
   validated against.
   ============================================================ */

import {
  CORE_ONTOLOGY,
  isAttractorIdentifier,
  isAttractorKeyword,
  ontologyView,
  parseCardRef,
  type OntologyView,
} from "@/lib/core";

import { BLANKS, RUBRIC_BLANK_IDS, valueOf, type BlankValues } from "./blanks";
import { rubricStarted } from "./bundle";

/** Built once. The view walks the term graph, and nothing here changes the vocabulary. */
export const TUTORIAL_ONTOLOGY: OntologyView = ontologyView(CORE_ONTOLOGY);

/**
 * The terms a reader may type, by kind, with the abstract categories left out.
 *
 * A category is abstract when something else in the vocabulary names it as `broader`, and
 * that is derived rather than listed: `human-in-the-loop`, `evaluative`, `orchestration`
 * and `tool-capability` all have children and none is a thing a card declares. Deriving it
 * means a term added to the vocabulary appears in the right list on the day it is added.
 *
 * A card declaring an abstract type does load: the rule that used to refuse
 * `human-in-the-loop` was removed in 2026-08-30 and no replacement was added, on the
 * ground that `OntologyTerm` has no way to say a term is abstract. So this narrows what
 * the tutorial OFFERS without claiming the engine would refuse the rest, which is why the
 * fault message below says the term is not one the tutorial writes rather than that it is
 * not a term.
 */
export function offeredTerms(ontology: OntologyView, kind: string): string[] {
  return ontology.ontology.terms
    .filter((term) => term.kind === kind && ontology.children(term.id).length === 0)
    .map((term) => term.id);
}

/** One vocabulary fault, as the page lists it and as the download refuses on it. */
export interface Fault {
  readonly id: string;
  readonly text: string;
}

/**
 * The blanks that become an IDENTIFIER rather than prose, and the rule each is held to.
 *
 * Free text can be quoted into a YAML scalar and stay itself. An identifier cannot: a card
 * id is what the file is named and what `card="…@1.0.0"` pins, and a node name is a DOT
 * node id, so both are positions where a space or a colon is a parse error rather than an
 * unusual value. The rules are the engine's own, reachable from the barrel rather than
 * restated: `parseCardRef` is what `bundle/unpinned-card` is decided by, and
 * `isAttractorIdentifier` is what `attractor/*` lints a node id against.
 *
 * Checked on the page rather than left to the download, for the same reason the vocabulary
 * is: a reader who typed `crawl pages` should be told so while the field is in front of
 * them, not after they have unzipped a folder that does not parse.
 */
const IDENTIFIER_BLANKS: readonly {
  readonly id: string;
  readonly kind: "card id" | "node name" | "blueprint name";
}[] = [
  { id: "blueprint_name", kind: "blueprint name" },
  { id: "c1_id", kind: "card id" },
  { id: "c2_id", kind: "card id" },
  { id: "c3_id", kind: "card id" },
  { id: "c4_id", kind: "card id" },
  { id: "c5_id", kind: "card id" },
  { id: "n1", kind: "node name" },
  { id: "n2", kind: "node name" },
  { id: "n3", kind: "node name" },
  { id: "n4", kind: "node name" },
];

/** Every identifier blank holding something that is not one. */
export function identifierFaults(values: BlankValues): Fault[] {
  const faults: Fault[] = [];
  for (const blank of IDENTIFIER_BLANKS) {
    const value = valueOf(values, blank.id);
    if (value === "") continue;

    if (blank.kind === "node name") {
      if (isAttractorIdentifier(value) && !isAttractorKeyword(value)) continue;
      faults.push({
        id: blank.id,
        text:
          `\`${value}\` is not a node name. A node id is a letter or underscore followed by ` +
          "letters, digits and underscores, and it may not be a DOT keyword.",
      });
      continue;
    }

    /* Both go through `parseCardRef`, which is the function that decides whether a `card=`
       pin resolves: an id it refuses is an id no node can pin, whatever else is true of it.
       The blueprint name goes through the same rule because it is the folder's name, the
       zip's name and the slug the exporter derives the graph's name from. */
    if (parseCardRef(`${value}@1.0.0`) !== undefined) continue;
    faults.push({
      id: blank.id,
      text:
        `\`${value}\` is not a ${blank.kind}. Lowercase letters, digits and hyphens, ` +
        "optionally with a `namespace/` in front.",
    });
  }
  return faults;
}

/**
 * Every blank holding a term its vocabulary does not know.
 *
 * Strict, and the strictness is the engine's: a `type` outside the vocabulary is
 * `card/unknown-term` at ERROR severity, so a bundle carrying one does not resolve and
 * cannot be exported. A page that let it through would hand somebody a folder the first
 * command in its own README refuses.
 */
export function vocabularyFaults(values: BlankValues, ontology: OntologyView): Fault[] {
  const faults: Fault[] = [];
  for (const blank of BLANKS) {
    if (blank.vocab === undefined) continue;
    const value = valueOf(values, blank.id);
    if (value === "") continue;
    const term = ontology.get(value);
    if (term !== undefined && term.kind === blank.vocab) continue;
    const offered = offeredTerms(ontology, blank.vocab);
    faults.push({
      id: blank.id,
      text:
        `\`${value}\` is not a ${blank.vocab} this tutorial writes. ` +
        `One of: ${offered.join(", ")}.`,
    });
  }
  return faults;
}

/**
 * Whether the engine would accept an edge carrying `source` into a `target` port.
 *
 * The rule is `compatible()` in `lib/core/bundle/resolve.ts`, ported rather than
 * approximated: equal, or either side is `any`, or the source is subsumed by the target.
 * The data types are a real hierarchy, so a string comparison would be STRICTER than the
 * engine and would paint a correct bundle red. `json` flows into a `structured` port and
 * everything flows into `any`.
 */
export function portsFit(source: string, target: string, ontology: OntologyView): boolean {
  if (source === target) return true;
  if (source === "any" || target === "any") return true;
  return ontology.isA(source, target);
}

/** The three forward edges, and which blanks hold the two ends of each. */
export const FORWARD_EDGES: readonly {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly a: string;
  readonly b: string;
}[] = [
  { label: "pages", from: "c1_out_type", to: "c2_in_type", a: "n1", b: "n2" },
  { label: "entries", from: "c2_out_type", to: "c3_in_type", a: "n2", b: "n3" },
  { label: "grounded", from: "c3_out_type", to: "c4_in_type", a: "n3", b: "n4" },
];

/**
 * Every edge the engine would refuse, in the engine's own words.
 *
 * `bundle/type-mismatch` reads "Edge `a -> b` has no compatible ports: `a` produces `X`,
 * `b` accepts `Y`", and the strip says the same thing. The design prototype phrased it
 * "does not fit a Y port", which is a second wording for one finding: a reader who fixes
 * it here and then runs `darkprint validate` should meet the sentence they already read.
 */
export function edgeFaults(values: BlankValues, ontology: OntologyView): string[] {
  const faults: string[] = [];
  for (const edge of FORWARD_EDGES) {
    const from = valueOf(values, edge.from);
    const to = valueOf(values, edge.to);
    if (from === "" || to === "") continue;
    if (portsFit(from, to, ontology)) continue;
    const a = valueOf(values, edge.a) || edge.a;
    const b = valueOf(values, edge.b) || edge.b;
    faults.push(
      `Edge \`${a} -> ${b}\` has no compatible ports: \`${a}\` produces \`${from}\`, ` +
        `\`${b}\` accepts \`${to}\`.`,
    );
  }
  return faults;
}

/**
 * Which blanks are still empty, and therefore what the download is waiting for.
 *
 * Steps 01 to 06 are always required. Step 07's are required only once the rubric has been
 * started, so a reader who wants the plain four-node folder from step 06 is not held up by
 * fields belonging to a step they have not reached.
 */
export function emptyBlanks(values: BlankValues): string[] {
  const rubric = rubricStarted(values);
  return BLANKS.filter((blank) => valueOf(values, blank.id) === "")
    .filter((blank) => rubric || !RUBRIC_BLANK_IDS.includes(blank.id))
    .map((blank) => blank.id);
}

/** How many of the blanks in play are filled, and how many there are. */
export function progress(values: BlankValues): { filled: number; total: number } {
  const rubric = rubricStarted(values);
  const inPlay = BLANKS.filter((blank) => rubric || !RUBRIC_BLANK_IDS.includes(blank.id));
  return {
    filled: inPlay.filter((blank) => valueOf(values, blank.id) !== "").length,
    total: inPlay.length,
  };
}

/** The line above the graph: what is defined, how many edges, and the loop's state. */
export function graphStats(values: BlankValues, definedNodes: number): string {
  const capped = valueOf(values, "c3_max_iterations") !== "";
  return [
    `${definedNodes} of 4 nodes defined`,
    rubricStarted(values) ? "5 edges · rubric wired" : "4 edges · no rubric yet",
    capped ? `1 cycle, capped at ${valueOf(values, "c3_max_iterations")}` : "1 cycle, uncapped",
  ].join(" · ");
}
