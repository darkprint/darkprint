/* ============================================================
   T231 AC4 and the must-not-move set

   AC4 is *"the 429's published key set (D-230-09) is unchanged"*,
   and around it sits a short list of things this task must leave
   exactly where they are. Every cell here is readable TODAY —
   none of them depends on D-231-01's new signature — so this file
   is the half of the suite whose green is a measurement rather
   than a prediction, and its reds after the merge are T231
   breaking something rather than T231 being unfinished.

   The domain is PARSED out of §T230 rather than typed here. A
   construction over an author's transcription of a spec is a list
   one level up, and AC4 says the document's set is unchanged — a
   set transcribed into this file would have this suite asserting
   that the document agrees with what this suite remembers of it.

   ── F-230-J, and the one cell that would have caught it ──
   Deleting `isNull(revokedAt)` from `resolveKey`'s WHERE scored
   **0 new failures across all 164 cells of both halves** while
   end-to-end a revoked key held 6 000 against 600. That line is
   the whole of AC4's *refused immediately* and nothing measured
   it. The cell below reds when it is deleted. It is a source
   assertion rather than a behavioural one — deliberately, because
   the behavioural form needs a scratch database and this run
   stands 28 of them awaiting the owner's ruling. A source cell
   that reds is worth more than a behavioural one that is not
   written, and its weakness is stated rather than hidden: it
   pins the CLAUSE, not the effect.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  moduleSource,
  parametersOf,
  publishedProblemMembers,
  withoutComments,
} from "./contract";

/** A URL is required so `instance` is a pathname rather than the whole href. */
function request(path = "/api/blueprints"): Request {
  return new Request(`https://darkprint.io${path}`);
}

/**
 * A verdict for a CONFIGURED bucket that has been spent. Built here rather than obtained by
 * driving `checkLimit`, because that call's signature is what T231 changes and this file is
 * the one that must stay readable across the change.
 */
const SPENT = {
  allowed: false,
  limit: 600,
  remaining: 0,
  resetAt: new Date("2026-08-22T15:00:00.000Z"),
  windowMs: 60 * 60 * 1000,
} as const;

/** F-230-M's number, transcribed: `365 * 24 * HOUR`. Not on the barrel, so it is written out. */
const UNCONFIGURED_BACKOFF_MS = 365 * 24 * 60 * 60 * 1000;

async function limits(): Promise<Record<string, unknown>> {
  return (await import("@/lib/server/limits")) as unknown as Record<string, unknown>;
}

describe("AC4 — the 429's published key set is exactly D-230-09's, and it is nine", () => {
  it("renders exactly the members §T230 publishes, no more and no fewer", async () => {
    const { members } = publishedProblemMembers();
    const mod = await limits();
    const rateLimited = mod.rateLimited as (r: Request, v: unknown, b: string) => Response;

    const body = (await rateLimited(request(), SPENT, "read").json()) as Record<string, unknown>;

    /* Sorted on both sides: the document writes them grouped by provenance and a renderer
       writes them in whatever order its object literal has, and neither order is contract. */
    expect(
      Object.keys(body).sort(),
      `The 429's key set has moved. T231's AC4 says it does not, and T081's whitelist is ` +
        `asserted against it — an extension member carrying a driver value after \`type\`, ` +
        `\`title\` and \`detail\` were all pinned is the one defect that whitelist has ever ` +
        `caught, which is why D-230-09 publishes the SET rather than the members.\n` +
        `  published: ${[...members].sort().join(", ")}\n` +
        `  rendered:  ${Object.keys(body).sort().join(", ")}`,
    ).toEqual([...members].sort());
  });

  it("is nine members, counted from the document rather than asserted from memory", () => {
    const { members } = publishedProblemMembers();
    /* The brief states nine. Derived here so the nine is the document's and not the brief's:
       a number recalled into an assertion is a number this suite wrote itself. */
    expect(
      members.length,
      `§T230's \`problem+json 429\` block parses to ${members.length} members: ` +
        `${members.join(", ")}. AC4 pins the set at what D-230-09 published, and this suite ` +
        `and the document now disagree about what that is.`,
    ).toBe(9);
    expect(new Set(members).size, `the published set has a duplicate member`).toBe(9);
  });

  it("pins `keysAvailable` to the value the document pins it to", async () => {
    const { pinned } = publishedProblemMembers();
    const mod = await limits();
    const rateLimited = mod.rateLimited as (r: Request, v: unknown, b: string) => Response;
    const body = (await rateLimited(request(), SPENT, "read").json()) as Record<string, unknown>;

    expect(
      Object.keys(pinned),
      `§T230 pins a literal value on exactly one member, \`keysAvailable: true\` — T220 AC6's ` +
        `affordance. The document now pins ${Object.keys(pinned).length}.`,
    ).toEqual(["keysAvailable"]);
    expect(String(body.keysAvailable)).toBe(pinned.keysAvailable);
  });

  it("answers 429 as `application/problem+json`", async () => {
    const mod = await limits();
    const rateLimited = mod.rateLimited as (r: Request, v: unknown, b: string) => Response;
    const response = rateLimited(request(), SPENT, "read");

    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
  });

  it("renders `detail` as the admissible form byte for byte", async () => {
    const mod = await limits();
    const rateLimited = mod.rateLimited as (r: Request, v: unknown, b: string) => Response;
    const body = (await rateLimited(request(), SPENT, "read").json()) as Record<string, unknown>;

    /* The form is written out rather than imported: a test that imports its expected message
       from the module under test asserts that the module agrees with itself, and passes
       unchanged the day the wording starts interpolating something it should not. */
    expect(
      body.detail,
      `D-230-09: "\`detail\` is the admissible form byte for byte." An admissible form is ` +
        `EXACT-MATCHED, which is its whole purpose.`,
    ).toBe("read: limit of 600 per hour reached; resets at 2026-08-22T15:00:00.000Z.");
  });
});

