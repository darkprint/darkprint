/* ============================================================
   AC1: *an over-limit request returns 429 naming the limit and
   the reset*, as `problem+json` (B-03).

   And the clause the block adds to it, which is the one worth
   instrumenting: **never the caller's identity, key id or IP — a
   rendering that names the subject makes the refusal itself an
   identity oracle.**

   That is asserted by deriving the deny set from what the CALLER
   SUPPLIED rather than by scanning for words somebody listed. A
   blacklist of five named things is a site list one level down,
   and it cannot see the sixth. Every identifier handed to
   `enforceLimit` here is a distinctive literal, and the assertion
   is that none of them survives into any rendering of the
   response — body, headers and status line.

   Nothing here needs a database.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { enforceLimit } from "./check";
import type { LimitConfig } from "./config";
import type { LimitSubject, ResolvedKey } from "./types";
import { createSlotCounter } from "./counter";
import { LimitsStoreError, RateLimitedError, invalidLabelError, limitsStoreError } from "./errors";
import { armsNotDisjoint, rateLimited, readJsonObject, withLimitsErrors } from "./http";

const CONFIG: LimitConfig = {
  read: {
    anonymous: { limit: 1, windowMs: 60_000 },
    account: { limit: 1, windowMs: 60_000 },
    key: { limit: 1, windowMs: 60_000 },
  },
};

/**
 * A keyed subject, every string a distinctive literal so a leak of any of them is
 * unmistakable — INCLUDING the ones inside the record (T231).
 *
 * `label` carries one too. It is caller data the account chose, it travels into the subject
 * now that the subject carries a whole `ResolvedKey`, and a refusal that echoed it would be
 * the same leak as one echoing a `keyId`.
 *
 * The cast is how a colocated test holds what only `resolveKey` can produce; see
 * `check.test.ts` for the cells that measure that no other file can.
 */
const KEY: ResolvedKey = {
  keyId: "KEYIDLITERAL-5555-4555-8555-555555555555",
  accountId: "ACCOUNTLITERAL-4444-4444-8444-444444444444",
  label: "LABELLITERAL-8888-4888-8888-888888888888",
  createdAt: new Date(1_000_000),
  revokedAt: null,
} as ResolvedKey;

const SUBJECT: LimitSubject = { tier: "key", key: KEY, ip: "198.51.100.203" };

/**
 * Every string a caller supplied, flattened one level out of the subject.
 *
 * **A strengthening rather than a repair, and it was found in the instrument.** The deny set
 * used to be `Object.values(SUBJECT)`, which was total while the subject was three strings.
 * Under the union a keyed subject's values are a string and an OBJECT, so `keyId`,
 * `accountId` and `label` would have dropped out of the deny set silently and the scan would
 * have read as coverage while covering less.
 *
 * Strings only, and that is deliberate rather than convenient: `revokedAt` is `null` and
 * `createdAt` is a `Date`, and neither has a rendering a caller could recognise as its own —
 * where `String(null)` would false-red against any JSON body carrying a null.
 *
 * **`tier` is excluded and it is the one exclusion here.** It is the union's discriminant
 * rather than anything a caller chose, and its value for the case that matters is the
 * literal `"key"` — which D-230-09 publishes inside the refusal on purpose, as
 * `keysAvailable`. Scanning it would red every keyed refusal against the member T220's AC6
 * requires to be there. Named rather than filtered by length or by shape, so a future member
 * does not fall out of the deny set by resembling this one.
 *
 * The brand leaves no trace here: it is a `declare const unique symbol`, ambient and erased,
 * so there is no property for this walk to find or to trip over.
 */
function suppliedStrings(subject: LimitSubject): readonly string[] {
  const out: string[] = [];
  for (const [member, value] of Object.entries(subject)) {
    if (member === "tier") continue;
    if (typeof value === "string") out.push(value);
    else if (value !== null && typeof value === "object") {
      for (const inner of Object.values(value as unknown as Record<string, unknown>)) {
        if (typeof inner === "string") out.push(inner);
      }
    }
  }
  return out;
}

