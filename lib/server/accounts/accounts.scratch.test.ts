/* ============================================================
   T050 implementer's scratch harness — the DATABASE-FREE half.
   Not the blind suite, which is written against the contract in
   `../darkprint-wt-t050-accounts-tests` and has never seen this
   file. This exists so every guard added in this module gets
   falsified against something, per CLAUDE.md's definition of
   done, and so the parts of the task that need no Postgres are
   observed without holding the gate slot.

   Control bytes are IMPORTED, never retyped (T-01, which fired
   twice on this task's own production code and was blocked by the
   tool layer both times).

   What is NOT here: everything that touches the store. That is
   `getAccount`, `getPublicAuthor`, the three writers' store half,
   `changeHandle`'s transaction and `upsertFromGitHub` — all of
   which need the gate slot, which T050's blind author holds.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LONE_HIGH_SURROGATE, NUL, nulInside, surrogateInside } from "@/tests/support/control-bytes";
import type { schema } from "@/lib/db";
import { HandleTakenError, InvalidNameError, NamingStoreError } from "@/lib/server/naming";
import type { Db, DbClient } from "@/lib/db";
import { createDbClient } from "@/lib/db";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/server/auth";
import { GET as getAccountRoute } from "@/app/api/account/route";
import { AccountStoreError } from "./errors";
import { HandleRequiredError, InvalidProfileError, NotAccountOwnerError } from "./errors";
import { changeHandle } from "./handle";
import { upsertFromGitHub } from "./github";
import { getPublicAuthor } from "./read";
import { requireAccountOwner, requireHandle } from "./guards";
import { withStore } from "./store";
import { actorFrom, readJsonObject, withAccountErrors } from "./http";
import { accountRecordOf, publicAuthorOf } from "./records";
import { shapeProfilePatch } from "./write";
import {
  isValidAvatarHue,
  isValidBio,
  isValidDisplayName,
  isValidEmail,
  isValidVisibility,
  normalizeEmail,
} from "./validate";

type AccountRow = typeof schema.account.$inferSelect;

const ROW: AccountRow = {
  id: "11111111-1111-4111-8111-111111111111",
  githubId: "42",
  githubLogin: "mara",
  handle: "mara-veil",
  displayName: "Mara Veiga",
  email: "mara@veiga.dev",
  bio: null,
  avatarHue: 210,
  validator: true,
  validatorSince: null,
  validatorWeight: "3.000",
  defaultVisibility: "private",
  notificationPreferences: {},
  createdAt: new Date("2026-02-11T00:00:00.000Z"),
  updatedAt: new Date("2026-02-11T00:00:00.000Z"),
};

describe("the free-text door refuses rather than repairs", () => {
  it("refuses a NUL and a lone surrogate in every free-text field", () => {
    expect(isValidDisplayName(nulInside("Mara"))).toBe(false);
    expect(isValidDisplayName(surrogateInside("Mara"))).toBe(false);
    expect(isValidBio(nulInside("hi"))).toBe(false);
    expect(isValidBio(surrogateInside("hi"))).toBe(false);
    expect(isValidEmail(nulInside("a@b.c"))).toBe(false);
    expect(isValidEmail(surrogateInside("a@b.c"))).toBe(false);
    /* Bare, not only inside a label: a trailing-byte check would miss one of the two. */
    expect(isValidDisplayName(NUL)).toBe(false);
    expect(isValidDisplayName(LONE_HIGH_SURROGATE)).toBe(false);
  });

  it("is not a blanket unicode ban", () => {
    /* The way this guard goes wrong quietly, and T010's adversary named it first: a
       refusal that catches every non-ASCII name passes every ill-formed test and
       destroys the field. */
    expect(isValidDisplayName("Mara Veiga")).toBe(true);
    expect(isValidDisplayName("Ólafur Þórðarson")).toBe(true);
    expect(isValidDisplayName("宮崎 駿")).toBe(true);
    expect(isValidDisplayName("مارا")).toBe(true);
    expect(isValidDisplayName("👩‍💻 builds things")).toBe(true);
  });
});

