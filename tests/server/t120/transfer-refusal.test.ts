/* ============================================================
   T120 — AC3 and the refusal vocabulary

   ── why no cell here writes `rejects.toThrow()` bare ──
   In the blind position the suite's own `import("@/lib/server/
   lifecycle")` rejects, and a bare `rejects.toThrow()` is
   SATISFIED BY THAT. The cell then passes against a module that
   does not exist, which is the blind-position launderer: it
   turns the one position where a criterion cell is guaranteed
   falsifiable into a green.

   So every refusal is caught by hand, and the caught value is
   put through `expectRefusal`, which fails when the throw is the
   import rejection. A refusal cell in this file reds blind for
   the same reason every other cell does, and its message says
   which of the two it is.

   ── and the message is asserted, not merely the throw ──
   `wave-blind.md`: assert what the writer LEFT BEHIND, not only
   that it threw. AC3's whole content is "before anything moves",
   so each refusal cell also diffs the whole database AND reads
   the bundle row back field by field — a refusal that updated
   `owner_id` and then threw moves no row COUNT at all, so a
   census alone would report nothing moved about a transfer that
   completed.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RecordedSetup, describe_, isAdmissible, loadLifecycle, requiredFn, signature } from "./contract";
import {
  ANONYMOUS,
  bundleRow,
  publishBundle,
  scratchDatabase,
  seedAccount,
  wholeDatabaseCensus,
  type Account,
  type Published,
  type Scratch,
} from "./fixtures";

interface World {
  scratch: Scratch;
  alice: Account;
  bob: Account;
  carol: Account;
  /** Alice's, at a slug Bob also holds. */
  collides: Published;
  /** Bob's, at the same slug. */
  bobsSameSlug: Published;
}

const world = new RecordedSetup<World>("the T120 refusal fixture");

beforeAll(async () => {
  await world.run(async () => {
    const scratch = await scratchDatabase("refusal");
    const alice = await seedAccount(scratch, "t120-r-alice");
    const bob = await seedAccount(scratch, "t120-r-bob");
    const carol = await seedAccount(scratch, "t120-r-carol");
    const collides = await publishBundle(scratch, alice, "contested", "public");
    const bobsSameSlug = await publishBundle(scratch, bob, "contested", "public");
    return { scratch, alice, bob, carol, collides, bobsSameSlug };
  });
}, 120_000);

afterAll(async () => {
  await world.optional()?.scratch.drop();
});

async function verb(name: string) {
  const mod = await loadLifecycle();
  return requiredFn(mod, name, signature(name).text);
}

/** Whatever `run` threw, or a red saying it did not throw at all. */
async function caught(run: () => Promise<unknown>): Promise<unknown> {
  try {
    const value = await run();
    return { __resolved: value };
  } catch (thrown) {
    return thrown;
  }
}

/**
 * The caught value is a real refusal from the module, carrying an admissible sentence.
 *
 * Three distinct failures, each named, because collapsing them is how a refusal cell stops
 * meaning anything: the call RESOLVED; the call threw the suite's own absent-module import
 * rejection rather than a refusal; the call threw something whose message the contract does
 * not publish for this verb.
 */
function expectRefusal(thrown: unknown, callingVerb: string, expectedClass?: string): Error {
  if (typeof thrown === "object" && thrown !== null && "__resolved" in thrown) {
    throw new Error(
      `${callingVerb} RESOLVED with ${describe_((thrown as { __resolved: unknown }).__resolved)} ` +
        `where the contract publishes a refusal.`,
    );
  }
  const error = thrown as Error;
  const message = String(error?.message ?? "");
  if (/Cannot find (package|module)/.test(message) && message.includes("lifecycle")) {
    throw new Error(
      `${callingVerb} did not refuse: the throw is this suite's own import of an absent ` +
        `@/lib/server/lifecycle.\n` +
        `  That is the BLIND POSITION and it is reported here rather than swallowed, because ` +
        `a bare \`rejects.toThrow()\` is satisfied by exactly this rejection — a refusal cell ` +
        `written that way is green against a module that does not exist.\n` +
        `  Cause: ${message}`,
    );
  }
  if (!isAdmissible(callingVerb, message)) {
    throw new Error(
      `${callingVerb} threw \`${error?.name}\` reading ${JSON.stringify(message)}, which is ` +
        `not one of the sentences §T120 publishes for it (D-120-03, D-120-15).`,
    );
  }
  if (expectedClass !== undefined && error?.name !== expectedClass) {
    throw new Error(
      `${callingVerb} refused with \`${error?.name}\` where D-120-03 names \`${expectedClass}\`. ` +
        `D-120-14 maps statuses off the refusal kind, so the class is load-bearing at the route.`,
    );
  }
  return error;
}