const request = () => new Request("https://darkprint.io/api/blueprints");

describe("the arms are pairwise disjoint, so arm order cannot change an answer", () => {
  it("no mapped class is a subtype of another", () => {
    /* Beside the wrapper rather than only here, because it is a claim the code makes about
       ITSELF: `http.ts`'s header says a base-class arm would make order load-bearing, and
       this is what stops that sentence being a preference that reads as a guarantee. */
    expect(armsNotDisjoint()).toEqual([]);
  });
});

describe("D-230-09: the 429 carries exactly the published key set", () => {
  const VERDICT = {
    allowed: false,
    limit: 60,
    remaining: 0,
    resetAt: new Date("2026-08-20T09:30:00.000Z"),
    windowMs: 60_000,
  };

  it("the member set is EXACTLY the nine published names", async () => {
    /* The SET, not the members. T081's key-set whitelist is the only instrument in this run
       that caught an extension member carrying a driver value after `type`, `title` and
       `detail` were all pinned — a `sqlstate` on the document passes every other assertion.
       An equality here reds on a ninth member nobody enumerated, which is the whole reason
       D-230-09 publishes the set rather than a list of things that must be present. */
    const body = (await rateLimited(request(), VERDICT, "read").json()) as object;
    expect(Object.keys(body).sort()).toEqual([
      "detail",
      "instance",
      "keysAvailable",
      "limit",
      "remaining",
      "resetAt",
      "status",
      "title",
      "type",
    ]);
  });

  it("the verdict's numbers are machine-readable rather than only in the sentence", () => {
    /* AC1 is satisfied by the sentence; T220's client parses the members. A regex over
       `detail` is not a machine-readable member, which is what D-230-09 overturned. */
    return rateLimited(request(), VERDICT, "read")
      .json()
      .then((body: unknown) => {
        expect(body).toMatchObject({
          limit: 60,
          remaining: 0,
          resetAt: "2026-08-20T09:30:00.000Z",
          keysAvailable: true,
        });
      });
  });

  it("keysAvailable says nothing about this caller", async () => {
    /* T220 AC6 needs the refusal to tell an MCP client that a key would raise the ceiling. A
       value that varied with whether THIS caller holds one would be the identity oracle the
       block forbids, so it is a fact about the product. Driven at both tiers to show it does
       not move. */
    const anon = (await rateLimited(request(), VERDICT, "read").json()) as {
      keysAvailable: unknown;
    };
    const keyed = (await rateLimited(request(), { ...VERDICT, limit: 6000 }, "read").json()) as {
      keysAvailable: unknown;
    };
    expect(anon.keysAvailable).toBe(true);
    expect(keyed.keysAvailable).toBe(true);
  });

  it("detail is the admissible form byte for byte", async () => {
    const body = (await rateLimited(request(), VERDICT, "read").json()) as {
      detail: string;
    };
    /* A LITERAL. An expectation built from the module asserts the module agrees with itself. */
    expect(body.detail).toBe(
      "read: limit of 60 per minute reached; resets at 2026-08-20T09:30:00.000Z.",
    );
  });

  it("is a problem+json 429 at the request's own path", async () => {
    const response = rateLimited(request(), VERDICT, "read");
    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(((await response.json()) as { instance: string }).instance).toBe("/api/blueprints");
  });

  it("the window it renders is the verdict's own, so no caller can pass a disagreeing one", async () => {
    /* D-230-10's whole content, driven. The withdrawn shape took `windowMs` as a fourth
       parameter with `windowFor` published to fetch it, and both spellings refuse to compile
       when the number is absent — so compile-time safety separates nothing. What separates
       them is that a fetched window can DISAGREE with the verdict being rendered, and an
       exact-matched form would then be confidently wrong with nothing comparing the operands.
       Under the carried field the two cannot differ, and this is the measurement of that:
       changing only `windowMs` on the verdict moves the sentence. */
    const hourly = (await rateLimited(request(), { ...VERDICT, windowMs: 3_600_000 }, "read").json()) as {
      detail: string;
    };
    expect(hourly.detail).toBe(
      "read: limit of 60 per hour reached; resets at 2026-08-20T09:30:00.000Z.",
    );
  });

  it("carries no retry-after header, and no header this module chose", async () => {
    /* Declined deliberately rather than forgotten. Every leak instrument on a problem+json
       route in this run is scoped to the problem DOCUMENT — T081's F1 measured that a driver
       value on a response header reddens nothing, blind or colocated. A second rendering of
       `resetAt` on the one surface nothing reads is how the first stops being the whole
       answer, and the document already carries the instant as a published member. */
    const response = rateLimited(request(), VERDICT, "read");
    expect(response.headers.get("retry-after")).toBeNull();
    expect([...response.headers.keys()].sort()).toEqual(["content-type"]);
  });
});

