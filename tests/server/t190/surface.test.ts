/* ============================================================
   T190 — the published surface exists and is the right kind of
   thing

   ── why there is a SOURCE cell beside the binding cells ──
   A type-level instrument cannot observe its own blindness. Types
   erase, so a cell made of type assertions is GREEN against a
   module that does not exist; and an unresolved import types
   everything it names as `any`, which makes every pin under it
   vacuous without a single red. Worse, `EventKind` is a type and
   nothing runtime publishes its four members, so there is no value
   to inspect at all.

   D-190-05 ratifies the answer: a cell may read
   `lib/server/notifications/index.ts` through `node:fs` at run
   time, and its author never opens it. That is the ONLY thing that
   separates *this member is absent* from *an assertion failed*.

   The source cell claims exactly what a text search can claim and
   says so at its own message. It is not a semantic check and does
   not pretend to be one; it closes the failure where a name never
   arrives at all.

   ── the behavioural cells are where `Preferences` is really
   pinned ──
   `getPreferences` answering an object with exactly the four keys
   and four booleans is a claim about the shape that survives type
   erasure, and it is asserted in `preferences.test.ts` against a
   real database rather than here.

   ── every cell binds the module LAST ──
   `bind` and `bindValue` are the last statement before the
   assertion, never the first. An early red masks every premise
   below it while being correct about its own subject.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  BARREL_FILE,
  EXACT_ARITY,
  MIN_ARITY,
  NOTIFICATIONS,
  PUBLISHED,
  PUBLISHED_FUNCTIONS,
  PUBLISHED_NAMES,
  barrelSource,
  bind,
  bindValue,
  describe_,
  loadNotifications,
} from "./contract";

describe("T190 surface: the Published signatures block's names are exported", () => {
  it.each(PUBLISHED_NAMES)("`%s` is exported from the barrel", async (name) => {
    /* Premises first, module last. */
    const clause = PUBLISHED[name];
    expect(clause, "the pin table lost this name's clause").toBeTruthy();

    const value = await bindValue(name);
    expect(
      value,
      `${NOTIFICATIONS} exports \`${name}\` as undefined.\n  the contract publishes: ${clause}`,
    ).toBeDefined();
  });

  it.each(PUBLISHED_FUNCTIONS)("`%s` is a function of at least its declared arity", async (name) => {
    const wanted = MIN_ARITY[name];
    expect(wanted, `MIN_ARITY has no entry for \`${name}\``).toBeGreaterThan(0);

    const fn = await bind(name);
    expect(
      fn.length,
      `${NOTIFICATIONS} exports \`${name}\` with arity ${fn.length}; the block publishes ` +
        `${wanted} parameter(s) before the first default: ${PUBLISHED[name]}\n` +
        `  This is a LOWER bound on purpose. \`Function.length\` stops at the first parameter ` +
        `carrying a default, and an optional \`?\` erases at runtime, so a shorter answer means ` +
        `a parameter the block publishes as required is missing or defaulted.`,
    ).toBeGreaterThanOrEqual(wanted);
  });

  /**
   * Where a ruling spells the last parameter, the arity is an EQUALITY.
   *
   * `>=` admits both spellings of an optional trailing parameter and so enforces neither:
   * `d = undefined` answers 3 and a bare `d?` answers 4, and both clear a `>= 3` bound. The
   * equality admits only the ruled one.
   *
   * That distinction is here because I got it backwards once — I recorded `?` as answering 3
   * and reported that the spelling could not be checked without a new instrument. It can, with
   * this one, by asserting the number instead of a floor.
   */
  it.each(Object.keys(EXACT_ARITY))("`%s` has EXACTLY its ruled arity", async (name) => {
    const wanted = EXACT_ARITY[name]!;
    const fn = await bind(name as never);
    expect(
      fn.length,
      `\`${name}\` answers Function.length ${fn.length}; the ruled signature gives ${wanted}.\n` +
        `  ${fn.length === wanted + 1 ? "That is the arity of the OPTIONAL spelling: a bare `?` erases to a plain parameter with no default emitted. The ruling spells this parameter `= undefined` (\"the arity spelling, per T250's rule\") precisely so the published arity stays readable." : "The published block spells this parameter list exactly."}\n` +
        `  Asserted as an equality and not a bound: \`>= ${wanted}\` admits both spellings and ` +
        `so enforces neither.`,
    ).toBe(wanted);
  });

  /**
   * `DEFAULT_PREFERENCES` is the one published member that is a VALUE.
   *
   * Its contents are asserted in `preferences.test.ts` against the fixture that specifies them;
   * here the claim is only that it is a plain object and not a function, a getter answering a
   * fresh object each call, or a promise.
   */
  it("`DEFAULT_PREFERENCES` is a plain object, not a function or a promise", async () => {
    const value = await bindValue("DEFAULT_PREFERENCES");
    expect(
      typeof value === "object" && value !== null && !(value instanceof Promise),
      `${NOTIFICATIONS} exports \`DEFAULT_PREFERENCES\` as ${describe_(value)}; the block ` +
        `publishes it as \`DEFAULT_PREFERENCES: Preferences\`.`,
    ).toBe(true);
  });
});

