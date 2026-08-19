/* ============================================================
   T050 — the three writable profile fields, the email, and the
   default visibility

   "The three profile fields the settings form edits live are
    `displayName`, `bio`, `avatarHue`."

   ── the bounds are PUBLISHED, which is what makes this testable ──
   The first draft of this suite could not test `InvalidProfileError`
   at all: the form was published and the inputs that trigger it
   were not, so the class was unfirable and any threshold this
   author picked would have been invented. D-50-09/10/11 closed it:

     avatarHue     0–360, refused outside it
     displayName   <= 80 characters
     bio           <= 400 characters
     email         non-empty, and NO predicate beyond that (D-50-12)

   The `avatarHue` bound carries its own reason and it is D-13's,
   not tidiness: the column is `smallint`, so `40000` reaches the
   driver as SQLSTATE 22003 inside a `DrizzleQueryError` **whose
   message carries the statement and every bound parameter**. A
   module without the bound does not merely store something odd —
   it hands a caller the query and its parameters. That is why the
   refusal is asserted here and the leak is asserted in
   `errors.test.ts`: same defect, two properties.

   ── email is UNVERIFIED and nothing here pretends otherwise ──
   D-50-12: "nothing sends a verification, so no validity claim is
   made or tested." seams.md's `verificationSent` was dropped for
   being a field that would be a lie. So this file asserts that an
   address round-trips and that an empty one is refused, and
   asserts nothing whatever about whether the address is real.

   ── boundaries are asserted with LITERALS on both sides ──
   Each bound is checked at the largest accepted value and the
   smallest refused one. One-sided bounds are how an off-by-one
   ships: `<= 80` and `< 80` agree on 79 and on 81, and differ only
   at 80.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accountActor, assertAccountRecordKeys, bind, rejection, rendered } from "./contract";
import { type Scratch, closeDatabase, openDatabase, withHandle } from "./fixtures";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);

afterAll(async () => {
  await closeDatabase();
}, 60_000);

/** An account holding a handle, and the actor it speaks as. */
async function owner(): Promise<{ accountId: string; handle: string; actor: ReturnType<typeof accountActor> }> {
  const account = await withHandle(t);
  return {
    accountId: account.accountId,
    handle: account.handle,
    actor: accountActor(account.accountId, account.handle),
  };
}

describe("updateProfile writes the three fields the settings form edits", () => {
  it("sets displayName, bio and avatarHue together and returns the new record", async () => {
    const o = await owner();
    const updateProfile = await bind("updateProfile");
    const record = await updateProfile(t.db, o.actor, o.accountId, {
      displayName: "Mara Veiga",
      bio: "Builds harnesses.",
      avatarHue: 217,
    });

    const shape = assertAccountRecordKeys(record, "updateProfile(...)");
    const author = shape.author as Record<string, unknown>;
    expect(author.displayName).toBe("Mara Veiga");
    expect(author.bio).toBe("Builds harnesses.");
    expect(author.avatarHue).toBe(217);
  });

  it("makes the change visible to the public author surface", async () => {
    /* The returned record and the stored row are two claims. A module that echoes its own
       patch back satisfies the test above and stores nothing, and the defect surfaces one task
       later as a profile page that never updates. */
    const o = await owner();
    const updateProfile = await bind("updateProfile");
    const getPublicAuthor = await bind("getPublicAuthor");

    await updateProfile(t.db, o.actor, o.accountId, { displayName: "Stored Not Echoed" });
    const author = (await getPublicAuthor(t.db, o.handle)) as { displayName?: unknown } | undefined;

    expect(author?.displayName).toBe("Stored Not Echoed");
  });

  it("leaves an absent key alone rather than clearing it", async () => {
    /* `patch: { displayName?; bio?; avatarHue? }` — three optional keys, so a patch naming one
       says nothing about the other two. The implementation that gets this wrong reads the
       patch as a whole record and writes `undefined` over the rest, which the settings form
       triggers the first time a user edits one field. Absent and `null` are different
       instructions and the type spells both. */
    const o = await owner();
    const updateProfile = await bind("updateProfile");

    await updateProfile(t.db, o.actor, o.accountId, {
      displayName: "Keep Me",
      bio: "Keep me too.",
      avatarHue: 100,
    });
    const after = rendered(await updateProfile(t.db, o.actor, o.accountId, { avatarHue: 200 }));
    const author = after.author as Record<string, unknown>;

    expect(author.avatarHue).toBe(200);
    expect(author.displayName).toBe("Keep Me");
    expect(author.bio).toBe("Keep me too.");
  });

  it("clears a field when the patch names it as null", async () => {
    /* The other half of the same distinction, and the reason `patch` publishes `| null` on all
       three: a user removing their bio has no other way to say so. */
    const o = await owner();
    const updateProfile = await bind("updateProfile");

    await updateProfile(t.db, o.actor, o.accountId, {
      displayName: "Temporary",
      bio: "Temporary.",
      avatarHue: 300,
    });
    const after = rendered(
      await updateProfile(t.db, o.actor, o.accountId, {
        displayName: null,
        bio: null,
        avatarHue: null,
      }),
    );
    const author = after.author as Record<string, unknown>;

    expect(author.displayName).toBeNull();
    expect(author.avatarHue).toBeNull();
    expect(
      Object.hasOwn(author, "bio"),
      `a cleared bio renders ABSENT — \`PublicAuthor.bio?: string\` admits no null, so ` +
        `"cleared" and "never set" are one state and render alike.`,
    ).toBe(false);
  });

  it("accepts an empty patch without disturbing anything", async () => {
    const o = await owner();
    const updateProfile = await bind("updateProfile");
    await updateProfile(t.db, o.actor, o.accountId, { displayName: "Unchanged" });
    const after = rendered(await updateProfile(t.db, o.actor, o.accountId, {}));
    expect((after.author as Record<string, unknown>).displayName).toBe("Unchanged");
  });
});

