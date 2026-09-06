import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import baseline from "./baseline.json" with { type: "json" };
import {
  BASE_TABLES,
  CONTRACT,
  SQLSTATE,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Row,
  type Scratch,
} from "./harness.ts";
import { readCatalogue, shapeOf, type Catalogue } from "./catalogue.ts";
import {
  attemptToDriverError,
  existing,
  fixtures,
  insertLiteral,
  marker,
  type Fixtures,
} from "./rows.ts";

/* ============================================================
   T005 AC7 and AC7a — what this task is allowed to do to the ten
   tables eight merged tasks already use

   AC7: no existing table is altered, renamed or dropped, with
   exactly one named exception, and the ten tables T000 shipped are
   otherwise byte-identical in the schema after this task.

   AC7a: `handle_reservation.account_id` becomes NOT NULL, and a
   direct INSERT of a NULL-owner reservation fails at the driver,
   not at a caller.

   ── why the comparison is against a frozen file ──
   `lib/db/migrations/**` is inside T005's `Owns`, so the way to
   satisfy AC7 wrongly is to edit `0001_init.up.sql` in place: base
   itself moves, and every up/down round trip still agrees with
   itself. `baseline.json` was captured from the base commit's own
   bytes by `capture-baseline.ts` before this suite could be
   contaminated, and it carries the sha it came from. Nothing here
   reads `lib/db/**`.

   ── why the diff is enumerated rather than counted ──
   `expect(live).toEqual(baseline)` would red on the one change AC7a
   requires and say only "objects differ". The delta is computed as
   a list of named cells and compared against the ONE cell AC7a
   licenses, so an extra change reports itself by name and a missing
   one reports itself as a missing entry. Reading which cell moved
   rather than how many is the same instrument this run keeps
   arriving at for mutations.
   ============================================================ */

let scratch: Scratch;
let cat: Catalogue;
let f: Fixtures;

