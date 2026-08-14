import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { can, visibleTo } from "@/lib/server/policy";

import {
  anonymous,
  account,
  card,
  cardIdFor,
  cards,
  dropScratchDatabases,
  insertAccount,
  marker,
  operator,
  PUBLISHED,
  scratchDatabase,
  type Cards,
  type Scratch,
} from "./contract";

/* ============================================================
   T020 acceptance criterion 4 — private cards

   (4) a private card is unreadable by anyone but its owner and the
       operator

   Enforced at this boundary rather than left to callers, so it is
   tested at this boundary: every one of the four readers takes an
   `Actor`, and a denial is a **shape** — `undefined`, or the row
   absent from a list. Never a throw, never a 403. Mapping a denial
   to 404 is the route's job (B-03), so a reader that threw would
   put a decision in the wrong layer and a 500 in the response.

   The criterion names two grantees, and the test names four
   deniers: anonymous, a signed-in stranger, an actor whose
   `accountId` is the empty string, and an actor merely *tagged*
   `operator` with no `accountId` — T060 rules that possession of
   the discriminant is not authority, and this module inherits that
   by delegating rather than by re-deciding.
   ============================================================ */

let api: Cards;
let scratch: Scratch;
let ownerId: string;
let strangerId: string;
let operatorId: string;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    api = await cards();
    scratch = await scratchDatabase();
    ownerId = await insertAccount(scratch, marker("read-owner"));
    strangerId = await insertAccount(scratch, marker("read-stranger"));
    operatorId = await insertAccount(scratch, marker("read-operator"));
  } catch (cause) {
    setupFailure = cause;
  }
}, 120_000);

beforeEach(() => {
  if (setupFailure !== undefined) throw setupFailure;
});

