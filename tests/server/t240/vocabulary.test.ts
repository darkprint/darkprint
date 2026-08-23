/* ============================================================
   T240 — the absolute constraint: no audit action names a
   blueprint run

   §T240 calls this "a product promise, not an engineering
   preference", and quotes the product's own copy for it:
   `components/bundle/Aside.tsx` — "What the registry stores is
   this bundle and who owns it. What it still does not: a run, a
   key, or any telemetry about either."

   The block asks for "a test [that] asserts no `action` value in
   the enum's live set refers to a run", and **D-240-03 is the
   ruling that made such a test possible at all**: there was no
   enum. `action` is `text` in `schema.ts` and the block typed it
   `string`, so the set the assertion quantifies over did not
   exist and the constraint was held by remembering. `AUDIT_ACTIONS`
   is now published as a closed set and `action` is typed as that
   union, which makes an action naming a run unpassable rather
   than merely discouraged.

   **Its membership is the implementer's to propose and the
   orchestrator's to ratify.** Nothing here proposes one. These
   cells quantify over whatever set lands.

   ── the forbidden vocabulary is DERIVED from the product copy ──
   Not transcribed. `Aside.tsx` is the source §T240 cites, so the
   nouns are parsed out of the sentence in that file: if the copy
   changes, this suite's domain changes with it, and if the file
   moves the cell says so rather than passing over a list nobody
   maintains.

   ── and one clause of the derived set is REPORTED, not charged ──
   The copy names three things: a run, a key, and telemetry about
   either. Only *run* is charged. `key` is not, and the reason is
   written into the cell: T230 ships API keys as a stored registry
   object with its own audit obligation (`backend.md` §T230 AC7 —
   "AC7's audit is T240's `writeAudit`"), so an action named
   `apikey.revoke` is legitimate and a cell charging `key` would
   red a correct implementation. A clause of my own query that
   would red the right answer gets LABELLED rather than deleted,
   and the orchestrator gets to rule on it.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditRows,
  boundAuditActions,
  ratifiedActions,
  boundWriteAudit,
  RecordedSetup,
  scratchDatabase,
  type Scratch,
} from "./contract";

const ASIDE = fileURLToPath(new URL("../../../components/bundle/Aside.tsx", import.meta.url));

/**
 * The nouns the product copy says the registry does not hold, read out of the file §T240
 * cites rather than retyped here.
 *
 * A parse that finds nothing is a BROKEN TEST and throws saying so — an empty forbidden set
 * would make every assertion below vacuously true, which is the silent failure this
 * derivation exists to avoid in the first place.
 */
function forbiddenNouns(): string[] {
  const source = readFileSync(ASIDE, "utf8");
  const sentence = /What it still does not:\s*([^<.]+)\./.exec(source);
  if (sentence === null) {
    throw new Error(
      `components/bundle/Aside.tsx no longer carries the "What it still does not:" sentence ` +
        `that backend.md §T240 cites as the source of this constraint.\n` +
        `  This suite DERIVES the forbidden vocabulary from that copy rather than ` +
        `transcribing it, so a moved or reworded sentence is a broken test and must be ` +
        `reported. Do not replace it with a hand-written list — the list is what goes stale.`,
    );
  }
  const nouns = sentence[1]
    .split(/,|\bor\b/)
    .map((part) => part.replace(/\b(a|an|any|about|either)\b/g, "").trim().toLowerCase())
    .filter((part) => part !== "");
  if (nouns.length === 0) {
    throw new Error(
      `the "What it still does not:" sentence parsed to no nouns: ` +
        `${JSON.stringify(sentence[1])}. An empty forbidden set makes every assertion below ` +
        `vacuously true.`,
    );
  }
  return nouns;
}

/**
 * Charged. The block's own sentence: "there is no audit action naming a blueprint *run*".
 * `runs` and `run_id` are the same word in a dotted or snake-cased action name, which is why
 * an action is split into segments and matched by stem rather than by substring — `rerun`
 * would over-match and `bundle.run` would not be caught by an equality check.
 */
const CHARGED = ["run"] as const;

