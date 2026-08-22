/* ============================================================
   T133 — the two corpora, and why each member is in one of them

   Every entry cites the clause of D-133-01/02/03 that puts it where
   it is. Nothing here is a shape somebody thought of: a member with
   no clause beside it is a guess, and a guess about this column is
   the defect the task exists to end.

   ── the nonce ──
   Refused fixtures carry a nonce in a value, in a key and nested,
   so AC4's "never the caller's value" is measurable on every one of
   them rather than on a chosen representative. Two members carry no
   nonce because they have nowhere to put one -- an empty array and a
   number -- and they say so.
   ============================================================ */

import { term, vocabularyText } from "./contract";

export interface Case {
  /** The name a red carries, so a failure says which shape moved. */
  readonly name: string;
  /** The clause that decides this member. Quoted into every failure message. */
  readonly clause: string;
  /** Whether the nonce is reachable inside the value at all. */
  readonly carriesNonce: boolean;
  readonly value: (n: string) => unknown;
}

/* --------------------- refused at the write --------------------- */

export const REFUSED: readonly Case[] = [
  {
    name: "a bare term array",
    clause:
      "D-133-01: not an array and not a primitive -- `storedVocabulary` throws on " +
      "`Array.isArray`, `parseOntologyTerms` throws `is not a YAML mapping`. This is the " +
      "exact value T130's blind author stored, and the reason this task exists.",
    carriesNonce: true,
    value: (n) => [term(`${n}/a-term`)],
  },
  {
    name: "an empty array",
    clause:
      "D-133-01: not an array. Empty is still an array, and `parseOntologyTerms` refuses it " +
      "at the same `Array.isArray` check -- an emptiness exemption would be a rule neither " +
      "reader has.",
    carriesNonce: false,
    value: () => [],
  },
  {
    name: "a string",
    clause:
      "D-133-01: not a primitive. The bytes belong under `text`; a bare string is the column " +
      "holding a document instead of the record that carries one.",
    carriesNonce: true,
    value: (n) => vocabularyText(`${n}/a-term`),
  },
  {
    name: "a number",
    clause: "D-133-01: not a primitive.",
    carriesNonce: false,
    value: () => 42,
  },
  {
    name: "a boolean",
    clause: "D-133-01: not a primitive.",
    carriesNonce: false,
    value: () => true,
  },
  {
    name: "`terms` with no `text`",
    clause:
      "D-133-01: `text` is a required string -- `storedVocabulary` throws otherwise, and " +
      "D-90-03 ruled `text` in precisely so the author's bytes survive rather than being " +
      "re-emitted from the parse. This is the pre-D-90-03 spelling and the one shape the " +
      "two merged readers genuinely differ on (D-130-07): T090 refuses it, T130's " +
      "`counts.terms` reads it. The column decides, and the column requires `text`.",
    carriesNonce: true,
    value: (n) => ({ terms: [term(`${n}/a-term`)] }),
  },
  {
    name: "a `text` that is not a string",
    clause: "D-133-01: `text` is a required `string`.",
    carriesNonce: true,
    value: (n) => ({ text: { bytes: n }, terms: [] }),
  },
  {
    name: "a `text` that is null",
    clause:
      "D-133-01: `text` is a required `string`. `null` is legal for the WHOLE column and " +
      "not for this field -- the two are different clauses and only one of them admits it.",
    carriesNonce: true,
    value: (n) => ({ text: null, terms: [term(`${n}/a-term`)] }),
  },
  {
    name: "a `terms` that is a string",
    clause:
      "D-133-01: `terms` present must be an array -- `parseOntologyTerms` throws " +
      "``has a `terms` that is not a list``.",
    carriesNonce: true,
    value: (n) => ({ text: vocabularyText(`${n}/a-term`), terms: `  - id: ${n}` }),
  },
  {
    name: "a `terms` that is an object",
    clause:
      "D-133-01: `terms` present must be an array. A mapping of ids is the other natural " +
      "guess at this column and neither reader accepts it.",
    carriesNonce: true,
    value: (n) => ({ text: vocabularyText(`${n}/a-term`), terms: { [`${n}/a-term`]: term(n) } }),
  },
  {
    name: "a `terms` holding a number",
    clause:
      "D-133-03: the write calls the readers' own `parseOntologyTerms`, which throws " +
      "``terms[0] is not a mapping``. The published type is `readonly unknown[]` because " +
      "typing the element is T030's business; the runtime refusal arrives free. THIS IS THE " +
      "CELL THAT MEASURES D-133-03 -- an implementation checking only `Array.isArray(terms)` " +
      "passes every other member of this corpus and fails here.",
    carriesNonce: false,
    value: () => ({ text: vocabularyText("x/y"), terms: [42] }),
  },
  {
    name: "a `terms` holding a term with an unknown `kind`",
    clause:
      "D-133-03, derived rather than quoted: if the write calls `parseOntologyTerms` then " +
      "`toTerm`'s five-kind check runs at the write too. T133 adds no term rule -- it runs " +
      "T030's -- so a release the profile reader would 500 on cannot be written. The second " +
      "cell that separates the shared parse from a shape predicate beside it.",
    carriesNonce: true,
    value: (n) => ({
      text: vocabularyText(`${n}/a-term`),
      terms: [{ ...term(`${n}/a-term`), kind: "not-a-kind" }],
    }),
  },
];

