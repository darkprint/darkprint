/* ============================================================
   T040 — fixtures, and the oracle AC1 is measured against

   Not a test file.

   ── the oracle, and why it is not mine ──
   AC1 asks that the nine archive bundles "return the diagnostics,
   autonomy class and security level the build computes today". A
   test that computes those by calling `loadBundle` itself and then
   compares them to `validateBundle` is measuring the wrapper
   against the thing it wraps, through the same route, and would go
   green against an implementation that ignores half its arguments
   as long as it ignored them consistently.

   `public/bundles/<slug>/README.md` is written by `prebuild`
   (`scripts/generate-bundles.ts`), committed, and carries five
   figures per bundle in its own words:

       bundle digest  sha256:<64 hex>
       Autonomy: <Class>.
       > <the autonomy sentence, ordinal removed>
       Security level <n>.
       > <the security rationale string, verbatim>

   It is produced by a different route from `loadBundle`'s return
   value and it sits on disk before this suite runs. **And it can
   go red**: all nine digests, classes, sentences, levels and
   rationales were reproduced from the shipped folder bytes before
   they were adopted, and dropping the vocabulary from
   `frontline-triage` moves four of the five. That is the
   two-factor check this run requires of a reference — a reference
   that cannot register the quantity reads zero for the same reason
   a broken one does.

   The fifth, `autonomyClass`, is the one that does NOT move, and
   saying so here is the point. It was `conditional` with the
   vocabulary and `supervised` without it until the autonomy
   reading gained its control-point half; both sides now land in
   the same band (0.6667 and 0.50, against a `level2` cut-off of
   0.50) and the class alone can no longer tell them apart. Four
   names cannot separate two graphs that score three digits apart,
   which is why `autonomyStatement` is parsed beside the class
   rather than the class being trusted to carry the axis on its
   own.

   ── what the oracle observes, stated rather than implied ──
   Only `frontline-triage` ships `ontology/extensions.yaml`. The
   other eight score identically with and without a vocabulary, so
   the nine-case sweep carries a ONE-case discriminator for the
   `vocabulary` argument. Reported as D-40-09 and repeated here so
   nine greens are not read as nine independent checks.

   ── floor assertions ──
   Every parse below refuses rather than returning an empty set. A
   README whose format drifts must red as "the oracle did not
   parse", never as nine bundles that happened to match nothing:
   a set that can only be empty is not a measurement.
   ============================================================ */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import type { BundleManifest, OntologyTerm, OntologyView } from "@/lib/core";
import { parseOntologyTerms } from "@/lib/content/ontology-file";

/** The input shape the published signature takes. Written out, not imported. */
export interface EngineInput {
  manifest: BundleManifest;
  dot: string;
  cardFiles: Record<string, string>;
  extensions?: readonly OntologyTerm[];
  ontology?: OntologyView;
}

export interface ArchiveOracle {
  digest: string;
  autonomyClass: string;
  /**
   * The autonomy sentence the README quotes: the engine's `rationale` with the band ordinal
   * taken out by `lib/format.ts:autonomyStatement`, which is the one transform between the
   * two. It carries the counts and the comparison, so it separates two graphs the four class
   * names round onto one word.
   */
  autonomyStatement: string;
  securityLevel: number;
  securityRationale: string;
}

export interface ArchiveCase {
  slug: string;
  input: EngineInput;
  oracle: ArchiveOracle;
  /** True for the one bundle that ships a local vocabulary. */
  carriesVocabulary: boolean;
}

const BUNDLES_DIR = "public/bundles";
const BLUEPRINTS_DIR = "content/blueprints";
const EXTENSIONS_FILE = "ontology/extensions.yaml";

/** The archive as it ships. Ten, and the count is asserted rather than assumed. */
export const EXPECTED_BUNDLE_COUNT = 10;

