/* ============================================================
   T150 — the published surface

   Every name here is bound EXACTLY. T150's contract carries a
   Published signatures block, and the rule above it is that the
   contract names the interface and not only the behaviour, so a
   name the block publishes is no longer a thing either side may
   choose. There is no candidate list anywhere in this suite: T000
   measured twice that a list resolving to the WRONG export is more
   dangerous than one resolving to nothing, because the failure it
   reports is indistinguishable from a defect until somebody checks
   by hand.

   No database. Nothing in this file touches Postgres, so it runs
   wherever the barrel does — which also means these are the cells
   that stay meaningful when the compose stack is down.

   ── a type pin lies three ways, so it is not the only instrument ──
   `SignalState` is pinned at COMPILE time below, and `npm run
   typecheck` is the only thing that evaluates that line: a runtime
   check sees an object's keys and never its declaration. But a type
   pin is **silently vacuous against an absent module** — an
   `import type` of a name that is not there is one TS2307 and every
   assertion under it stops meaning anything.

   So the pin is paired with a SOURCE cell that reads the barrel off
   disk. That is the only instrument that separates *the member is
   absent* from *an assertion failed*, and it is the one a
   type-level instrument structurally cannot be.

   ── what is deliberately NOT asserted ──
   That the barrel exports nothing beyond the three names. §T150
   publishes no error class, and a store module that touches
   `@/lib/db` owes one — `tests/store-modules-seal-their-faults.test.ts`
   reds without it. An exhaustive assertion here would forbid the
   class the repository's own guard requires. Charged as F3; the
   silence is the contract's, and this suite does not fill it.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COUNTERS,
  PUBLISHED,
  PUBLISHED_KINDS,
  PUBLISHED_NAMES,
  SIGNAL_STATE_KEYS,
  bind,
  loadCounters,
  schemaTargetActorKinds,
  schemaTargetKinds,
} from "./contract";
import type { PublishedName, SignalState } from "./contract";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const COUNTERS_DIR = join(REPO_ROOT, "lib", "server", "counters");

/* ============================================================
   The source cell

   Reads `lib/server/counters/**` as TEXT. It asserts nothing about
   behaviour and it is not a substitute for the bindings below — it
   exists so that when those reds arrive, a reader can tell in one
   line which of the two worlds produced them.
   ============================================================ */

function sourceFiles(): string[] {
  try {
    return readdirSync(COUNTERS_DIR, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => join(e.parentPath ?? COUNTERS_DIR, e.name));
  } catch {
    return [];
  }
}

describe("the module is on disk at all", () => {
  /*
   * ONE cell, not two, and the merge is deliberate.
   *
   * It was two: an existence cell and a barrel cell that returned early when the directory was
   * empty. That early return made the barrel cell pass **because the module was absent** — a
   * green that means nothing, arriving at 0ms, in a file whose whole purpose is to tell a
   * reader which of two worlds produced the reds beside it. It is the vacuous shape this suite
   * is meant to hunt for in itself, and it was in the instrument rather than in the subject.
   *
   * Merged, so there is exactly one green here and it is only reachable with real source on
   * disk. Two reds for one fact would have been noise; a green for no fact is worse.
   */
  it("finds `lib/server/counters/**` on disk, with a barrel in it", () => {
    const files = sourceFiles();
    expect(
      files.length,
      `\`lib/server/counters/**\` holds no TypeScript source.\n` +
        `  §T150 owns it and publishes ${PUBLISHED_NAMES.join(", ")} from \`${COUNTERS}\`.\n` +
        `  **This red is the blind position, not a defect**: this suite was written in a ` +
        `worktree branched before the implementation existed. Every other red in this file is a ` +
        `consequence of this one until it goes green, and reading them as separate findings is ` +
        `the mistake this cell exists to prevent.`,
    ).toBeGreaterThan(0);

    const barrel = files.find((f) => f.endsWith("index.ts"));
    expect(
      barrel,
      `\`lib/server/counters/\` holds ${files.length} source files and no \`index.ts\`. ` +
        `\`lib/core/index.ts\` states the rule this repository follows: "The one module the app ` +
        `imports … Deep paths are internal and may be rearranged, so nothing outside should ` +
        `reach for one." The block publishes the barrel \`${COUNTERS}\`.`,
    ).toBeDefined();
    expect(readFileSync(barrel as string, "utf8").length).toBeGreaterThan(0);
  });
});

/* ============================================================
   `SignalState`, bound at COMPILE time

   `npm run typecheck` is what evaluates `PIN` below; vitest never
   sees it. Against an absent module the import is a TS2307 and the
   pin is vacuous — which is reported as the blind position rather
   than filtered, and is exactly what the source cell above exists
   to disambiguate.

   `Exact<>` by mutual assignability is deliberately NOT the
   instrument: it calls `{ a }` and `{ a; b? }` equal, so it is
   blind to an added optional member — and an optional
   `starredByCaller` is precisely what AC4 forbids ("`false` for an
   anonymous actor rather than absent"). `-?` in the mapped type is
   what strips optionality before the key sets are compared, so an
   optional member still shows up as a key and a MISSING one does
   not. The value-level half — that the four are `number`,
   `number`, `number`, `boolean` and not their `string` storage
   shapes — is `assertSignalState`'s, at runtime, because a numeric
   column arriving as a string type-checks perfectly at every
   boundary that never reads it.
   ============================================================ */

type Keys<T> = { [K in keyof T]-?: K }[keyof T];
type KeySetEquals<A, B> = [Keys<A>] extends [Keys<B>]
  ? [Keys<B>] extends [Keys<A>]
    ? true
    : false
  : false;
