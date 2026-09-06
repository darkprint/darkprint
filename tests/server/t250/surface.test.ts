/* ============================================================
   T250 — the published surface

   Both names are bound EXACTLY. §T250 carries a Published
   signatures block and the rule above it is that the contract names
   the interface and not only the behaviour, so a name the block
   publishes is no longer a thing either side may choose. There is
   no candidate list anywhere in this suite: T000 measured twice
   that a list resolving to the WRONG export is more dangerous than
   one resolving to nothing, because the failure it reports is
   indistinguishable from a defect until somebody checks by hand.

   No database. Nothing in this file touches Postgres, so these are
   the cells that stay meaningful when the compose stack is down.

   ── the source cell, and why a type pin is not enough ──
   A type pin is evaluated only by `tsc`, and it lies three ways: it
   is silently vacuous against an absent module (one TS2307 and
   every assertion under it stops meaning anything), loudly useless
   against a present barrel missing a member, and falsely green on a
   negative whose probe matches neither shape. A type-level
   instrument structurally cannot observe its own blindness.

   So the pins are paired with a SOURCE cell that reads the barrel
   off disk. That is the only thing that separates *the member is
   absent* from *an assertion failed*.

   ── what is deliberately NOT asserted ──
   That the barrel exports nothing beyond the two names. §T250
   publishes no error class, and a module reaching `@/lib/db` owes
   one: `tests/store-modules-seal-their-faults.test.ts` builds its
   domain over every `lib/server/<name>/` whose source imports
   `@/lib/db` and reds without a sealed class. An exhaustive
   assertion here would forbid the class the repository's own guard
   requires. The silence is the contract's and this suite does not
   fill it; it is reported rather than legislated.
   ============================================================ */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PUBLISHED,
  PUBLISHED_NAMES,
  REPO_ROOT,
  bind,
  loadSeed,
  outcomeOf,
} from "./contract";
import type { PublishedName } from "./contract";

const SEED_DIR = join(REPO_ROOT, "lib", "server", "seed");
const SEED_SCRIPT = join(REPO_ROOT, "scripts", "import-seed.ts");

/* ============================================================
   The source cell

   Reads the barrel as TEXT and asserts nothing about behaviour. It
   is not a substitute for the bindings below; it exists so that
   when those reds arrive a reader can tell in one line which of the
   two worlds produced them.

   It reads `index.ts` only. Walking `lib/server/seed/**` and
   grepping the implementation would be reading the implementer's
   `Owns`, which this suite does not do.
   ============================================================ */
describe("the module on disk", () => {
  it("reports whether the barrel exists at all, which no type pin can", () => {
    const present = existsSync(join(SEED_DIR, "index.ts"));
    const listing = existsSync(SEED_DIR) ? readdirSync(SEED_DIR).sort().join(", ") : "(no folder)";
    expect(
      present,
      `lib/server/seed/index.ts is not on disk. Found: ${listing}.\n` +
        "  Against an unmerged implementation this is the blind position and not a defect. It is " +
        "asserted so that a red here and a red in the binding cells below are distinguishable: " +
        "this one says the module is ABSENT, those say an assertion failed.",
    ).toBe(true);
  });

  it("names both published functions in the barrel's own text", () => {
    const source = existsSync(join(SEED_DIR, "index.ts"))
      ? readFileSync(join(SEED_DIR, "index.ts"), "utf8")
      : "";
    /* Terminated on both sides. `planImport` is not a prefix of `runImport` and neither contains
       the other, but the habit is the point: an unterminated match is how two cells become one. */
    for (const name of PUBLISHED_NAMES) {
      expect(new RegExp(`\\b${name}\\b`).test(source), `${name} is not named in the barrel`).toBe(
        true,
      );
    }
  });

  it("ships the entry point the block names", () => {
    expect(existsSync(SEED_SCRIPT), "scripts/import-seed.ts is not on disk").toBe(true);
  });
});

describe("the barrel", () => {
  it("loads", async () => {
    const outcome = await outcomeOf(() => loadSeed());
    expect(outcome.error ?? null).toBeNull();
    expect(outcome.ok).toBe(true);
  });

  it.each(PUBLISHED_NAMES)("publishes %s as a function", async (name: PublishedName) => {
    const outcome = await outcomeOf(() => bind(name));
    expect(outcome.error ?? null).toBeNull();
    expect(typeof outcome.value).toBe("function");
  });
});