describe("AC1: the refusal is a problem+json 429", () => {
  async function refusal(): Promise<Response> {
    const counter = createSlotCounter({ slots: 64, seed: 1, now: () => 1_000_000 });
    return withLimitsErrors(request(), async () => {
      await enforceLimit(SUBJECT, "read", { config: CONFIG, counter });
      await enforceLimit(SUBJECT, "read", { config: CONFIG, counter });
      return new Response("unreachable");
    });
  }

  it("answers 429 with the problem media type", async () => {
    const response = await refusal();
    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
  });

  it("names the limit and the reset", async () => {
    const body = (await (await refusal()).json()) as Record<string, unknown>;
    /* Written out as a literal rather than built from the module. An expectation constructed
       from the subject asserts that the subject agrees with itself. */
    expect(body.detail).toBe("read: limit of 1 per minute reached; resets at 1970-01-01T00:17:40.000Z.");
    expect(body.status).toBe(429);
    expect(body.title).toBe("Rate limited");
    expect(body.type).toBe("https://darkprint.io/problems/rate-limited");
    expect(body.instance).toBe("/api/blueprints");
  });

  it("the wrapper's 429 and rateLimited's are the same document", async () => {
    /* ONE author for the 429, whichever composition a caller chose — `checkLimit` then
       `rateLimited`, or `enforceLimit` and the wrapper's arm. Two constructors for one
       document is two chances for one of them to drift off the published key set, and an
       assertion on each separately could not see the drift. This compares them. */
    const direct = await rateLimited(
      request(),
      { allowed: false, limit: 1, remaining: 0, resetAt: new Date(1_060_000), windowMs: 60_000 },
      "read",
    ).text();
    expect(await (await refusal()).text()).toBe(direct);
  });

  it("re-throws a RateLimitedError this module did not build", async () => {
    /* A context-less instance is reachable: `tests/error-hygiene.test.ts` constructs every
       published class directly. The wrapper does not know its numbers, so it cannot render
       the published key set — and a document with holes in it would satisfy every assertion
       that checks members are PRESENT while failing the one that checks the set. Re-thrown
       instead, through the arm reserved for what this wrapper does not recognise. */
    const bare = new RateLimitedError("read: limit of 1 per minute reached; resets at X.");
    await expect(
      withLimitsErrors(request(), async () => {
        throw bare;
      }),
    ).rejects.toBe(bare);
  });
});