describe("length is counted in code points, not UTF-16 units", () => {
  /* The one class of input on which the two readings disagree, which is why it is
     asserted rather than described. Eighty emoji are eighty characters to the reader
     who typed them and 160 `.length` units. */
  const EIGHTY_EMOJI = "\u{1F600}".repeat(80);

  it("accepts 80 code points that are 160 UTF-16 units", () => {
    expect([...EIGHTY_EMOJI].length).toBe(80);
    expect(EIGHTY_EMOJI.length).toBe(160);
    expect(isValidDisplayName(EIGHTY_EMOJI)).toBe(true);
  });

  it("still refuses 81 of them, so the bound is a bound", () => {
    expect(isValidDisplayName("\u{1F600}".repeat(81))).toBe(false);
  });

  it("holds the same way for bio at 400", () => {
    expect(isValidBio("\u{1F600}".repeat(400))).toBe(true);
    expect(isValidBio("\u{1F600}".repeat(401))).toBe(false);
  });
});

describe("avatarHue is bounded and integral", () => {
  it("accepts the whole published range and its ends", () => {
    expect(isValidAvatarHue(0)).toBe(true);
    expect(isValidAvatarHue(360)).toBe(true);
    expect(isValidAvatarHue(null)).toBe(true);
  });

  it("refuses what would reach a smallint as 22003 or as a rounded value", () => {
    expect(isValidAvatarHue(-1)).toBe(false);
    expect(isValidAvatarHue(361)).toBe(false);
    expect(isValidAvatarHue(40000)).toBe(false);
    expect(isValidAvatarHue(12.5)).toBe(false);
    expect(isValidAvatarHue(Number.NaN)).toBe(false);
    expect(isValidAvatarHue(Number.POSITIVE_INFINITY)).toBe(false);
    /* The one an upper-bound-only check admits, which is why it is named separately. */
    expect(isValidAvatarHue(Number.NEGATIVE_INFINITY)).toBe(false);
  });
});

describe("every predicate is total over unknown, so a wrong type is a 400 and not a 500", () => {
  /* Each predicate gets the values that are the WRONG TYPE FOR IT, not one shared list.
     The shared list was this file's own first mistake and it is worth the comment: it
     put `5` through `isValidAvatarHue`, which is a legal hue, and reported a defect
     against correct code. A wrong-type set is a claim about the predicate, so it has to
     be built per predicate. */
  const NOT_A_STRING: readonly unknown[] = [5, true, {}, [], undefined, Symbol.iterator];
  const NOT_A_NUMBER: readonly unknown[] = ["5", true, {}, [], undefined, Symbol.iterator];

  it("narrows rather than throwing, for every field", () => {
    for (const value of NOT_A_STRING) {
      expect(isValidDisplayName(value)).toBe(false);
      expect(isValidBio(value)).toBe(false);
      expect(isValidEmail(value)).toBe(false);
      expect(isValidVisibility(value)).toBe(false);
    }
    for (const value of NOT_A_NUMBER) {
      expect(isValidAvatarHue(value)).toBe(false);
    }
  });

  it("refuses the two string literals visibility is NOT", () => {
    expect(isValidVisibility("public")).toBe(true);
    expect(isValidVisibility("private")).toBe(true);
    expect(isValidVisibility("Public")).toBe(false);
    expect(isValidVisibility("")).toBe(false);
  });
});

describe("email is non-empty after trimming, and unverified", () => {
  it("refuses empty and whitespace-only, accepts null", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
    expect(isValidEmail(null)).toBe(true);
  });

  it("asserts NO validity beyond that, which is the ruling", () => {
    /* If someone adds a regex later this reds, which is the point: D-50-12 rules the
       field unverified, so refusing an odd-looking address would refuse legal ones. */
    expect(isValidEmail("not-an-email")).toBe(true);
    expect(isValidEmail("a@b")).toBe(true);
  });

  it("stores the trimmed value it validated", () => {
    expect(normalizeEmail("  mara@veiga.dev  ")).toBe("mara@veiga.dev");
    expect(normalizeEmail(null)).toBe(null);
  });
});

