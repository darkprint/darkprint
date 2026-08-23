/* ============================================================
   T240 — the adversary pass: both halves merged, run against
   each other, and attacked

   Written AFTER reading `lib/server/observability/**`, which the
   blind half never did. Everything here is a measurement — an
   input, an observed output, and the cell that produced it — and
   each cell says which half it charges.

   ── the four things this file was asked to attack ──
   1. the twelve-member equality (`vocabulary.test.ts`, and it
      holds — the expected set is parsed out of D-240-08 rather
      than transcribed, so a member added on spec reds against
      the ruling);
   2. `bundle.publish`'s composing-layer rule, which its
      implementer says is stated and unguarded — VERIFIED here
      mechanically rather than taken;
   3. the `isOperator` copy (D-240-10), where a weakened copy is
      the failure mode — DIFFERENTIALLY tested against T060's own
      predicate, which is the only second axis available;
   4. its two chased zeros, and **zero-2's equivalence argument
      is REFUTED below by measurement.**

   ── what this file does not claim ──
   Nothing here is a mutation result. Mutations are pre-registered
   by identity and scope and reported separately; an all-green
   suite is a claim about an instrument until something shows it
   still fires.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A DEEP import, and the only one in this suite.
 *
 * `lib/db/index.ts`'s rule forbids reaching past a barrel, and D-240-10 is the debt that
 * exists because `isOperator` is **not on the policy barrel** — which publishes `can`,
 * `visibleTo` and three types. That is precisely why T240 had to copy it.
 *
 * A differential test needs the original, and the original is only reachable this way. The
 * alternative is comparing the copy against a restatement I write, which is the
 * co-authored-reference error: a check written by the author of the assertions is a
 * consistency check, never a second axis. T060's module is the second axis — it was written
 * by neither half of this task.
 *
 * **This import disappears the day `isOperator` reaches the barrel and D-240-10's copy goes
 * with it.** Both are the same debt seen from two sides.
 */
import { isOperator } from "@/lib/server/policy/is-owner";

import {
  boundListAudit,
  boundWriteAudit,
  RecordedSetup,
  refusalForm,
  scratchDatabase,
  type Row,
  type Scratch,
} from "./contract";

