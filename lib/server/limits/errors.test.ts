/* ============================================================
   D-13's hygiene clause, held HERE as well as by
   `tests/error-hygiene.test.ts`, and the duplication is
   deliberate rather than an oversight.

   A repo-wide check and a module-local suite are blind in
   opposite directions. The repo-wide one builds its domain by
   construction and can therefore assert only what it can compute
   from the domain — which is exactly the part of a clause that
   generalises, and exactly not the part that was amended in
   because somebody found a way to satisfy the rest while
   defeating it.

   And there is a second, sharper reason on this task, measured
   rather than assumed: **`tests/error-hygiene.test.ts`'s domain
   is `git ls-tree -d --name-only backend lib/server/`, the
   SHIPPED directories.** `lib/server/limits` is not among them
   until T230 merges, so these four classes are invisible to that
   guard in this worktree and its equality stays at 18 here. This
   file is the only thing measuring them before the merge — which
   is precisely when a defect in them is still cheap to fix.
   ============================================================ */

import { describe, expect, it } from "vitest";
import {
  InvalidLabelError,
  LimitsStoreError,
  NotKeyOwnerError,
  RateLimitedError,
  describeWindow,
  invalidLabelError,
  rateLimitContext,
  rateLimitDetail,
  limitsStoreError,
  notKeyOwnerError,
  rateLimitedError,
} from "./errors";

/** Every class the barrel publishes. `LimitsError`, the base, is deliberately not on it. */
const PUBLISHED = [
  ["RateLimitedError", RateLimitedError],
  ["InvalidLabelError", InvalidLabelError],
  ["NotKeyOwnerError", NotKeyOwnerError],
  ["LimitsStoreError", LimitsStoreError],
] as const;

/**
 * Two call shapes, because the own-property set can differ between them: an `Error` `cause`
 * is only installed when the option is passed, and a constructor that assigned a field
 * conditionally would satisfy the clause under one shape and violate it under the other.
 * The same two shapes `tests/error-hygiene.test.ts` uses, so a class that passes here
 * cannot red there for an arity this file did not try.
 */
const SHAPES: readonly (readonly unknown[])[] = [
  ["probe detail"],
  ["probe detail", { code: "23505", constraint: "api_key_token_hash_key" }],
];