describe("F-230-M: an unconfigured bucket's 429 does not invite a hot loop", () => {
  /* The defect driven the way it reaches a caller — `enforceLimit` -> `withLimitsErrors` ->
     the published document — rather than at the verdict, which `check.test.ts` holds. These
     are about what a CLIENT parses, which is where the epoch did its damage: the sentence
     read plausibly and the machine-readable member said "come back now".

     Nothing here is outside D-230-09's published key set. The set is exactly nine members and
     T081's whitelist is asserted against it, so the fix moves two values that were already
     members rather than adding a tenth to make the refusal loud. */
  async function refusal(): Promise<Response> {
    const counter = createSlotCounter({ slots: 64, seed: 1, now: () => 1_000_000 });
    return withLimitsErrors(request(), async () => {
      /* A bucket absent from CONFIG. This is the shape the defect is actually reached
         through: the next task to wire a route mistypes `reads` for `read`. */
      await enforceLimit(SUBJECT, "nobody-sized-this", { config: CONFIG, counter });
      return new Response("unreachable");
    });
  }

  it("answers 429 rather than passing the request", async () => {
    expect((await refusal()).status).toBe(429);
  });

  it("resetAt is in the future, so a client computing a wait gets a positive one", async () => {
    const body = (await (await refusal()).json()) as Record<string, unknown>;
    const wait = Date.parse(body.resetAt as string) - Date.now();
    expect(wait).toBeGreaterThan(0);
  });

  it("detail is the admissible form, says no `per 0ms`, and names the member's own instant", async () => {
    const body = (await (await refusal()).json()) as Record<string, unknown>;
    /* Written out as the form rather than assembled from the module, with only the instant
       read off the DOCUMENT — a literal for that would be a literal for `Date.now()`. Reading
       it from `resetAt` is not the subject agreeing with itself: it is the assertion that the
       sentence and the machine-readable member name the SAME instant, which is the one
       cross-check the epoch satisfied while both were wrong.

       The negative is redundant against the equality above and is kept, because it is the
       charge in F-230-M's own words and a reader looking for it should find it asserted. */
    expect(body.detail).not.toContain("per 0ms");
    expect(body.detail).toBe(
      `nobody-sized-this: limit of 0 per 365 days reached; resets at ${body.resetAt as string}.`,
    );
  });

  it("carries exactly the published nine members, loud or not", async () => {
    /* The refusal being made loud must not have been paid for with a tenth member. */
    const body = (await (await refusal()).json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "detail",
      "instance",
      "keysAvailable",
      "limit",
      "remaining",
      "resetAt",
      "status",
      "title",
      "type",
    ]);
  });
});

describe("the refusal names no subject", () => {
  it("no identifier the caller supplied survives into any rendering", async () => {
    const counter = createSlotCounter({ slots: 64, seed: 1, now: () => 1_000_000 });
    const response = await withLimitsErrors(request(), async () => {
      await enforceLimit(SUBJECT, "read", { config: CONFIG, counter });
      await enforceLimit(SUBJECT, "read", { config: CONFIG, counter });
      return new Response("unreachable");
    });

    /* The deny set is DERIVED from what the caller supplied rather than hand-listed, so a
       sixth identifier nobody enumerated is covered the day somebody adds one to
       `LimitSubject` or to the record it carries. See `suppliedStrings` for why it walks one
       level in, and for the two members it deliberately does not scan. */
    const supplied = suppliedStrings(SUBJECT);
    /* Anti-vacuity: a walk that found nothing would satisfy every `not.toContain` below for
       every possible response. Four strings — the ip, and the record's keyId, accountId and
       label — and the equality reds if the subject grows a fifth nobody scanned. */
    expect(supplied).toHaveLength(4);
    const rendered = [
      await response.clone().text(),
      JSON.stringify([...response.headers]),
      String(response.status),
    ].join(" ");

    for (const value of supplied) {
      expect(rendered, `subject value ${value} reached a rendering`).not.toContain(value);
    }
  });

  it("two different subjects refused on one bucket and window render identically", async () => {
    /* The stronger claim, and the one that says "oracle" rather than "leak": if the two
       renderings differ at all, the difference is a channel, whatever it happens to carry.
       An assertion that named the three fields would miss a fourth; an equality cannot. */
    async function refusalFor(subject: LimitSubject): Promise<string> {
      const counter = createSlotCounter({ slots: 64, seed: 1, now: () => 1_000_000 });
      const response = await withLimitsErrors(request(), async () => {
        await enforceLimit(subject, "read", { config: CONFIG, counter });
        await enforceLimit(subject, "read", { config: CONFIG, counter });
        return new Response("unreachable");
      });
      return await response.text();
    }

    const first = await refusalFor(SUBJECT);
    const second = await refusalFor({
      tier: "key",
      key: {
        keyId: "OTHERKEY-7777-4777-8777-777777777777",
        accountId: "DIFFERENT-6666-4666-8666-666666666666",
        label: "OTHERLABEL-9999-4999-8999-999999999999",
        createdAt: new Date(2_000_000),
        revokedAt: null,
      } as ResolvedKey,
      ip: "203.0.113.99",
    });
    expect(first).toBe(second);
  });
});

