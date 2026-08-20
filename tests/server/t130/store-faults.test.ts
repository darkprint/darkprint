/* ============================================================
   T130 — what a caller sees when the store cannot answer

   ── why this file exists, and what it is NOT reading ──
   D-13: no rejection may carry the failed statement or its bound
   parameters. T080 merged with no error class and no store
   wrapper, and a closed-port probe against its merged, tagged
   routes returned a raw `DrizzleQueryError` whose message opens
   with the full `select … from "bundle"`. That cost a whole extra
   task (T081), and the guard written afterwards —
   `tests/store-modules-seal-their-faults.test.ts` — reds on any
   `lib/server/<name>/` that imports `@/lib/db` and exports no
   error class. `lib/server/profiles` will import `@/lib/db`.

   ── the sites are derived from the contract, not found in code ──
   I was asked not to read the implementation and did not need to.
   **All three published functions take `db: Db`**, so a store
   fault is reachable from every one of them, and the published
   block enumerates them. The property below is therefore
   quantified over the whole published surface rather than over
   sites somebody listed.

   **And the honest limit of that phrase, because "by
   construction" is the claim nothing reds on when it is wrong:**
   the domain is `FUNCTION_NAMES`, which is MY TRANSCRIPTION of the
   block rather than a derivation from the module. That is a list
   one level up — D-40-G's charge — and it is stated rather than
   dressed up. It discharges one of the two demonstrations a
   constructed domain owes: nothing LISTED is dead, because the
   floor cell reds the day the loop and the block disagree. It does
   not discharge the other: a fourth published function I failed to
   transcribe is invisible here. Deriving the domain from the
   module's own exports instead would go green on a module that
   publishes nothing at all, which is the worse of the two failures.

   ── no database is used anywhere in this file ──
   `DATABASE_URL` is not read and nothing is created or dropped:
   the client is built directly from a connection string naming a
   CLOSED PORT. Port 1 is reserved and never listening, so
   `connect` refuses immediately and no assertion here waits on a
   timeout. This whole file runs off-slot.

   ── what CANNOT be written, reported rather than faked ──
   T081's strongest instrument is an exact-match pin: `message`
   equals `` `${operation}: the registry store failed.` ``, written
   out as a literal rather than imported from its own subject.
   **T130 publishes no error class and no message form for this
   path**, so that pin is unwritable without inventing wording,
   which would red an implementation phrased differently. This is
   T081's own F2 one task later, and the cheap fix is the same:
   publish the string in the block.

   **D-130-02 does not fill this gap and is not being read as
   though it did.** It withdrew `"getProfile: no such handle."` and
   ruled that `getProfile` publishes no rejection — which is about
   the ABSENT HANDLE path, where the answer is a value. A store
   that cannot answer is a different path with a different
   obligation, and it still has no published form.

   What is asserted instead is derived on both sides — the deny set
   from the driver error the driver ACTUALLY produced, never typed
   here — plus an invariance property with a control that stops it
   comparing two things already equal.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createDbClient, type DbClient } from "@/lib/db";

import {
  FUNCTION_NAMES,
  PUBLISHED,
  account,
  assertTellsCannotOverMatch,
  bind,
  collectStrings,
} from "./contract";

/** A port nothing listens on. `connect` refuses immediately. */
const CLOSED_PORT_URL = "postgres://darkprint:darkprint@127.0.0.1:1/darkprint";

/** Values that never reach a database, because nothing here has one. */
const ACCOUNT_ID = "00000000-0000-4000-8000-000000013000";
const HANDLE = "t130-store-fault";

let client: DbClient;
let db: unknown;

/** The actor is the account it names, so no authorization check can refuse before the store. */
const owner = account(ACCOUNT_ID, HANDLE);

/**
 * What each published function needs in order to REACH the store rather than refuse earlier.
 * `setPins` is handed an empty list on purpose: a pin string would make this file depend on
 * the spelling `pins.test.ts` has to discover, and clearing reaches the store either way.
 */