function readOracle(slug: string): ArchiveOracle {
  const path = join(BUNDLES_DIR, slug, "README.md");
  const text = readFileSync(path, "utf8");

  const digest = /^bundle digest\s+(sha256:[0-9a-f]{64})$/m.exec(text);
  const autonomy = /^Autonomy: (.+)\.$/m.exec(text);
  /* The autonomy sentence is the blockquote directly under the class line, anchored to it for
     the same reason the security rationale is anchored to its own: the document carries two
     blockquotes and an unanchored pattern would take whichever came first. */
  const statement = /^Autonomy: .+\.\n\n> (.+)$/m.exec(text);
  const level = /^Security level (\d+)\.$/m.exec(text);
  /* The rationale is the blockquote directly under the level line. Anchored to that line so a
     second blockquote elsewhere in the document cannot be picked up by accident. */
  const rationale = /^Security level \d+\.\n\n> (.+)$/m.exec(text);

  const missing = [
    digest === null ? "bundle digest" : undefined,
    autonomy === null ? "Autonomy:" : undefined,
    statement === null ? "the autonomy sentence blockquote" : undefined,
    level === null ? "Security level" : undefined,
    rationale === null ? "the security rationale blockquote" : undefined,
  ].filter((x): x is string => x !== undefined);

  if (
    missing.length > 0 ||
    digest === null ||
    autonomy === null ||
    statement === null ||
    level === null ||
    rationale === null
  ) {
    throw new Error(
      `${path} did not yield ${missing.join(", ")}.\n` +
        `  This is a defect in THIS suite's oracle, not in \`@/lib/server/engine\`. AC1 is ` +
        `measured against the figures \`prebuild\` writes into that file; if its format moved, ` +
        `the parser above moves with it. Reporting the miss rather than returning an empty set ` +
        `is the whole reason this throws.`,
    );
  }

  return {
    digest: digest[1],
    /* "Closed-loop." in the document, `closed-loop` in `AutonomyClass`. Lowercased rather
       than mapped through a table, because a table is a list and a list goes stale. */
    autonomyClass: autonomy[1].toLowerCase(),
    autonomyStatement: statement[1],
    securityLevel: Number(level[1]),
    securityRationale: rationale[1],
  };
}

/**
 * One archive bundle, assembled from the bytes the site actually hands out.
 *
 * The manifest comes from `content/blueprints/<slug>/blueprint.yaml` because a downloaded
 * folder carries none — which is itself worth knowing, since `validateBundle`'s `manifest` is
 * not optional and a caller replaying a download has to supply one from somewhere.
 */
export function archiveCase(slug: string): ArchiveCase {
  const dir = join(BUNDLES_DIR, slug);
  const dot = readFileSync(join(dir, "topology.dot"), "utf8");
  const manifest = parseYaml(
    readFileSync(join(BLUEPRINTS_DIR, slug, "blueprint.yaml"), "utf8"),
  ) as BundleManifest;

  const cardFiles: Record<string, string> = {};
  for (const file of readdirSync(join(dir, "cards")).sort()) {
    cardFiles[`cards/${file}`] = readFileSync(join(dir, "cards", file), "utf8");
  }
  if (Object.keys(cardFiles).length === 0) {
    throw new Error(`${dir}/cards is empty; the fixture would assert nothing.`);
  }

  const extensionsPath = join(dir, EXTENSIONS_FILE);
  const carriesVocabulary = existsSync(extensionsPath);
  const extensions = carriesVocabulary
    ? parseOntologyTerms(
        parseYaml(readFileSync(extensionsPath, "utf8")) as unknown,
        EXTENSIONS_FILE,
      )
    : undefined;

  return {
    slug,
    input: extensions === undefined ? { manifest, dot, cardFiles } : { manifest, dot, cardFiles, extensions },
    oracle: readOracle(slug),
    carriesVocabulary,
  };
}

/**
 * The slugs alone, listed without reading a README.
 *
 * Separate from `archiveCases()` on purpose: the slug list is what a `describe` loop needs at
 * COLLECTION time, and a parse failure inside the oracle must red one test rather than abort
 * the file. A collection abort prints file-level FAIL lines with no test path, which is the
 * shape a set-difference instrument cannot see.
 */
