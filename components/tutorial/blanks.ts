/* ============================================================
   /tutorial — the keywords a reader types, in one table
   ------------------------------------------------------------
   Every blank on the page is a row here, and nothing else declares
   one. The page reads this table to render the fields, to count how
   many are filled, to decide which are still empty when the reader
   asks for the folder, and to know which of them a mirror repeats
   elsewhere. A blank declared in the markup instead would be
   invisible to all four.

   ── why `example` and not `placeholder` ──
   The value doubles as the "fill with example" payload, so it has to
   be the value the tutorial would have shipped if it wrote the file
   itself. Calling it a placeholder would invite somebody to soften
   one into a hint like "your blueprint name", and the fill button
   would then write that into a card.

   ── `vocab` is the whole reason this file is not just strings ──
   Three of the blanks name an ontology term and the engine refuses a
   term it does not hold: a `type` the vocabulary has never heard of
   is `card/unknown-term` at error severity, so a bundle carrying one
   cannot be exported at all. Those three validate strictly against
   `ontologyView(CORE_ONTOLOGY)` before the download is offered,
   which is why the page can promise the folder it hands over
   resolves.
   ============================================================ */

/** The three vocabularies a blank can be held to. `undefined` means free text. */
export type BlankVocabulary = "node-type" | "data-type" | "tool";

export interface Blank {
  readonly id: string;
  /** 1-7. Which step shows this field; also which step must be complete before download. */
  readonly step: number;
  /**
   * The example value, and the value "fill with example" writes.
   *
   * Every one of these has been through `validate` and `export --attractor`: the assembled
   * bundle resolves with no error-severity diagnostic. Changing one is changing a fixture,
   * so `bundle.test.ts` runs the whole set through the engine on every suite.
   */
  readonly example: string;
  /** The accessible name. The field sits inside a `<pre>` with no visible label. */
  readonly label: string;
  /** Held strictly against the core vocabulary when set. */
  readonly vocab?: BlankVocabulary;
  /**
   * Rendered as a `<textarea>` with this many rows.
   *
   * `action` and `spec` are sentences an agent executes rather than identifiers, and a
   * single-line input for a 200-character spec shows the reader eight characters of what
   * they wrote.
   */
  readonly rows?: 2 | 3;
  /** Rough width in `ch`, so a field is the size of the value it expects. */
  readonly width: number;
}

/**
 * The rubric's own blanks, which are optional until the rubric is started.
 *
 * Step 07 adds a fifth card and a scenario, and a reader who wants the plain four-node
 * folder from step 06 must not be blocked by fields belonging to a step they have not
 * reached. `c5_id` is the switch: the moment it holds anything, the rubric is being
 * written and the rest of this list becomes required with it.
 */
export const RUBRIC_BLANK_IDS: readonly string[] = [
  "c5_id",
  "c5_name",
  "s_name",
  "s_seed1",
  "s_seed2",
  "s_min",
  "s_fact",
  "s_cov",
  "s_ground",
  "s_seeds",
];