const REACHES_THE_STORE: Readonly<Record<string, readonly unknown[]>> = {
  getProfile: [owner, HANDLE],
  setPins: [owner, ACCOUNT_ID, []],
  toggleFollow: [owner, HANDLE],
};

/**
 * The driver's own machinery: things no caller supplies, so none of them can be planted and
 * none can arrive except from the driver. Kept beside the DERIVED deny set rather than
 * instead of it — a derived set is only as wide as the artefact it is derived from, and a
 * SQLSTATE is in neither the statement nor its parameters (T081's own hole).
 */
const DRIVER_MACHINERY = [
  "econnrefused",
  "connect ",
  "select ",
  "insert into",
  "update ",
  "delete from",
  "returning",
  "$1",
  "drizzlequeryerror",
  "127.0.0.1",
  "5432",
  "postgres://",
  "password",
  "node_modules",
  "at object.",
];

function chainMessages(error: unknown): string[] {
  const out: string[] = [];
  let node: unknown = error;
  const seen = new Set<unknown>();
  while (node !== null && node !== undefined && !seen.has(node)) {
    seen.add(node);
    if (node instanceof Error) out.push(node.message);
    node = (node as { cause?: unknown }).cause;
  }
  return out;
}

/** Everything a caller could read off a thrown value, as one lower-cased string. */
function rendering(error: unknown): string {
  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.message, String(error));
  } else {
    parts.push(String(error));
  }
  try {
    parts.push(JSON.stringify(error) ?? "");
  } catch {
    parts.push("(JSON.stringify threw)");
  }
  parts.push(collectStrings(error).join(" "));
  return parts.join("\n").toLowerCase();
}

/**
 * A real driver fault carrying `param` as a bound value, produced through the same drizzle
 * instance the module is handed. This is the ORACLE for the deny set — the tokens come off
 * the error the driver produced, never off a list typed in this file.
 */
async function driverFault(param: string): Promise<unknown> {
  try {
    await (db as { execute: (q: unknown) => Promise<unknown> }).execute(
      sql`select id from "account" where handle = ${param}`,
    );
  } catch (error) {
    return error;
  }
  throw new Error(
    "A query against a closed port resolved. This file measures nothing unless the store " +
      "genuinely cannot answer; check that port 1 is not listening on this host.",
  );
}

/**
 * A fully DERIVED deny set was built here first and then withdrawn, and the withdrawal is
 * worth recording rather than leaving as an absence.
 *
 * The derived form is T030's: every word of the driver error carried on `cause`, minus the
 * caller's own identifiers. Measured against the two store-fault forms this repository has
 * already merged — `"<operation>: the account store failed."` (T050) and
 * `"<operation>: the registry store failed."` (T081, `archive/errors.ts:74`) — it reds on
 * **`failed`**, because the driver's own message opens `Failed query:`. That is a genuine
 * over-match: the token appears in an admissible rendering, so the scan would report a leak
 * against an implementation that leaked nothing, which is exactly what T-04 forbids shipping
 * and what `assertTellsCannotOverMatch` exists to catch at fixture time.
 *
 * T030 subtracted its own scaffolding by "deriving it from a baseline `Error` rather than by
 * listing it". The equivalent subtraction here is the admissible MESSAGE FORM — and T130
 * publishes none, which is the contract gap this file already reports. So the deny set is the
 * driver-specific list above, every member of which is prose no message of the shape both
 * merged precedents take can contain, and the positive control below is what makes its green
 * mean something.
 *
 * The derived half returns the day the form is published, and it is one function.
 */
function statementIdentifiers(error: unknown): string[] {
  /* The quoted identifiers of the statement the driver was running — `"account"`, and any
     column or index it names. Derived from the error rather than typed, and specific enough
     that no admissible message form can contain one by accident, unlike a bare English word. */
  const text = chainMessages(error).join(" ");
  const quoted = text.match(/"[a-z_][a-z0-9_]*"/g) ?? [];
  return [...new Set(quoted.map((q) => q.toLowerCase()))];
}