describe("the arities the rulings fixed", () => {
  /**
   * D-250-01 dropped `root`, and this cell says what it does and does not catch.
   *
   * `Function.length` counts parameters before the first defaulted or rest one. TypeScript's `?`
   * erases at runtime, so `planImport(root?: string)` still reports `1` and IS caught here.
   * `planImport(root: string = undefined)` reports `0` and is NOT — which is why the behavioural
   * half sits beside it: the function is called with no argument and required to answer.
   */
  it("planImport takes no parameter (D-250-01)", async () => {
    const planImport = await bind("planImport");
    expect(planImport).toHaveLength(0);
  });

  it("planImport answers when called with no argument", async () => {
    const planImport = await bind("planImport");
    const outcome = await outcomeOf(() => planImport());
    expect(outcome.error ?? null).toBeNull();
    expect(outcome.value === null || typeof outcome.value !== "object").toBe(false);
  });

  it("runImport takes the db and the plan", async () => {
    const runImport = await bind("runImport");
    expect(runImport).toHaveLength(2);
  });
});

/* ============================================================
   The type pins

   Evaluated by `npx tsc --noEmit` and by nothing else: a runtime
   check sees an object's keys and never its declaration.

   ── each one BINDS THE MODULE, and that is the whole design ──
   Against an absent module a type pin is one TS2307 and every
   assertion under it stops meaning anything, while the cell itself
   goes GREEN at runtime, because erased types leave nothing to run.
   A green cell that measured nothing is the exact shape this suite
   is hunting for in itself.

   So each cell below ends by binding the barrel. A green here now
   means two things at once — the pin compiled AND the module is
   there — and there is no state in which the pin is vacuous and the
   cell is green. The bind is LAST, after the type work, so a red
   from it cannot mask anything above it.
   ============================================================ */
describe("the published types", () => {
  it("pins ImportPlan and ImportResult at compile time", async () => {
    type Plan = import("@/lib/server/seed").ImportPlan;
    type Result = import("@/lib/server/seed").ImportResult;

    /* `ImportResult extends ImportPlan`, so a Result is assignable to a Plan and a Plan is not
       assignable to a Result. Both directions are pinned: assignability one way alone is
       satisfied by the two being the SAME type, which is what the `extends` forbids. */
    const widens = (r: Result): Plan => r;
    // @ts-expect-error a bare ImportPlan is missing `created` and `skipped`
    const narrows = (p: Plan): Result => p;

    /* The two members `extends` adds, pinned as `number` rather than merely present. `unknown`
       would satisfy "the member exists" and admits the string a `count(*)` hands back. */
    const created: number = 0 as Result["created"];
    const skipped: number = 0 as Result["skipped"];
    const handle: string = "" as Plan["registryHandle"];
    /* A fourth binding, `Plan["ontologyVersion"]`, stood beside these. 0009 withdrew the
       member; a type pin on an absent member is a compile error, not a weaker assertion. */

    expect([typeof widens, typeof narrows]).toEqual(["function", "function"]);
    expect([created, skipped, handle]).toEqual([0, 0, ""]);

    /* Last. Without it every line above is erased and this cell is green against a module that
       does not exist. */
    expect(typeof (await bind("runImport"))).toBe("function");
  });

  it("pins the visibility union to exactly two members", async () => {
    type Plan = import("@/lib/server/seed").ImportPlan;
    type Visibility = Plan["cards"][number]["visibility"];

    const publicOk: Visibility = "public";
    const privateOk: Visibility = "private";
    // @ts-expect-error the union admits nothing else
    const neither: Visibility = "unlisted";

    expect([publicOk, privateOk, neither]).toEqual(["public", "private", "unlisted"]);
    expect(typeof (await bind("planImport"))).toBe("function");
  });
});

describe("what this suite does not assert", () => {
  /**
   * Recorded as a cell rather than as a comment, so the silence is in the run's output.
   *
   * `tests/store-modules-seal-their-faults.test.ts` builds its domain over `git ls-tree backend
   * lib/server`, so it says nothing about this task until T250 merges. Its rule is that a module
   * importing `@/lib/db` must publish a sealed error class. §T250's block publishes none, and
   * `runImport(db, plan)` takes a `Db`. This cell asserts the premise of that collision rather
   * than the conclusion: the guard exists, and its rule is the one quoted.
   */
  it("leaves the barrel's error class to the contract, and says why", () => {
    const guard = join(REPO_ROOT, "tests", "store-modules-seal-their-faults.test.ts");
    expect(existsSync(guard)).toBe(true);
    const source = readFileSync(guard, "utf8");
    expect(source).toContain("@/lib/db");
    expect(PUBLISHED.runImport).toContain("db: Db");
  });
});