describe("an absent optional value omits the key, on the wire and in the object", () => {
  it("omits bio and validatorSince rather than carrying them as null or undefined", () => {
    const author = publicAuthorOf(ROW);
    expect(Object.keys(author).sort()).toEqual(["avatarHue", "displayName", "handle", "validator"]);
    expect("bio" in author).toBe(false);

    const record = accountRecordOf(ROW);
    expect("validatorSince" in record).toBe(false);
  });

  it("agrees with what Response.json actually serialises", () => {
    /* The reason the distinction is load-bearing: `{ bio: undefined }` has the key in
       the object a unit test inspects and NOT in the body, so an object-level and a
       wire-level key-set assertion would disagree about one response. */
    const author = publicAuthorOf(ROW);
    const wire = JSON.parse(JSON.stringify(author)) as Record<string, unknown>;
    expect(Object.keys(wire).sort()).toEqual(Object.keys(author).sort());
  });

  it("carries the key when the value is present", () => {
    const author = publicAuthorOf({ ...ROW, bio: "Builds attractors." });
    expect(author.bio).toBe("Builds attractors.");
  });
});

describe("the profile patch is shaped before anything is written", () => {
  it("null clears, undefined does not, and absent does not", () => {
    /* The three readings of "the caller did not give me a string", and they are not
       interchangeable: `bio?: string | null` says `?` is absent and `| null` is clear.
       `undefined` is the first. The two differ by DATA LOSS rather than by taste — a
       later task spreading `{ bio: maybeUndefined }` would otherwise erase text nobody
       asked to erase — and `JSON.parse` produces no `undefined`, so no request can
       reach it and no route test would ever have caught it. */
    expect(shapeProfilePatch("updateProfile", { bio: null })).toEqual({ bio: null });
    expect(shapeProfilePatch("updateProfile", { bio: undefined })).toEqual({});
    expect(shapeProfilePatch("updateProfile", {})).toEqual({});
  });

  it("refuses the whole patch when any one field is invalid", () => {
    /* A module validating as it WROTE would store `displayName` and then refuse, and
       no assertion on a return value could see it. Observable here because the shaping
       is pure: it either yields every column or throws having yielded none. */
    expect(() =>
      shapeProfilePatch("updateProfile", { displayName: "Renamed", avatarHue: 40000 }),
    ).toThrow(InvalidProfileError);
  });

  it("passes a valid patch through whole", () => {
    expect(shapeProfilePatch("updateProfile", { displayName: "Mara", avatarHue: 210 })).toEqual({
      displayName: "Mara",
      avatarHue: 210,
    });
  });
});



describe("withStore: a decision is never sanitized into a fault", () => {
  /* This is the single most load-bearing pure function in the module and it had NO
     observer without Postgres. Everything downstream rests on it: D-50-08's 409 and
     400 both require T070's rejections to reach the route with their class intact, and
     the four `NotAccountOwnerError` throws that sit INSIDE a `withStore` survive only
     because this function lets them past. Break it and every one of them becomes a 500
     — while the module still looks correct, because the sanitized rendering it would
     produce is a legitimate rendering.

     Its failure mode is the one the previous falsification exposed: `AccountStoreError`
     carries the operation and nothing else, so a wrongly-sanitized decision is
     indistinguishable from a genuine fault by any assertion on the message. Observed
     here by CLASS instead, which is available precisely because the thing under test is
     the class-preserving step itself. */
  const raise = (err: unknown) => async (): Promise<never> => {
    throw err;
  };

  it("passes T070's two decisions through with their class intact", async () => {
    await expect(withStore("changeHandle", raise(new HandleTakenError("taken")))).rejects.toThrow(
      HandleTakenError,
    );
    await expect(withStore("changeHandle", raise(new InvalidNameError("bad")))).rejects.toThrow(
      InvalidNameError,
    );
  });

  it("passes this module's own rejections through", async () => {
    await expect(withStore("updateProfile", raise(new NotAccountOwnerError("no")))).rejects.toThrow(
      NotAccountOwnerError,
    );
    await expect(withStore("updateProfile", raise(new InvalidProfileError("no")))).rejects.toThrow(
      InvalidProfileError,
    );
  });

  it("does NOT re-wrap an already-sanitized NamingStoreError, which would rename the failing operation", async () => {
    /* The subtle one. `NamingStoreError` IS a fault, so re-wrapping it would look
       harmless — but its message already names `allocateHandle`, and re-wrapping would
       replace it with one naming `changeHandle`. The rendering would then name an
       operation that did not fail, which is the opposite of what the whitelist is for. */
    const original = new NamingStoreError("allocateHandle: the database call failed.");
    await expect(withStore("changeHandle", raise(original))).rejects.toThrow(
      "allocateHandle: the database call failed.",
    );
  });

  it("sanitizes anything else, keeping the driver error only as a cause", async () => {
    const driver = new Error("insert into \"account\" (github_id) values ($1) -- mara@veiga.dev");
    await expect(withStore("setEmail", raise(driver))).rejects.toThrow(
      "setEmail: the account store failed.",
    );
    /* AC2 through the fault path: the bound parameter on `setEmail` IS the email. */
    const caught = await withStore("setEmail", raise(driver)).catch((e: unknown) => e as Error);
    expect(caught.message).not.toContain("veiga.dev");
    expect(caught.cause).toBe(driver);
  });

  it("returns the value untouched when nothing throws", async () => {
    expect(await withStore("getAccount", async () => "ok")).toBe("ok");
  });
});


