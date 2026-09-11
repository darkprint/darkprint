/* ============================================================
   T190 AC4, and the two preference verbs

   ── AC4 is a fact about a DEFAULT, so a single-sided cell is
   vacuous ──
   The column is `jsonb NOT NULL DEFAULT '{}'`, and `getPreferences`
   fills the missing keys from `DEFAULT_PREFERENCES`. A cell that
   only ever asks a new account whether `digest` is `false` cannot
   tell a module that CONSULTS the column from one that returns a
   frozen constant and never reads it at all — both answer `false`,
   and the second is wrong about every other account in the
   database.

   So every default below is driven from BOTH sides: `{}` must read
   as the constant's value, and a column that EXPLICITLY DISAGREES
   with the constant must read as the column. The second half is
   what proves the fill is a fill.

   ── and the constant has a second axis ──
   `DEFAULT_PREFERENCES` is the module's. The suite's own literal
   was written from the product's settings page rather than copied
   from the module, so the two agreeing is a measurement and not a
   tautology.

   ── the refusals ──
   D-190-05 published a THIRD admissible form. `getPreferences`
   refuses a non-owner rather than answering it the defaults, so
   both verbs are driven against every non-owner shape T060 rules
   on — including the two that INHERIT authority, which are the
   only shapes that separate a module delegating to `can` from one
   re-implementing ownership as an equality on ids.

   ── every cell binds the module LAST ──
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES_PIN,
  MESSAGE_FORMS,
  NON_OWNERS,
  PREFERENCE_KEYS,
  type PreferencesShape,
  type Scratch,
  absentUuid,
  bind,
  bindValue,
  deferred,
  describe_,
  dropScratchDatabases,
  mark,
  operatorActor,
  plantAccount,
  preferencesColumn,
  rejection,
  renderingsOf,
  scratchDatabase,
} from "./contract";

const setup = deferred<Scratch>(() => scratchDatabase("prefs"));

afterAll(async () => {
  await dropScratchDatabases();
});

/** Every published preference key, as a boolean, and nothing else. */
function assertPreferencesShape(value: unknown, where: string): PreferencesShape {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} answered ${describe_(value)}; the block publishes \`Preferences\`.`);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const wanted = [...PREFERENCE_KEYS].sort();
  if (keys.join(",") !== wanted.join(",")) {
    throw new Error(
      `${where} answered keys [${keys.join(", ")}]; \`interface Preferences { repin: boolean; ` +
        `fork: boolean; deprecation: boolean; digest: boolean }\` has exactly [${wanted.join(", ")}].\n` +
        `  A missing key is AC4's own hazard — "a missing key must not read as \`true\` ` +
        `anywhere" — and an extra one is a shape the column may then accumulate.`,
    );
  }
  const notBoolean = Object.entries(record).filter(([, v]) => typeof v !== "boolean");
  if (notBoolean.length > 0) {
    throw new Error(
      `${where} answered non-boolean member(s): ` +
        `${notBoolean.map(([k, v]) => `${k}=${describe_(v)}`).join(", ")}. ` +
        `\`Preferences\` is four booleans.`,
    );
  }
  return record as unknown as PreferencesShape;
}

