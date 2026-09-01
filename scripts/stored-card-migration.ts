/* ============================================================
   DarkPrint — the pure half of the stored-card migration
   D-92 retired `requires_human`, D-93 removed `ontologyVersion`
   from the bundle manifest, and D-101 split the single `cannot`
   list into an ENFORCED half (`cannot`, ontology `data-type` ids
   the resolver holds every incoming edge to) and a STATED half
   (`will_not`, free sentences). `content/` was migrated. The
   registry rows were not: on 2026-09-01 all 58 `card_version`
   rows still carried `requiresHuman` and `ontologyVersion` in
   `body`, none carried `willNot`, and 85 of the 87 entries in
   their `cannot` lists were prose sentences that `loadCard`
   refuses at ERROR severity as `card/unknown-term`. Every stored
   YAML source is therefore unreadable by the engine that wrote
   it, which takes down `/blueprints`, `/nodes` and every export.

   ── Why this module exists apart from the runner ──
   Same split, same reason, as `scripts/skill-refs.ts` beside
   `scripts/generate-skill-refs.ts`: this module decides WHAT the
   transform is and imports `@/lib/core` statically, which is what
   lets vitest — whose config already aliases `@/` — exercise it
   directly with no database, no filesystem and no subprocess.
   `scripts/migrate-stored-cards.ts` is the thin half that
   installs Node's resolver hook, reads rows, and writes.

   ── Why the YAML is edited as LINES and not re-serialised ──
   `card_version.source` is served verbatim by `lib/server/export/
   build.ts` (`source`, not `body`, so the folder hashes to the
   digest its README prints). Re-emitting it through a YAML writer
   would reflow every folded scalar and rewrite every blank line,
   producing bytes that differ from `content/cards/` everywhere
   rather than only where D-101 moved something — and the
   migration's own cross-check is "does the mechanical transform
   land on the archive". So the edit is the smallest textual one
   that expresses the three rules, and anything it does not
   recognise is REFUSED rather than repaired. A migration that
   guesses at a shape it has not seen is how 85 sentences ended up
   in a field typed as a vocabulary in the first place.
   ============================================================ */

import type { NodeCard, OntologyView } from "@/lib/core";

/* --------------------- the three rules --------------------- */

/**
 * Keys D-92 and D-93 withdrew, in both spellings, because both used to load.
 *
 * `lib/core/card/validate.ts` reports these as `card/retired-field` at WARNING severity,
 * so they are not what breaks the stored rows — the prose in `cannot` is. They are still
 * deleted here, because a warning on all 58 rows is a warning nobody will ever read as
 * signal, and because `NodeCard` no longer declares either field.
 */
export const RETIRED_CARD_KEYS: readonly string[] = Object.freeze([
  "requires_human",
  "requiresHuman",
  "ontology_version",
  "ontologyVersion",
]);

/** `body` is camelCase (it is a parsed `NodeCard`), so only these two can appear there. */
const RETIRED_BODY_KEYS: readonly string[] = Object.freeze(["requiresHuman", "ontologyVersion"]);

/** One prohibition list, split into the half the resolver enforces and the half it reads. */
export interface ProhibitionSplit {
  /** Ontology `data-type` ids. The resolver refuses every incoming edge that carries one. */
  cannot: string[];
  /** Everything else, verbatim and in the order it was written. The engine reads it as prose. */
  willNot: string[];
}

/**
 * D-101's split, applied with the validator's own predicate rather than a second one.
 *
 * `lib/core/card/validate.ts`'s `checkTerm` resolves an entry with `ontology.get(id)` and
 * falls back to `ontology.resolve(id)` (one deprecation redirect), then requires
 * `kind === "data-type"`. Anything else is `card/unknown-term` or `card/wrong-term-kind`,
 * both errors. Asking the same question the same way is what makes the result loadable by
 * construction: an entry this function leaves in `cannot` is exactly an entry `validateCard`
 * will accept there.
 *
 * Nothing is dropped and nothing is reordered. `cannot` and `willNot` each keep the
 * original relative order, so `cannot[i]` and `willNot[j]` read in the sequence the author
 * wrote them, and the two lists together are a permutation of the input.
 */