describe("D-50-18: a recognised, sanitized fault answers problem+json 500", () => {
  const request = new Request("https://darkprint.io/api/account");
  const raise = (err: unknown) => async (): Promise<never> => {
    throw err;
  };

  it("maps AccountStoreError to 500 with the published type and its own message", async () => {
    const response = await withAccountErrors(
      request,
      raise(new AccountStoreError("getAccount: the account store failed.")),
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = (await response.json()) as { type: string; detail: string };
    expect(body.type).toBe("https://darkprint.io/problems/store-failed");
    expect(body.detail).toBe("getAccount: the account store failed.");
  });

  it("WITNESSES THE CLASS, not only the status: an identical message on a bare Error re-throws", async () => {
    /* The whole reason this test exists. `AccountStoreError`'s class identity is
       observed by nothing else in the tree — no assertion could tell it from a bare
       `Error` carrying the same string — and D-50-18 makes a route BRANCH on that
       class, which promotes an unobserved property into a load-bearing one without
       making it observable. Until this, *"the route answers 500"* and *"the route
       answers 500 FOR THIS CLASS"* were the same green.

       Held apart here by outcome rather than by inspection: same message, one is a
       500 and the other leaves. Reversing the two arms reds this and nothing else. */
    const message = "getAccount: the account store failed.";
    expect((await withAccountErrors(request, raise(new AccountStoreError(message)))).status).toBe(500);
    await expect(withAccountErrors(request, raise(new Error(message)))).rejects.toThrow(message);
  });

  it("still re-throws what it does not recognise, which is what that arm is FOR", async () => {
    await expect(withAccountErrors(request, raise(new TypeError("a bug")))).rejects.toThrow(TypeError);
  });
});

describe("D-50-18 at the transport, against a database that cannot answer", () => {
  /* The cheapest assertion in this task and it needs neither a live database nor the
     gate slot: point the shared client at a CLOSED PORT and drive the route. A correct
     door ruling had put the sanitizer's whole fault path out of reach of anything short
     of a real outage; this puts it back, at the transport, for the cost of a refused
     TCP connection. */
  const SECRET = "t050-transport-secret";
  const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
  type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

  let dead: DbClient;
  let previous: DbClient | undefined;
  let previousSecret: string | undefined;

  beforeAll(() => {
    previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SECRET;
    /* Port 1 has nothing listening, so every query fails at connect with ECONNREFUSED —
       a genuine driver failure rather than a thrown stub. */
    dead = createDbClient("postgres://nobody:nobody@127.0.0.1:1/nothing");
    const withShared = globalThis as GlobalWithSharedClient;
    previous = withShared[SHARED_CLIENT_KEY];
    withShared[SHARED_CLIENT_KEY] = dead;
  });

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previous;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
    await dead.close();
  });

  it("GET /api/account answers problem+json 500, not Next's generic one", async () => {
    /* The route the ruling was implemented too narrowly to reach the first time: it had
       no error boundary at all, so fixing only the wrapper left this one throwing. */
    const signed = new Request("https://darkprint.io/api/account", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeSession({ accountId: "11111111-1111-4111-8111-111111111111", handle: "mara-veil" }, SECRET)}`,
      },
    });
    const response = await getAccountRoute(signed);
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = (await response.json()) as { type: string; detail: string };
    expect(body.type).toBe("https://darkprint.io/problems/store-failed");
    expect(body.detail).toBe("getAccount: the account store failed.");
  });

  it("and the body carries no connection string, host, port or SQLSTATE", async () => {
    /* AC2's fault path through a REAL driver error rather than a synthetic one: the
       `cause` here is whatever `pg` raises for a refused connection, and none of it
       may reach the rendering. */
    const signed = new Request("https://darkprint.io/api/account", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeSession({ accountId: "11111111-1111-4111-8111-111111111111", handle: "mara-veil" }, SECRET)}`,
      },
    });
    const raw = await (await getAccountRoute(signed)).text();
    for (const tell of ["nobody", "127.0.0.1", "nothing", "ECONNREFUSED", "connect", "postgres://"]) {
      expect(raw).not.toContain(tell);
    }
  });
});