type Expect<T extends true> = T;

/* The pin. Referenced by `PIN_IS_EVALUATED` below so it cannot be dropped as unused — a pin
   nothing reads is deleted by the next reader as dead code, and it was the assertion. */
type SignalStatePin = Expect<
  KeySetEquals<import("@/lib/server/counters").SignalState, SignalState>
>;

const PIN_IS_EVALUATED: SignalStatePin = true;

describe("the published surface", () => {
  it("SIGNPOST ONLY — the SignalState pin is checked by typecheck, never by this cell", () => {
    /*
     * **This cell has no runtime discrimination and is not coverage.** `PIN_IS_EVALUATED` is the
     * literal `true`, so `toBe(true)` passes under every implementation and no mutation can red
     * it. Named so in the title, because a green whose name sounds like an assertion is counted
     * as one by whoever reads the summary line.
     *
     * What it is FOR: `SignalStatePin` is a type alias, and a type alias with no call site is
     * deleted by the next reader as dead code — and it was the assertion. This gives it one, and
     * gives a reader grepping `SignalState` in the test tree somewhere to land.
     *
     * The real instrument is `npm run typecheck`, and right now it reports `TS2307` on the
     * import — so **the pin is currently vacuous**, which is the blind position and is exactly
     * what the source cell above exists to make legible. A cast would neuter it permanently:
     * `true as SignalStatePin` compiles whatever the alias resolves to, so the annotation is on
     * the DECLARATION and the assignability check is the thing that fails.
     */
    expect(PIN_IS_EVALUATED).toBe(true);
  });

  it.each(PUBLISHED_NAMES)("exports `%s` as a function", async (name: PublishedName) => {
    /* Bound inside the cell, never in a hook: a throw in `beforeAll` produces SKIPS rather than
       reds, and a run with skipped > 0 is invalid rather than a zero. Three names, three reds. */
    const fn = await bind(name);
    expect(typeof fn, PUBLISHED[name]).toBe("function");
  });

  it("takes no Actor on `recordDownload`, which is what makes AC6 structural", async () => {
    /*
     * "`recordDownload` therefore takes **no `Actor`**, which is what makes the rule structural:
     * this function cannot discriminate on the caller because it is not given one."
     *
     * `Function.length` counts parameters before the first default or rest. An OPTIONAL `?`
     * parameter erases at runtime and still counts, which is what makes this the right
     * instrument: a third parameter added as `actor?: Actor` shows here as 3, and the criterion
     * is that the function is not GIVEN an actor — an optional one is still given one.
     *
     * Two is asserted rather than "not three", because "not three" is satisfied by a function
     * taking one argument or ten.
     */
    const fn = await bind("recordDownload");
    expect(
      fn.length,
      `\`recordDownload\` declares ${fn.length} parameters; the contract publishes two, ` +
        `\`(db, target)\`.\n  ${PUBLISHED.recordDownload}\n` +
        `  AC6 is ruled — an owner's download of their own private bundle COUNTS — and the ` +
        `ruling's mechanism is that this function cannot discriminate on the caller because it ` +
        `is not given one. A third parameter reopens that, whether or not it is optional.`,
    ).toBe(2);
  });

  it.each(["getSignals", "toggleStar"] as const)(
    "takes (db, actor, target) on `%s`",
    async (name) => {
      const fn = await bind(name);
      expect(
        fn.length,
        `\`${name}\` declares ${fn.length} parameters.\n  ${PUBLISHED[name]}`,
      ).toBe(3);
    },
  );

  it("does not publish a runtime value named `SignalState`", async () => {
    /*
     * `SignalState` is an interface and an interface has no runtime binding, so its ABSENCE
     * here is correct and is not a red. What would be a red is a value under that name: a
     * second declaration of one shape, by a route nobody ruled on.
     */
    const mod = await loadCounters();
    expect(
      mod.SignalState,
      `\`${COUNTERS}\` exports a runtime value named \`SignalState\`. The block publishes it as ` +
        `an interface, which has no runtime binding — a value under that name is a second ` +
        `declaration of one shape.`,
    ).toBeUndefined();
  });

  it("agrees with `lib/db/schema.ts` about the three target kinds", () => {
    /*
     * The block restates the kinds inline in all three signatures, three times over; the schema
     * is where they are declared. A second SOURCE rather than a consistency check — if these
     * disagree, the contract is wrong about a table it does not own, and the red says which
     * side moved.
     */
    expect(
      [...PUBLISHED_KINDS].sort(),
      `§T150 publishes \`"blueprint" | "card" | "term"\` in all three signatures and ` +
        `\`target_kind\` declares ${schemaTargetKinds().join(" | ")}.`,
    ).toEqual([...schemaTargetKinds()].sort());
  });

  it("writes a `target_actor` kind the schema declares", () => {
    /*
     * D-WAVE-01 gives T150 `kind = "star"` and nothing else. That the member exists is a fact
     * about the schema and is checked here rather than assumed by every write cell downstream:
     * a suite that plants `'star'` in nine fixtures and never checks the enum reds nine times
     * with a Postgres 22P02 and says nothing about which of the two is wrong.
     */
    expect(schemaTargetActorKinds(), "`target_actor_kind` must declare `star`").toContain("star");
  });

  it("holds the four SignalState keys in one place, and they are the four", () => {
    expect([...SIGNAL_STATE_KEYS]).toEqual([
      "downloadCount",
      "noteCount",
      "starCount",
      "starredByCaller",
    ]);
  });
});
