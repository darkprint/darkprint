/* ============================================================
   T190 — this suite's own instruments, falsified before they are
   trusted

   Every cell below is about THIS FILE'S NEIGHBOURS, not about
   `lib/server/notifications/**`. None of them binds the module, and
   all of them are green in the blind position. That is deliberate:
   an instrument that only starts being checked once the thing it
   measures exists has never been checked at all.

   ── why the digest oracle needs a second axis ──
   D-190-02(4) publishes `subject_digest` as
   `contentDigest(canonicalJson(subject))`. If this suite computed
   its expectation the same way, the module and the suite would call
   ONE implementation and agree with each other about whatever it
   did — an oracle written by the author of the assertions is a
   consistency check, never a second axis. So `PINNED_DIGESTS`
   carries digests produced OUTSIDE this repository entirely
   (`printf '%s' '<canonical>' | shasum -a 256`), and the first cell
   below is what stops `@/lib/core` drifting away from them quietly.

   ── why the recording fake needs one too ──
   AC5's whole claim is "delivered exactly once", and the fake is
   what counts deliveries. A fake that counted CALLS would score a
   throwing send as a delivery and make AC5 unfalsifiable while
   looking like coverage. The cells below drive the fake against
   both shapes and require it to tell them apart.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { canonicalJson, contentDigest } from "@/lib/core";
import {
  DEFAULT_PREFERENCES_PIN,
  EVENT_KINDS,
  MESSAGE_FORMS,
  NON_OWNERS,
  PINNED_DIGESTS,
  PREFERENCE_KEYS,
  PUBLISHED_NAMES,
  ROUTE_NAMES,
  deliveredCountFor,
  recordingDelivery,
  subjectDigest,
} from "./contract";

describe("T190 instruments: the digest oracle agrees with an authority outside this repository", () => {
  it.each(PINNED_DIGESTS)(
    "canonicalises to $canonical and digests to the shasum-computed literal",
    ({ canonical, digest, subject }) => {
      expect(
        canonicalJson(subject),
        `\`canonicalJson\` no longer produces the bytes this suite's pinned digest was ` +
          `computed over. The literal was produced by \`printf '%s' '${canonical}' | ` +
          `shasum -a 256\`, an instrument outside this repository, which is the only reason ` +
          `the AC5 digest cells are a measurement rather than the module agreeing with itself.`,
      ).toBe(canonical);

      expect(
        contentDigest(canonicalJson(subject)),
        `\`contentDigest(canonicalJson(...))\` disagrees with the externally computed digest ` +
          `for ${canonical}. Either \`@/lib/core\` changed, or the literal in \`contract.ts\` ` +
          `is wrong — and until that is settled every T190 cell asserting a \`subject_digest\` ` +
          `is measuring an unknown.`,
      ).toBe(digest);
    },
  );

  /**
   * The property AC5's second cell actually rests on, stated on its own.
   *
   * Two spellings of one subject must collide. If they did not, the "two spellings yield one
   * row" cell would be green against an implementation that stored two rows, because the two
   * digests would differ and the unique key would never fire.
   */
  it("two key orders of one subject produce ONE digest", () => {
    const a = { slug: "t190-up", fork: "b1" };
    const b = { fork: "b1", slug: "t190-up" };
    expect(
      subjectDigest(a),
      "`{fork, upstream}` and `{upstream, fork}` digest differently, so D-190-02(4)'s " +
        "canonicalisation is not happening and AC5's two-spellings cell would pass against an " +
        "implementation that stored both.",
    ).toBe(subjectDigest(b));
  });

  /** A near-miss: one character of one value, and the digest must move. */
  it("a subject differing by one character digests differently", () => {
    expect(
      subjectDigest({ slug: "t190-up", fork: "b1" }),
      "Two DIFFERENT subjects digest the same, so the unique key would collapse unrelated " +
        "events into one row and every `exactly one` cell in this suite would be vacuous.",
    ).not.toBe(subjectDigest({ slug: "t190-up", fork: "b2" }));
  });
});