describe("T190 AC4: the defaults are the published ones, and the fill reads the column", () => {
  /** The only cell here that touches no database: the module's constant against the suite's literal. */
  it("`DEFAULT_PREFERENCES` is the four published defaults", async () => {
    const published = await bindValue("DEFAULT_PREFERENCES");
    expect(
      published,
      `\`DEFAULT_PREFERENCES\` disagrees with the published defaults. The module publishes ` +
        `${JSON.stringify(published)}.`,
    ).toEqual(DEFAULT_PREFERENCES_PIN);
  });

  it("a brand-new account, whose column is `{}`, reads every default", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("ac4-new").toLowerCase(), {});

    /* The premise: the column really is `{}`, not four booleans some other writer filled in. */
    expect(
      await preferencesColumn(scratch, account.accountId),
      "the fixture did not leave `notification_preferences` empty, so this cell is not about " +
        "a default at all.",
    ).toEqual({});

    const getPreferences = await bind("getPreferences");
    const answered = assertPreferencesShape(
      await getPreferences(scratch.db, account.actor, account.accountId),
      "getPreferences on an account whose column is `{}`",
    );

    expect(
      answered,
      `AC4: an account whose \`notification_preferences\` is \`{}\` did not read as the ` +
        `published defaults.\n` +
        `  expected ${JSON.stringify(DEFAULT_PREFERENCES_PIN)} — the fixture's own four.\n` +
        `  §T190: "a missing key must not read as \`true\` anywhere".`,
    ).toEqual(DEFAULT_PREFERENCES_PIN);

    expect(
      answered.digest,
      "AC4 in its own words: the weekly digest is off for a new account.",
    ).toBe(false);
  });

  /**
   * The half that makes the cell above a measurement.
   *
   * Each key is planted with the OPPOSITE of its default, alone, so a module that answers a
   * frozen constant reds on exactly one key and a module that reads the column passes. Driving
   * one key at a time rather than all four also means the red names which key was ignored.
   */
  it.each(PREFERENCE_KEYS)(
    "a column that explicitly DISAGREES about `%s` reads as the column, not as the constant",
    async (key) => {
      const scratch = await setup.require();
      const contrary = !DEFAULT_PREFERENCES_PIN[key];
      const account = await plantAccount(scratch, mark(`ac4-${key}`).toLowerCase(), {
        [key]: contrary,
      });

      expect(
        (await preferencesColumn(scratch, account.accountId))?.[key],
        "the fixture did not persist the contrary value, so this cell would be comparing the " +
          "constant against itself.",
      ).toBe(contrary);

      const getPreferences = await bind("getPreferences");
      const answered = assertPreferencesShape(
        await getPreferences(scratch.db, account.actor, account.accountId),
        `getPreferences with \`${key}\` explicitly ${String(contrary)}`,
      );

      expect(
        answered[key],
        `AC4: \`${key}\` is stored as ${String(contrary)} and \`getPreferences\` answered ` +
          `${String(answered[key])}, which is \`DEFAULT_PREFERENCES.${key}\`.\n` +
          `  The stored value DISAGREES with the default on purpose: that is the only shape ` +
          `that separates a module filling the gaps in a column it read from one returning a ` +
          `constant it never read. A cell asserting an explicit value that already equals the ` +
          `default is vacuous.`,
      ).toBe(contrary);

      /* And the other three still fill from the constant — the fill did not become a replace. */
      for (const other of PREFERENCE_KEYS) {
        if (other === key) continue;
        expect(
          answered[other],
          `\`${other}\` is absent from the column and did not fill from ` +
            `\`DEFAULT_PREFERENCES\`; one stored key turned the fill off for the rest.`,
        ).toBe(DEFAULT_PREFERENCES_PIN[other]);
      }
    },
  );
});