afterAll(async () => {
  const dropped = await dropScratchDatabases();
  console.log(`t020/read teardown: dropped ${dropped} databases`);
}, 120_000);

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${what} produced ${value === null ? "null" : typeof value}; expected a record.`);
  }
  return value as Record<string, unknown>;
}

async function put(
  id: string,
  version: string,
  visibility: "public" | "private",
  owner = ownerId,
): Promise<Record<string, unknown>> {
  const fixture = card({ id, version });
  return asRecord(
    await api.addCard(scratch.db, {
      cardId: id,
      version,
      ownerId: owner,
      visibility,
      body: fixture.body,
      source: fixture.source,
    }),
    "addCard",
  );
}

/** Every actor the criterion denies, with the reason it denies them. */
function deniers(): { label: string; actor: unknown }[] {
  return [
    { label: "anonymous", actor: anonymous },
    { label: "a signed-in stranger", actor: account(strangerId, "stranger") },
    /* T060: an empty-string account id never widens past what an anonymous caller sees. */
    { label: "an account whose id is the empty string", actor: account("") },
    /* T060: possession of the discriminant is not authority. */
    { label: "an operator tag with no accountId", actor: { kind: "operator" } },
  ];
}

describe("AC4 — a private card is unreadable by anyone but its owner and the operator", () => {
  it("AC4: getCard answers undefined for every denied actor, and never throws", async () => {
    const id = cardIdFor("ac4get");
    await put(id, "1.0.0", "private");

    for (const { label, actor } of deniers()) {
      const outcome = await Promise.resolve(api.getCard(scratch.db, actor, id, "1.0.0")).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, value: String(error) }),
      );
      /* A denial is a shape, not an exception and not a 403. */
      expect(outcome, `${label}: ${PUBLISHED.actorFilter}`).toEqual({ ok: true, value: undefined });
    }
  }, 60_000);

  it("AC4: the owner and the operator both read the private card in full", async () => {
    const id = cardIdFor("ac4grant");
    const stored = await put(id, "1.0.0", "private");

    const asOwner = asRecord(
      await api.getCard(scratch.db, account(ownerId, "owner"), id, "1.0.0"),
      "getCard as owner",
    );
    const asOperator = asRecord(
      await api.getCard(scratch.db, operator(operatorId), id, "1.0.0"),
      "getCard as operator",
    );

    expect(asOwner.id).toBe(stored.id);
    expect(asOperator.id).toBe(stored.id);
    /* In full: the private card's own bytes, not a redacted projection. The criterion is
       about who may read it, and a reader that returned a stub for the owner would satisfy
       "not undefined" while breaking what a read is for. */
    expect(asOwner.source).toBe(stored.source);
    expect(asOperator.source).toBe(stored.source);
    expect(asOwner.digest).toBe(stored.digest);
  });

  it("AC4: a public card stays readable by everyone, so the filter is not a blanket denial", async () => {
    const id = cardIdFor("ac4public");
    const stored = await put(id, "1.0.0", "public");
    for (const { label, actor } of deniers()) {
      const read = asRecord(await api.getCard(scratch.db, actor, id, "1.0.0"), `getCard ${label}`);
      expect(read.id, label).toBe(stored.id);
    }
  }, 60_000);

  it("AC4: getLatestCard hides a private newest version rather than falling back", async () => {
    const id = cardIdFor("ac4latest");
    await put(id, "1.0.0", "public");
    await put(id, "2.0.0", "private");

    /* The sharp case. "Latest visible to this actor" and "latest, then filtered" differ
       exactly here, and the second is the one that leaks: a stranger who gets `1.0.0` back
       learns nothing, while a stranger who gets `undefined` learns a newer version exists.
       Neither reading is more secure by accident, so both are stated rather than guessed —
       what is asserted is only that the private row itself never comes back. */
    for (const { label, actor } of deniers()) {
      const latest = await api.getLatestCard(scratch.db, actor, id);
      const record = latest === undefined ? undefined : asRecord(latest, "getLatestCard");
      expect(record?.version, `${label} must never see 2.0.0`).not.toBe("2.0.0");
    }

    const asOwner = asRecord(
      await api.getLatestCard(scratch.db, account(ownerId), id),
      "getLatestCard as owner",
    );
    expect(asOwner.version).toBe("2.0.0");
    const asOperator = asRecord(
      await api.getLatestCard(scratch.db, operator(operatorId), id),
      "getLatestCard as operator",
    );
    expect(asOperator.version).toBe("2.0.0");
  });

  it("AC4: listCardVersions omits the private rows rather than refusing the list", async () => {
    const id = cardIdFor("ac4list");
    await put(id, "1.0.0", "public");
    await put(id, "1.1.0", "private");
    await put(id, "1.2.0", "public");

    for (const { label, actor } of deniers()) {
      const listed = (await api.listCardVersions(scratch.db, actor, id)) as Record<
        string,
        unknown
      >[];
      expect(Array.isArray(listed), label).toBe(true);
      /* The row is absent from the list; the list itself still comes back. A reader that
         threw, or returned nothing at all because one row was private, would take the two
         public versions with it. */
      expect(listed.map((r) => r.version).sort(), label).toEqual(["1.0.0", "1.2.0"]);
    }

    const asOwner = (await api.listCardVersions(scratch.db, account(ownerId), id)) as Record<
      string,
      unknown
    >[];
    expect(asOwner.map((r) => r.version).sort()).toEqual(["1.0.0", "1.1.0", "1.2.0"]);
    const asOperator = (await api.listCardVersions(scratch.db, operator(operatorId), id)) as Record<
      string,
      unknown
    >[];
    expect(asOperator.map((r) => r.version).sort()).toEqual(["1.0.0", "1.1.0", "1.2.0"]);
  }, 60_000);

  it("AC4: resolveCardRef answers undefined for a private card a stranger names exactly", async () => {
    const id = cardIdFor("ac4ref");
    await put(id, "1.0.0", "private");
    for (const { label, actor } of deniers()) {
      const outcome = await Promise.resolve(
        api.resolveCardRef(scratch.db, actor, `${id}@1.0.0`),
      ).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, value: String(error) }),
      );
      expect(outcome, label).toEqual({ ok: true, value: undefined });
    }
    const asOwner = asRecord(
      await api.resolveCardRef(scratch.db, account(ownerId), `${id}@1.0.0`),
      "resolveCardRef as owner",
    );
    expect(asOwner.version).toBe("1.0.0");
  }, 60_000);

  it("AC4: one owner's private card is invisible to another owner who has cards of their own", async () => {
    const mine = cardIdFor("ac4mine");
    const yours = cardIdFor("ac4yours");
    await put(mine, "1.0.0", "private", ownerId);
    await put(yours, "1.0.0", "private", strangerId);

    /* Ownership is per row, not a flag on the caller. A filter keyed on "is this actor an
       owner of anything" rather than "of this row" passes every test above. */
    await expect(api.getCard(scratch.db, account(strangerId), mine, "1.0.0")).resolves.toBeUndefined();
    await expect(api.getCard(scratch.db, account(ownerId), yours, "1.0.0")).resolves.toBeUndefined();
    expect(asRecord(await api.getCard(scratch.db, account(ownerId), mine, "1.0.0"), "own").version).toBe(
      "1.0.0",
    );
  });

  it("AC4: the decision agrees with @/lib/server/policy rather than being re-derived", async () => {
    const id = cardIdFor("ac4policy");
    await put(id, "1.0.0", "private");
    const resource = { kind: "card", ownerId, visibility: "private" } as const;

    /* T060 is merged and real, and the contract says to filter through it. Asserting the
       module's answers against `can` and `visibleTo` directly is what makes "filters through
       T060" testable from outside: a module that reimplemented the rule would agree here by
       luck and diverge the first time T060 changed. */
    for (const { label, actor } of deniers()) {
      expect(can(actor as never, "read", resource), `${label}: policy denies`).toBe(false);
      await expect(api.getCard(scratch.db, actor, id, "1.0.0")).resolves.toBeUndefined();
    }
    expect(can(account(ownerId) as never, "read", resource)).toBe(true);
    expect(can(operator(operatorId) as never, "read", resource)).toBe(true);
    expect(visibleTo(account(ownerId) as never, ownerId)).toBe("all");
    expect(visibleTo(account(strangerId) as never, ownerId)).toBe("public");
    expect(visibleTo(operator(operatorId) as never, ownerId)).toBe("all");
  }, 60_000);

  it("AC4: a malformed actor is denied rather than crashing the read", async () => {
    const id = cardIdFor("ac4malformed");
    await put(id, "1.0.0", "private");
    /* T060 rules that `can` and `visibleTo` fail closed and never throw for a malformed
       actor. A reader that dereferenced `actor.accountId` before delegating would turn each
       of these into a 500 on a request that should simply see nothing. */
    for (const actor of [null, undefined, {}, { kind: "nonsense" }, "operator", 7, []]) {
      const outcome = await Promise.resolve(api.getCard(scratch.db, actor, id, "1.0.0")).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, value: String(error) }),
      );
      expect(outcome, `actor ${JSON.stringify(actor) ?? "undefined"}`).toEqual({
        ok: true,
        value: undefined,
      });
    }
  }, 60_000);

  it("AC4: an actor built on a prototype carrying the owner's id is denied", async () => {
    const id = cardIdFor("ac4proto");
    await put(id, "1.0.0", "private");
    /* T060: authority is never inherited — every field either function reads is fetched
       through `Object.hasOwn` first. This module gets that for free by delegating, and pays
       for it in full if it copies the fields onto its own object first. */
    const inherited = Object.create({ kind: "account", accountId: ownerId, handle: null }) as object;
    await expect(api.getCard(scratch.db, inherited, id, "1.0.0")).resolves.toBeUndefined();

    const inheritedOperator = Object.create({ kind: "operator", accountId: operatorId }) as object;
    await expect(api.getCard(scratch.db, inheritedOperator, id, "1.0.0")).resolves.toBeUndefined();
  });
});

describe("reads of what is not there", () => {
  it("getCard answers undefined for a card id nothing holds", async () => {
    await expect(
      api.getCard(scratch.db, anonymous, cardIdFor("nothing"), "1.0.0"),
    ).resolves.toBeUndefined();
  });

  it("getCard answers undefined for a version that card never had", async () => {
    const id = cardIdFor("noversion");
    await put(id, "1.0.0", "public");
    await expect(api.getCard(scratch.db, anonymous, id, "9.9.9")).resolves.toBeUndefined();
  });

  it("getCard answers undefined for an empty card id rather than matching something", async () => {
    const id = cardIdFor("emptyid");
    await put(id, "1.0.0", "public");
    /* An empty string is falsy, and a predicate that treats it as "no filter" answers this
       with the row above. */
    await expect(api.getCard(scratch.db, anonymous, "", "1.0.0")).resolves.toBeUndefined();
    await expect(api.getCard(scratch.db, anonymous, id, "")).resolves.toBeUndefined();
  });

  it("listCardVersions answers an empty array for a card id nothing holds", async () => {
    await expect(
      api.listCardVersions(scratch.db, anonymous, cardIdFor("nolist")),
    ).resolves.toEqual([]);
  });

  it("getLatestCard answers undefined when every version is private and the actor is not the owner", async () => {
    const id = cardIdFor("allprivate");
    await put(id, "1.0.0", "private");
    await put(id, "2.0.0", "private");
    await expect(api.getLatestCard(scratch.db, anonymous, id)).resolves.toBeUndefined();
    expect(
      asRecord(await api.getLatestCard(scratch.db, account(ownerId), id), "as owner").version,
    ).toBe("2.0.0");
  });
});