describe("every published class satisfies D-13's four-part hygiene clause", () => {
  it("each renders as {} and keeps its stack, at every arity", () => {
    /* Offenders collected and asserted empty rather than one `it` per class, so a failure
       names EVERY class that is wrong instead of stopping at the first — which is the shape
       `tests/error-hygiene.test.ts` itself uses, and the reason is the same: the reader of a
       failure message is by construction someone who has just made a mistake. */
    const rendered: string[] = [];
    const traceless: string[] = [];
    for (const [name, Ctor] of PUBLISHED) {
      for (const args of SHAPES) {
        const instance = new (Ctor as unknown as new (...a: never[]) => Error)(
          ...(args as never[]),
        );
        const keys = Object.keys(instance);
        const json = JSON.stringify(instance);
        if (keys.length > 0 || json !== "{}") {
          rendered.push(`${name} @${args.length}: keys=${JSON.stringify(keys)} json=${json}`);
        }
        /* Retained, not deleted. The other three parts of the clause are all satisfiable by
           deleting `stack`, which is precisely the shape the amendment exists to prevent. */
        if (typeof instance.stack !== "string" || instance.stack === "") {
          traceless.push(`${name} @${args.length}`);
        }
      }
    }
    expect(rendered).toEqual([]);
    expect(traceless).toEqual([]);
  });

  it("each puts its name on the prototype, not on the instance", () => {
    const offenders: string[] = [];
    for (const [name, Ctor] of PUBLISHED) {
      const instance = new (Ctor as unknown as new (...a: never[]) => Error)(
        "probe detail" as never,
      );
      if (instance.name !== name) offenders.push(`${name} reports ${instance.name}`);
      /* `this.name =` in a constructor creates an own ENUMERABLE property, which is what puts
         a class name into `Object.keys` and breaks the clause above. This says WHERE it lives
         rather than only that the rendering is clean, so the two fail separately. */
      if (Object.getOwnPropertyDescriptor(instance, "name") !== undefined) {
        offenders.push(`${name} has an own \`name\``);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("a cause is present and non-enumerable when one is passed, and absent when not", () => {
    const withCause = limitsStoreError("resolveKey", new Error("driver"));
    const descriptor = Object.getOwnPropertyDescriptor(withCause, "cause");
    expect(descriptor?.enumerable).toBe(false);
    expect(descriptor?.value).toBeInstanceOf(Error);

    /* Presence and value are different questions, and `hasOwnProperty("cause")` cannot
       separate them: `new Error(m, { cause: undefined })` still INSTALLS the property,
       because the spec installs on `HasProperty` rather than on the value. So a check that a
       cause arrived would be a guard that cannot fail unless the no-cause path really passes
       no options bag — which is what this asserts. */
    expect(Object.getOwnPropertyDescriptor(notKeyOwnerError("revokeKey"), "cause")).toBeUndefined();
  });
});

describe("the rate-limit context is carried without becoming a rendering", () => {
  const RESET = new Date("2026-08-20T09:30:00.000Z");

  it("survives on the instance and reaches no enumerable surface", () => {
    const verdict = { allowed: false, limit: 60, remaining: 3, resetAt: RESET, windowMs: 60_000 };
    const err = rateLimitedError("read", verdict);
    expect(rateLimitContext(err)).toEqual({ bucket: "read", verdict });
    /* The reason it is a SYMBOL rather than a non-enumerable string key: `Object.keys`,
       `JSON.stringify` and a spread all skip symbol keys, so the hygiene clause holds by
       construction instead of by somebody remembering `enumerable: false` on a future field.
       All three are asserted, because they are three different renderings. */
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
    expect(Object.keys({ ...err })).toEqual([]);
  });

  it("is absent from an instance nobody built through the factory", () => {
    /* Reachable rather than defensive: `tests/error-hygiene.test.ts` constructs every
       published class directly at one and two arguments. A reader assuming a context would
       throw inside the guard that measures hygiene. */
    expect(rateLimitContext(new RateLimitedError("probe detail"))).toBeUndefined();
  });

  it("the message and the document are built from one author", () => {
    /* `rateLimitDetail` is the single author of the admissible form. An error's message and
       a rendered document that agreed by each building the sentence would be two authors
       agreeing today; this asserts they are one. */
    expect(
      rateLimitedError("read", {
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: RESET,
        windowMs: 60_000,
      }).message,
    ).toBe(rateLimitDetail("read", 60, 60_000, RESET));
  });
});

describe("the published message forms", () => {
  it("RateLimitedError carries the bucket, the number, the window and the instant", () => {
    expect(
      rateLimitedError("read", {
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: new Date("2026-08-20T09:30:00.000Z"),
        windowMs: 60_000,
      }).message,
    ).toBe("read: limit of 60 per minute reached; resets at 2026-08-20T09:30:00.000Z.");
  });

  it("the other three are the operation and nothing else", () => {
    expect(invalidLabelError("issueKey", "label").message).toBe("issueKey: `label` is not valid.");
    expect(notKeyOwnerError("revokeKey").message).toBe("revokeKey: not this account's keys.");
    expect(limitsStoreError("resolveKey", new Error("x")).message).toBe(
      "resolveKey: the limits store failed.",
    );
  });

  it("a store fault renders nothing the driver gave it", () => {
    /* The deny set is derived from the cause rather than hand-listed: every word the driver
       error carries must be absent from every rendering, except the scaffolding a bare
       `Error` contributes anyway. Deriving is what catches the seventh thing nobody
       enumerated. */
    const driver = new Error(
      'insert into "api_key" ("token_hash") values ($1) -- 23505 api_key_token_hash_key',
    );
    const err = limitsStoreError("issueKey", driver);
    const scaffolding = new Set(String(new Error("x")).split(/\W+/).filter(Boolean));
    const renderings = [err.message, String(err), JSON.stringify(err), JSON.stringify({ detail: err.message })];
    for (const word of driver.message.split(/\W+/).filter((w) => w.length > 2)) {
      if (scaffolding.has(word)) continue;
      for (const rendering of renderings) {
        expect(rendering, `${word} in ${rendering}`).not.toContain(word);
      }
    }
  });

  it("names the operation, which is the one thing it does carry", () => {
    /* The whitelist half. Asserting only the absences above would be satisfied by a message
       that said nothing at all, which is a rendering with no author rather than one with
       one. */
    expect(limitsStoreError("issueKey", new Error("x")).message).toContain("issueKey");
  });
});

describe("describeWindow is total", () => {
  it("renders the whole units and falls back to seconds", () => {
    expect(describeWindow(1000)).toBe("second");
    expect(describeWindow(90_000)).toBe("90 seconds");
    expect(describeWindow(60_000)).toBe("minute");
    expect(describeWindow(300_000)).toBe("5 minutes");
    expect(describeWindow(3_600_000)).toBe("hour");
    expect(describeWindow(7_200_000)).toBe("2 hours");
    expect(describeWindow(86_400_000)).toBe("day");
  });

  it("never renders undefined, for any window anybody could configure", () => {
    /* A lookup table would be a list, and a window nobody enumerated would render as
       `undefined` inside a refusal a caller reads. Every branch here ends in a seconds
       rendering, and this is the measurement of that rather than the claim. */
    for (const ms of [1, 7, 999, 1001, 45_000, 3_599_999, 1e9, Number.MAX_SAFE_INTEGER]) {
      const rendered = describeWindow(ms);
      expect(rendered, `windowMs=${ms}`).not.toContain("undefined");
      expect(rendered.length, `windowMs=${ms}`).toBeGreaterThan(0);
    }
  });

  it("renders a nonsensical window rather than throwing", () => {
    /* Reached only through a misconfiguration, and a refusal that throws while rendering a
       refusal is a 500 in place of a 429. */
    for (const ms of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => describeWindow(ms), `windowMs=${ms}`).not.toThrow();
    }
  });
});

describe("the refusal cannot be given a subject", () => {
  it("rateLimitedError's parameter list carries no identity", () => {
    /* Structural rather than behavioural, and stated as an arity check because that is what
       it is: a parameter that exists is a parameter somebody interpolates later. The block
       forbids the caller's identity, key id or IP in the rendering, and a factory that
       cannot be handed one cannot render one however it is edited. */
    expect(rateLimitedError).toHaveLength(2);
  });
});