describe("F-230-M — an unconfigured bucket backs off for a year, and NOT to the epoch", () => {
  /*
   * The assertion EXCLUDES the bad output rather than admitting the good one. A cell whose
   * comment names the epoch while its assertion merely admits a plausible date reads as
   * coverage to everyone downstream: `toBeInstanceOf(Date)` admits `new Date(0)`.
   *
   * The old epoch behaviour is the DEFECT and not the baseline. `http.ts` declines a
   * `retry-after` deliberately, so `resetAt` is the entire recovery signal, and the Unix
   * epoch tells a correctly-implemented client to wait zero: it retries, is refused, and
   * loops at full request rate forever. The better-behaved the client, the tighter the loop.
   */
  const UNCONFIGURED = {
    allowed: false,
    limit: 0,
    remaining: 0,
    resetAt: new Date(Date.parse("2026-08-22T12:00:00.000Z") + UNCONFIGURED_BACKOFF_MS),
    windowMs: UNCONFIGURED_BACKOFF_MS,
  } as const;

  it("renders `limit of 0 per 365 days`, and never `per 0ms`", async () => {
    const mod = await limits();
    const rateLimited = mod.rateLimited as (r: Request, v: unknown, b: string) => Response;
    const body = (await rateLimited(request(), UNCONFIGURED, "search").json()) as Record<
      string,
      unknown
    >;
    const detail = String(body.detail);

    expect(
      detail.includes("per 0ms"),
      `the unconfigured refusal rendered \`per 0ms\` — F-230-M's sentinel surfacing inside ` +
        `the exact-matched form. detail: ${detail}`,
    ).toBe(false);
    expect(detail).toBe(
      "search: limit of 0 per 365 days reached; resets at 2027-08-22T12:00:00.000Z.",
    );
  });

  it("does not answer the Unix epoch as the machine-readable `resetAt`", async () => {
    const mod = await limits();
    const rateLimited = mod.rateLimited as (r: Request, v: unknown, b: string) => Response;
    const body = (await rateLimited(request(), UNCONFIGURED, "search").json()) as Record<
      string,
      unknown
    >;

    expect(
      body.resetAt,
      `\`resetAt\` came back as the Unix epoch, which is exactly the F-230-M defect: it is ` +
        `the entire recovery signal and it tells a client to retry immediately, forever.`,
    ).not.toBe(new Date(0).toISOString());
    expect(Date.parse(String(body.resetAt))).toBeGreaterThan(0);
  });

  it("renders a window `describeWindow` can name — the control that can fail", async () => {
    /*
     * The control for the two cells above: they would both pass against a renderer that
     * silently dropped the window, so this one drives a value the renderer must NOT be able
     * to describe from a table — 90 seconds is neither a day, an hour nor a minute — and
     * requires it to come out named rather than as `undefined`.
     */
    const mod = await limits();
    const rateLimited = mod.rateLimited as (r: Request, v: unknown, b: string) => Response;
    const odd = { ...UNCONFIGURED, limit: 5, windowMs: 90_000 };
    const body = (await rateLimited(request(), odd, "upload").json()) as Record<string, unknown>;

    expect(String(body.detail)).toContain("limit of 5 per 90 seconds reached");
  });
});