beforeAll(() => {
  client = createDbClient(CLOSED_PORT_URL);
  db = (client as unknown as { db: unknown }).db;
});

afterAll(async () => {
  /* The pool never connected, so there is nothing to drain; `close()` is still the published
     way to give it back and a failure to connect is not a reason to skip it. */
  await client.close().catch(() => undefined);
});

describe("the instrument can register a leak before any green below is offered", () => {
  it("carries no tell that admissible content could match (T-04)", () => {
    /* Checked at fixture time rather than after one over-matches. A blacklist asserted with
       `includes` answers "do these characters appear", where the claim is "did this leak", and
       the two differ exactly when a tell is a substring of something a rendering may
       legitimately carry. The admissible content here is everything a T130 message form could
       name: the operation, the caller's own handle and account id. */
    assertTellsCannotOverMatch(DRIVER_MACHINERY, [
      { handle: HANDLE, accountId: ACCOUNT_ID, operations: [...FUNCTION_NAMES] },
    ]);
  });

  it("reports the raw driver error as leaking", async () => {
    /* The positive control. A scanner that cannot register the quantity reads zero for the
       same reason a broken one does, so every green in this file rests on this cell showing
       the predicate goes red on the very error T130 has to seal. */
    const raw = await driverFault("control-value");
    const text = rendering(raw);
    const hits = DRIVER_MACHINERY.filter((tell) => text.includes(tell));
    expect(
      hits.length,
      `the unsealed \`DrizzleQueryError\` must trip the scan, or the scan measures nothing.\n` +
        `  rendering: ${text.slice(0, 400)}`,
    ).toBeGreaterThan(0);
  });

  it("produces DIFFERENT driver messages for different bound parameters", async () => {
    /* The control for the invariance cell below, and the reason it is here rather than
       implied. T081 deleted thirteen cells that asserted one message across two unreachable
       servers: the two things being compared were already equal, so the equality held whatever
       the module did. Two different BOUND PARAMETERS is the axis where the driver's own
       message genuinely differs — D-13's whole subject — so an implementation whose message
       varies with the driver has somewhere to be caught. */
    const a = await driverFault("t130-alpha-param");
    const b = await driverFault("t130-bravo-param");
    expect(chainMessages(a).join("\n")).not.toBe(chainMessages(b).join("\n"));
  });
});

describe("every published function seals the store fault", () => {
  it("covers all three published functions, so the set cannot silently shrink", () => {
    /* A guard on THIS FILE, counted as that and not as coverage: it compares two lists that
       both live here, so no implementation can fail it. It reds the day the loop and the
       published block disagree — a fourth function, or one quietly dropped from the loop. */
    expect(Object.keys(REACHES_THE_STORE).sort()).toEqual([...FUNCTION_NAMES].sort());
  });

  for (const name of FUNCTION_NAMES) {
    it(`\`${name}\` refuses without carrying the statement or its parameters`, async () => {
      const fn = await bind(name);
      const args = REACHES_THE_STORE[name]!;

      let thrown: unknown;
      let resolved = false;
      try {
        await fn(db, ...args);
        resolved = true;
      } catch (error) {
        thrown = error;
      }

      expect(
        resolved,
        `${PUBLISHED[name]} resolved against a store that cannot answer. A read with no ` +
          `database behind it is not an answer.`,
      ).toBe(false);

      const raw = await driverFault(HANDLE);
      const identifiers = statementIdentifiers(raw);
      expect(
        identifiers.length,
        "the driver error has to name at least one quoted identifier, or the derived half of " +
          "the deny set is empty and this sweep is that much less than it claims",
      ).toBeGreaterThan(0);

      const text = rendering(thrown);
      const leaked = [
        ...identifiers.filter((token) => text.includes(token)),
        ...DRIVER_MACHINERY.filter((tell) => text.includes(tell)),
      ].sort();

      expect(
        leaked,
        `D-13: no rejection may carry the failed statement or its bound parameters. This is ` +
          `the defect that escaped eleven merged, tagged T080 routes and cost T081 a whole ` +
          `task, reachable here from every published function because every one takes ` +
          `\`db: Db\`.\n  what a caller can read: ${text.slice(0, 400)}`,
      ).toEqual([]);
    });
  }
});