describe("T120 AC3 — a transfer into a taken slug is refused BEFORE anything moves", () => {
  it("`planTransfer` reports the collision and writes nothing", async () => {
    const { scratch, alice, bob, collides } = world.require();

    const before = await wholeDatabaseCensus(scratch);
    const beforeRow = await bundleRow(scratch, collides.bundleId);

    const plan = (await (await verb("planTransfer"))(
      scratch.db,
      alice.actor,
      collides.bundleId,
      bob.handle,
    )) as Record<string, unknown>;

    /* The plan REPORTS rather than refuses — that is the whole reason the two `plan*` verbs
       exist, and a `planTransfer` that threw here would make the criterion unobservable
       without performing the act. */
    expect(plan.collides).toBe(true);
    expect(plan.bundleId).toBe(collides.bundleId);
    expect(plan.fromAccountId).toBe(alice.accountId);
    expect(plan.toAccountId).toBe(bob.accountId);
    expect(plan.slug).toBe("contested");

    expect(await wholeDatabaseCensus(scratch)).toEqual(before);
    expect(await bundleRow(scratch, collides.bundleId)).toEqual(beforeRow);
  });

  it("`transferBundle` refuses with the published sentence and leaves the row untouched", async () => {
    const { scratch, alice, bob, collides } = world.require();

    const before = await wholeDatabaseCensus(scratch);
    const beforeRow = await bundleRow(scratch, collides.bundleId);

    const thrown = await caught(async () =>
      (await verb("transferBundle"))(scratch.db, alice.actor, collides.bundleId, bob.handle),
    );
    const error = expectRefusal(thrown, "transferBundle", "TransferRefusedError");

    /* The sentence, exactly, with the caller's own two submissions rendered into it. The
       generic `isAdmissible` check inside `expectRefusal` accepts any published body; this
       line pins WHICH one, so a module that refused for the right reason with the wrong
       sentence — or for the wrong reason with a published sentence — is caught. */
    expect(error.message).toBe(
      "transferBundle: `" + bob.handle + "` already has a bundle at `contested`.",
    );

    /* "Before anything moves", held two ways. The census alone is not enough: a refusal that
       UPDATED `owner_id` and then threw changes no row count anywhere, so a count-only
       control reports nothing moved about a transfer that completed. */
    expect(await wholeDatabaseCensus(scratch)).toEqual(before);
    expect(
      await bundleRow(scratch, collides.bundleId),
      "the bundle row changed across a refused transfer. AC3 is `refused before anything " +
        "moves`, and a row that moved and then threw satisfies every `rejects.toThrow()` a " +
        "reviewer would write.",
    ).toEqual(beforeRow);
  });

  it("the disagreeing control: an UNCONTESTED slug plans `collides: false` and then transfers", async () => {
    const { scratch, alice, carol } = world.require();

    /* Without this cell, both cells above pass against a `planTransfer` that hardcodes
       `collides: true` and a `transferBundle` that refuses everything — a criterion
       satisfiable by always refusing needs the case that must NOT refuse. */
    const free = await publishBundle(scratch, alice, "uncontested", "public");

    const plan = (await (await verb("planTransfer"))(
      scratch.db,
      alice.actor,
      free.bundleId,
      carol.handle,
    )) as Record<string, unknown>;
    expect(plan.collides).toBe(false);

    await (await verb("transferBundle"))(scratch.db, alice.actor, free.bundleId, carol.handle);
    expect((await bundleRow(scratch, free.bundleId))?.owner_id).toBe(carol.accountId);
  });
});