export function splitProhibitions(entries: readonly string[], ontology: OntologyView): ProhibitionSplit {
  const cannot: string[] = [];
  const willNot: string[] = [];
  for (const entry of entries) {
    const term = ontology.get(entry) ?? ontology.resolve(entry)?.term;
    if (term !== undefined && term.kind === "data-type") cannot.push(entry);
    else willNot.push(entry);
  }
  return { cannot, willNot };
}

/* --------------------- refusals --------------------- */

/**
 * A shape the transform will not guess at.
 *
 * Carries the ref and the 1-based line, never the offending text: an operator needs to know
 * which file and where, and a message that quotes a card's own prose is a message that ends
 * up in a terminal scrollback, a paste, and eventually a ticket. Same reasoning as D-13 one
 * layer down, applied to a script.
 */
export class CardMigrationRefusal extends Error {
  /* Assigned in the body rather than declared as constructor parameter properties: the
     runner is executed by `node --experimental-strip-types`, which is strip-only and
     refuses `constructor(readonly ref: string)` with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX. */
  readonly ref: string;
  readonly reason: string;
  readonly line: number | undefined;

  constructor(ref: string, reason: string, line?: number) {
    super(`${ref}: ${reason}${line === undefined ? "" : ` (line ${line})`}`);
    this.name = "CardMigrationRefusal";
    this.ref = ref;
    this.reason = reason;
    this.line = line;
  }
}

/* --------------------- old body -> new body --------------------- */

/**
 * The stored `jsonb` body, brought onto the post-D-101 shape.
 *
 * Returns a new object; the input is never mutated, because the caller compares the two.
 * The result is deliberately typed as a plain record rather than as `NodeCard`: this
 * function transforms whatever the column happens to hold, and asserting it is a card is
 * `storedCardGaps`'s job, run by the caller against the value about to be written. Calling
 * it a `NodeCard` here would be the cast `lib/server/cards/stored-card.ts` exists to end.
 *
 * `cannot` absent is not an error — `stringList` defaults it to `[]` — but a `cannot` that
 * is present and not a list of strings is, because splitting it would mean inventing a
 * reading for it.
 */
export function migrateCardBody(
  ref: string,
  body: unknown,
  ontology: OntologyView,
): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new CardMigrationRefusal(ref, "the stored body is not a JSON object");
  }
  const row = body as Record<string, unknown>;

  if (Object.hasOwn(row, "willNot")) {
    throw new CardMigrationRefusal(ref, "the stored body already carries `willNot`; it looks migrated");
  }

  const raw = row.cannot;
  if (raw !== undefined && !(Array.isArray(raw) && raw.every((e) => typeof e === "string"))) {
    throw new CardMigrationRefusal(ref, "`cannot` is present and is not a list of strings");
  }
  const split = splitProhibitions((raw ?? []) as readonly string[], ontology);

  const next: Record<string, unknown> = { ...row };
  for (const key of RETIRED_BODY_KEYS) delete next[key];
  next.cannot = split.cannot;
  next.willNot = split.willNot;
  return next;
}

/* --------------------- old YAML -> new YAML --------------------- */

/** A column-0 key line, e.g. `cannot:` or `requires_human: false`. Indented lines never match. */
const TOP_LEVEL_KEY = /^([A-Za-z_][A-Za-z0-9_]*):(.*)$/;

/** A block-sequence entry as every card in the corpus writes one: two spaces, dash, space. */
const BLOCK_ENTRY = /^ {2}- (.*)$/;

/**
 * The stored YAML bytes, brought onto the post-D-101 shape, changed only where a rule applies.
 *
 * Three edits, and nothing else moves — not a blank line, not an indent, not the trailing
 * newline:
 *
 *  1. every column-0 `requires_human:` / `ontology_version:` line (both spellings) is deleted;
 *  2. the `cannot:` block's entries are split by `splitProhibitions`;
 *  3. a `will_not:` header is written immediately after the surviving `cannot` entries, and
 *     `cannot:` collapses to `cannot: []` when nothing stays.
 *
 * Refuses rather than guesses on: a CR (the corpus is LF and a CR would defeat every anchor
 * below, silently leaving the file unmigrated); a second column-0 `cannot:`; a `cannot:`
 * carrying an inline non-empty sequence, which would need a YAML writer to split; a
 * multi-line or quoted entry, whose text is not what the line holds; and a document that
 * already has `will_not:`.
 */