describe("the sealed fault renders as nothing (the hygiene clause)", () => {
  for (const name of FUNCTION_NAMES) {
    it(`\`${name}\`'s rejection has an empty enumerable surface`, async () => {
      /* The clause, quoted: `Object.keys(err)` is empty and `JSON.stringify(err)` is exactly
         `"{}"`; `cause` is present but NON-ENUMERABLE, which is what keeps `JSON.stringify`
         from reaching it; `stack` is retained. Checked with `propertyIsEnumerable`, never by
         inference — presence and enumerability are different questions.

         This is not a restatement of `tests/error-hygiene.test.ts`. That guard checks the
         SHAPE of a class the barrel exports; this checks what the live FAULT PATH actually
         produces, which is where D-13 bites and which a class-shape check cannot see. */
      const fn = await bind(name);
      const args = REACHES_THE_STORE[name]!;

      let thrown: unknown;
      try {
        await fn(db, ...args);
      } catch (error) {
        thrown = error;
      }

      expect(thrown, "nothing was thrown, so there is no rendering to check").toBeInstanceOf(Error);
      const err = thrown as Error;

      expect(Object.keys(err)).toEqual([]);
      expect(JSON.stringify(err)).toBe("{}");
      expect(
        typeof err.stack,
        "`stack` is RETAINED — the clause forbids leaking, not diagnosing",
      ).toBe("string");
      if (Object.getOwnPropertyDescriptor(err, "cause") !== undefined) {
        expect(
          err.propertyIsEnumerable("cause"),
          "`cause` carries the driver error and must be non-enumerable",
        ).toBe(false);
      }
    });
  }
});

describe("the rejection is a function of the operation and not of the driver", () => {
  it("`getProfile` answers the same rendering for two different handles", async () => {
    /* The invariance half, with its control two blocks up: the two DRIVER errors for these
       two parameters differ, so an implementation that let the driver's message through has
       somewhere to be caught. Without that control this cell would be comparing two things
       already equal, which is the shape T081 deleted thirteen cells for. */
    const getProfile = await bind("getProfile");

    const messages: string[] = [];
    for (const handle of ["t130-alpha-param", "t130-bravo-param"]) {
      let resolved = false;
      try {
        await getProfile(db, account(ACCOUNT_ID, handle), handle);
        resolved = true;
      } catch (error) {
        messages.push(error instanceof Error ? error.message : String(error));
      }
      /* Outside the `catch`, deliberately: a `throw` inside the `try` lands in this file's own
         `catch` and gets pushed as if it were the module's message, which would make the
         comparison below one this suite wrote both sides of. */
      expect(
        resolved,
        `getProfile resolved for "${handle}" against a store that cannot answer`,
      ).toBe(false);
    }

    expect(
      messages[0],
      `DERIVED, and labelled: T130 publishes no message form, so this rests on the two merged ` +
        `precedents that do — \`"<operation>: the account store failed."\` (T050) and ` +
        `\`"<operation>: the registry store failed."\` (T081) — plus D-50-17's "carries the ` +
        `operation alone". Under that shape the rendering cannot move with the handle. If the ` +
        `published form turns out to interpolate the caller's own identifier, this is the one ` +
        `cell that changes, and it should change by a RULING rather than by being deleted.`,
    ).toBe(messages[1]);
  });
});