describe("the other two arms", () => {
  it("an invalid label is a 400 carrying the rejection's own message", async () => {
    const response = await withLimitsErrors(request(), async () => {
      throw invalidLabelError("issueKey", "label");
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { detail: string }).detail).toBe(
      "issueKey: `label` is not valid.",
    );
  });

  it("a store fault is a problem+json 500 rather than a re-throw", async () => {
    /* D-50-18: throwing produces a 500 too — Next's own generic one, outside the envelope
       every other failure on the route uses and unobservable to anything driving the handler
       directly. The re-throw arm is for what this wrapper does NOT recognise. */
    const response = await withLimitsErrors(request(), async () => {
      throw limitsStoreError("resolveKey", new Error("select * from api_key where token_hash = $1"));
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toBe("resolveKey: the limits store failed.");
    /* D-13: the statement travels on `cause` and reaches no rendering. */
    expect(body.detail).not.toContain("select");
    expect(body.detail).not.toContain("token_hash");
  });

  it("re-throws what it does not recognise", async () => {
    /* A bug dressed up as a known condition is how one stops being noticed. */
    const bug = new TypeError("db.select is not a function");
    await expect(
      withLimitsErrors(request(), async () => {
        throw bug;
      }),
    ).rejects.toBe(bug);
  });

  it("does not answer for NotKeyOwnerError, which has no arm on purpose", async () => {
    /* No route can produce one — both routes pass `session.accountId`, so `can` compares an
       id against itself. Giving it a status would publish a code the contract does not list
       for a case that cannot arise. Asserted so the absence is a decision rather than a
       hole somebody fills later without noticing. */
    const { notKeyOwnerError } = await import("./errors");
    const err = notKeyOwnerError("issueKey");
    await expect(
      withLimitsErrors(request(), async () => {
        throw err;
      }),
    ).rejects.toBe(err);
  });
});

describe("the store fault class is recognised by identity, not by shape", () => {
  it("a plain Error carrying the same message is re-thrown", async () => {
    /* Removal changes WHETHER a caller gets an error; substitution changes WHICH one, and
       only the second measures identity. A wrapper matching on the message would answer 500
       here, and this is what separates the two. */
    const impostor = new Error("resolveKey: the limits store failed.");
    await expect(
      withLimitsErrors(request(), async () => {
        throw impostor;
      }),
    ).rejects.toBe(impostor);
    expect(impostor).not.toBeInstanceOf(LimitsStoreError);
  });
});

describe("readJsonObject", () => {
  it("answers undefined for anything that is not a JSON object", async () => {
    for (const body of ["not json", "[]", "null", '"a string"', "7"]) {
      const req = new Request("https://darkprint.io/api/account/keys", { method: "POST", body });
      expect(await readJsonObject(req), body).toBeUndefined();
    }
  });

  it("answers the object for a JSON object", async () => {
    const req = new Request("https://darkprint.io/api/account/keys", {
      method: "POST",
      body: JSON.stringify({ label: "CI" }),
    });
    expect(await readJsonObject(req)).toEqual({ label: "CI" });
  });

  it("never renders the parse error, which would quote the input", async () => {
    const req = new Request("https://darkprint.io/api/account/keys", {
      method: "POST",
      body: "{ secret-looking-garbage",
    });
    await expect(readJsonObject(req)).resolves.toBeUndefined();
  });
});