export function archiveSlugs(): string[] {
  return readdirSync(BUNDLES_DIR).sort();
}

let cases: ArchiveCase[] | undefined;

/** All nine, sorted by slug. Read once — the archive cannot change under a run. */
export function archiveCases(): ArchiveCase[] {
  cases ??= archiveSlugs().map(archiveCase);
  return cases;
}

/** The one bundle whose cards name a term only its own vocabulary defines. */
export const VOCABULARY_BUNDLE = "frontline-triage";
/** The local term those cards name. `card/unknown-term` quotes it when the vocabulary is absent. */
export const LOCAL_TERM = "lupo/pii-handling";
/** An eight-node bundle, used for AC2's three-of-eight case. */
export const EIGHT_NODE_BUNDLE = "adversarial-consensus-line";

export function caseFor(slug: string): ArchiveCase {
  const found = archiveCases().find((c) => c.slug === slug);
  if (found === undefined) {
    throw new Error(
      `${BUNDLES_DIR} has no \`${slug}\`. The fixture names a bundle the archive no longer ` +
        `ships, which is a defect in this suite rather than in the engine service.`,
    );
  }
  return found;
}

/* --------------------- derived inputs --------------------- */

/** A copy with only the first `n` card files kept, in sorted key order. */
export function keepCards(input: EngineInput, n: number): EngineInput {
  const keys = Object.keys(input.cardFiles).sort();
  if (n > keys.length) {
    throw new Error(`fixture asks for ${n} of ${keys.length} cards; there are not that many.`);
  }
  const cardFiles: Record<string, string> = {};
  for (const key of keys.slice(0, n)) cardFiles[key] = input.cardFiles[key];
  return { ...input, cardFiles };
}

/** A copy carrying a different DOT source and every card the original had. */
export function withDot(input: EngineInput, dot: string): EngineInput {
  return { ...input, dot };
}

/** A copy with `extensions` removed entirely. */
export function withoutVocabulary(input: EngineInput): EngineInput {
  const { manifest, dot, cardFiles } = input;
  return { manifest, dot, cardFiles };
}

/** A copy whose `cardFiles` keys were inserted in reverse sorted order. */
export function reverseCardOrder(input: EngineInput): EngineInput {
  const cardFiles: Record<string, string> = {};
  for (const key of Object.keys(input.cardFiles).sort().reverse()) {
    cardFiles[key] = input.cardFiles[key];
  }
  return { ...input, cardFiles };
}

/* --------------------- DOT that does not parse --------------------- */

/**
 * Two sources that fail at DIFFERENT positions and produce the IDENTICAL message.
 *
 * The pair is the point. AC3 says a parse failure "returns a diagnostic carrying line and
 * column", and a test asserting only that `line` and `column` are *defined* is passed by an
 * implementation reporting 1:1 for everything — presence wearing identity's clothes. Two
 * fixtures whose only difference is where the fault sits force the reported position to
 * track the input.
 *
 * Positions measured against base `lib/core` before they were written here.
 */
export const UNPARSEABLE_LINE_2 = "digraph g {\n  a -> ;\n}\n";
export const UNPARSEABLE_LINE_3 = "digraph g {\n  a -> b;\n  c -> ;\n}\n";
export const UNPARSEABLE_POSITIONS: Readonly<Record<string, { line: number; column: number }>> = {
  [UNPARSEABLE_LINE_2]: { line: 2, column: 8 },
  [UNPARSEABLE_LINE_3]: { line: 3, column: 8 },
};

/** Not a graph at all: the failure is at the very first token. */
export const NOT_A_GRAPH = "not a graph at all";

/* --------------------- a bundle with nothing to say --------------------- */

/**
 * One node, one card, and — measured — **zero diagnostics**.
 *
 * The fourth input class the service boundary has to answer for, and the only one the archive
 * cannot supply: all nine shipped bundles carry at least one warning, so without this fixture
 * "resolves cleanly" would go untested while looking covered.
 */