export function migrateCardSource(ref: string, source: string, ontology: OntologyView): string {
  if (source.includes("\r")) {
    throw new CardMigrationRefusal(ref, "the source contains a carriage return; this transform is LF only");
  }

  const lines = source.split("\n");
  const out: string[] = [];
  let sawCannot = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const key = TOP_LEVEL_KEY.exec(line);

    if (key === null) {
      out.push(line);
      continue;
    }

    const name = key[1] as string;
    const inline = (key[2] as string).trim();

    if (RETIRED_CARD_KEYS.includes(name)) continue;

    if (name === "will_not" || name === "willNot") {
      throw new CardMigrationRefusal(ref, "the source already carries `will_not`; it looks migrated", i + 1);
    }

    if (name !== "cannot") {
      out.push(line);
      continue;
    }

    if (sawCannot) {
      throw new CardMigrationRefusal(ref, "a second column-0 `cannot:` key", i + 1);
    }
    sawCannot = true;

    if (inline !== "") {
      /* `cannot: []` is already the post-D-101 empty form and there is nothing to move out
         of it. Any other inline value is a flow sequence, and rewriting one into two flow
         sequences is a YAML-writing problem this transform declines to have. */
      if (inline !== "[]") {
        throw new CardMigrationRefusal(ref, "`cannot` holds an inline sequence this transform cannot split", i + 1);
      }
      out.push(line);
      continue;
    }

    /* Block form. The entries run until the first line that is not `  - …`, which in every
       card in the corpus is the blank line before the next key. */
    const entries: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const entry = BLOCK_ENTRY.exec(lines[j] as string);
      if (entry === null) break;
      const text = (entry[1] as string).trim();
      if (text === "" || /^["'&*!|>%@`{[]/.test(text)) {
        throw new CardMigrationRefusal(ref, "a `cannot` entry is quoted, empty or multi-line", j + 1);
      }
      entries.push(text);
    }

    const split = splitProhibitions(entries, ontology);
    out.push(split.cannot.length === 0 ? "cannot: []" : "cannot:");
    for (const entry of split.cannot) out.push(`  - ${entry}`);
    if (split.willNot.length > 0) {
      out.push("will_not:");
      for (const entry of split.willNot) out.push(`  - ${entry}`);
    }
    i = j - 1;
  }

  return out.join("\n");
}

/* --------------------- rollback SQL literals --------------------- */

/**
 * A Postgres string literal for `value`, dollar-quoted with a tag that cannot appear in it.
 *
 * Measured on the corpus this migration restores: 40 of the 58 stored sources contain a
 * single quote and 1 contains a backslash. Hand-doubling quotes into a `'…'` literal is the
 * classic way to write a rollback file that applies cleanly and restores different bytes,
 * and the rollback is the one artefact whose failure mode is silent — nobody reads it until
 * the moment it is the only copy left. A dollar-quoted body performs no escape processing
 * at all, so the bytes between the delimiters are the bytes stored.
 *
 * The tag grows until it does not occur in the value, so it is chosen against the content
 * rather than assumed to be safe.
 */