describe("the published bounds, at the boundary in both directions", () => {
  it("accepts avatarHue 0 and 360 and refuses -1 and 361", async () => {
    /* Both ends and both sides. A module clamping instead of refusing passes a one-sided test
       that only checks the accepted value, and a module refusing the whole range passes one
       that only checks the refusal. */
    const o = await owner();
    const updateProfile = await bind("updateProfile");

    for (const hue of [0, 360]) {
      const record = rendered(await updateProfile(t.db, o.actor, o.accountId, { avatarHue: hue }));
      expect((record.author as Record<string, unknown>).avatarHue).toBe(hue);
    }

    for (const hue of [-1, 361]) {
      const err = await rejection(
        updateProfile(t.db, o.actor, o.accountId, { avatarHue: hue }) as Promise<unknown>,
        `updateProfile({ avatarHue: ${hue} })`,
      );
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("refuses an avatarHue the `smallint` column cannot hold, before the driver sees it", async () => {
    /* The case the ruling names: `40000` overflows `smallint` and raises 22003 from Postgres
       with the statement and every bound parameter in the message. The bound must refuse it
       first — which is a claim about WHERE the refusal happens, and the only observable
       difference is the shape of the error, asserted in `errors.test.ts`. Here the claim is
       only that it is refused at all. */
    const o = await owner();
    const updateProfile = await bind("updateProfile");
    const err = await rejection(
      updateProfile(t.db, o.actor, o.accountId, { avatarHue: 40000 }) as Promise<unknown>,
      "updateProfile({ avatarHue: 40000 })",
    );
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts a displayName of exactly 80 and refuses 81", async () => {
    const o = await owner();
    const updateProfile = await bind("updateProfile");

    const at = "d".repeat(80);
    const record = rendered(await updateProfile(t.db, o.actor, o.accountId, { displayName: at }));
    expect((record.author as Record<string, unknown>).displayName).toBe(at);

    const over = await rejection(
      updateProfile(t.db, o.actor, o.accountId, { displayName: "d".repeat(81) }) as Promise<unknown>,
      "updateProfile({ displayName: 81 chars })",
    );
    expect(over).toBeInstanceOf(Error);
  });

  it("accepts a bio of exactly 400 and refuses 401", async () => {
    const o = await owner();
    const updateProfile = await bind("updateProfile");

    const at = "b".repeat(400);
    const record = rendered(await updateProfile(t.db, o.actor, o.accountId, { bio: at }));
    expect((record.author as Record<string, unknown>).bio).toBe(at);

    const over = await rejection(
      updateProfile(t.db, o.actor, o.accountId, { bio: "b".repeat(401) }) as Promise<unknown>,
      "updateProfile({ bio: 401 chars })",
    );
    expect(over).toBeInstanceOf(Error);
  });

  it("counts a bound in characters, not in bytes", async () => {
    /* `"é".repeat(80)` is 80 characters and 160 UTF-8 bytes. A bound measured with
       `Buffer.byteLength` refuses this and a bound measured with `.length` accepts it, and the
       two are indistinguishable on ASCII — which is every fixture anyone writes by hand. The
       column is `text` with no width, so nothing downstream forces the byte reading. */
    const o = await owner();
    const updateProfile = await bind("updateProfile");
    const accented = "é".repeat(80);
    const record = rendered(
      await updateProfile(t.db, o.actor, o.accountId, { displayName: accented }),
    );
    expect((record.author as Record<string, unknown>).displayName).toBe(accented);
  });
});

describe("setEmail stores an address and never claims to have verified it", () => {
  it("round-trips an address to the owner's own record", async () => {
    const o = await owner();
    const setEmail = await bind("setEmail");
    const getAccount = await bind("getAccount");

    await setEmail(t.db, o.actor, o.accountId, "mara@example.test");
    const record = (await getAccount(t.db, o.actor, o.accountId)) as { email?: unknown };
    expect(record.email).toBe("mara@example.test");
  });

  it("clears the address when given null", async () => {
    const o = await owner();
    const setEmail = await bind("setEmail");
    await setEmail(t.db, o.actor, o.accountId, "temporary@example.test");
    const record = rendered(await setEmail(t.db, o.actor, o.accountId, null));
    expect(record.email).toBeNull();
  });

  it("refuses an empty string, which is the whole of the published predicate", async () => {
    /* D-50-12: "Email has no predicate beyond non-empty." So this is the ONE refusal this
       suite may assert, and no address shape is tested in either direction — a suite inventing
       an email grammar would red every implementation that chose a different one, which is a
       candidate list in a new hat. */
    const o = await owner();
    const setEmail = await bind("setEmail");
    const err = await rejection(
      setEmail(t.db, o.actor, o.accountId, "") as Promise<unknown>,
      'setEmail("")',
    );
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts an address no verifier would, because nothing verifies", async () => {
    /* The saturation direction: a module that quietly added a grammar would refuse this, and
       nothing in the contract licenses that. Asserting the permissive side is what keeps
       "unverified" from drifting into "validated by whatever regex the implementer knew".
       If a predicate is ever wanted, it is a ruling and this test is the one that reds. */
    const o = await owner();
    const setEmail = await bind("setEmail");
    const odd = "not-an-address-at-all";
    const record = rendered(await setEmail(t.db, o.actor, o.accountId, odd));
    expect(record.email).toBe(odd);
  });

  it("never renders the address on the public author surface", async () => {
    const o = await owner();
    const setEmail = await bind("setEmail");
    const getPublicAuthor = await bind("getPublicAuthor");
    await setEmail(t.db, o.actor, o.accountId, "leak-check@example.test");

    const author = rendered(await getPublicAuthor(t.db, o.handle));
    expect(JSON.stringify(author)).not.toContain("leak-check@example.test");
  });
});

describe("setDefaultVisibility", () => {
  it("defaults to public and moves to private", async () => {
    /* The column's own default is `public` (`lib/db/schema.ts`), and B-15's owner surfaces read
       this to decide what a new bundle starts as. Both values asserted, so a module that
       ignores its argument and always answers the default is caught. */
    const o = await owner();
    const getAccount = await bind("getAccount");
    const setDefaultVisibility = await bind("setDefaultVisibility");

    const before = (await getAccount(t.db, o.actor, o.accountId)) as { defaultVisibility?: unknown };
    expect(before.defaultVisibility).toBe("public");

    const after = rendered(await setDefaultVisibility(t.db, o.actor, o.accountId, "private"));
    expect(after.defaultVisibility).toBe("private");

    const back = rendered(await setDefaultVisibility(t.db, o.actor, o.accountId, "public"));
    expect(back.defaultVisibility).toBe("public");
  });

  it("persists the choice rather than echoing it", async () => {
    const o = await owner();
    const setDefaultVisibility = await bind("setDefaultVisibility");
    const getAccount = await bind("getAccount");

    await setDefaultVisibility(t.db, o.actor, o.accountId, "private");
    const record = (await getAccount(t.db, o.actor, o.accountId)) as {
      defaultVisibility?: unknown;
    };
    expect(record.defaultVisibility).toBe("private");
  });

  it("refuses a value outside the published pair", async () => {
    const o = await owner();
    const setDefaultVisibility = await bind("setDefaultVisibility");
    const err = await rejection(
      setDefaultVisibility(t.db, o.actor, o.accountId, "unlisted" as never) as Promise<unknown>,
      'setDefaultVisibility("unlisted")',
    );
    expect(err).toBeInstanceOf(Error);
  });
});