/** Segments of an action name: `bundle.publish`, `api_key.revoke`, `bundle-run` all split. */
function segments(action: string): string[] {
  return action.toLowerCase().split(/[.\-_/:\s]+/).filter((s) => s !== "");
}

const setup = new RecordedSetup<Scratch>("The T240 vocabulary scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

describe("T240 D-240-03 — `AUDIT_ACTIONS` is a closed set worth quantifying over", () => {
  it("is a non-empty set of distinct strings", async () => {
    const actions = await boundAuditActions();

    expect(
      actions.length,
      `D-240-03: \`AUDIT_ACTIONS\` is empty. Every assertion in this file quantifies over it, ` +
        `so an empty set makes the product's absolute constraint vacuously satisfied — which ` +
        `is exactly the state the ruling replaced.`,
    ).toBeGreaterThan(0);

    const duplicates = actions.filter((a, i) => actions.indexOf(a) !== i);
    expect(
      [...new Set(duplicates)],
      `D-240-03: \`AUDIT_ACTIONS\` repeats ${[...new Set(duplicates)].join(", ")}. A union type ` +
        `collapses duplicates silently, so the set and the type would disagree about their ` +
        `own size with nothing to show for it.`,
    ).toEqual([]);
  });

  /**
   * **D-240-08's twelve, as an EQUALITY — so a member added on spec reds.**
   *
   * D-240-09 makes the set amendable by the orchestrator at a task's dispatch and by nobody
   * else, because "a member no caller exists for is a guard that cannot fail". An equality
   * is what turns that from a rule into something a run can enforce: a thirteenth member
   * added in the module reds here against the ruling that did not authorise it, and a
   * ratified member arrives without anyone editing this file.
   *
   * **The expected set is PARSED out of the ruling, not transcribed.** Transcribing it
   * would make this suite the second place the vocabulary lives, and a second spelling of
   * one quantity is exactly the shape D-230-10 forecloses one module over — the two would
   * then disagree silently, and this cell would be enforcing my copy rather than the ruling.
   *
   * Compared as SORTED SETS rather than in order: D-240-08 writes them grouped by subject
   * and the module writes them in the same grouping, but the order is not something either
   * document commits to, and a cell that reddened on a reordering would be asserting a
   * property nobody published.
   */
  it("is EXACTLY the twelve members D-240-08 ratified, no more and no fewer", async () => {
    const ratified = ratifiedActions();

    /* The derivation checked before it is used. Twelve is the count the ruling states in
       words — "Twelve members, derived from the published writers of the eight merged
       state-changing modules" — so a parse answering anything else has misread the grid,
       and the equality below would be enforcing my parse rather than the ruling. */
    expect(
      ratified.length,
      `D-240-08 says twelve members and the parse of its grid found ${ratified.length}: ` +
        `${ratified.join(", ")}. This is a broken test until the two agree.`,
    ).toBe(12);

    const actions = await boundAuditActions();
    expect(
      [...actions].sort(),
      `D-240-03/D-240-08: \`AUDIT_ACTIONS\` is not the ratified set.\n` +
        `  extra (in the module, NOT ratified):  ` +
        `${actions.filter((a) => !ratified.includes(a)).join(", ") || "(none)"}\n` +
        `  missing (ratified, not in module):    ` +
        `${ratified.filter((a) => !actions.includes(a)).join(", ") || "(none)"}\n` +
        `  D-240-09: the set is amended by the ORCHESTRATOR at a task's dispatch and never ` +
        `on spec, because a member no caller exists for is a guard that cannot fail.`,
    ).toEqual([...ratified].sort());
  });

  /**
   * The criterion, quantified over the live set.
   *
   * Matched by SEGMENT rather than by substring: `bundle.run` and `run_id` are hits,
   * `rerun-policy` is not, and neither is a legitimate action that happens to contain the
   * three letters. A substring scan would red a correct implementation and then be widened
   * until it stopped meaning anything.
   */
  it("names no blueprint run — the product promise, over whatever set landed", async () => {
    const nouns = forbiddenNouns();

    /* The derivation is checked before it is used: `run` must be one of the nouns the copy
       actually names. If the copy is reworded so that it is not, this suite is charging
       something the product no longer says. */
    expect(
      nouns,
      `the charged noun "run" is not among the ones parsed out of Aside.tsx (${nouns.join(", ")}), ` +
        `so this cell is enforcing a constraint the product copy no longer states.`,
    ).toContain("run");

    const actions = await boundAuditActions();
    const offending = actions.filter((action) =>
      segments(action).some((segment) => CHARGED.some((noun) => segment === noun || segment === `${noun}s`)),
    );

    expect(
      offending,
      `The absolute constraint: ${offending.join(", ")} names a blueprint run.\n` +
        `  components/bundle/Aside.tsx: "What the registry stores is this bundle and who owns ` +
        `it. What it still does not: a run, a key, or any telemetry about either."\n` +
        `  §T240: "there is no audit action naming a blueprint run, and download counts come ` +
        `from an explicit event at the serving edge (T150), never derived from request logs".\n` +
        `  This is a product promise and the copy is on the page today.`,
    ).toEqual([]);
  });

  /**
   * **Reported, not charged — and the label is the point.**
   *
   * The copy names three things and this file charges one. `key` and `telemetry` are parsed
   * out of the same sentence and printed rather than asserted, because charging `key` would
   * red a correct implementation: T230 ships API keys as a stored registry object with an
   * audit obligation of its own (`backend.md` §T230 AC7 — "AC7's audit is T240's
   * `writeAudit`, called with `actorKind: "operator"`"), so `apikey.revoke` is a legitimate
   * action name.
   *
   * A clause of my own query that would red the right answer gets LABELLED rather than
   * deleted. The orchestrator rules on whether the copy's "a key" means an API key or the
   * key used in a run; until then this cell records what the set contains so the ruling is
   * made against a measurement rather than against a guess.
   */
  it("records, without charging, any action touching the copy's other two nouns", async () => {
    const nouns = forbiddenNouns();
    const uncharged = nouns.filter((n) => !CHARGED.includes(n as (typeof CHARGED)[number]));
    const actions = await boundAuditActions();

    const touching = actions.filter((action) =>
      segments(action).some((segment) => uncharged.some((noun) => segment.includes(noun))),
    );
    console.log(
      `T240 vocabulary: AUDIT_ACTIONS = ${actions.join(", ")}\n` +
        `  copy's nouns: ${nouns.join(", ")}; charged: ${CHARGED.join(", ")}\n` +
        `  touching an UNCHARGED noun (reported for a ruling, not a defect): ` +
        `${touching.join(", ") || "(none)"}`,
    );

    expect(
      uncharged.length,
      `the copy parsed to ${nouns.length} nouns and this file charges ${CHARGED.length}; if ` +
        `the uncharged remainder is empty the sentence has changed and the split above needs ` +
        `revisiting rather than silently becoming a no-op.`,
    ).toBeGreaterThan(0);
  });

  /**
   * The set has to be LIVE, not merely declared.
   *
   * A published vocabulary with a member the writer cannot store is a set that lies: the type
   * admits it, a caller writes it, and the insert fails at runtime on a value the contract
   * says is legal. Every member is written and read back, so the set's own claim about itself
   * is measured rather than trusted.
   *
   * Asserted as the whole map at once rather than per action — one red naming every member
   * that did not survive, instead of N reds for one defect.
   */
  it("every published action actually round-trips into the column", async () => {
    const scratch = setup.require();
    const actions = await boundAuditActions();

    const write = await boundWriteAudit();
    for (const action of actions) {
      await write(scratch.client.db, {
        actorId: scratch.ownerId,
        actorKind: "owner",
        action,
        targetKind: "vocabulary",
        targetId: action,
        decision: "allowed",
      });
    }

    const stored = (await auditRows(scratch))
      .filter((r) => r.target_kind === "vocabulary")
      .map((r) => String(r.action))
      .sort();

    expect(
      stored,
      `D-240-03: the published set and what the column actually holds disagree.\n` +
        `  A member the writer cannot store is a set that lies: the union admits it, a caller ` +
        `passes it, and the insert fails at runtime on a value the contract calls legal.`,
    ).toEqual([...actions].sort());
  });
});