export function dollarQuoted(value: string): string {
  let tag = "dp";
  while (value.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${value}$${tag}$`;
}

/** A `text[]` literal built from dollar-quoted members, cast so an empty array still types. */
export function textArrayLiteral(values: readonly string[]): string {
  return `ARRAY[${values.map(dollarQuoted).join(", ")}]::text[]`;
}

/** A `jsonb` literal, or the keyword `NULL` for a column that held nothing. */
export function jsonbLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  return `${dollarQuoted(JSON.stringify(value))}::jsonb`;
}

/* --------------------- what a migrated card must satisfy --------------------- */

/**
 * The fields the migration is defined to change, read off a body for the acceptance report.
 *
 * Published so the runner's before/after tables and its post-write assertions read the same
 * five numbers from the same reader. A second spelling of "how many prose entries are left
 * in `cannot`" is how a migration comes to report success against its own output.
 */
export interface ProhibitionCensus {
  retiredKeys: number;
  hasWillNot: boolean;
  cannotEntries: number;
  willNotEntries: number;
  /** Entries in `cannot` holding a space, which no ontology term id does. */
  proseInCannot: number;
}

export function censusOf(body: unknown): ProhibitionCensus {
  const row = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : []);
  const cannot = list(row.cannot);
  return {
    retiredKeys: RETIRED_CARD_KEYS.filter((k) => Object.hasOwn(row, k)).length,
    hasWillNot: Array.isArray(row.willNot),
    cannotEntries: cannot.length,
    willNotEntries: list(row.willNot).length,
    proseInCannot: cannot.filter((e) => e.includes(" ")).length,
  };
}

/**
 * The five cards whose archive `notes` differ from the stored `notes` beyond the mechanical
 * transform, pinned as a literal.
 *
 * The migration re-derives the 57 archive-backed cards from `content/cards/` rather than
 * transforming their stored bytes, because the same wave that split `cannot` also rewrote
 * the prose that described the retired fields as live: `maintainer-approval@1.0.0` said "the
 * `requires_human` flag is redundant with the node type and set anyway" and now says "the
 * `human-gate` type is the whole of what says so". `notes` is inside `cardDigest`, and these
 * five are pinned by 10 of the 16 releases, so transforming instead of re-deriving would
 * publish release digests that disagree with the ones each committed
 * `public/bundles/<slug>/README.md` already prints.
 *
 * Pinned so that a SIXTH divergence, or a divergence in any other field, aborts the run.
 * Without it the cross-check would silently absorb an unrelated edit to `content/`.
 */
export const NOTES_REWRITTEN_BY_THE_WAVE: readonly string[] = Object.freeze([
  "acceptance-verifier@2.0.0",
  "bounded-retry@2.0.0",
  "confidence-escalation@1.0.0",
  "intent-router@2.0.0",
  "maintainer-approval@1.0.0",
]);

/**
 * The one card with no counterpart under `content/`, and the four values its migrated form
 * must produce.
 *
 * `alessandro-smoke-checker@1.0.0` is database-only, so it gets the mechanical transform
 * applied to its own bytes and has no archive to be checked against. The obvious oracle —
 * "the release it belongs to resolves and its blueprint digest equals the digest we
 * computed" — is VACUOUS for it: both sides derive from the same new source bytes. Measured:
 * deleting the card's one prose refusal outright instead of moving it also loads with zero
 * diagnostics and also produces a perfectly self-consistent pair of digests
 * (`sha256:7a422c9f…` / `sha256:71608079…`). So the expected digests are pinned here as
 * literals computed and recorded before the run, and the runner asserts them.
 */
export const SMOKE_CHECKER_REF = "alessandro-smoke-checker@1.0.0";
export const SMOKE_CHECKER_EXPECTED = Object.freeze({
  cardDigest: "sha256:b94ae8ab9bfed1a4e0e042d9c2e38888b0df8c03346131df49d5d89f6d8f345f",
  releaseDigest: "sha256:e574a714bade7ad8ff8e787222086ef50c383e3c27719afd611365e75f47e375",
  cannotEntries: 0,
  willNotEntries: 1,
});

/**
 * The corpus-wide totals the migration must land on, taken from the ARCHIVE census and never
 * recomputed from the migration's own output.
 *
 * 84 `will_not` entries across the 57 archive cards, plus the smoke-checker's 1, is 85; the
 * 2 surviving `cannot` entries are both `acceptance-criteria`, on `code-builder@1.0.0` and
 * `targeted-debugger@1.0.0`. These two numbers are the ONLY checks that distinguish "moved
 * the 85 sentences into `willNot`" from "deleted them": a migration that deletes them
 * satisfies every digest and every shape check, and its digests are self-consistent.
 */
export const EXPECTED_TOTALS = Object.freeze({
  cardVersions: 58,
  releases: 16,
  cannotEntries: 2,
  willNotEntries: 85,
});

/** Convenience for the runner's reports: `id@version` from a row. */
export function refOf(cardId: string, version: string): string {
  return `${cardId}@${version}`;
}

/** The fields of a `NodeCard` compared field-by-field by the mechanical cross-check. */
export const CARD_FIELDS: readonly (keyof NodeCard)[] = Object.freeze([
  "id",
  "name",
  "type",
  "phases",
  "action",
  "spec",
  "model",
  "agent",
  "tools",
  "mcp",
  "skill",
  "params",
  "inputs",
  "outputs",
  "dependencies",
  "cannot",
  "willNot",
  "riskMarkers",
  "notes",
  "version",
  "author",
  "provenance",
]);
