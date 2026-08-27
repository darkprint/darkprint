/* ============================================================
   T160 — T060's third ruling, and a red here is an OPEN CONTRACT
   QUESTION rather than a failed acceptance criterion

   ── READ THIS BEFORE CHARGING ANYBODY WITH A RED IN THIS FILE ──
   T060 rules that AUTHORITY IS NEVER INHERITED: an actor whose
   `kind` or `accountId` sits on its prototype is not the thing it
   looks like, and `can`/`visibleTo` read both fields through
   `Object.hasOwn` for that reason. D-240-15 is what the ruling
   costs when nothing holds it — one `Object.create` fixture
   inherited BOTH fields, so whichever clause survived a mutation
   still refused it, and deleting either clause reddened zero cells.

   §T160 DOES NOT RESTATE THAT RULING, and it cannot delegate to
   `can`: `Resource` (`lib/server/policy/types.ts:16-20`) has no
   `ballot` member, so there is nothing for `can` to decide and the
   refusal is the ballot module's own. That is D-240-10's
   charged-copy shape arriving a third time.

   So an implementer who built exactly to §T160 — "an anonymous
   ballot is refused", and nothing else about actors — writes
   `actor.kind === "account" && actor.accountId` and GRANTS every
   actor below, because a prototype lookup answers both. A red here
   would then be a correct implementation of the section as
   written, and reporting it as an AC6 failure would be a false
   charge.

   ── why the cells are here anyway rather than deleted ──
   Deleting the clause is the move D-240-11 rules against:
   "labelling the uncharged clause in the cell and printing the
   live set rather than deleting the clause is the right shape — it
   rules against a measurement instead of against a memory." The
   question is real, it is reported as charge F-160-H, and the
   file's own name is the label.

   Each cell inherits EXACTLY ONE field and owns the other, which
   is D-240-15's repair applied before the same hole can open here:
   a fixture inheriting both is refused by either clause alone and
   cannot separate them.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import type { Actor } from "@/lib/server/policy";

import { type Scratch, bind, describe_ } from "./contract";
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

/** `kind` on the prototype, `accountId` its own. */
function inheritedKind(accountId: string): Actor {
  return Object.assign(Object.create({ kind: "account" }), {
    accountId,
    handle: null,
  }) as Actor;
}

/** `accountId` on the prototype, `kind` its own. */
function inheritedId(accountId: string): Actor {
  return Object.assign(Object.create({ accountId }), {
    kind: "account",
    handle: null,
  }) as Actor;
}

describe("T060 N-2/N-4 — authority is never inherited (UNRULED for T160)", () => {
  it.each([
    {
      label: "`kind` inherited, `accountId` its own",
      build: inheritedKind,
      clause: "`Object.hasOwn(actor, \"kind\")`",
    },
    {
      label: "`accountId` inherited, `kind` its own",
      build: inheritedId,
      clause: "`Object.hasOwn(actor, \"accountId\")`",
    },
  ])("refuses an actor with $label", async ({ label, build, clause }) => {
    const s = await db();
    const owner = await seedAccount(s, { label: "inh-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const voter = await seedAccount(s, { label: "inh-v", weight: 1, validator: false });
    const castBallot = await bind("castBallot");

    let rejected: unknown;
    let resolved: unknown;
    try {
      resolved = await castBallot(s.db, build(voter.id), bundle.id, { efficacy: 60 });
    } catch (err) {
      rejected = err;
    }

    const rows = await ballotRows(s, bundle.id);
    expect(
      rows.length === 0 && rejected !== undefined,
      `castBallot GRANTED an actor with ${label} — it ${
        rejected === undefined ? `resolved with ${describe_(resolved)}` : "rejected"
      } and left ${rows.length} ballot row(s).\n` +
        `  READ THE FILE HEADER BEFORE CHARGING THIS. §T160 does not restate T060's ruling ` +
        `that authority is never inherited, and \`Resource\` has no \`ballot\` member, so ` +
        `\`can\` cannot decide it. An implementation built to the section as written grants ` +
        `here, and this red is a CONTRACT QUESTION — charge F-160-H — rather than a failed ` +
        `AC6.\n` +
        `  What the ruling would require: ${clause}, which a prototype lookup does not ` +
        `satisfy. This fixture inherits exactly one field and owns the other, so each clause ` +
        `is separable; D-240-15 is the measurement of what happens when one fixture inherits ` +
        `both and neither clause can be mutated to a red.`,
    ).toBe(true);
  });
});