describe("T190 surface: the barrel file names what the block publishes", () => {
  /**
   * The one cell that can tell *the module is not there* from *an assertion failed*.
   *
   * Deliberately a TEXT search, and its message says so: it closes the failure where a name
   * never arrives, and claims nothing about what the name means.
   */
  it("the barrel exists on disk", () => {
    const source = barrelSource();
    expect(
      source,
      `\`${BARREL_FILE}\` does not exist.\n` +
        `  backend.md §T190 owns \`lib/server/notifications/**\` and names the barrel ` +
        `\`${NOTIFICATIONS}\`.\n` +
        `  This is the blind position: the implementation half has not landed. Every other ` +
        `cell in this suite reds for the same reason, and none of them can distinguish it ` +
        `from a real defect without this cell.`,
    ).toBeDefined();
  });

  it.each(PUBLISHED_NAMES)("the barrel's source mentions `%s`", (name) => {
    const source = barrelSource();
    expect(source, `the barrel does not exist; see the cell above`).toBeDefined();
    expect(
      (source ?? "").includes(name),
      `\`lib/server/notifications/index.ts\` does not contain the string \`${name}\`.\n` +
        `  the contract publishes: ${PUBLISHED[name]}\n` +
        `  This is a text search over the barrel and claims only that: a name present here ` +
        `with the wrong meaning still satisfies it. It exists because a type-level pin is ` +
        `silently vacuous against an absent module, and this is what separates the two.`,
    ).toBe(true);
  });

  /**
   * The two types the block publishes beside the verbs.
   *
   * They erase at build, so there is no runtime value to bind and no other way to notice
   * their absence — a caller building an `enqueue` event needs somewhere to get `EventKind`,
   * and a restated copy at the call site is exactly the drift this repository charges.
   */
  it.each(["EventKind", "Preferences", "NotificationDelivery"])(
    "the barrel's source names the published type `%s`",
    (name) => {
      const source = barrelSource();
      expect(source, "the barrel does not exist; see the cell above").toBeDefined();
      expect(
        (source ?? "").includes(name),
        `\`lib/server/notifications/index.ts\` does not contain \`${name}\`.\n` +
          `  §T190's block publishes \`type EventKind\`, \`interface Preferences\` and ` +
          `(D-190-03) \`interface NotificationDelivery\`. These are TYPES: they erase at ` +
          `build, so this text cell is the only instrument that can see one go missing.`,
      ).toBe(true);
    },
  );
});

describe("T190 surface: D-190-05's hygiene expectation for this barrel", () => {
  /**
   * D-190-05 names the two classes this task publishes and derives `error-hygiene` 50 -> 52
   * at the merge. `tests/error-hygiene.test.ts` builds its domain by construction over every
   * `lib/server/<module>/index.ts`, counting `(barrel, export)` pairs — so what this barrel
   * exports moves that equality, and these two cells are where the intent is written down on
   * this side rather than discovered when the number disagrees.
   */
  it.each(["NotificationStoreError", "UnsubscribeInvalidError"])(
    "the barrel publishes `%s`",
    async (name) => {
      const source = barrelSource();
      expect(source, "the barrel does not exist; see the surface cell above").toBeDefined();

      const mod = await loadNotifications();
      expect(
        mod[name],
        `${NOTIFICATIONS} exports no \`${name}\`.\n` +
          `  D-190-05: "Hygiene expectation from both halves — NotificationStoreError + ` +
          `UnsubscribeInvalidError, 50 -> 52 derived at merge."\n` +
          `  found: ${Object.keys(mod).sort().join(", ") || "(nothing)"}\n` +
          `  A caller that cannot name the class cannot branch on it, which is the reason ` +
          `T110 gives for publishing its own two.`,
      ).toBeDefined();
    },
  );

  /**
   * The negative half, and it is the one that actually moves the equality.
   *
   * `NotAccountOwnerError` is T050's and is CONSUMED here (D-190-05 puts two of the three
   * admissible messages in its form). Re-exporting it from this barrel would publish a class
   * this module did not author and would take the hygiene count to 53 against a ruling that
   * says 52 — a number nobody could then explain from the rulings alone.
   */
  it("the barrel does NOT re-export `NotAccountOwnerError`", async () => {
    const source = barrelSource();
    expect(source, "the barrel does not exist; see the surface cell above").toBeDefined();

    const mod = await loadNotifications();
    expect(
      mod.NotAccountOwnerError,
      `${NOTIFICATIONS} re-exports \`NotAccountOwnerError\`.\n` +
        `  D-190-05: "no re-export of NotAccountOwnerError from this barrel (the walk counts ` +
        `(barrel, export) pairs)". It is T050's class, consumed here and not authored here; ` +
        `re-publishing it would take \`error-hygiene\`'s equality past the 52 the ruling ` +
        `derives.`,
    ).toBeUndefined();
  });
});