describe("T190: setPreferences writes, answers the whole record, and persists only the four", () => {
  it.each(PREFERENCE_KEYS)("patching `%s` alone moves it and leaves the rest", async (key) => {
    const scratch = await setup.require();
    const contrary = !DEFAULT_PREFERENCES_PIN[key];
    const account = await plantAccount(scratch, mark(`set-${key}`).toLowerCase(), {});

    const setPreferences = await bind("setPreferences");
    const returned = assertPreferencesShape(
      await setPreferences(scratch.db, account.actor, account.accountId, { [key]: contrary }),
      `setPreferences({ ${key}: ${String(contrary)} })`,
    );

    expect(
      returned[key],
      `setPreferences answered \`${key}\` = ${String(returned[key])} for a patch that set it ` +
        `to ${String(contrary)}.`,
    ).toBe(contrary);
    for (const other of PREFERENCE_KEYS) {
      if (other === key) continue;
      expect(
        returned[other],
        `patching \`${key}\` moved \`${other}\`. The block publishes the parameter as ` +
          `\`Partial<Preferences>\`: an absent key is not a request to change it.`,
      ).toBe(DEFAULT_PREFERENCES_PIN[other]);
    }

    /* Read back through the OTHER verb, so the round trip crosses the storage rather than
       being answered out of whatever `setPreferences` was holding. */
    const getPreferences = await bind("getPreferences");
    const read = assertPreferencesShape(
      await getPreferences(scratch.db, account.actor, account.accountId),
      "getPreferences after setPreferences",
    );
    expect(
      read,
      `the value \`setPreferences\` answered did not survive a read through ` +
        `\`getPreferences\`, so it was never stored.`,
    ).toEqual(returned);
  });

  /**
   * D-190-05: `setPreferences({})` is a no-op returning the current four.
   *
   * Driven against an account whose stored state is NOT the defaults, so a module that
   * answered the constant for an empty patch would red here and would be invisible against a
   * fresh account.
   */
  it("an empty patch is a no-op and answers the CURRENT four, not the defaults", async () => {
    const scratch = await setup.require();
    const stored = { repin: false, digest: true };
    const account = await plantAccount(scratch, mark("set-empty").toLowerCase(), stored);
    const expected: PreferencesShape = { ...DEFAULT_PREFERENCES_PIN, ...stored };

    const setPreferences = await bind("setPreferences");
    const returned = assertPreferencesShape(
      await setPreferences(scratch.db, account.actor, account.accountId, {}),
      "setPreferences({})",
    );

    expect(
      returned,
      `D-190-05: "setPreferences({}) is a no-op returning the current four". The account's ` +
        `stored state is ${JSON.stringify(stored)}, which disagrees with the defaults on two ` +
        `keys, so answering the defaults here is distinguishable from answering the current ` +
        `record — and only the second is the ruling.`,
    ).toEqual(expected);

    expect(
      await preferencesColumn(scratch, account.accountId),
      "an empty patch rewrote the column. A no-op writes nothing.",
    ).toEqual(stored);
  });

  /**
   * D-190-05: unknown keys are IGNORED and NEVER PERSISTED — "the writer writes only the four
   * known keys, so the column cannot accumulate foreign keys, and a cell may read the column
   * directly to prove it".
   *
   * The foreign key carries a planted token, so a red cannot be explained by anything else in
   * the database having put that string there.
   */
  it("an unknown key is ignored and never reaches the column", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("set-foreign").toLowerCase(), {});
    const foreign = "inbox";
    const patch = { digest: true, [foreign]: true } as Record<string, boolean>;

    const setPreferences = await bind("setPreferences");
    const returned = assertPreferencesShape(
      await setPreferences(scratch.db, account.actor, account.accountId, patch),
      `setPreferences({ digest: true, ${foreign}: true })`,
    );

    expect(returned.digest, "the known half of the patch was dropped along with the unknown half").toBe(
      true,
    );

    const column = (await preferencesColumn(scratch, account.accountId)) ?? {};
    expect(
      Object.keys(column).sort().filter((k) => !(PREFERENCE_KEYS as readonly string[]).includes(k)),
      `\`notification_preferences\` accumulated key(s) outside the published four: ` +
        `${JSON.stringify(column)}.\n` +
        `  D-190-05: unknown keys are ignored and NEVER PERSISTED — the writer writes only the ` +
        `four known keys. A column that accumulates foreign keys is a shape this task owns and ` +
        `did not publish.`,
    ).toEqual([]);
  });
});

describe("T190: both preference verbs refuse a non-owner with the published sentence", () => {
  it.each(NON_OWNERS)("getPreferences refuses $label", async (nonOwner) => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("get-deny").toLowerCase(), { digest: true });

    const getPreferences = await bind("getPreferences");
    const err = await rejection(
      () => getPreferences(scratch.db, nonOwner.actor(account.accountId), account.accountId),
      `getPreferences for ${nonOwner.label}`,
    );

    expect(
      renderingsOf(err).message,
      `${nonOwner.because}\n` +
        `  D-190-05 publishes exactly this sentence for \`getPreferences\`, and the section's ` +
        `"whole set" clause now covers three forms.\n` +
        `  A module answering this caller the DEFAULTS instead of refusing would also hide the ` +
        `stored \`digest: true\` this account carries, which is why the fixture stores one.`,
    ).toBe(MESSAGE_FORMS.getPreferences);
  });

  it.each(NON_OWNERS)("setPreferences refuses $label", async (nonOwner) => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("set-deny").toLowerCase(), {});

    const setPreferences = await bind("setPreferences");
    const err = await rejection(
      () =>
        setPreferences(scratch.db, nonOwner.actor(account.accountId), account.accountId, {
          digest: true,
        }),
      `setPreferences for ${nonOwner.label}`,
    );

    expect(renderingsOf(err).message, nonOwner.because).toBe(MESSAGE_FORMS.setPreferences);

    /* Assert what the writer LEFT BEHIND, not only that it threw. A module that writes the row
       and then refuses satisfies every `rejects.toThrow()` a reviewer would write. */
    expect(
      await preferencesColumn(scratch, account.accountId),
      `${nonOwner.label} was refused AND the write landed. The refusal has to happen before ` +
        `the write, not beside it.`,
    ).toEqual({});
  });
});