beforeAll(async () => {
  scratch = await scratchDatabase("existing");
  cat = await readCatalogue(scratch.query);
  f = fixtures(scratch.query, cat);
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

/* Every delta a ruling licenses, written as the diff entries it produces. AC7a's cell is
   T005's own. The five `bundle` columns are T280's (owner-instructed GitHub-style draft
   creation, migration 0007_drafts): nullable additions, so every merged task's INSERT and
   SELECT against `bundle` still binds — the freeze's reason (a moved base breaks eight
   consumers silently) does not reach a nullable add, and the cells are enumerated here so
   the NEXT alteration still reports itself by name instead of hiding behind a count. */
const LICENSED_DELTAS = [
  /* 0009_drop_ontology_versioning, owner-instructed 2026-09-05. Nineteen cells, and they
     are the largest delta this guard has ever licensed: a column off `release` and two
     whole tables. Enumerated one per line for the reason the T280 note above gives, which
     matters more here than anywhere else in this list. A count would let the NEXT
     alteration to `release` hide inside a number that already says nineteen, and `release`
     is the table eight merged tasks query. Every line is a cell somebody can look up in the
     migration; nothing is grouped and nothing is wildcarded.

     Ordered the way `diff()` emits: it sorts within each kind and the caller concatenates
     columns, then indexes, then constraints. The order is part of the assertion because
     `toEqual` over an array is ordered, so a licensed list written table-by-table reds
     against a correct schema. */
  "added columns bundle.category",
  "added columns bundle.description",
  "added columns bundle.summary",
  "added columns bundle.tags",
  "added columns bundle.title",
  "changed handle_reservation.account_id is_nullable: YES -> NO",
  "removed columns ontology_term.body",
  "removed columns ontology_term.created_at",
  "removed columns ontology_term.id",
  "removed columns ontology_term.kind",
  "removed columns ontology_term.ontology_version_id",
  "removed columns ontology_term.term_id",
  "removed columns ontology_version.created_at",
  "removed columns ontology_version.digest",
  "removed columns ontology_version.id",
  "removed columns ontology_version.version",
  "removed columns release.scored_ontology_version_id",
  "removed indexes ontology_term.ontology_term_pkey",
  "removed indexes ontology_term.ontology_term_version_term_key",
  "removed indexes ontology_version.ontology_version_pkey",
  "removed indexes ontology_version.ontology_version_version_key",
  "removed constraints ontology_term.ontology_term_ontology_version_id_ontology_version_id_fk",
  "removed constraints ontology_term.ontology_term_pkey",
  "removed constraints ontology_version.ontology_version_pkey",
  "removed constraints release.release_scored_ontology_version_id_ontology_version_id_fk",
];

suite("T005 AC7 — the frozen baseline is a measurement", () => {
  it("`baseline.json` was captured from a real commit and covers all ten base tables and every base enum", () => {
    /* This suite's own instrument, checked before it is used. Two of the assertions below
       compare a live schema against `baseline.json` by walking the baseline's entries — and
       a baseline that is empty, or truncated, or still the placeholder committed while the
       gate slot was queued, makes those walks iterate over nothing and pass. A set that can
       only be empty is not a measurement, and the enum comparison in particular has exactly
       that shape.

       So: the capture names a commit, it names the ten tables, every one of them has columns
       in it, and the five enums T000 declared are all there. None of that can be true of a
       stub. */
    expect(
      /^[0-9a-f]{40}$/.test(baseline.capturedFrom),
      `\`baseline.json\` records capturedFrom = ${JSON.stringify(baseline.capturedFrom)}. It ` +
        `has not been captured; run tests/server/t005/capture-baseline.ts against the base ` +
        `commit. Until then every comparison against it is walking an empty set.`,
    ).toBe(true);

    expect([...baseline.tables].sort(), "the baseline names the ten T000 tables").toEqual(
      [...BASE_TABLES].sort(),
    );

    const covered = new Set((baseline.shape.columns as Row[]).map((r) => String(r.table_name)));
    expect(
      BASE_TABLES.filter((t) => !covered.has(t)),
      "every base table has columns in the frozen baseline",
    ).toEqual([]);

    /* The five T000 declared, read off `0001_init.up.sql` at capture time. Named here rather
       than counted, because "at least one enum" is the same vacuous shape one level down. */
    const enumNames = [...new Set((baseline.enums as Row[]).map((r) => String(r.name)))].sort();
    expect(enumNames, "the baseline carries every enum type base declares").toEqual([
      "actor_kind",
      "audit_decision",
      "target_actor_kind",
      "target_kind",
      "visibility",
    ]);
  });
});

suite("T005 AC7 — the ten tables T000 shipped are untouched but for the licensed cells", () => {
  /* Eight of the ten, and the two that left are named rather than subtracted.
     ------------------------------------------------------------
     `ontology_version` and `ontology_term` were dropped by `0009_drop_ontology_versioning`
     on the owner's instruction of 2026-09-05: the vocabulary names what an Attractor node
     IS, Attractor fixes those shapes in its own spec and carries no vocabulary version, so
     a DarkPrint-only version on top was a second thing to keep in step with nothing.
     `ontology_term` went with its parent because `ontology_term.ontology_version_id` is
     NOT NULL and references it, and the table's only unique key is keyed on that column.
     Neither had a reader: no module under `lib/server/**` queries either, verified by grep
     before the migration was written.

     `BASE_TABLES` is deliberately NOT shortened. It is the freeze's subject and it names
     what T000 shipped, which is a historical fact that a later deletion does not edit; the
     baseline JSON it is compared against cannot change either. Shortening it would make
     every removed column vanish from the delta silently, which is the one outcome this
     suite exists to prevent. So the ten stay listed, the nineteen removed cells are
     licensed by name below, and the two departed tables get the assertion they would
     otherwise have escaped: they must be ABSENT, so a later migration cannot quietly
     recreate them and have this suite call it a return to health. */
  const DROPPED_BY_0009 = ["ontology_version", "ontology_term"] as const;

  it("the eight surviving base tables are present, and the two dropped in 0009 are gone", () => {
    requireT005Shipped(scratch);
    expect(
      BASE_TABLES.filter((t) => !cat.tables.includes(t) && !DROPPED_BY_0009.includes(t as never)),
      `${CONTRACT.ac7}\n  Eight tasks have merged against them.\n  baseline captured from ` +
        `${baseline.capturedFrom}\n  tables present: ${cat.tables.join(", ")}`,
    ).toEqual([]);

    expect(
      DROPPED_BY_0009.filter((t) => cat.tables.includes(t)),
      "0009 dropped these two. A migration that recreates one has undone an owner decision, " +
        "and the delta cell below would then report their columns as ADDED rather than as the " +
        "licensed removals they are.",
    ).toEqual([]);
  });

  it("AC7: the schema delta over those ten tables is exactly the licensed cells, and nothing else", async () => {
    requireT005Shipped(scratch);
    const live = await shapeOf(scratch.query, BASE_TABLES);
    const delta = [
      ...diff("columns", baseline.shape.columns as Row[], live.columns, columnKey),
      ...diff("indexes", baseline.shape.indexes as Row[], live.indexes, indexKey),
      ...diff("constraints", baseline.shape.constraints as Row[], live.constraints, constraintKey),
    ];

    expect(
      delta,
      `${CONTRACT.ac7}\n  ${CONTRACT.ac7a}\n  Baseline captured from ${baseline.capturedFrom} ` +
        `(${baseline.migration}), which is base and not this tree.\n` +
        `  Only the licensed cells may move. Anything else here is an alteration to a table ` +
        `eight merged tasks already query, and nothing downstream would find out until it broke.`,
    ).toEqual(LICENSED_DELTAS);
  }, 120_000);

  it("AC7: no base enum gained, lost or reordered a label", async () => {
    requireT005Shipped(scratch);
    const live = await scratch.query(
      `select t.typname as name, e.enumlabel as label
         from pg_type t join pg_enum e on e.enumtypid = t.oid
        where t.typnamespace = 'public'::regnamespace
        order by t.typname, e.enumsortorder`,
    );
    const liveByName = groupLabels(live);
    const baseByName = groupLabels(baseline.enums as Row[]);

    /* New enum types are extension and are fine — a metric enum, for instance. What is not
       fine is an existing one changing: `target_kind` gaining a member widens what every
       merged task's `target` rows may hold, and `target_actor_kind` losing one would strand
       rows T150 and T170 are written against. Compared in order, because a label's sort
       order is what a `< ` comparison on the enum reads. */
    const changed = [...baseByName.entries()]
      .filter(([name, labels]) => (liveByName.get(name) ?? []).join("|") !== labels.join("|"))
      .map(([name, labels]) => `${name}: ${labels.join(", ")} -> ${(liveByName.get(name) ?? []).join(", ") || "(absent)"}`);

    expect(changed, `${CONTRACT.ac7}\n  baseline captured from ${baseline.capturedFrom}`).toEqual([]);
  }, 60_000);
});

suite("T005 AC7a — a NULL-owner reservation is unstorable", () => {
  it("AC7a: a direct INSERT of a reservation with no account fails at the driver", async () => {
    requireT005Shipped(scratch);
    const attempt = await attemptToDriverError(() =>
      insertLiteral(scratch.query, "handle_reservation", {
        handle: marker("null-owner"),
        account_id: null,
      }),
    );

    expect(
      attempt.raised,
      `${CONTRACT.ac7a}\n  Such a row is garbage that can never be claimed or released: under ` +
        `T070's ruled predicate \`handle_reservation.account_id = excluded.account_id\`, ` +
        `NULL = NULL is NULL, so it refuses everyone forever. T070 cannot fix it — ` +
        `lib/db/schema.ts is Forbidden there — and a runtime guard in \`allocateHandle\` closes ` +
        `only T070's own path while T050 and any later writer keep theirs open.`,
    ).toBe(true);

    expect(
      attempt.raised ? (attempt.driver?.code ?? null) : null,
      `${CONTRACT.ac7a}\n  The insert was refused, but the rejection carries no SQLSTATE, so it ` +
        `came from something other than the storage. AC7a says "fails at the driver, not at a ` +
        `caller" precisely because a caller-side guard leaves every other writer's path open.`,
    ).toBe(SQLSTATE.not_null_violation);
  }, 120_000);

  it("AC7a: a reservation WITH an owner still stores, so the column is narrowed rather than closed", async () => {
    requireT005Shipped(scratch);
    const account = await existing(f, "account");
    const attempt = await attemptToDriverError(() =>
      insertLiteral(scratch.query, "handle_reservation", {
        handle: marker("owned"),
        account_id: account.id,
      }),
    );
    expect(
      attempt.raised
        ? `${attempt.driver?.code ?? "(no sqlstate)"}: ${attempt.driver?.message ?? String(attempt.cause)}`
        : null,
      `${CONTRACT.ac7a}\n  Saturation's half: a NOT NULL that also refused an owned reservation ` +
        `would satisfy the assertion above and break T070, which is merged. The narrowing has ` +
        `to leave the legal case legal.`,
    ).toBeNull();
  }, 120_000);

  it("AC7a: an existing reservation cannot be UPDATED to a NULL owner either", async () => {
    requireT005Shipped(scratch);

    /* Found by auditing this suite's own claims of unobservability rather than by a
       mutation. The test below asserts the cell is unreachable through ANY writer, and
       everything backing that claim was an INSERT — which is precisely the gap AC4's own
       criterion names one file over: a row checked only at birth is mutable to anything
       afterwards. I wrote that sentence about somebody else's trigger and did not apply it
       to my own claim.

       NOT NULL happens to hold on UPDATE as well, so this is expected to pass on a correct
       schema and is not a second way for it to fail. That is the point: the claim was
       "unreachable through any writer" and the evidence covered one verb, so the assertion
       was narrower than the sentence it supported. A claim of silence is a measurement, and
       this is the measurement it was missing. */
    const account = await existing(f, "account");
    const handle = marker("owned-then-orphaned");
    await insertLiteral(scratch.query, "handle_reservation", {
      handle,
      account_id: account.id,
    });

    const attempt = await attemptToDriverError(() =>
      scratch.query(`update "handle_reservation" set "account_id" = null where "handle" = $1`, [
        handle,
      ]),
    );

    expect(
      attempt.raised ? (attempt.driver?.code ?? "(no sqlstate)") : "(accepted)",
      `${CONTRACT.ac7a}\n  A reservation orphaned by an UPDATE is the same garbage row as one ` +
        `inserted that way: under T070's ruled predicate it refuses everyone forever. T050 ` +
        `renames handles and is the writer most likely to reach this verb.`,
    ).toBe(SQLSTATE.not_null_violation);
  }, 120_000);

  it("AC7a: after this, T070's W0/W5 discriminating cell is unreachable through any writer", async () => {
    requireT005Shipped(scratch);
    /* Recorded as an assertion rather than as prose because `backend.md` says it will need
       saying: T070's adversary confirmed the shipped predicate is
       `handle_reservation.account_id = excluded.account_id` rather than the null-safe form by
       seeding a NULL-owner row, releasing it, and claiming it with a NULL claimant. That row
       is what this test proves unstorable. Anyone re-verifying T070's predicate after this
       merges is reading source, not taking a measurement, and should say so.

       The positive half is what is checked here: the cell is unreachable because the STORE
       refuses it, not because the one caller that could have reached it now guards. */
    const rows = await scratch.query(
      `select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'handle_reservation'
          and column_name = 'account_id'`,
    );
    expect(
      rows.map((r) => String(r.is_nullable)),
      `${CONTRACT.ac7a}\n  A guard in allocateHandle closes only T070's own path; NOT NULL ` +
        `makes the W0/W5 difference provably unreachable rather than merely unreached.`,
    ).toEqual(["NO"]);
  }, 60_000);
});

/* --------------------- the diff --------------------- */

function columnKey(r: Row): string {
  return `${String(r.table_name)}.${String(r.column_name)}`;
}
function indexKey(r: Row): string {
  return `${String(r.tablename)}.${String(r.indexname)}`;
}
function constraintKey(r: Row): string {
  return `${String(r.table_name)}.${String(r.conname)}`;
}

/**
 * Named cells rather than a boolean. Every entry reads as a sentence a person can act on:
 * which table, which column or index, which field, and what it went from and to.
 */
function diff(label: string, before: Row[], after: Row[], key: (r: Row) => string): string[] {
  const b = new Map(before.map((r) => [key(r), r]));
  const a = new Map(after.map((r) => [key(r), r]));
  const out: string[] = [];

  for (const [k, row] of b) {
    const other = a.get(k);
    if (other === undefined) {
      out.push(`removed ${label} ${k}`);
      continue;
    }
    for (const field of Object.keys(row)) {
      const was = normalise(row[field]);
      const now = normalise(other[field]);
      if (was !== now) out.push(`changed ${k} ${field}: ${was} -> ${now}`);
    }
  }
  for (const k of a.keys()) if (!b.has(k)) out.push(`added ${label} ${k}`);

  return out.sort();
}

/** `information_schema` answers numbers as numbers over one driver and strings over another. */
function normalise(value: unknown): string {
  return value === null || value === undefined ? "(null)" : String(value);
}

function groupLabels(rows: Row[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const name = String(r.name);
    out.set(name, [...(out.get(name) ?? []), String(r.label)]);
  }
  return out;
}
