/* ============================================================
   T133 AC3 — a release already stored in a refused shape is
   detectable without reading every row

   ── WHAT A GREEN HERE ESTABLISHES, AND WHAT IT DOES NOT ──
   Stated first because it is the whole value of this file.

   The query below is THIS SUITE'S, written from D-133-01's clauses.
   A green establishes a property of the COLUMN -- that the published
   shape is separable in the store by one predicate, so the rows
   already there can be found without pulling the table into the
   application -- and it establishes NOTHING WHATSOEVER about the
   implementer's artefact. It is not an oracle for anything the
   implementer writes, and it must not be read as one.

   That is not a hedge; it is the criterion's actual shape. T133's
   `Owns` excludes `lib/db/migrations/**`, so of AC3's two admissible
   forms -- "a migration or a reported query, stated either way" --
   only the reported query is reachable, and D-133-02 F6 settles it:
   AC3 "reports the rows already there, as a query rather than a
   migration". A reported query is prose in a handback. No cell can
   assert prose. What a cell CAN do is show that the thing the prose
   would have to say is true, and that is what this file does.

   ── the limit, recorded rather than hidden ──
   The predicate separates the SHAPE clauses. It cannot separate a
   term-level malformation -- `terms: [42]`, or a term whose `kind`
   is not one of the five -- because deciding those is
   `parseOntologyTerms`, which does not run in SQL. Two rows below
   are planted for exactly that and the cell asserts the predicate
   MISSES them. That assertion records the boundary; it does not
   demand it. A reported query that also caught them would be a
   better artefact and would red this cell, which is the right way
   round for a limit nobody has claimed to have closed.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  freshBundle,
  insertReleaseRaw,
  openScratch,
  term,
  vocabularyText,
  type Scratch,
} from "./contract";

/**
 * One predicate over `local_vocabulary`, spelled from D-133-01's three clauses and nothing
 * else: not an array and not a primitive; `text` a required string; `terms`, when the key
 * is present, an array or null.
 *
 * `is not null` first, because `null` is the other legal column value and most releases
 * have it -- a report that named every release without a vocabulary would name almost the
 * whole table.
 *
 * **The first clause is MEASURED REDUNDANT and is labelled rather than deleted.** Removing
 * `jsonb_typeof(local_vocabulary) <> 'object'` reds nothing: `->` on an array or a scalar
 * yields SQL NULL, so the `text` clause already catches every non-object. Found by
 * falsifying this query rather than by reading it. It stays because it states D-133-01's
 * first clause where a reader looks for it, and it is labelled because an unfalsifiable
 * line described as a guard is how a future reader comes to rely on nothing.
 */
const REFUSED_ROWS = `
  select id from release
   where local_vocabulary is not null
     and (
          jsonb_typeof(local_vocabulary) <> 'object'
       or jsonb_typeof(local_vocabulary -> 'text') is distinct from 'string'
       or (local_vocabulary ? 'terms'
           and jsonb_typeof(local_vocabulary -> 'terms') not in ('array', 'null'))
     )
   order by id
`;

let opened: Scratch | undefined;
let setupFailure: unknown;

/** id -> the label a failure quotes, filled as the rows are planted. */
const separable = new Map<string, string>();
const legal = new Map<string, string>();
const grammarOnly = new Map<string, string>();