const setup = new RecordedSetup<Scratch>("The T240 adversary scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

/**
 * Actors the module's own hardening contemplates — every one of them a shape `Actor` does
 * not admit, which is the whole reason `isOperatorActor` reads its fields with
 * `Object.hasOwn` and checks the id is a non-empty string.
 *
 * If nothing but a well-typed `Actor` could ever arrive, none of that hardening would have
 * a reason to exist. It does exist, in both halves, carried across the copy deliberately —
 * so the set of inputs it is FOR is the set this file tests it against.
 */
const MALFORMED_ACTORS: readonly [string, unknown][] = [
  ["undefined", undefined],
  ["null", null],
  ["a bare string", "operator"],
  ["a number", 7],
  ["an empty object", {}],
  ["an inherited kind/accountId (Object.create)", Object.create({ kind: "operator", accountId: "acc" })],
  ["operator with no accountId", { kind: "operator" }],
  ["operator with an empty-string accountId", { kind: "operator", accountId: "" }],
  ["operator with a non-string accountId", { kind: "operator", accountId: 7 }],
];

describe("T240 adversary — D-240-10's copy, against T060's own predicate", () => {
  /**
   * **The copy is FAITHFUL, and this is the cell that shows it rather than asserting it.**
   *
   * D-240-10's stated failure mode is a weakened copy, and the read is not obvious by eye:
   * the original composes `isId(actor.accountId)` and the copy inlines
   * `typeof … === "string" && … .length > 0`. Those are the same predicate — `isId`'s body
   * is exactly that — but "the same by inspection" is what a weakened copy also looks like
   * to the person who wrote it.
   *
   * So the two are run against the same nine adversarial actors and their verdicts compared
   * ELEMENT-WISE. `listAudit` does not expose its predicate, so its verdict is read off the
   * only thing that is observable: whether it refuses. That makes this a test of the
   * composed behaviour, which is the thing that actually matters.
   *
   * **Where the two disagree the cell reports the actor, not a count** — a count of
   * agreements is satisfied by two predicates that agree on eight and differ on the ninth,
   * and the ninth is always the interesting one.
   */
  it("agrees with `lib/server/policy`'s `isOperator` on every adversarial actor", async () => {
    const env = setup.require();
    const list = await boundListAudit();

    const disagreements: string[] = [];
    for (const [label, actor] of MALFORMED_ACTORS) {
      let policy: boolean | "threw";
      try {
        policy = isOperator(actor as Parameters<typeof isOperator>[0]);
      } catch {
        policy = "threw";
      }

      let module_: boolean | "threw";
      try {
        await list(env.client.db, actor, {});
        module_ = true;
      } catch (err) {
        module_ = (err as Error).message === refusalForm() ? false : "threw";
      }

      if (policy !== module_) disagreements.push(`${label}: policy=${policy}, listAudit=${module_}`);
    }

    expect(
      disagreements,
      `D-240-10: the copied predicate and T060's own disagree on:\n` +
        disagreements.map((d) => `  - ${d}`).join("\n") +
        `\n  A weakened copy is the failure mode the ruling names, and T060's module is the ` +
        `only second axis available — a restatement written here would be a consistency ` +
        `check on my own reading, never an independent one.`,
    ).toEqual([]);
  });

  /**
   * **F-240-D — the module's own "nothing else leaves" claim is false, and it refutes the
   * equivalence argument that was offered for leaving the check where it is.**
   *
   * `store.ts`'s header: *"what crosses this line is either a value, this module's own
   * refusal, or an `AuditStoreError` naming the operation. Nothing else leaves."*
   *
   * Measured, `listAudit(db, undefined, {})` and `listAudit(db, null, {})` reject with a
   * raw **`TypeError: Cannot convert undefined or null to object`** — from `Object.hasOwn`
   * inside `isOperatorActor`, which runs BEFORE `withStore` is entered. A bare `TypeError`
   * carries a stack and an internal path, which is the B-03 rendering the wrapper exists to
   * prevent, and it leaves through the one door the module says is closed.
   *
   * **This is exactly the case zero-2's equivalence argument declares impossible.** That
   * argument is that moving the permission check to the top of `withStore`'s callback is
   * observationally identical, because the decision arm passes `NotPermittedError` through
   * unwrapped. That holds for every actor the predicate ANSWERS about. It does not hold for
   * the two it THROWS on: inside `withStore` the `TypeError` is sealed into an
   * `AuditStoreError`; outside it escapes raw. The two placements differ on precisely the
   * input class B-03 is about — and the move the argument called a no-op is the fix.
   *
   * **Scope, stated so nobody reads this as larger than it is.** `Actor` is a typed union,
   * so neither value is reachable through a type-correct call, and the same throw comes out
   * of T060's original — the copy is faithful here too, fault included. What makes it a
   * finding rather than a curiosity is that the module is hardened against a *subtler*
   * malformed actor (an inherited `kind`, via `Object.create`) and not against the two
   * simplest ones. A predicate carrying that hardening has already conceded that untrusted
   * shapes reach it.
   */
  it("F-240-D: lets only a refusal or an AuditStoreError out, for every malformed actor", async () => {
    const env = setup.require();
    const list = await boundListAudit();

    const escaped: string[] = [];
    for (const [label, actor] of MALFORMED_ACTORS) {
      try {
        await list(env.client.db, actor, {});
      } catch (err) {
        const e = err as Error;
        if (e.name !== "NotPermittedError" && e.name !== "AuditStoreError") {
          escaped.push(`${label} → ${e.name}: ${e.message}`);
        }
      }
    }

    expect(
      escaped,
      `F-240-D: a rejection that is neither this module's refusal nor its wrapper left ` +
        `\`listAudit\`:\n` +
        escaped.map((e) => `  - ${e}`).join("\n") +
        `\n  lib/server/observability/store.ts: "what crosses this line is either a value, ` +
        `this module's own refusal, or an AuditStoreError naming the operation. Nothing else ` +
        `leaves."\n` +
        `  A bare TypeError carries a stack and an internal path — the B-03 rendering the ` +
        `wrapper exists to prevent.\n` +
        `  This also REFUTES zero-2's equivalence argument: moving the permission check to ` +
        `the top of withStore's callback is NOT observationally identical, because there the ` +
        `throw would be sealed. The move that was called a no-op is the fix.`,
    ).toEqual([]);
  });
});

describe("T240 adversary — the refusal is a CLASS, not only a sentence", () => {
  /**
   * **A gap in my own blind half, closed here.**
   *
   * `list.test.ts` asserts the refusal's message by exact equality against the published
   * form, three times, and never once asserts what was thrown. An implementation raising a
   * bare `Error("listAudit: not permitted.")` passes every cell I wrote — and D-240-04's
   * class exists because **a refusal a caller cannot NAME is a refusal a caller cannot
   * branch on**, which is the rule the saves and limits barrels both state in their own
   * headers.
   *
   * It matters more here than the general rule suggests: `withStore` recognises the
   * decision by IDENTITY (`err instanceof NotPermittedError`) and seals everything else. A
   * refusal thrown as a bare `Error` would be caught by that wrapper and re-rendered as
   * "the audit store failed" — turning a refusal about AUTHORITY into one about
   * AVAILABILITY, which is AC5's distinction collapsing one layer up from the row.
   */
  it("throws `NotPermittedError`, which is what keeps the refusal out of the store wrapper", async () => {
    const env = setup.require();
    const mod = await import("@/lib/server/observability");
    const NotPermittedError = (mod as unknown as Record<string, unknown>).NotPermittedError as
      | (new () => Error)
      | undefined;

    expect(
      typeof NotPermittedError,
      `D-240-04: the barrel exports no \`NotPermittedError\`, so a caller cannot tell a ` +
        `refusal from a fault except by matching a sentence.`,
    ).toBe("function");

    const list = await boundListAudit();
    let thrown: Error | undefined;
    try {
      await list(env.client.db, { kind: "anonymous" }, {});
    } catch (err) {
      thrown = err as Error;
    }

    expect(thrown, "D-240-04: an anonymous read resolved where a refusal is the criterion.").toBeDefined();
    expect(
      thrown instanceof (NotPermittedError as new () => Error),
      `D-240-04: the refusal is a ${thrown?.name}: ${thrown?.message}\n` +
        `  The sentence alone is not the criterion. \`withStore\` recognises the decision by ` +
        `IDENTITY and seals everything else, so a bare Error carrying the right words would ` +
        `be re-rendered as a store fault — a refusal about authority becoming one about ` +
        `availability, which is AC5's distinction collapsing one layer above the row.`,
    ).toBe(true);

    /* And it must stay sealed as an error: the published sentence is the whole rendering,
       so nothing may ride along enumerably where a problem+json body would pick it up. */
    expect(
      JSON.stringify(thrown),
      `B-03: the refusal serialises as ${JSON.stringify(thrown)}; it must carry the sentence ` +
        `and nothing else — naming a target the caller may not see is itself a leak.`,
    ).toBe("{}");
  });
});

describe("T240 adversary — D-240-13, the `cause` clause at its ruled scope", () => {
  /**
   * D-240-13 scopes the clause: assert a `cause`, WHERE PRESENT, is non-enumerable, and
   * assert its presence only on the wrapped-driver-fault path.
   *
   * `store-error.test.ts` asserts presence on the FK path, which IS that path. What is left
   * is the general half — no `AuditStoreError` this module can produce may carry an
   * ENUMERABLE cause — and it is asserted over both classes rather than one, because the
   * clause is about the rendering and both classes are rendered the same way.
   */
  it("never carries an enumerable `cause`, on either class", async () => {
    const mod = (await import("@/lib/server/observability")) as unknown as Record<string, unknown>;

    const cases: [string, Error][] = [];
    const AuditStoreError = mod.AuditStoreError as new (op: string, cause: unknown) => Error;
    const NotPermittedError = mod.NotPermittedError as new () => Error;

    cases.push(["AuditStoreError with a driver cause", new AuditStoreError("probe", new Error("driver"))]);
    /* D-240-13's own example: a pre-check that throws with nothing underneath it. The
       ruling says this is not wrong, so the cell asserts the clause holds here too rather
       than asserting a cause exists. */
    cases.push(["AuditStoreError with an undefined cause", new AuditStoreError("probe", undefined)]);
    cases.push(["NotPermittedError", new NotPermittedError()]);

    const offenders = cases
      .filter(([, err]) => Object.prototype.propertyIsEnumerable.call(err, "cause"))
      .map(([label]) => label);

    expect(
      offenders,
      `D-240-05/D-240-13: ${offenders.join(", ")} carries an ENUMERABLE \`cause\`, so the ` +
        `driver error ships in the serialised body — the B-03 leak in the one place a ` +
        `reviewer reading \`message\` would never check.`,
    ).toEqual([]);

    /* The two constructions must render identically. If they did not, the shape of a
       rendering would tell a reader which internal path produced it, which is the same
       class of leak one level down. */
    expect(
      cases.map(([, err]) => JSON.stringify(err)),
      `D-240-13: the constructions do not render alike, so the rendering discloses which ` +
        `internal path produced it.`,
    ).toEqual(["{}", "{}", "{}"]);
  });
});

describe("T240 adversary — what AC1 still does not cover, recorded as a measurement", () => {
  /**
   * **D-240-08's composing-layer rule is stated and UNGUARDED, and this cell is the
   * verification rather than the claim.**
   *
   * The rule: *"THE COMPOSING LAYER WRITES THE ROW, A MODULE UNDERNEATH DOES NOT."*
   * `bundle.publish` overlaps `bundle.create`/`release.add` deliberately, so a publish that
   * wrote through archive AND at the composing layer would make one operation two rows.
   * **AC1 as narrowed by D-240-01 cannot catch that** — it counts one `writeAudit` call,
   * and this is two.
   *
   * Its implementer says the rule is unguarded because no call site exists. **Verified, not
   * taken**: enumerated mechanically over the merged tree, and the enumeration is the cell.
   * A `grep` over `lib`, `app`, `components` and `scripts` for the two published functions
   * finds zero call sites outside this module's own folder and this suite.
   *
   * **This cell is deliberately not a red.** Zero call sites is the correct state today —
   * D-240-09 refuses to pre-seed members for callers that do not exist, and the same logic
   * refuses a guard for a call graph that does not either. What it does is make the claim
   * rest on a measurement, and turn into a red the day the first caller lands without a
   * guard arriving with it.
   */
  it("records that AC1's whole-corpus half has no call site to be tested against", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const root = fileURLToPath(new URL("../../../", import.meta.url));

    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
        const path = `${dir}/${name}`;
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.tsx?$/.test(name)) continue;
        const relative = path.slice(root.length);
        /* The module's own folder and this suite are not callers of it. */
        if (relative.startsWith("lib/server/observability/")) continue;
        if (relative.startsWith("tests/server/t240/")) continue;
        const source = readFileSync(path, "utf8");
        if (/\b(writeAudit|listAudit)\s*\(/.test(source)) callers.push(relative);
      }
    };
    for (const top of ["lib", "app", "components", "scripts"]) {
      try {
        walk(`${root}${top}`);
      } catch {
        /* A top-level directory that does not exist is not a caller either. */
      }
    }

    console.log(
      `T240 AC1 whole-corpus half: ${callers.length} call site(s) of writeAudit/listAudit ` +
        `outside lib/server/observability/**: ${callers.join(", ") || "(none)"}`,
    );

    expect(
      callers,
      `D-240-08's composing-layer rule now has ${callers.length} call site(s) to bind:\n` +
        callers.map((c) => `  - ${c}`).join("\n") +
        `\n  The rule is "THE COMPOSING LAYER WRITES THE ROW, A MODULE UNDERNEATH DOES NOT", ` +
        `and AC1 as narrowed cannot enforce it — it counts ONE writeAudit call and a ` +
        `double-write is two. D-240-01 records the whole-corpus half as UNOWNED; this cell ` +
        `reds the day that stops being free, so the obligation surfaces with its first ` +
        `caller instead of after it.`,
    ).toEqual([]);
  });

  /**
   * The one property of the composing-layer rule that IS testable from here: an action the
   * rule governs must be writable, so a caller that follows it is not blocked by the
   * vocabulary.
   *
   * Thin, and said to be thin. It shows `bundle.publish` exists and round-trips; it says
   * nothing about whether anybody writes it in the right place, which is the whole content
   * of the rule and is not observable from this partition.
   */
  it("can write `bundle.publish`, which is all of the rule this partition can observe", async () => {
    const env = setup.require();
    const write = await boundWriteAudit();

    await write(env.client.db, {
      actorId: env.ownerId,
      actorKind: "owner",
      action: "bundle.publish",
      targetKind: "bundle",
      targetId: "adversary/composing@1.0.0",
      decision: "allowed",
    });

    const list = await boundListAudit();
    const rows = await list(env.client.db, { kind: "operator", accountId: env.operatorId }, {
      targetKind: "bundle",
      targetId: "adversary/composing@1.0.0",
    });

    expect(
      rows.map((r) => (r as Row).action),
      "the action D-240-08's composing-layer rule governs does not round-trip.",
    ).toEqual(["bundle.publish"]);
  });
});