export const BLANKS: readonly Blank[] = [
  /* 01 name */
  {
    id: "blueprint_name",
    step: 1,
    example: "site-knowledge-desk",
    label: "blueprint name",
    width: 22,
  },
  {
    id: "summary",
    step: 1,
    example:
      "Reads a fixed set of websites, turns what they say into cited entries, and keeps only the entries a checker could trace back to a page.",
    label: "summary",
    rows: 2,
    width: 72,
  },

  /* 02 the crawler */
  { id: "c1_id", step: 2, example: "seed-crawler", label: "crawler id", width: 16 },
  { id: "c1_name", step: 2, example: "Seed Crawler", label: "crawler name", width: 16 },
  {
    id: "c1_type",
    step: 2,
    example: "tool",
    label: "crawler type",
    vocab: "node-type",
    width: 12,
  },
  {
    id: "c1_action",
    step: 2,
    example:
      "Fetch every page reachable from the seed list, staying on the seed hosts, and hand the text on untouched.",
    label: "crawler action",
    rows: 2,
    width: 72,
  },
  {
    id: "c1_spec",
    step: 2,
    example:
      "Start from each seed URL, follow only links on the same host, stop at depth 2, fetch nothing twice. Emit one record per page: url, fetched_at, text. Do not summarise, rank or drop a page: what is worth keeping is the next node's decision.",
    label: "crawler spec",
    rows: 3,
    width: 72,
  },
  { id: "c1_tools", step: 2, example: "http-fetch", label: "crawler tool", vocab: "tool", width: 14 },
  {
    id: "shape_page",
    step: 2,
    example: "{url, fetched_at, text}",
    label: "page record shape",
    width: 24,
  },
  {
    id: "c1_out_type",
    step: 2,
    example: "text",
    label: "crawler output type",
    vocab: "data-type",
    width: 12,
  },
  {
    /* `will_not` and not `cannot`, and the rename is the engine's. `cannot` takes
       `data-type` term ids the resolver enforces against every incoming edge; a sentence
       there is `card/unknown-term` at error severity and the bundle stops resolving. The
       prose promise a node makes in its own words is `will_not`, which nothing checks and
       which is addressed to whoever reads the card. Step 02 says so in the open. */
    id: "c1_will_not",
    step: 2,
    example: "leave the seed hosts",
    label: "what the crawler will not do",
    width: 26,
  },

  /* 03 the extractor */
  { id: "c2_id", step: 3, example: "fact-extractor", label: "extractor id", width: 16 },
  { id: "c2_name", step: 3, example: "Fact Extractor", label: "extractor name", width: 16 },
  {
    id: "c2_type",
    step: 3,
    example: "agent",
    label: "extractor type",
    vocab: "node-type",
    width: 12,
  },
  {
    id: "c2_action",
    step: 3,
    example:
      "Turn each page into structured entries: one claim, one source URL, one quoted span.",
    label: "extractor action",
    rows: 2,
    width: 72,
  },
  {
    id: "c2_in_type",
    step: 3,
    example: "text",
    label: "extractor input type",
    vocab: "data-type",
    width: 12,
  },
  {
    id: "shape_entry",
    step: 3,
    example: "{claim, url, span}",
    label: "entry shape",
    width: 20,
  },
  {
    id: "c2_out_type",
    step: 3,
    example: "structured",
    label: "extractor output type",
    vocab: "data-type",
    width: 12,
  },
  {
    id: "c2_will_not",
    step: 3,
    example: "cite a page it did not read",
    label: "what the extractor will not do",
    width: 30,
  },

  /* 04 the checker, and the writer */
  { id: "c3_id", step: 4, example: "citation-checker", label: "checker id", width: 18 },
  { id: "c3_name", step: 4, example: "Citation Checker", label: "checker name", width: 18 },
  {
    id: "c3_type",
    step: 4,
    example: "validation",
    label: "checker type",
    vocab: "node-type",
    width: 12,
  },
  {
    id: "c3_action",
    step: 4,
    example:
      "Reopen each entry's cited span on its page and split the batch into grounded and unsupported.",
    label: "checker action",
    rows: 2,
    width: 72,
  },
  {
    id: "c3_in_type",
    step: 4,
    example: "structured",
    label: "checker input type",
    vocab: "data-type",
    width: 12,
  },
  {
    id: "c3_out_type",
    step: 4,
    example: "structured",
    label: "checker grounded type",
    vocab: "data-type",
    width: 12,
  },
  {
    /* The number that turns the loop from a hazard into a bounded one, and the one blank
       whose absence the analyser charges. Without a cap on some member of the cycle,
       `unbounded-loop` is inferred on BOTH the extractor and the checker and takes the
       security reading from 4 to 2. `readIterationCap` accepts `max_iterations`,
       `maxIterations` or `max_retries` as a top-level `params` key. */
    id: "c3_max_iterations",
    step: 4,
    example: "3",
    label: "how many turns the loop may take",
    width: 6,
  },
  {
    id: "c3_will_not",
    step: 4,
    example: "rewrite an entry it rejected",
    label: "what the checker will not do",
    width: 30,
  },
  { id: "c4_id", step: 4, example: "knowledge-writer", label: "writer id", width: 18 },
  { id: "c4_type", step: 4, example: "tool", label: "writer type", vocab: "node-type", width: 12 },
  {
    id: "c4_in_type",
    step: 4,
    example: "structured",
    label: "writer input type",
    vocab: "data-type",
    width: 12,
  },

  /* 05 wire them */
  { id: "n1", step: 5, example: "crawl", label: "first node name", width: 12 },
  { id: "n2", step: 5, example: "extract", label: "second node name", width: 12 },
  { id: "n3", step: 5, example: "verify", label: "third node name", width: 12 },
  { id: "n4", step: 5, example: "assemble", label: "fourth node name", width: 12 },

  /* 07 measure it */
  { id: "c5_id", step: 7, example: "rubric-author", label: "rubric card id", width: 16 },
  { id: "c5_name", step: 7, example: "Rubric Author", label: "rubric card name", width: 16 },
  { id: "s_name", step: 7, example: "python-release-notes", label: "scenario name", width: 24 },
  {
    id: "s_seed1",
    step: 7,
    example: "https://docs.python.org/3/whatsnew/",
    label: "first seed site",
    width: 40,
  },
  {
    id: "s_seed2",
    step: 7,
    example: "https://peps.python.org/",
    label: "second seed site",
    width: 40,
  },
  { id: "s_min", step: 7, example: "40", label: "minimum entries", width: 6 },
  {
    id: "s_fact",
    step: 7,
    example: "PEP 703 makes the GIL optional",
    label: "a fact that must appear",
    width: 34,
  },
  { id: "s_cov", step: 7, example: "0.8", label: "coverage threshold", width: 6 },
  { id: "s_ground", step: 7, example: "1.0", label: "grounding threshold", width: 6 },
  { id: "s_seeds", step: 7, example: "1.0", label: "within-seeds threshold", width: 6 },
];

/** Every blank, by id. Built once: the page looks one up on every keystroke. */
export const BLANK_BY_ID: ReadonlyMap<string, Blank> = new Map(
  BLANKS.map((blank) => [blank.id, blank]),
);

/** The values a reader has typed, keyed by blank id. Absent and empty mean the same thing. */
export type BlankValues = Readonly<Record<string, string>>;

/** Every blank at its example value, which is what "fill with example" writes. */
export function exampleValues(): BlankValues {
  const values: Record<string, string> = {};
  for (const blank of BLANKS) values[blank.id] = blank.example;
  return values;
}

/** A trimmed value, or the empty string. One reader, so trimming cannot be forgotten. */
export function valueOf(values: BlankValues, id: string): string {
  return (values[id] ?? "").trim();
}
