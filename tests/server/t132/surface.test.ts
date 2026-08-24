/* ============================================================
   T132 — the amended surface exists

   Not an acceptance criterion of its own: the cells beside this
   file need these three names, and a red here says *which* name is
   missing instead of leaving the reader to infer it from forty
   failures that all say "undefined is not a function".

   ── this file is the one that passes with nothing built ──
   Every other cell in this suite opens a database. These do not,
   and that is labelled rather than left to be read as coverage:
   `publishes the barrel the task amends` passes today, against a
   tree where none of the three readers exists, because T080's
   barrel is merged. It says the barrel still loads and nothing
   more.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  PUBLISHED,
  READER_NAMES,
  READER_COUNT_AFTER,
  READERS_ADDED_AFTER,
  REGISTRY,
  T080_READER_COUNT,
  bind,
  loadRegistry,
} from "./contract";
import { READER_NAMES as T080_READER_NAMES } from "../t080/contract";
import { COUNT_KEYS } from "../t130/contract";

describe("T132 published signatures", () => {
  it("publishes the barrel the task amends", async () => {
    expect(typeof (await loadRegistry())).toBe("object");
  });

  for (const name of READER_NAMES) {
    it(`publishes \`${name}\` from ${REGISTRY}`, async () => {
      expect(typeof (await bind(name))).toBe("function");
    });
  }

  /**
   * D-132-03: "Reader count 13 -> 16; `PUBLISHED` gains three entries and `toBe(13)` becomes
   * `toBe(16)` in the same commit", which C-2 and D-260-14 both call the sanctioned path —
   * `PUBLISHED` is an equality over reader names, so adding a reader reds it BY DESIGN.
   *
   * Asserted from this side as well as from T080's own `surface.test.ts` for one reason: the
   * amendment is the implementer's, in T080's partition, and a suite that only checked its
   * own three names cannot tell "the three landed and the table was amended" from "the three
   * landed and the table was left at thirteen, so the AC6 sweep over there still runs over
   * the old set". The arithmetic is derived from D-132-03's own numbers rather than typed
   * twice: 13 + 3.
   */
  it("leaves T080's reader table naming all sixteen, plus the later ruled additions", () => {
    expect(
      T080_READER_NAMES.length,
      `D-132-03 moves the count 13 -> 16 in the same commit as the readers, and ` +
        `READERS_ADDED_AFTER names what later rulings added (D-260-31: usersOfMany). T080's ` +
        `table still names ${T080_READER_NAMES.length}: [${T080_READER_NAMES.join(", ")}]. ` +
        `\`privacy.test.ts\` iterates that table, so a table left short shrinks the merged ` +
        `AC6 sweep without failing anything over there.`,
    ).toBe(READER_COUNT_AFTER + READERS_ADDED_AFTER.length);
    expect(T080_READER_COUNT + READER_NAMES.length).toBe(READER_COUNT_AFTER);
    for (const name of READER_NAMES) expect(T080_READER_NAMES).toContain(name);
    for (const name of READERS_ADDED_AFTER) expect(T080_READER_NAMES).toContain(name);
  });

  /**
   * D-132-02 C-2: `COUNT_KEYS` "moves in the same commit as the key they pin, the sanctioned
   * path, exactly like T080's `PUBLISHED`". `counts.cards` is what this whole task was
   * created for (D-130-06), and the key set is where an added count becomes visible at all —
   * T050's AC2 precedent, quoted in T130's own contract: "the test that matters asserts the
   * key set of what a visitor receives rather than the value of one field".
   */
  it("adds `cards` to the profile record's count keys", () => {
    expect(
      [...COUNT_KEYS],
      `D-132-02 C-1 rules \`counts.cards\` in and C-2 grants T130's pin moving with it. ` +
        `Without the key in this set, \`asProfileRecord\` never checks the member and ` +
        `\`asWireProfileRecord\` cannot see it reach the wire.`,
    ).toContain("cards");
  });

  /**
   * The AC6 arithmetic, held as an identity rather than as two hand-maintained numbers.
   *
   * D-132-03: "the AC6 `CALLS` table stays at 13 and is the blind round's (C-8)". So the
   * sweep is split across two files by ruling, and the risk that creates is a SEVENTEENTH
   * reader arriving later with an AC6 cell in neither. This says: every published reader is
   * covered by exactly one of the two tables, and the thirteen T080 keeps are exactly the
   * ones this task did not add.
   *
   * **It is GREEN in the blind position and that is not coverage.** Today T080's table holds
   * thirteen and none of them is one of mine, so the partition trivially holds; after the
   * amendment it holds sixteen and the same identity holds again. What it reds on is the
   * amendment being done WRONG — two of three added, a name spelled differently in the two
   * tables, or a seventeenth reader arriving with no sweep at all. The cell above is the one
   * that reds on the amendment being ABSENT, and it is why this one is allowed to be quiet.
   */
  it("covers every published reader by exactly one AC6 table", () => {
    const mine = new Set<string>(READER_NAMES);
    /* The later additions are swept HERE too (their AC6 cells are in this suite's
       privacy.test.ts, per READERS_ADDED_AFTER's docblock), so they count as covered by this
       side of the partition, not T080's. */
    const later = new Set<string>(READERS_ADDED_AFTER);
    const theirs = T080_READER_NAMES.filter((name) => !mine.has(name) && !later.has(name));
    expect(
      theirs.length,
      `T080's \`privacy.test.ts\` sweeps the thirteen it was written for; this suite sweeps ` +
        `the three T132 adds plus READERS_ADDED_AFTER (D-260-31). If those sets do not ` +
        `partition the published readers, some reader has no AC6 cell anywhere and nothing ` +
        `fails to say so.`,
    ).toBe(T080_READER_COUNT);
    expect(theirs.length + mine.size + later.size).toBe(READER_COUNT_AFTER + READERS_ADDED_AFTER.length);
  });

  /**
   * A guard on THIS FILE, not on the module, and green with nothing built.
   *
   * The signature strings are quoted in failure messages throughout the suite, so a typo in
   * one of them silently degrades every red that cites it — the message would name a
   * signature the contract does not publish, and a reader would chase the wrong difference.
   */
  it("quotes each published signature by its own name", () => {
    for (const name of READER_NAMES) {
      expect(PUBLISHED[name], `PUBLISHED.${name}`).toContain(`${name}(db: Db, actor: Actor`);
    }
  });
});