beforeAll(async () => {
  try {
    const s = await openScratch();
    opened = s;
    const bundleId = await freshBundle(s, "detect");
    const t = term("someone/a-term");
    const text = vocabularyText("someone/a-term");

    const plant = async (
      into: Map<string, string>,
      label: string,
      value: unknown,
    ): Promise<void> => {
      into.set(await insertReleaseRaw(s, bundleId, value), label);
    };

    /* Refused by the shape, and separable in SQL. */
    await plant(separable, "a bare term array", [t]);
    await plant(separable, "an empty array", []);
    await plant(separable, "a string", text);
    await plant(separable, "a number", 42);
    await plant(separable, "`terms` with no `text`", { terms: [t] });
    await plant(separable, "a `text` that is a number", { text: 42, terms: [] });
    await plant(separable, "a `text` that is null", { text: null, terms: [t] });
    await plant(separable, "a `terms` that is a string", { text, terms: "  - id: x" });
    await plant(separable, "a `terms` that is an object", { text, terms: { "a/b": t } });

    /* Legal, and every one of them a row a report must not name. */
    await plant(legal, "`null`", undefined);
    await plant(legal, "`{ text, terms }`", { text, terms: [t] });
    await plant(legal, "`{ text, terms: [] }`", { text, terms: [] });
    await plant(legal, "`{ text, terms: null }`", { text, terms: null });
    await plant(legal, "`{ text }`", { text });
    await plant(legal, "an empty `text`", { text: "", terms: [] });
    await plant(legal, "extra keys", { text, terms: [t], generatedBy: "t133" });

    /* Refused by the shared parser, invisible to any predicate that is not that parser. */
    await plant(grammarOnly, "a `terms` holding a number", { text, terms: [42] });
    await plant(grammarOnly, "a term with an unknown `kind`", {
      text,
      terms: [{ ...t, kind: "not-a-kind" }],
    });
  } catch (error) {
    setupFailure = error;
  }
}, 120_000);

afterAll(async () => {
  await opened?.drop();
});

function scratch(): Scratch {
  if (opened === undefined) {
    throw new Error(
      `This file's fixture never came up, so this criterion was not measured: ` +
        `${String(setupFailure)}`,
    );
  }
  return opened;
}

async function flagged(): Promise<Set<string>> {
  const rows = await scratch().query(REFUSED_ROWS);
  return new Set(rows.map((row) => String(row.id)));
}

describe("AC3 — the published shape is separable in the store by one predicate", () => {
  it("names every row the shape refuses and can name", async () => {
    const found = await flagged();
    const missed = [...separable].filter(([id]) => !found.has(id)).map(([, label]) => label);
    expect(
      missed,
      "One predicate over `local_vocabulary` did not find every refused row, so the rows " +
        "already stored cannot be reported without reading them all. This is a property of " +
        "the COLUMN and of this file's own query; it says nothing about the implementer.",
    ).toEqual([]);
  }, 60_000);

  it("names no row the shape admits", async () => {
    const found = await flagged();
    const wrong = [...legal].filter(([id]) => found.has(id)).map(([, label]) => label);
    expect(
      wrong,
      "The predicate named a legal row. A report that names correct releases is worse than " +
        "no report: the two legal values that look unusual -- `{ text, terms: null }` and " +
        "`{ text }` alone -- are the ones a hasty predicate flags, and both are ruled legal " +
        "by D-133-01.",
    ).toEqual([]);
  }, 60_000);

  it("does not name what only `parseOntologyTerms` can decide, and that is the limit", async () => {
    const found = await flagged();
    const caught = [...grammarOnly].filter(([id]) => found.has(id)).map(([, label]) => label);
    expect(
      caught,
      "The predicate caught a term-level malformation. That is BETTER than this cell expects " +
        "and the cell is what should change: the boundary recorded here is that SQL cannot " +
        "run the grammar, so a reported query built from the shape clauses alone misses rows " +
        "the readers still refuse. Recorded rather than left silent -- a report scoped to the " +
        "malformations its author thought of is the failure this file's preamble names.",
    ).toEqual([]);
  }, 60_000);

  it("answers as an aggregate, so the report never leaves the database", async () => {
    /*
     * AC3's own words are "without reading every row". The list above already satisfies it,
     * and this states the stronger form the operator actually runs: one number, computed in
     * Postgres, with no release crossing the wire.
     */
    const rows = await scratch().query(
      `select count(*)::int as n from (${REFUSED_ROWS}) as refused`,
    );
    expect(rows[0]?.n, "The aggregate form of the report did not answer a number.").toBe(
      separable.size,
    );
  }, 60_000);
});
