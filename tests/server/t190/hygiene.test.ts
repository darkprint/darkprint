/* ============================================================
   T190 — D-13, and the admissible set as a closed set

   §T190: "Admissible message forms carry no subject line, no
   recipient address and no part of the content", and D-190-05 makes
   the set three:

     "getPreferences: not this account's owner."
     "setPreferences: not this account's owner."
     "unsubscribe: this link is no longer valid."

   ── the strongest form of "the whole set" is an EQUALITY ──
   Every refusal this suite can reach is required to render EXACTLY
   one of the three. That excludes every leak by construction rather
   than by listing the leaks somebody thought of: an address, a
   token, a SQLSTATE, a bound parameter and a subject line are all
   outside a three-element set without being named.

   The searches below are kept anyway and they are not redundant.
   The equality is about `message`; a leak can also reach a log
   through `String(err)`, through `JSON.stringify(err)` and through
   an enumerable own property, and D-13's hygiene clause is about
   all four.

   ── the address is PLANTED ──
   `plantedToken()` produces twenty-two alphanumeric characters no
   admissible message can contain by accident. A tell that can occur
   naturally reds like a real leak: a SQLSTATE search over-matched in
   this repository once because a fixture's `process.pid` contained
   `23505`.

   ── `cause` is DESCENDED INTO, and is not itself the charge ──
   D-13 makes `cause` the sanctioned carrier for an original fault,
   so a scanner refusing to look there charges nothing and one
   treating anything found there as a leak false-charges every
   correctly wrapped module. What is asserted is the RENDERING —
   `message`, `String`, `JSON.stringify`, `Object.keys` — which is
   what actually escapes to a log.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  ADMISSIBLE_MESSAGES,
  MESSAGE_FORMS,
  NON_OWNERS,
  type Renderings,
  type Scratch,
  bind,
  deferred,
  dropScratchDatabases,
  mark,
  plantAccount,
  plantedToken,
  rejection,
  renderingsOf,
  scratchDatabase,
} from "./contract";

const setup = deferred<Scratch>(() => scratchDatabase("hygiene"));

afterAll(async () => {
  await dropScratchDatabases();
});

/** Every surface at once, so a search runs over all four rather than over `message` alone. */
function surfaces(r: Renderings): { where: string; text: string }[] {
  return [
    { where: "message", text: r.message },
    { where: "String(err)", text: r.string },
    { where: "JSON.stringify(err)", text: r.json },
    { where: "Object.keys(err)", text: r.keys.join(",") },
  ];
}

function assertNoTell(r: Renderings, tell: string, what: string, where: string): void {
  const hits = surfaces(r).filter((s) => s.text.includes(tell));
  expect(
    hits.map((h) => `${h.where}: ${h.text}`),
    `${where} leaked ${what} into ${hits.length} rendering(s).\n` +
      `  §T190: the admissible forms carry "no subject line, no recipient address and no part ` +
      `of the content", and D-190-03 keeps addresses out of this module BY CONSTRUCTION — ` +
      `\`NotificationDelivery.send\` takes an \`accountId\` and never an address, so an ` +
      `address reaching a rendering means something went and fetched one.`,
  ).toEqual([]);
}

/**
 * D-13's hygiene clause. `name` set in a constructor is an own ENUMERABLE property, which puts
 * the class name into `Object.keys(err)` and `JSON.stringify(err)`; the repository's convention
 * is to put it on the prototype. `cause` must be non-enumerable for the same reason — and that
 * is precisely the shape a leak scanner walking only enumerable properties cannot see, which is
 * why the searches above run over `String(err)` too.
 */
function assertSealed(err: unknown, where: string): void {
  const r = renderingsOf(err);
  expect(
    r.keys,
    `${where} carries own ENUMERABLE properties ${JSON.stringify(r.keys)}.\n` +
      `  D-13's hygiene clause: \`name\` goes on the prototype, never on the instance, and ` +
      `\`cause\` is non-enumerable. An own \`name\`/\`message\`/\`cause\` reaches every log ` +
      `that JSON-stringifies an error.`,
  ).toEqual([]);
}

describe("T190: every refusal renders exactly one of the three admissible forms", () => {
  it.each(NON_OWNERS)("getPreferences for $label", async (nonOwner) => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("h-get").toLowerCase(), {});

    const getPreferences = await bind("getPreferences");
    const err = await rejection(
      () => getPreferences(scratch.db, nonOwner.actor(account.accountId), account.accountId),
      "getPreferences",
    );
    const r = renderingsOf(err);

    expect(
      ADMISSIBLE_MESSAGES,
      `getPreferences refused ${nonOwner.label} with ${JSON.stringify(r.message)}, which is ` +
        `outside the published set of three.`,
    ).toContain(r.message);
    expect(r.message).toBe(MESSAGE_FORMS.getPreferences);
    assertSealed(err, "the getPreferences refusal");
  });

  it.each(NON_OWNERS)("setPreferences for $label", async (nonOwner) => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("h-set").toLowerCase(), {});

    const setPreferences = await bind("setPreferences");
    const err = await rejection(
      () =>
        setPreferences(scratch.db, nonOwner.actor(account.accountId), account.accountId, {
          digest: true,
        }),
      "setPreferences",
    );
    const r = renderingsOf(err);

    expect(ADMISSIBLE_MESSAGES).toContain(r.message);
    expect(r.message).toBe(MESSAGE_FORMS.setPreferences);
    assertSealed(err, "the setPreferences refusal");
  });
});