/* --------------------- accepted at the write --------------------- */

/**
 * The half that keeps the twelve refusals honest: a guard that refuses every vocabulary
 * satisfies all of them and fails only here.
 */
export const ACCEPTED: readonly Case[] = [
  {
    name: "`null`",
    clause: "D-133-01: `null` is the other legal column value.",
    carriesNonce: false,
    value: () => null,
  },
  {
    name: "`text` and `terms`",
    clause: "D-133-01: the shape itself. D-90-03 ruled the column stores `{ text, terms }`.",
    carriesNonce: true,
    value: (n) => ({ text: vocabularyText(`${n}/a-term`), terms: [term(`${n}/a-term`)] }),
  },
  {
    name: "`text` and an empty `terms`",
    clause:
      "D-133-01: an array is an array. `parseOntologyTerms` reads it as `[]`, which is " +
      "`this archive adds nothing to the core` and is not an error.",
    carriesNonce: true,
    value: (n) => ({ text: vocabularyText(`${n}/a-term`), terms: [] }),
  },
  {
    name: "`text` and a null `terms`",
    clause:
      "D-133-01: `terms?: readonly unknown[] | null` -- absent or `null` means `[]` " +
      "(`ontology-file.ts:52`).",
    carriesNonce: true,
    value: (n) => ({ text: vocabularyText(`${n}/a-term`), terms: null }),
  },
  {
    name: "`text` alone",
    clause:
      "D-133-01: `terms` is optional. A bundle whose vocabulary file declares nothing still " +
      "has bytes, and D-90-03 keeps the bytes.",
    carriesNonce: true,
    value: (n) => ({ text: vocabularyText(`${n}/a-term`) }),
  },
  {
    name: "an empty `text`",
    clause:
      "D-133-03's principle, ruled 2026-08-22: where the readers already decide, the writer " +
      "adds no rule. `storedVocabulary` checks only `typeof text !== \"string\"`, so the " +
      "empty string passes both readers today, and refusing it at the write would invent a " +
      "boundary neither reader has. A writer stricter than its readers is a third reading " +
      "of this column.",
    carriesNonce: false,
    value: () => ({ text: "", terms: [] }),
  },
  {
    name: "extra keys beside `text` and `terms`",
    clause:
      "D-133-03's principle, same ruling: both readers ignore unknown keys, so the writer " +
      "ignores them. Refusing them would be the writer's own third reading.",
    carriesNonce: true,
    value: (n) => ({
      text: vocabularyText(`${n}/a-term`),
      terms: [term(`${n}/a-term`)],
      generatedBy: n,
    }),
  },
];
