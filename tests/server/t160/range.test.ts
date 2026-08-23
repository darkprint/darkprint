/* ============================================================
   T160 — B-11's 0-100, and what a caller may not put in the store

   B-11 is "0-100 per metric" and `ballot_metric_range` enforces it
   in the database. §T160 has NO acceptance criterion about the
   range and publishes no error class, so what `castBallot` does
   with a 101 — refuse it, clamp it, or let the constraint refuse
   it — is undecided. That is charge F-160-H.

   ── SO THIS FILE ASSERTS ONLY WHAT IS TRUE UNDER EVERY READING ──
   Nothing here requires a rejection and nothing here requires a
   resolution. What all three readings agree on is the OUTPUT:

     * no `ballot` row ever holds a value outside 0-100;
     * no aggregate ever leaves the axis;
     * IF the call rejects, the refusal carries none of the
       driver's own prose — D-13, and the SQLSTATE this task can
       actually produce is `23514`, `check_violation`, raised by
       `ballot_metric_range` itself.

   That last one is the reason this file exists at all. The natural
   implementation lets the constraint do the refusing, and the
   natural failure is then a `DrizzleQueryError` reaching the caller
   with the full statement, every bound parameter and the
   constraint's name in it. A cell asserting only "it threw" is
   green against exactly that.

   ── the planted token, and why it is here rather than in a
      connection-string cell ──
   A deny list of driver tells is derived from the STATEMENT and
   cannot see a value the statement does not contain — a scan of
   that shape stayed green in this run on a document verifiably
   carrying a SQLSTATE. The other half works by PROVENANCE: a
   22-character random token is cast as the metric value, so the
   only route from it into a rendering is the module putting the
   caller's own bound parameter there. It over-matches nothing,
   because nothing else in the process has ever seen the string.

   A `-1` and a `101` are driven separately, and a non-numeric
   value separately again, because "a check constraint refusing -1
   by refusing every value passes that" — the same reason T005's
   own block gives for measuring both ends.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  METRICS,
  type Scratch,
  accountActor,
  assertAggregate,
  assertNoDriverProse,
  bind,
  plantedToken,
  renderingsOf,
} from "./contract";
import {
  ballotRows,
  closeDatabase,
  openDatabase,
  seedAccount,
  seedBundle,
} from "./fixtures";

let scratch: Promise<Scratch> | undefined;

function db(): Promise<Scratch> {
  if (scratch === undefined) {
    scratch = openDatabase();
    scratch.catch(() => {});
  }
  return scratch;
}

afterAll(async () => {
  await closeDatabase();
});

async function castRaw(
  s: Scratch,
  label: string,
  vote: Record<string, unknown>,
): Promise<{ bundleId: string; rejected: unknown; resolved: unknown }> {
  const owner = await seedAccount(s, { label: `${label}-owner`, weight: 1, validator: false });
  const bundle = await seedBundle(s, { ownerId: owner.id });
  const voter = await seedAccount(s, { label: `${label}-v`, weight: 1, validator: false });
  const castBallot = await bind("castBallot");
  try {
    const resolved = await castBallot(
      s.db,
      accountActor(voter.id, voter.handle),
      bundle.id,
      vote,
    );
    return { bundleId: bundle.id, rejected: undefined, resolved };
  } catch (err) {
    return { bundleId: bundle.id, rejected: err, resolved: undefined };
  }
}

describe("B-11's range — the output, under every live reading of what happens at the boundary", () => {
  it.each([
    ["101, one above the top of the axis", 101],
    ["-1, one below the bottom", -1],
    ["a value far outside, so a clamp and a refusal are told apart in the row", 100000],
  ])("a cast of %s never reaches the store out of range", async (label, value) => {
    const s = await db();
    const outcome = await castRaw(s, `rng${value}`, { efficacy: value });

    const rows = await ballotRows(s, outcome.bundleId);

    if (outcome.rejected !== undefined) {
      assertNoDriverProse(outcome.rejected, `the refusal of ${label}`);
      expect(
        outcome.rejected,
        `the refusal of ${label} is ${String(outcome.rejected)}, not an Error.`,
      ).toBeInstanceOf(Error);
      /* Nothing left behind. This is the live assertion on this branch and it is NOT implied
         by the check constraint: a row whose three metrics are all NULL satisfies
         `ballot_metric_range` perfectly, so an implementation that inserts the ballot and
         then fails on the value leaves a phantom ballot the constraint cannot see. */
      expect(
        rows,
        `castBallot refused ${label} AND left ${rows.length} ballot row(s): ` +
          `${JSON.stringify(rows)}.\n` +
          `  An all-NULL row passes \`ballot_metric_range\`, so the database cannot catch ` +
          `this one; only reading the table back can. "It threw" is satisfied by an ` +
          `implementation that wrote first.`,
      ).toEqual([]);
    } else {
      /* Accepted. The database cannot have stored the out-of-range value, so the live
         question is what the RESPONSE carries: a module answering an optimistic aggregate
         computed from the value it was handed rather than from the row it wrote reports 101
         here, and nothing in the store would ever show it. */
      const seen = assertAggregate(outcome.resolved, `castBallot's answer to ${label}`);
      for (const metric of METRICS) {
        expect(
          seen[metric].value >= 0 && seen[metric].value <= 100,
          `castBallot ACCEPTED ${label} and the aggregate then reads ` +
            `${seen[metric].value} on \`${metric}\`, off the 0-100 axis \`ScoreRadar\` plots. ` +
            `The stored row cannot hold it — \`ballot_metric_range\` forbids that — so this ` +
            `number came from the caller's own argument and not from the store.`,
        ).toBe(true);
      }
      expect(
        rows.filter((r) => r.efficacy !== null && (r.efficacy < 0 || r.efficacy > 100)),
        "the store, checked for completeness. `ballot_metric_range` makes this unfalsifiable " +
          "on its own; it is here so a red prints the row beside the response.",
      ).toEqual([]);
    }
  });

  /**
   * The provenance half. The metric carries a token nothing else in this process has seen, so
   * the only route from it into a rendering is the module putting the caller's own bound
   * parameter there.
   *
   * A non-numeric metric also reaches the driver through a different door from a
   * `check_violation` — `22P02`, invalid text representation — so this cell exercises a
   * second failure path as well as a second detection method.
   */
  it("a refusal never carries the caller's own value back out", async () => {
    const s = await db();
    const token = plantedToken();
    const outcome = await castRaw(s, "planted", { efficacy: token });

    if (outcome.rejected === undefined) {
      /* Accepting a non-numeric metric is its own finding, and the store is where it shows. */
      const rows = await ballotRows(s, outcome.bundleId);
      expect(
        rows.map((r) => r.efficacy).filter((v) => v !== null && !Number.isInteger(v)),
        `castBallot accepted a non-numeric \`efficacy\` and stored ${JSON.stringify(rows)}.`,
      ).toEqual([]);
      return;
    }

    assertNoDriverProse(outcome.rejected, "the refusal of a non-numeric metric");

    const r = renderingsOf(outcome.rejected);
    for (const [name, text] of [
      ["message", r.message],
      ["String(err)", r.string],
      ["JSON.stringify(err)", r.json],
      ["own keys", r.ownKeys.join(",")],
    ] as const) {
      expect(
        text.includes(token),
        `${name} carries the value this suite bound as \`efficacy\`.\n` +
          `  The token is random and minted here, so it can only have arrived through the ` +
          `driver error — a \`DrizzleQueryError\`'s own message opens with the full query and ` +
          `every bound parameter. D-13 puts the driver error on \`cause\`, non-enumerable, ` +
          `and it reaches no rendering.\n` +
          `  ${name}: ${text.slice(0, 300)}`,
      ).toBe(false);
    }
  });
});