describe("the barrel has two front doors and only one of them is parsed", () => {
  /* Every case here is unreachable through HTTP and reachable by the twelve tasks that
     call this module in-process. `JSON.parse` produces no `undefined`, no `null` where
     an object is typed, and the routes check what they must — so "a request cannot send
     that" is an argument about the ROUTE and says nothing about the BARREL.

     Each is driven through `untouchable()`, which is the assertion underneath the
     assertion and is NOT decoration. Falsifying the first of these against a plain
     `{} as Db` reddened **zero**: with the door removed, `db.insert` threw a
     `TypeError` that `upsertFromGitHub`'s own catch-all wrapped into the same
     `AccountStoreError` with the same message, so the test passed for the opposite
     reason. Asserting the class and the message cannot tell "refused at the door" from
     "the driver blew up and got sanitized" — only "no connection was opened" can. */
  const alice = { kind: "account", accountId: "alice", handle: "alice" } as const;

  /** A `Db` that records any access and refuses it, so reaching the store is observable. */
  function untouchable(): { db: Db; touched: () => boolean } {
    let seen = false;
    const db = new Proxy(
      {},
      {
        get(_target, property) {
          seen = true;
          throw new Error(`the store was reached: db.${String(property)}`);
        },
      },
    ) as Db;
    return { db, touched: () => seen };
  }

  it("D-50-17: an empty githubId is refused rather than stored as a colliding identity", async () => {
    /* `NOT NULL` is satisfied by `""`, and two empty ids collide on
       `account_github_id_key` as ONE identity — AC6 read backwards. */
    const { db, touched } = untouchable();
    await expect(upsertFromGitHub(db, { githubId: "", githubLogin: "x" })).rejects.toThrow(
      "upsertFromGitHub: the account store failed.",
    );
    expect(touched()).toBe(false);
  });

  it("a non-string handle is a refusal, not a TypeError out of T070's grammar", async () => {
    /* `isNameSegment` reads `.length` off its argument: total for a string, a
       `TypeError` for `null` — a 500 for what is plainly a caller's mistake. */
    const { db, touched } = untouchable();
    await expect(changeHandle(db, alice, "alice", null as unknown as string)).rejects.toThrow(
      InvalidProfileError,
    );
    expect(touched()).toBe(false);
  });

  it("getPublicAuthor answers undefined for a non-string rather than throwing", async () => {
    const { db, touched } = untouchable();
    expect(await getPublicAuthor(db, null as unknown as string)).toBeUndefined();
    expect(await getPublicAuthor(db, 5 as unknown as string)).toBeUndefined();
    expect(touched()).toBe(false);
  });

  it("a patch that is not an object asked for no columns", () => {
    expect(shapeProfilePatch("updateProfile", null as unknown as Record<string, never>)).toEqual({});
  });
});

describe("AC2 is satisfied by the type, not by a filter", () => {
  it("PublicAuthor has no email key at any value of the row", () => {
    for (const email of ["mara@veiga.dev", null]) {
      const author = publicAuthorOf({ ...ROW, email });
      expect(Object.keys(author)).not.toContain("email");
      expect(JSON.stringify(author)).not.toContain("veiga.dev");
    }
  });
});

describe("validatorWeight crosses the numeric boundary as a number", () => {
  it("converts the string pg returns, keeping the fractional part", () => {
    expect(accountRecordOf(ROW).validatorWeight).toBe(3);
    expect(accountRecordOf({ ...ROW, validatorWeight: "1.005" }).validatorWeight).toBe(1.005);
    /* An integer reading passes the first and silently loses the second. */
    expect(accountRecordOf({ ...ROW, validatorWeight: "1.000" }).validatorWeight).toBe(1);
  });
});