export function cleanInput(): EngineInput {
  const source = caseFor(EIGHT_NODE_BUNDLE);
  const cardKey = "cards/task-intake@1.0.0.yaml";
  const card = source.input.cardFiles[cardKey];
  if (card === undefined) {
    throw new Error(
      `${EIGHT_NODE_BUNDLE} no longer ships \`${cardKey}\`; the clean-bundle fixture names a ` +
        `card the archive does not have.`,
    );
  }
  return {
    manifest: source.input.manifest,
    dot: 'digraph g {\n  only [card="task-intake@1.0.0"];\n}\n',
    cardFiles: { [cardKey]: card },
  };
}

/* --------------------- vocabularies --------------------- */

/**
 * A local term that declares no `broader`, so no term of the curated core subsumes it.
 *
 * `OntologyView.validate()` answers `ontology/local-term-unrooted` for it and `loadBundle`
 * answers nothing — measured both ways against base. That pair is what makes the contract's
 * "vocabulary defects are reported separately from bundle defects" checkable in **both**
 * directions rather than only as an absence.
 */
export const UNROOTED_VOCABULARY_YAML = [
  'version: "0.1.0"',
  "terms:",
  "  - id: zz/unrooted-marker",
  "    kind: risk-marker",
  "    label: Unrooted marker",
  "    description: A local term pointing at nothing in the curated core.",
  "    defaultWeight: 0.5",
  '    since: "0.1.0"',
  "",
].join("\n");

/** The same document, well-formed and rooted. Nothing to report about it. */
export const ROOTED_VOCABULARY_YAML = [
  'version: "0.1.0"',
  "terms:",
  "  - id: zz/rooted-marker",
  "    kind: risk-marker",
  "    label: Rooted marker",
  "    description: A local term rooted in the curated core.",
  "    broader: isolation-breach",
  "    defaultWeight: 0.5",
  '    since: "0.1.0"',
  "",
].join("\n");

export const UNROOTED_TERMS: readonly OntologyTerm[] = parseOntologyTerms(
  parseYaml(UNROOTED_VOCABULARY_YAML) as unknown,
  EXTENSIONS_FILE,
);

/* --------------------- card sources --------------------- */

/** A card document that is not YAML at all. `card/parse-error` carries the position. */
export const MALFORMED_CARD_YAML = "id: solver\n  name: [unclosed\n";

/** Well-formed YAML, and not a card: every required field is missing. */
export const NOT_A_CARD_YAML = "just: a mapping\nwith: no card fields\n";

/** A vocabulary document that is not YAML at all: the failure is at the parser. */
export const MALFORMED_VOCABULARY_YAML = "version: 0.1.0\nterms: [\n";

/**
 * Valid YAML whose `terms` are not a list of terms — a SECOND refusal path, and the one a
 * mutation found unobserved.
 *
 * The document above fails at the YAML parser; this one parses perfectly and is refused by
 * whatever reads `terms`. A module that returned `terms: []` beside the refusal of this one
 * passed every test written against the first, because the first never reaches that branch.
 */
export const NOT_A_VOCABULARY_YAML = 'version: "0.1.0"\nterms: not-a-list\n';

/** A DOT that PARSES into a graph and still carries a parse-stage diagnostic. */
export const PARSES_WITH_A_COMPLAINT = "graph g {\n  a -- b;\n}\n";

/**
 * A card document with two leading blank lines, for use inside a bundle.
 *
 * `card/parse-error` carries a line, so a module that trimmed or re-indented card texts before
 * handing them to the engine would report a position two lines off — pointing an author at the
 * wrong line of their own file. The bundle-level twin of the same check on `validateCardSource`.
 */
export const MALFORMED_CARD_WITH_LEADING_BLANKS = `\n\n${"id: solver\n  name: [unclosed\n"}`;

/* --------------------- Attractor lint (D-40-13) --------------------- */