describe("T190: an operator passes both preference verbs (D-190-05)", () => {
  /**
   * T060 grants it: `can(operator, "read"|"write", { kind: "account", accountId })` is true,
   * because `isOperatorGrant` sits inside the account case. D-190-05 settles the reading the
   * refusal wording invites — "the sentences' `owner` wording is the common case, not policy".
   *
   * This is the cell that would have been written backwards without the ruling, and exactly
   * one of the two spellings reds a correct implementation.
   */
  it("an operator reads another account's preferences", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("op-get").toLowerCase(), { digest: true });
    const operator = await plantAccount(scratch, mark("op-a").toLowerCase(), {});

    const getPreferences = await bind("getPreferences");
    const answered = assertPreferencesShape(
      await getPreferences(scratch.db, operatorActor(operator.accountId), account.accountId),
      "getPreferences as an operator",
    );

    expect(
      answered.digest,
      `D-190-05: an operator passes all three preference verbs, and T060's \`can\` grants it ` +
        `on \`{ kind: "account" }\`. A module re-implementing ownership as ` +
        `\`actor.accountId === accountId\` refuses here.`,
    ).toBe(true);
  });

  it("an operator writes another account's preferences", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("op-set").toLowerCase(), {});
    const operator = await plantAccount(scratch, mark("op-b").toLowerCase(), {});

    const setPreferences = await bind("setPreferences");
    const returned = assertPreferencesShape(
      await setPreferences(scratch.db, operatorActor(operator.accountId), account.accountId, {
        fork: false,
      }),
      "setPreferences as an operator",
    );

    expect(returned.fork, "D-190-05: an operator passes all three preference verbs.").toBe(false);
    expect(
      (await preferencesColumn(scratch, account.accountId))?.fork,
      "the operator's write was answered but not stored.",
    ).toBe(false);
  });
});

describe("T190 AC4: a stored non-boolean is not a preference this module wrote", () => {
  /**
   * MY HALF'S GAP, found by my own sweep and closed here.
   *
   * Mutation M13 replaced `fillPreferences`'s `typeof value === "boolean" ? value : DEFAULT`
   * with a coercion, and it redded exactly ONE cell in the whole merged suite — the
   * implementer's, not one of mine. A scoped zero is a claim about its scope: the suite caught
   * it, my half did not, and I had pre-registered a zero here without registering that the
   * zero would be MINE.
   *
   * What it costs is AC4's own clause one step down. The column is `jsonb` and nothing stops a
   * hand-edited row, a migration, or a future writer from leaving a string in it. `"false"` is
   * TRUTHY, so a coercing implementation reads a stored `"false"` as `digest: true` — the
   * account is subscribed to the one thing AC4 says is off by default, and every cell that sets
   * a real boolean stays green.
   *
   * `"false"` specifically, and not `"true"` or `1`: it is the value whose coerced reading is
   * the OPPOSITE of its plain meaning, so it separates "falls back to the default" from "was
   * coerced" in a single cell. A `1` would coerce to `true` and agree with the `repin` default
   * by accident.
   */
  it.each([
    { label: 'the string "false"', stored: "false", kind: "digest" as const, expect_: false },
    { label: 'the string "true"', stored: "true", kind: "digest" as const, expect_: false },
    { label: "the number 1", stored: 1, kind: "digest" as const, expect_: false },
    { label: "null", stored: null, kind: "digest" as const, expect_: false },
    { label: 'the string "false" under an ON default', stored: "false", kind: "fork" as const, expect_: true },
  ])("$label falls back to the published default, never a coercion", async ({ stored, kind, expect_ }) => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("m13").toLowerCase(), { [kind]: stored });

    /* The premise: the non-boolean really is in the column. Without it this cell is about an
       empty column and passes for the wrong reason. */
    expect(
      (await preferencesColumn(scratch, account.accountId))?.[kind],
      "the fixture did not persist the non-boolean, so nothing here is being read back",
    ).toEqual(stored);

    const getPreferences = await bind("getPreferences");
    const answered = (await getPreferences(scratch.db, account.actor, account.accountId)) as Record<
      string,
      boolean
    >;

    expect(
      answered[kind],
      `\`${kind}\` is stored as ${JSON.stringify(stored)} and read back as ` +
        `${String(answered[kind])}; it must fall back to \`DEFAULT_PREFERENCES.${kind}\` ` +
        `(${String(DEFAULT_PREFERENCES_PIN[kind])}).\n` +
        `  Only a real \`boolean\` is a preference this module wrote. A coercion reads the ` +
        `string "false" as TRUE — it is truthy — which subscribes an account to the one kind ` +
        `AC4 says is off by default, while every cell that stores a real boolean stays green.`,
    ).toBe(expect_);

    expect(
      typeof answered[kind],
      "the answered value is not a boolean, so `Preferences` is not four booleans here",
    ).toBe("boolean");
  });
});