describe("the must-not-move set, read off the module's own source", () => {
  it("`resolveKey` still refuses a revoked row in its WHERE (F-230-J's undefended line)", () => {
    const source = withoutComments(moduleSource("keys.ts"));
    const at = source.indexOf("export async function resolveKey");
    expect(
      at,
      `\`resolveKey\` is no longer declared in \`keys.ts\`. T231 may touch that file's RETURN ` +
        `TYPE and nothing else (§T231 Forbidden), so this is out of scope rather than a ` +
        `criterion — report it.`,
    ).toBeGreaterThan(-1);

    const body = source.slice(at, at + 1200);
    expect(
      /isNull\(\s*schema\.apiKey\.revokedAt\s*\)/.test(body),
      `\`resolveKey\`'s WHERE no longer carries \`isNull(schema.apiKey.revokedAt)\`.\n` +
        `  That single line is the whole of AC4's *a revoked key is refused immediately*, and ` +
        `F-230-J measured what rests on it: deleting it scored 0 new failures across all 164 ` +
        `cells of both halves, while end-to-end a revoked key held 6 000 against 600.\n` +
        `  T231's brand does NOT replace it. The brand proves PROVENANCE, never ` +
        `non-revocation — a narrowing to \`revokedAt: null\` would have made exactly this ` +
        `mutation inert, since a WHERE with the clause deleted still mints a branded record.\n` +
        `  body: ${body.slice(0, 400)}`,
    ).toBe(true);
  });

  it("`listKeys` still LISTS revoked rows rather than filtering them", () => {
    const source = withoutComments(moduleSource("keys.ts"));
    const at = source.indexOf("export async function listKeys");
    expect(at, "`listKeys` is no longer declared in `keys.ts`").toBeGreaterThan(-1);
    const body = source.slice(at, source.indexOf("export", at + 10));

    expect(
      /revokedAt/.test(body),
      `\`listKeys\` now mentions \`revokedAt\` in its query. D-230-11 lists revoked rows ` +
        `rather than filtering them, deliberately: \`revokedAt\` moving from \`null\` to an ` +
        `instant is AC4's only HTTP-observable form, and without it *a revoked key is refused ` +
        `immediately* has nothing a caller can look at.\n` +
        `  This is also the leak T231 closes at the type level — a listed revoked row is ` +
        `structurally an \`ApiKeyRecord\`, so today it can be handed straight to ` +
        `\`checkLimit\`. The fix is the brand, NOT filtering the listing.\n` +
        `  body: ${body.slice(0, 400)}`,
    ).toBe(false);
  });

  it("the two clauses above are read by an instrument that can tell them apart", () => {
    /*
     * Falsifying this file's own instrument on a second axis. Both cells above are
     * `regex over a source slice`, and a slice that came back empty — a renamed function, a
     * changed declaration form, a bad offset — would make the `listKeys` cell pass and the
     * `resolveKey` cell fail for reasons that have nothing to do with either clause.
     *
     * So: the same predicate is run over both bodies and required to answer DIFFERENTLY.
     * That is a claim no empty slice and no always-true predicate can satisfy.
     */
    const source = withoutComments(moduleSource("keys.ts"));
    const bodyOf = (name: string): string => {
      const at = source.indexOf(`export async function ${name}`);
      const next = source.indexOf("export", at + 10);
      return source.slice(at, next === -1 ? source.length : next);
    };

    /* The discriminating predicate is `tokenHash` and NOT `isNull`, deliberately: `isNull`
       is what the criterion above is about, so a control built on it would red under
       exactly the mutation the criterion is meant to catch — and a control that fails
       whenever the subject fails is not a control. `tokenHash` appears in `resolveKey`'s
       WHERE and nowhere in `listKeys`, for reasons no T231 change can touch. */
    const marker = /tokenHash/;
    expect(
      [marker.test(bodyOf("resolveKey")), marker.test(bodyOf("listKeys"))],
      `the slice predicate answers the same for \`resolveKey\` and \`listKeys\`, so it is ` +
        `not reading what the two cells above believe it is reading — an empty slice and an ` +
        `always-true predicate both look like this.`,
    ).toEqual([true, false]);
    expect(bodyOf("listKeys").length, "the `listKeys` slice is empty").toBeGreaterThan(80);
  });

  it("`ApiKeyRecord` still has no field a secret could occupy", async () => {
    /*
     * T230's block: "`issueKey` returns the secret exactly once and `ApiKeyRecord` does not
     * carry it … the record shape makes that structural rather than a rule someone
     * remembers." T231 owns `types.ts`, where that interface lives, so it is inside the
     * blast radius of this task even though no criterion names it.
     *
     * Read off the declaration rather than off an instance, because an instance only shows
     * the fields a particular row happened to fill.
     */
    const declared = withoutComments(moduleSource("types.ts"));
    const at = declared.indexOf("interface ApiKeyRecord");
    expect(at, "`ApiKeyRecord` is no longer declared in `types.ts`").toBeGreaterThan(-1);
    const body = declared.slice(at, declared.indexOf("}", at));

    for (const forbidden of ["secret", "token", "hash", "plaintext"]) {
      expect(
        new RegExp(forbidden, "i").test(body),
        `\`ApiKeyRecord\` gained a \`${forbidden}\`-bearing field. The secret is stored ` +
          `hashed and is unrecoverable; the record shape is what makes that structural.\n` +
          `  ${body}`,
      ).toBe(false);
    }
  });

  it("`rateLimited` still takes the three parameters D-230-10 kept it at", () => {
    const params = parametersOf(moduleSource("http.ts"), "rateLimited");
    expect(
      params.length,
      `\`rateLimited\` now takes ${params.length} parameters: ${params.join(" | ")}.\n` +
        `  D-230-10 ruled it stays at three and the window is CARRIED on the verdict, ` +
        `because a caller able to fetch the window separately can pass one that disagrees ` +
        `with the verdict it is rendering — inside an exact-matched form, with nothing ` +
        `comparing the two operands.\n` +
        `  \`http.ts\` is Forbidden to T231, so a change here is out of scope entirely.`,
    ).toBe(3);
  });
});