/**
 * A DOT that **parses with zero diagnostics** and lints one Attractor warning.
 *
 * The discriminator for `validateDot` being `parseDot` **+** `lintAttractor` rather than
 * `parseDot` alone. Measured against base: `parseDot` returns no diagnostics for this source
 * and `lintAttractor` returns `attractor/bad-node-id` at 2:3, so a parse-only implementation
 * answers `[]` — a green on every other test in the file and a red only here.
 *
 * The archive could never have observed this half: all nine shipped DOTs lint clean.
 */
export const LINTS_BAD_NODE_ID = 'digraph g {\n  "Node One" -> b;\n}\n';
export const LINT_BAD_NODE_ID_AT = { line: 2, column: 3 } as const;

/** A `strict digraph`, which Attractor does not read. Parses clean, lints `attractor/strict-graph`. */
export const LINTS_STRICT_GRAPH = "strict digraph g {\n  a -> b;\n}\n";

/* --------------------- the archive's own maxima --------------------- */

/**
 * What `DEFAULT_ENGINE_LIMITS` has to clear, measured from the shipped bytes rather than
 * quoted from the contract.
 *
 * D-40-07: "the default is chosen so **all nine archive bundles pass**, which is what keeps
 * AC1 and AC4 from contradicting each other." That is a property with two sides, and only one
 * of them can be checked against a constant: `limits.test.ts` asserts the default exceeds each
 * figure below **and** that every bundle really does pass with `limits` omitted, because a
 * number large enough on paper says nothing about whether the check reads the thing it names.
 *
 * Recomputed here rather than hard-coded, so a bundle added to the archive tightens the bound
 * instead of leaving it stale — the numbers in the comment are what they were when written.
 * `maxBytes` is the JSON encoding of the whole input; how the module measures its own input is
 * unpublished (reported), so this is the largest of the plausible readings and therefore a
 * safe lower bound for any of them.
 *
 *     largest submission   17 947 bytes   grounded-research-desk
 *     most cards            9             checkpoint-resume-runner
 *     most nodes            9             checkpoint-resume-runner
 */
export function archiveMaxima(): { bytes: number; cards: number; nodes: number } {
  let bytes = 0;
  let cards = 0;
  for (const { input } of archiveCases()) {
    bytes = Math.max(bytes, Buffer.byteLength(JSON.stringify(input), "utf8"));
    cards = Math.max(cards, Object.keys(input.cardFiles).length);
  }
  /* Node count is the DOT's, and counting it here would mean parsing DOT in a fixture. Every
     shipped bundle pins exactly one card per node, so the card count is the node count — a
     fact asserted in `limits.test.ts` rather than assumed here. */
  return { bytes, cards, nodes: cards };
}

/* --------------------- oversized submissions --------------------- */

/**
 * An input carrying the leak sentinel, so a refusal that quotes the submission is caught by an
 * exact-match pin rather than by scanning for what should not be there.
 *
 * The sentinel goes in three places a careless message could reach for — the slug, the DOT and
 * a card's text — because a refusal built from any one of them is the same defect.
 */
export function sentinelInput(sentinel: string, cardCount: number): EngineInput {
  const cardFiles: Record<string, string> = {};
  for (let i = 0; i < cardCount; i += 1) {
    cardFiles[`cards/${sentinel}-${i}@1.0.0.yaml`] = `id: ${sentinel}-${i}\n# ${sentinel}\n`;
  }
  return {
    manifest: {
      slug: sentinel,
      title: sentinel,
      summary: sentinel,
      tags: [sentinel],
    },
    dot: `digraph g {\n  // ${sentinel}\n  a -> b;\n}\n`,
    cardFiles,
  };
}

/* --------------------- D-40-D/F/G: the measure's own inputs --------------------- */

/**
 * A chain of `depth` nested objects, built ITERATIVELY.
 *
 * Iterative because a recursive builder blows this suite's own stack long before it reaches the
 * depths the ceiling is about — and a fixture that cannot construct the input is a test that
 * reports something about the fixture. Nothing here calls `JSON.stringify` on the result either,
 * for the same reason.
 */