describe("the two writer guards", () => {
  const alice = { kind: "account", accountId: "alice", handle: "alice" } as const;
  const handleless = { kind: "account", accountId: "alice", handle: null } as const;

  it("refuses a stranger with the published form and names no account", () => {
    expect(() => requireAccountOwner("updateProfile", alice, "bob")).toThrow(NotAccountOwnerError);
    try {
      requireAccountOwner("updateProfile", alice, "bob");
      expect.unreachable("requireAccountOwner accepted a stranger");
    } catch (err) {
      expect((err as Error).message).toBe("updateProfile: not this account's owner.");
    }
  });

  it("refuses an unfinished sign-up, and lets a finished one through", () => {
    expect(() => requireHandle("setEmail", handleless)).toThrow(HandleRequiredError);
    expect(() => requireHandle("setEmail", alice)).not.toThrow();
  });

  it("does not read an operator's missing handle as an unfinished sign-up", () => {
    /* Unreachable today — no route can mint an operator — and correct on the day one
       can: an operator is not signing up, and a missing field is not a null one. */
    expect(() => requireHandle("setEmail", { kind: "operator", accountId: "ops" })).not.toThrow();
  });
});

describe("the transport boundary maps four rejections and re-throws everything else", () => {
  const request = new Request("https://darkprint.io/api/account/handle", { method: "PATCH" });
  const raising = (err: unknown) => async (): Promise<Response> => {
    throw err;
  };

  it("maps HandleRequiredError to a 403 whose type is distinguishable", async () => {
    const response = await withAccountErrors(request, raising(new HandleRequiredError("op: this account has no handle yet.")));
    expect(response.status).toBe(403);
    const body = (await response.json()) as { type: string };
    expect(body.type).toBe("https://darkprint.io/problems/handle-required");
  });

  it("maps InvalidProfileError to 400 and HandleTakenError to 409", async () => {
    const bad = await withAccountErrors(request, raising(new InvalidProfileError("op: `bio` is not valid.")));
    expect(bad.status).toBe(400);
    const taken = await withAccountErrors(request, raising(new HandleTakenError("allocateHandle: the handle `x` is not available.")));
    expect(taken.status).toBe(409);
  });

  it("passes T070's message through unaltered, so each message keeps one author", async () => {
    const message = "allocateHandle: the handle `mara-veil` is not available.";
    const response = await withAccountErrors(request, raising(new HandleTakenError(message)));
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toBe(message);
  });

  it("maps InvalidNameError to 400 with its own message", async () => {
    const message = "allocateHandle: `Not A Handle` is not a valid handle.";
    const response = await withAccountErrors(request, raising(new InvalidNameError(message)));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { detail: string }).detail).toBe(message);
  });

  it("re-throws what it does not recognise rather than defaulting into a status", async () => {
    await expect(withAccountErrors(request, raising(new NotAccountOwnerError("op: not this account's owner.")))).rejects.toThrow(
      NotAccountOwnerError,
    );
    await expect(withAccountErrors(request, raising(new Error("something else")))).rejects.toThrow("something else");
  });
});

describe("the body reader answers undefined for everything that is not an object", () => {
  const post = (body: string): Request =>
    new Request("https://darkprint.io/api/account/email", { method: "PATCH", body });

  it("refuses malformed JSON, an array, null and a bare literal", async () => {
    expect(await readJsonObject(post("{"))).toBeUndefined();
    expect(await readJsonObject(post("[1,2]"))).toBeUndefined();
    expect(await readJsonObject(post("null"))).toBeUndefined();
    expect(await readJsonObject(post('"handle"'))).toBeUndefined();
  });

  it("accepts an object", async () => {
    expect(await readJsonObject(post('{"email":"a@b.c"}'))).toEqual({ email: "a@b.c" });
  });
});

describe("actorFrom is always an account, which is why the operator grant is unreachable", () => {
  it("carries the session's own handle, null included", () => {
    expect(actorFrom({ accountId: "alice", handle: null })).toEqual({
      kind: "account",
      accountId: "alice",
      handle: null,
    });
  });
});