describe("T190 D-190-08: the two decisions that decide what a cell may assert", () => {
  /**
   * (3) "`enqueue` declines SILENTLY at all four gates (preference off, tombstone, private
   * fork, unknown account) — each is an ordinary outcome, and a rejection would need a fourth
   * admissible form."
   *
   * That is the sentence that makes every zero in this suite a legitimate assertion: the AC1
   * and AC2-off cells await `enqueue` without catching, so a module that REJECTED at a gate
   * would red them for the wrong reason and every one of those reds would read as a leak.
   * Pinned here, once, rather than depended on silently across six files.
   */
  it.each([
    { label: "the preference is off", prefs: { fork: false } },
    { label: "the preference is on", prefs: { fork: true } },
  ])("`enqueue` resolves rather than rejecting when $label", async ({ prefs }) => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("d8-silent").toLowerCase(), prefs);

    const enqueue = await bind("enqueue");
    const answered = await enqueue(scratch.db, {
      kind: "fork",
      accountId: account.accountId,
      subject: { slug: "t190-up", fork: "b1" },
    });

    expect(
      answered,
      `the block publishes \`enqueue(...): Promise<void>\`; it answered ${describe_(answered)}.`,
    ).toBeUndefined();
  });

  it("`enqueue` for an account that does not exist declines silently", async () => {
    const scratch = await setup.require();

    const enqueue = await bind("enqueue");
    await expect(
      Promise.resolve(
        enqueue(scratch.db, {
          kind: "fork",
          accountId: absentUuid(),
          subject: { slug: "t190-up", fork: "b1" },
        }),
      ),
      `D-190-08(3): the unknown-account gate declines SILENTLY. A rejection here would need a ` +
        `fourth admissible message form, and the published set is three — so a throw is either ` +
        `an unpublished sentence or a raw foreign-key violation carrying the account id.`,
    ).resolves.toBeUndefined();
  });

  /**
   * (4) "`setPreferences` on a missing account raises the not-owner form — in-set, unreachable
   * from HTTP."
   *
   * The interesting half is that it is the SAME sentence a real non-owner gets. *No such
   * account* and *not yours* must be indistinguishable (B-03), or the refusal becomes an
   * oracle for which account ids exist — so this cell asserts the two renderings are equal to
   * EACH OTHER, not merely that each is admissible on its own.
   */
  it("`setPreferences` on a missing account is indistinguishable from a non-owner refusal", async () => {
    const scratch = await setup.require();
    const real = await plantAccount(scratch, mark("d8-missing").toLowerCase(), {});
    const stranger = await plantAccount(scratch, mark("d8-stranger").toLowerCase(), {});

    const setPreferences = await bind("setPreferences");

    const missing = renderingsOf(
      await rejection(
        () => setPreferences(scratch.db, stranger.actor, absentUuid(), { digest: true }),
        "setPreferences on an account id that names nothing",
      ),
    );
    const notYours = renderingsOf(
      await rejection(
        () => setPreferences(scratch.db, stranger.actor, real.accountId, { digest: true }),
        "setPreferences on somebody else's account",
      ),
    );

    expect(missing.message, "D-190-08(4): the missing-account case raises the not-owner form.").toBe(
      MESSAGE_FORMS.setPreferences,
    );
    expect(
      missing.message,
      `*no such account* and *not yours* are DISTINGUISHABLE by their rendering, which turns ` +
        `the refusal into an oracle for which account ids exist (B-03).\n` +
        `  missing:   ${JSON.stringify(missing.message)}\n` +
        `  not yours: ${JSON.stringify(notYours.message)}`,
    ).toBe(notYours.message);
  });
});