export function nestedTo(depth: number): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let cursor = root;
  for (let i = 0; i < depth; i += 1) {
    const next: Record<string, unknown> = {};
    cursor.deep = next;
    cursor = next;
  }
  return root;
}

/** `n` sibling plain objects — containers with nothing boxed anywhere in them. */
export function manyContainers(n: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < n; i += 1) out[`c${i}`] = { a: i, b: `v${i}` };
  return out;
}

/**
 * How many containers a value actually holds, counted by WALKING IT.
 *
 * Deliberately not the loop bound that built it. T040's round-4 implementer mutated one of its own
 * anti-vacuity controls and got 0, because the control compared two numbers both computed from the
 * loop bound — so a declared count could not move with the thing it described. A count taken from
 * the artefact can; a count taken from the recipe cannot.
 */
export function countContainers(value: unknown): number {
  let n = 0;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (v === null || typeof v !== "object") continue;
    n += 1;
    for (const child of Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)) {
      stack.push(child);
    }
  }
  return n;
}

/**
 * The two halves of D-40-G's partition, built from what the serialiser ACTUALLY does rather than
 * from a list of what it is supposed to do. Every entry below was measured against
 * `JSON.stringify` before it was written here, and `measure.test.ts` re-measures the partition at
 * run time rather than trusting these labels — a construction over an author's transcription of
 * the serialiser's branches is a maintained list one level up, which is D-40-G's own charge.
 */
export const REFUSED_BY_SERIALISER: Readonly<Record<string, () => unknown>> = {
  "a bigint": () => BigInt(1),
  "a boxed bigint": () => Object(BigInt(1)),
  "a bigint inside an array": () => [BigInt(2)],
  "a bigint one level down": () => ({ inner: BigInt(3) }),
};

export const DROPPED_BY_SERIALISER: Readonly<Record<string, () => unknown>> = {
  undefined: () => undefined,
  "a function": () => () => 1,
  "a symbol": () => Symbol("dropped"),
};

/** Values the serialiser UNBOXES rather than refusing — the three slots that were implemented. */
export const UNBOXED_BY_SERIALISER: Readonly<Record<string, () => unknown>> = {
  "a boxed string": () => Object("boxed"),
  "a boxed number": () => Object(1234),
  "a boxed boolean": () => Object(true),
};

/** Put a value in the submission at a place the walk must reach. */
export function manifestCarrying(base: EngineInput, value: unknown): EngineInput {
  return { ...base, manifest: { ...base.manifest, planted: value } as never };
}

/** The same, through the other caller-built object the published block says this module walks. */
export function extensionsCarrying(base: EngineInput, value: unknown): EngineInput {
  const { manifest, dot, cardFiles } = base;
  return { manifest, dot, cardFiles, extensions: [{ planted: value }] as never };
}

/* --------------------- D-40-H: step 4's two coercions and two reads --------------------- */

/**
 * Install a channel on a boxed primitive without making it an own enumerable key.
 *
 * `JSON.stringify` unboxes a boxed primitive, so own properties never reach the output either
 * way — but a non-enumerable definition keeps the fixture honest about what it is changing, which
 * is the channel and not the object's shape.
 */
export function withChannel<T extends object>(
  boxed: T,
  channel: "valueOf" | "toString" | "toPrimitive",
  fn: () => unknown,
): T {
  const key = channel === "toPrimitive" ? Symbol.toPrimitive : channel;
  Object.defineProperty(boxed, key, { value: fn, configurable: true, writable: true });
  return boxed;
}

/**
 * `Buffer.byteLength(JSON.stringify(input), "utf8")` — D-40-17's literal, used here as the ORACLE
 * for what a submission measures.
 *
 * The measured number is on no published return, so the only way to observe it is the `maxBytes`
 * boundary: accepted at exactly this many bytes, refused at one fewer. Every coercion cell below
 * is driven that way, and the oracle is the serialiser itself rather than any number written down
 * by me — which is the whole of what "the walk agrees with the ruled formula" means.
 */
export function submissionBytes(input: EngineInput): number {
  return Buffer.byteLength(JSON.stringify(input), "utf8");
}