describe("T190: no email address reaches a rendering", () => {
  /**
   * The account's address carries a planted token, so a hit cannot be anything but this
   * address arriving where §T190 forbids it.
   */
  it("a refusal about an account never renders that account's address", async () => {
    const scratch = await setup.require();
    const tell = plantedToken();
    const handle = mark("h-mail").toLowerCase();
    const account = await plantAccount(scratch, handle, {});
    await scratch.query("update account set email = $2 where id = $1", [
      account.accountId,
      `${tell}@darkprint.test`,
    ]);

    /* The premise: the address really is in the row the refusal is about. */
    const [row] = await scratch.query("select email from account where id = $1", [
      account.accountId,
    ]);
    expect(String(row?.email ?? ""), "the fixture did not plant the address").toContain(tell);

    const setPreferences = await bind("setPreferences");
    const err = await rejection(
      () =>
        setPreferences(scratch.db, NON_OWNERS[1]!.actor(account.accountId), account.accountId, {
          digest: true,
        }),
      "setPreferences",
    );

    assertNoTell(renderingsOf(err), tell, "the account's email address", "the refusal");
  });

  /** And neither does an unsubscribe refusal, which is the one path a stranger can drive. */
  it("an unsubscribe refusal never renders an address or an account id", async () => {
    const scratch = await setup.require();
    const tell = plantedToken();
    const account = await plantAccount(scratch, mark("h-unsub").toLowerCase(), { fork: true });
    await scratch.query("update account set email = $2 where id = $1", [
      account.accountId,
      `${tell}@darkprint.test`,
    ]);

    const unsubscribe = await bind("unsubscribe");
    const err = await rejection(
      () => unsubscribe(scratch.db, plantedToken()),
      "unsubscribe with an invented token",
    );
    const r = renderingsOf(err);

    assertNoTell(r, tell, "an email address", "the unsubscribe refusal");
    assertNoTell(r, account.accountId, "an account id", "the unsubscribe refusal");
    expect(
      r.message,
      "AC6: the token `names the kind rather than carrying an account id in the clear`, and " +
        "its refusal says even less than that.",
    ).toBe(MESSAGE_FORMS.unsubscribe);
    assertSealed(err, "the unsubscribe refusal");
  });
});

describe("T190: a store fault is sealed", () => {
  /**
   * The one path that reaches the driver, driven by taking the table away.
   *
   * `DrizzleQueryError.message` opens with the statement and every bound parameter (D-13). On
   * `enqueue` the bound parameters are the subject, and on a preferences write they are the
   * account id — so an unwrapped driver fault escaping this module renders exactly what the
   * admissible-forms rule exists to keep off every surface.
   *
   * Its own scratch database: the drop is destructive and no other cell may inherit it.
   */
  it("`enqueue` against a missing table renders no statement and no bound parameter", async () => {
    const scratch = await scratchDatabase("hygiene-fault");
    const tell = plantedToken();
    const account = await plantAccount(scratch, mark("h-fault").toLowerCase(), { fork: true });

    /* Premises: the module exists, the table exists, and then it does not. */
    const enqueue = await bind("enqueue");
    await scratch.query("drop table if exists notification_queue cascade");

    const err = await rejection(
      () =>
        enqueue(scratch.db, {
          kind: "fork",
          accountId: account.accountId,
          subject: { slug: tell, fork: "b1" },
        }),
      "enqueue against a dropped `notification_queue`",
    );
    const r = renderingsOf(err);

    assertNoTell(r, tell, "a bound parameter (the subject)", "the store fault");
    assertNoTell(r, account.accountId, "a bound parameter (the account id)", "the store fault");

    for (const prose of ["insert into", "select ", "notification_queue", "42P01", "23505"]) {
      const hits = surfaces(r).filter((s) => s.text.toLowerCase().includes(prose.toLowerCase()));
      expect(
        hits.map((h) => `${h.where}: ${h.text}`),
        `the store fault rendered driver prose (${JSON.stringify(prose)}).\n` +
          `  D-13: a store module seals its own faults. The original belongs on \`cause\`, ` +
          `which is the sanctioned carrier and is not searched here — what is searched is what ` +
          `escapes to a log.`,
      ).toEqual([]);
    }

    assertSealed(err, "the store fault");
    expect(
      (err as Error).name,
      `D-190-05 names \`NotificationStoreError\` as one of this module's two published ` +
        `classes. A caller that cannot name the class cannot branch on it.`,
    ).toBe("NotificationStoreError");
  });
});