describe("T190 instruments: the recording fake counts resolutions, not calls", () => {
  it("a send that RESOLVES is a delivery", async () => {
    const recorder = recordingDelivery();
    const message = {
      kind: "fork",
      accountId: "a",
      subject: { slug: "t190-up", fork: "b1" },
      unsubscribeToken: "t",
    };
    await recorder.delivery.send(message);

    expect(recorder.attempts).toHaveLength(1);
    expect(recorder.delivered).toHaveLength(1);
    expect(recorder.failed).toHaveLength(0);
    expect(deliveredCountFor(recorder, "fork", { fork: "b1", slug: "t190-up" })).toBe(1);
  });

  /**
   * The discriminating case. A fake that counted calls would answer 1 here, and every AC5 cell
   * would then report a delivery for a send that threw — which is precisely the double-delivery
   * the criterion exists to catch, scored as a success.
   */
  it("a send that THROWS is an attempt and is NOT a delivery", async () => {
    const recorder = recordingDelivery((n) => n === 1);
    const message = {
      kind: "fork",
      accountId: "a",
      subject: { slug: "t190-up", fork: "b1" },
      unsubscribeToken: "t",
    };
    await expect(recorder.delivery.send(message)).rejects.toThrow(/refusing send #1 on purpose/u);

    expect(recorder.attempts, "the attempt was not recorded").toHaveLength(1);
    expect(
      recorder.delivered,
      "a send that threw was counted as a delivery, which makes AC5 unfalsifiable: the " +
        "criterion is `retries without delivering twice`, and an attempt that failed did not " +
        "deliver.",
    ).toHaveLength(0);
    expect(recorder.failed).toHaveLength(1);
    expect(deliveredCountFor(recorder, "fork", { slug: "t190-up", fork: "b1" })).toBe(0);
  });

  it("`failOn` selects by one-based call index, so `n === 2` is the second send", async () => {
    const recorder = recordingDelivery((n) => n === 2);
    const send = (id: string) =>
      recorder.delivery.send({
        kind: "fork",
        accountId: "a",
        subject: { slug: "t190-up", fork: id },
        unsubscribeToken: "t",
      });

    await send("f1");
    await expect(send("f2")).rejects.toThrow();
    await send("f3");

    expect(recorder.attempts.map((m) => m.subject.fork)).toEqual(["f1", "f2", "f3"]);
    expect(
      recorder.delivered.map((m) => m.subject.fork),
      "`failOn` did not fail on the SECOND send, so D-190-02's `fails on row 2 of 3` fixture " +
        "would be driving a different case than the ruling names.",
    ).toEqual(["f1", "f3"]);
  });

  /** `deliveredCountFor` matches by digest, so it cannot be fooled by a re-spelled subject. */
  it("counts a re-spelled subject as the same delivery", async () => {
    const recorder = recordingDelivery();
    await recorder.delivery.send({
      kind: "fork",
      accountId: "a",
      subject: { fork: "b1", slug: "t190-up" },
      unsubscribeToken: "t",
    });
    expect(deliveredCountFor(recorder, "fork", { slug: "t190-up", fork: "b1" })).toBe(1);
    expect(
      deliveredCountFor(recorder, "repin", { slug: "t190-up", fork: "b1" }),
      "the kind is not being compared, so a delivery of the wrong kind would count.",
    ).toBe(0);
  });
});

describe("T190 instruments: the pins agree with the block they were copied from", () => {
  /**
   * `EventKind` and `Preferences` are the same four ids, and the fixture that specifies them
   * (`lib/data/account.ts:92-117`) keys the preferences by the event ids. A suite whose two
   * lists drifted apart would assert about two different sets and never notice.
   */
  it("the four event kinds and the four preference keys are the same set, in the same order", () => {
    expect([...PREFERENCE_KEYS]).toEqual([...EVENT_KINDS]);
  });

  it("DEFAULT_PREFERENCES_PIN has exactly the four keys and nothing else", () => {
    expect(Object.keys(DEFAULT_PREFERENCES_PIN).sort()).toEqual([...PREFERENCE_KEYS].sort());
  });

  /**
   * The pin is not all-true and not all-false.
   *
   * AC4's cells compare a filled read against this constant. If the constant were uniform, a
   * module that ignored the fixture and returned a single repeated boolean would satisfy every
   * one of them, and the criterion `the weekly digest is off for a new account` would be
   * carried entirely by an assertion that could not fail.
   */
  it("the pin is MIXED, so an all-true or all-false implementation cannot satisfy it", () => {
    const values = Object.values(DEFAULT_PREFERENCES_PIN);
    expect(values).toContain(true);
    expect(values).toContain(false);
    expect(DEFAULT_PREFERENCES_PIN.digest).toBe(false);
  });
});

describe("T190 instruments: every `it.each` domain is non-empty", () => {
  /**
   * The failure this closes is silent, and it is the one an all-green run cannot show you.
   *
   * Most of this suite's cells are generated: `it.each(NON_OWNERS)`, `it.each(EVENT_KINDS)`,
   * `it.each(PUBLISHED_NAMES)`, `it.each(PINNED_DIGESTS)`. A list that an edit empties does not
   * red — it produces NO CELLS AT ALL, and the run reports every remaining test passing over a
   * suite that is measuring a fraction of what its file names claim. Fourteen refusal cells and
   * seven published-name cells can leave without moving the failed column by one.
   *
   * That has happened in this repository: a derivation that found nothing made every cell built
   * from it vacuously green, which is why `tests/support/db.ts` and T150's `allTables()` both
   * FAIL CLOSED on an empty domain. Same move, stated as counts so a red says which list went
   * and what it should hold.
   *
   * The counts are LITERALS rather than `.length > 0`. A greater-than-zero check survives a
   * list that lost six of its seven members, and losing six of seven is the realistic edit —
   * a whole list going missing is loud, a member quietly dropped is not.
   */
  it.each([
    { name: "PINNED_DIGESTS", got: PINNED_DIGESTS.length, want: 4, why: "the four ruled subject shapes (D-190-07)" },
    { name: "EVENT_KINDS", got: EVENT_KINDS.length, want: 4, why: "`type EventKind` has four members" },
    { name: "PREFERENCE_KEYS", got: PREFERENCE_KEYS.length, want: 4, why: "`interface Preferences` has four booleans" },
    { name: "PUBLISHED_NAMES", got: PUBLISHED_NAMES.length, want: 7, why: "the Published signatures block plus D-190-02..05's additions" },
    { name: "NON_OWNERS", got: NON_OWNERS.length, want: 7, why: "T060's non-owner shapes, including the two that INHERIT authority" },
    { name: "ROUTE_NAMES", got: ROUTE_NAMES.length, want: 3, why: "D-190-05 publishes three routes" },
    { name: "ADMISSIBLE_MESSAGES", got: Object.keys(MESSAGE_FORMS).length, want: 3, why: "D-190-05 made the whole set three forms" },
  ])("$name holds $want entries", ({ name, got, want, why }) => {
    expect(
      got,
      `\`${name}\` holds ${got} entries and should hold ${want} — ${why}.\n` +
        `  This list drives \`it.each\` cells elsewhere in the suite. A shortened list does ` +
        `not RED: it produces fewer cells, and the run then reports every remaining test ` +
        `passing over a suite measuring less than its file names claim. Nothing else in this ` +
        `suite can see that happen.`,
    ).toBe(want);
  });

  /** And the non-owner list really does carry the two shapes only `can`-delegation refuses. */
  it("NON_OWNERS keeps both prototype-inheriting shapes", () => {
    const inheriting = NON_OWNERS.filter((n) => n.label.includes("INHERIT"));
    expect(
      inheriting.map((n) => n.label),
      "the two `Object.create(...)` actors are gone from NON_OWNERS. They are the ONLY members " +
        "that separate a module delegating to T060's `can` from one re-implementing ownership " +
        "as `actor.accountId === accountId` — every other shape in the list is refused by both.",
    ).toHaveLength(2);
  });
});