describe("T120 D-120-03/15 — the refusals, per verb, with the sentence the contract publishes", () => {
  const NO_SUCH_BUNDLE = "00000000-0000-4000-8000-0000000000ff";

  it.each(["planTransfer", "transferBundle"])(
    "%s refuses a bundleId nobody holds, and says so in one sentence",
    async (name) => {
      const { scratch, alice, bob } = world.require();
      const before = await wholeDatabaseCensus(scratch);

      const thrown = await caught(async () =>
        (await verb(name))(scratch.db, alice.actor, NO_SUCH_BUNDLE, bob.handle),
      );
      const error = expectRefusal(thrown, name);

      /* B-03: absent and unreadable are ONE sentence, so nothing here asserts a distinction
         between them — asserting one would be asking the module to leak which it was. */
      expect(error.message).toBe(name + ": no bundle at `" + NO_SUCH_BUNDLE + "`.");
      expect(await wholeDatabaseCensus(scratch)).toEqual(before);
    },
  );

  it.each(["planTransfer", "transferBundle"])(
    "%s refuses an actor who is not the bundle's owner",
    async (name) => {
      const { scratch, bob, collides } = world.require();
      const before = await wholeDatabaseCensus(scratch);
      const beforeRow = await bundleRow(scratch, collides.bundleId);

      /* Bob is a real, signed-in account who simply does not own this bundle — not anonymous,
         which is a different refusal with a different sentence one cell down. */
      const thrown = await caught(async () =>
        (await verb(name))(scratch.db, bob.actor, collides.bundleId, bob.handle),
      );
      const error = expectRefusal(thrown, name);
      expect(error.message).toBe(name + ": only the owner may transfer a bundle.");
      expect(await wholeDatabaseCensus(scratch)).toEqual(before);
      expect(await bundleRow(scratch, collides.bundleId)).toEqual(beforeRow);
    },
  );

  it.each(["planTransfer", "transferBundle"])(
    "%s refuses a recipient handle nobody holds",
    async (name) => {
      const { scratch, alice, collides } = world.require();
      const before = await wholeDatabaseCensus(scratch);

      /* A well-formed handle the grammar accepts and no account holds — not a malformed one,
         which would test T070's validator rather than this refusal. */
      const nobody = "t120-nobody-holds-this";
      const thrown = await caught(async () =>
        (await verb(name))(scratch.db, alice.actor, collides.bundleId, nobody),
      );
      const error = expectRefusal(thrown, name);
      expect(error.message).toBe(name + ": no account holds `" + nobody + "`.");
      expect(await wholeDatabaseCensus(scratch)).toEqual(before);
    },
  );

  it("`transferBundle` refuses an anonymous caller with D-180-03's form", async () => {
    const { scratch, collides, bob } = world.require();
    const before = await wholeDatabaseCensus(scratch);

    const thrown = await caught(async () =>
      (await verb("transferBundle"))(scratch.db, ANONYMOUS, collides.bundleId, bob.handle),
    );
    const error = expectRefusal(thrown, "transferBundle");
    expect(error.message).toBe("transferBundle: a transfer needs an account.");
    expect(await wholeDatabaseCensus(scratch)).toEqual(before);
  });
});

describe("T120 D-120-12 K — both `plan*` verbs authorize as their verbs do", () => {
  it("`planDeletion` refuses a stranger rather than counting somebody's private holdings", async () => {
    const { scratch, alice, bob } = world.require();

    /* The plan reports how many private bundles and private cards an account holds. A
       `planDeletion` that answered a stranger is B-03's leak arriving at a module boundary:
       the count is the private fact. K rules it authorizes; this is what that means. */
    const thrown = await caught(async () =>
      (await verb("planDeletion"))(scratch.db, bob.actor, alice.accountId),
    );
    const error = expectRefusal(thrown, "planDeletion");

    /* The sentence is asserted through the published BODY set rather than pinned to one
       string: D-120-15 enumerates no `planDeletion: not this account's owner.` even though K
       rules the refusal exists, so pinning the exact sentence here would red a module that
       followed the ruling. What is pinned is that the verb naming itself is the verb that
       raised it, and that the body is one §T120 publishes. */
    expect(isAdmissible("planDeletion", error.message)).toBe(true);
    expect(error.message.startsWith("planDeletion: ")).toBe(true);
  });

  it("the disagreeing control: the account's OWN `planDeletion` answers", async () => {
    const { scratch, alice } = world.require();

    /* Without this, the cell above passes against a `planDeletion` that refuses everyone. */
    const plan = (await (await verb("planDeletion"))(
      scratch.db,
      alice.actor,
      alice.accountId,
    )) as Record<string, unknown>;
    expect(plan.accountId).toBe(alice.accountId);
    expect(plan.handle).toBe(alice.handle);
  });
});
