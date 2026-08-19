/* ============================================================
   T081 AC4 — a store fault answers problem+json on all eleven
   routes, and AC3 carried across the transport

   AC4: D-50-18 applies here. A store fault answers `problem+json`
   500 with `type` `https://darkprint.io/problems/store-failed`,
   NOT Next's generic 500, on all eleven routes.

   Two things make that criterion cheap and one makes it sharp.

   Cheap: `DATABASE_URL` points at a closed port, so the fault
   arrives through the real driver with no Postgres running. No
   database is created, migrated or dropped anywhere in this file,
   so it runs off-slot.

   Sharp: the routes are DISCOVERED and matched through Next's own
   router rather than imported from paths this file guessed.
   D-80-07 rules that the URLs are the contract and the file layout
   is the implementation's — a `[...ref]` catch-all serving a
   namespaced id is correct, and a suite binding route MODULES
   takes `tsc` and `npm run build` down with it. So "all eleven
   routes" is quantified over what the tree actually serves, with a
   floor that reds the day the served set and the published set
   disagree.

   ── the deny set for a response has to come from somewhere ──
   A `problem+json` body carries no `cause` to derive a deny set
   from. It is built instead from the statements THE PUBLISHED
   READERS THEMSELVES RUN — driven once against the closed port and
   read off their own rejections — so the corpus is derived by
   construction over §T080's thirteen rather than from a list of
   tables typed here. Its own floor is asserted: a corpus that came
   back empty would pass every route.

   ── one stated non-assertion ──
   What `withRegistryErrors` does with a fault it does NOT
   recognise is not published, and D-50-18's re-throw arm is
   reserved for exactly that. Nothing here asserts it. Flagged
   rather than guessed: an adversary resolving an ambiguity has
   removed the finding.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ANONYMOUS,
  PROBLEM_MEDIA_TYPE,
  READER_NAMES,
  READER_PROBES,
  ROUTE_NAMES,
  ROUTE_PROBES,
  STORE_FAILED_TYPE,
  STORE_FAILURE_FORM,
  assertTellsCannotOverMatch,
  bindReader,
  boundParamsOf,
  callRoute,
  checkTextForStatement,
  deadDb,
  pointRoutesAtClosedPort,
  restoreRoutesDatabase,
  routePatternFor,
  routeTable,
  rejects,
  sqlOf,
  type RouteName,
} from "./contract";

beforeAll(() => {
  /* Two assignments and a `delete`. Deliberately not a hook that creates anything: a hook that
     throws runs no test and takes its file's cases out of the DENOMINATOR rather than into the
     numerator, so a red one prints as skips beside exit 1. */
  pointRoutesAtClosedPort();
});

afterAll(async () => {
  await restoreRoutesDatabase();
});

/**
 * The statements the published reads actually run, read off their own rejections against the
 * closed port. Memoised as the promise so thirteen refused connections happen once for the
 * whole file.
 */
let corpus: Promise<{ sql: string; params: string }> | undefined;

function statementCorpus(): Promise<{ sql: string; params: string }> {
  corpus ??= (async () => {
    const sql: string[] = [];
    const params: string[] = [];
    for (const name of READER_NAMES) {
      const fn = await bindReader(name);
      const dead = deadDb();
      try {
        const err = await rejects(
          () => fn(dead.db, ANONYMOUS, ...READER_PROBES[name].args),
          `${name}(deadDb, anonymous)`,
        );
        const statement = sqlOf(err);
        if (statement !== "") sql.push(statement);
        const bound = boundParamsOf(err);
        if (bound !== "") params.push(bound);
      } finally {
        await dead.close();
      }
    }
    return { sql: sql.join("\n"), params: params.join(" ") };
  })();
  return corpus;
}

/**
 * Everything a `problem+json` body is entitled to carry: the whole request path — which is
 * what `instance` is, by D-02, and every token of which the caller chose — and the operation
 * names, which D-13's whitelist admits as "a fixed message naming the operation".
 *
 * Stated limit, and it is the price of a whitelist derived rather than typed: a column whose
 * name is also a published reader's name, or a literal segment of a published URL, is admitted
 * here and the token half of this check cannot see it.
 *
 * `contiguousLeak` narrows that and does not close it. A body carrying a RUN of the statement
 * is caught whatever the run contains, so the hole is exactly one shape: a document leaking a
 * SINGLE identifier, shorter than twelve characters, that also happens to spell a reader's
 * name or a URL segment. Written out rather than waved at, because "still covers it" was the
 * first wording here and it was wider than the evidence.
 */
function allowedFor(name: RouteName): string[] {
  const probe = ROUTE_PROBES[name];
  return [probe.path, ...probe.supplied, ...READER_NAMES];
}

/** Drive a published URL, and turn a THROWN handler into AC4's own failure message. */
async function answerOf(name: RouteName, path: string): Promise<Response> {
  try {
    return await callRoute(name, path);
  } catch (cause) {
    throw new Error(
      `\`${ROUTE_PROBES[name].url}\` THREW instead of answering.\n` +
        `  AC4: a store fault answers problem+json 500 with type ${STORE_FAILED_TYPE}, not ` +
        `Next's generic 500. Throwing produces a 500 too, and that is precisely the reading ` +
        `D-50-18 ruled against: Next's own generic one, outside the envelope every other ` +
        `failure on this route uses and unobservable to anything driving the handler directly.\n` +
        `  thrown: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
}

interface Answered {
  status: number;
  contentType: string;
  text: string;
  body: Record<string, unknown>;
}

async function readAnswer(name: RouteName, path: string): Promise<Answered> {
  const response = await answerOf(name, path);
  const text = await response.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    text,
    body,
  };
}

describe("AC4 — the route set is the one the contract quantifies over", () => {
  it("the tree serves exactly eleven routes under the three owned trees", () => {
    const patterns = routeTable().map((r) => r.pattern);
    expect(
      patterns.length,
      `AC4 says "on all eleven routes". The tree serves ${patterns.length}: ` +
        `${patterns.join(", ")}.\n` +
        `  This is a floor over the sweep below rather than an opinion about layout — the ` +
        `paths are discovered, and D-80-07 makes the URLs the contract and the file layout ` +
        `the implementation's. A twelfth route is a surface nobody published; a tenth is a ` +
        `criterion this file would otherwise sweep without noticing.`,
    ).toBe(11);
  });

  it("every published URL, and every variant of one, resolves through Next's own matcher", () => {
    expect(ROUTE_NAMES.length, "the sweep's own case list must not be empty").toBe(11);

    const unserved: string[] = [];
    const served = new Set<string>();
    for (const name of ROUTE_NAMES) {
      const probe = ROUTE_PROBES[name];
      for (const path of [probe.path, probe.variantPath].filter(
        (p): p is string => p !== undefined,
      )) {
        try {
          served.add(routePatternFor(path));
        } catch {
          unserved.push(`${probe.url} -> ${path}`);
        }
      }
    }

    expect(
      unserved,
      "A published URL resolves to no route the tree serves. The contract publishes URLs and " +
        "the layout is the implementation's, so this says the URL is unserved rather than " +
        "that a file is missing from a guessed path — and it is the assertion that makes the " +
        "sweep below a measurement of the served surface.",
    ).toEqual([]);

    expect(
      served.size,
      `The eleven published URLs resolve to ${served.size} distinct patterns: ` +
        `${[...served].sort().join(", ")}.\n` +
        `  Fewer than eleven means two published URLs are served by one pattern, so a sweep ` +
        `over "all eleven routes" is exercising fewer than eleven handlers and the criterion ` +
        `is quantified over a smaller set than it names. That is the shadowing case D-80-07 ` +
        `settled, arriving here as a coverage claim rather than as a 404.`,
    ).toBe(11);
  });
});

describe("AC4 — a store fault answers problem+json 500 on every route", () => {
  for (const name of ROUTE_NAMES) {
    it(`${ROUTE_PROBES[name].url}: problem+json 500, type store-failed`, async () => {
      const probe = ROUTE_PROBES[name];
      const answered = await readAnswer(name, probe.path);

      expect(
        answered.status,
        `\`${probe.url}\` answered ${answered.status} against a database that refuses every ` +
          `connection. A store that cannot answer is a 500 (D-50-18), and any other status ` +
          `tells a caller something the module does not know — a 404 in particular would say ` +
          `"no such thing" for a resource nobody looked at.\n` +
          `  body: ${answered.text.slice(0, 400)}`,
      ).toBe(500);

      expect(
        answered.contentType,
        `\`${probe.url}\` answered a 500 outside the envelope. B-03 makes transport failures ` +
          `RFC 9457, and every other failure on this route already uses it; a generic 500 is ` +
          `the one shape a caller cannot parse alongside the rest.`,
      ).toContain(PROBLEM_MEDIA_TYPE);

      expect(
        answered.body.type,
        `\`${probe.url}\` answered a problem document with the wrong \`type\`. AC4 publishes ` +
          `this URI exactly, and it is the one string in this task pinned against a literal: ` +
          `a caller branching on \`type\` is the reason RFC 9457 has one.`,
      ).toBe(STORE_FAILED_TYPE);

      expect(
        typeof answered.body.title,
        `\`${probe.url}\`'s problem document has no \`title\`. RFC 9457 §3.1 requires it and ` +
          `\`problem()\` in @/lib/server/http already takes one.`,
      ).toBe("string");

      /* D-81-02: `detail` is the instance's own `message`, byte for byte — and D-81-01 fixes
         what that message is. The route does not hand the error out, so the pin here is the
         ruled FORM plus the operation it names, which together are that message. Split in two
         so a red says whether the wording or the named operation is the disagreement. */
      const matched = STORE_FAILURE_FORM.exec(String(answered.body.detail ?? ""));
      expect(
        matched === null ? String(answered.body.detail) : "(matches)",
        `\`${probe.url}\`'s problem document does not carry the ruled detail. D-81-02 makes ` +
          `\`detail\` the RegistryStoreError's own message and D-81-01 makes that message ` +
          `\`\${operation}: the registry store failed.\` A generic string here is a wrapper ` +
          `re-rendering rather than passing through, and D-50-08's rule is that each message ` +
          `keeps one author.`,
      ).toBe("(matches)");

      expect(
        [...READER_NAMES] as string[],
        `\`${probe.url}\` named the operation \`${String(matched?.[1])}\`, which is not one of ` +
          `§T080's thirteen published reads. A rendering that names an operation the caller ` +
          `cannot find in the contract points them at nothing; if this route genuinely fails ` +
          `inside something else, that something is an unpublished surface.`,
      ).toContain(String(matched?.[1]));

      expect(
        answered.body.instance,
        `\`${probe.url}\`'s problem document must identify the occurrence, which for these ` +
          `routes is the request path (D-02).`,
      ).toBe(probe.path);
    }, 30_000);
  }
});

describe("AC3 across the transport — no response carries the statement", () => {
  for (const name of ROUTE_NAMES) {
    it(`${ROUTE_PROBES[name].url}: the served body is clean`, async () => {
      const probe = ROUTE_PROBES[name];
      const { sql, params } = await statementCorpus();

      expect(
        sql,
        "The corpus of statements the published reads run came back empty, so the sweep below " +
          "would pass every response. That is a finding about the INSTRUMENT: either the " +
          "wrapper is discarding the driver error instead of putting it on `cause`, or the " +
          "probes never reached the driver. surface.test.ts's positive control separates the " +
          "two.",
      ).not.toBe("");

      /* T-04, for the half of the allow set this suite CHOSE. The dynamic segments are the
         fixture's; the reader names and the static segments of a published URL are admitted by
         D-13's whitelist and by D-80-02, so a collision there is a question about the schema
         rather than a broken probe and is not asserted here. Running the guard over both would
         red on the contract instead of on the fixture. */
      assertTellsCannotOverMatch({ query: sql }, probe.supplied);

      const answered = await readAnswer(name, probe.path);
      const check = checkTextForStatement(
        answered.text,
        { sql, params },
        allowedFor(name),
        `the served body of \`${probe.url}\``,
      );

      expect(
        check.vacuous,
        "Every token of every statement the readers run is also something this caller supplied " +
          "or an operation name, so nothing is left to look for and the assertion below is " +
          "vacuous.",
      ).toBe(false);

      expect(
        check.leaks,
        `D-13 across the transport. The deny set is derived from the statements the published ` +
          `reads actually run rather than typed here, and the allow set is this caller's own ` +
          `URL segments plus the operation names, which is exactly what D-13's whitelist ` +
          `admits.`,
      ).toEqual([]);
    }, 60_000);
  }
});

describe("the problem document carries no member the contract did not publish", () => {
  /**
   * The hole T081's implementer found in its own deny-word scan, closed here as a WHITELIST
   * over the document's shape rather than as another scan.
   *
   * Once `type`, `title`, `detail`, `status` and `instance` are each pinned, every leak a
   * word scan was written for is caught by a pin first — so the scan stops being reachable and
   * nothing reds when that happens. What still passes every pin is an RFC 9457 §3.2 EXTENSION
   * MEMBER: `sqlstate: err.cause.code` sits beside the five, satisfies all of them, and is a
   * driver value on the wire.
   *
   * This suite's own AC3 sweep could not see it either, and that is worth being exact about
   * rather than generous: the deny set there is derived from the STATEMENT and its bound
   * parameters, and a SQLSTATE is neither. The scan was never going to catch it.
   *
   * A key-set equality does, and it fails closed: any member beyond the five is a surface
   * nobody published, whatever it contains. That is the difference between forbidding the
   * leaks somebody thought of and admitting only what the contract names.
   */
  const RFC9457_CORE = ["detail", "instance", "status", "title", "type"];

  for (const name of ROUTE_NAMES) {
    it(`${ROUTE_PROBES[name].url}: the document's members are exactly RFC 9457's five`, async () => {
      const answered = await readAnswer(name, ROUTE_PROBES[name].path);
      const keys = Object.keys(answered.body).sort();

      expect(
        keys,
        `\`${ROUTE_PROBES[name].url}\` served a problem document with a member the contract ` +
          `does not publish. AC4 publishes \`type\` and the status; D-81-02 publishes ` +
          `\`detail\` and \`title\`; D-02 publishes \`instance\`. Anything else is an RFC 9457 ` +
          `§3.2 extension member, which is a published surface nobody published — and it is ` +
          `the one shape that passes every field pin in this file AND the statement scan, ` +
          `since a SQLSTATE appears in neither the statement nor its bound parameters. If an ` +
          `extension member is wanted, it goes in the block first.\n` +
          `  served: ${answered.text.slice(0, 400)}`,
      ).toEqual(RFC9457_CORE);
    }, 30_000);
  }
});

describe("D-81-02 — `title` is the problem type's own, so it is one string everywhere", () => {
  /**
   * The `title` literal is still unpublished: D-81-02 fixes it PER TYPE without giving the
   * string, and inventing one here would red an implementation that phrased it differently.
   * What is asserted is what "the problem type's own" entails without the wording — every
   * route serving the same `type` serves the same `title`.
   *
   * A per-route or per-caller title is a title carrying something about the request, which is
   * what a type-level field must not do. This is the weaker instrument of the pair and it is
   * labelled as one; if the wording is published it becomes a fourth exact match.
   */
  it("all eleven routes serve one title for the store-failed type", async () => {
    const titles = new Map<string, string[]>();
    for (const name of ROUTE_NAMES) {
      const answered = await readAnswer(name, ROUTE_PROBES[name].path);
      const title = typeof answered.body.title === "string" ? answered.body.title : "(absent)";
      titles.set(title, [...(titles.get(title) ?? []), name]);
    }

    expect(
      titles.size,
      "A floor over this sweep: eleven routes must contribute eleven measurements.",
    ).toBeGreaterThan(0);

    expect(
      [...titles.entries()].map(([title, names]) => `${JSON.stringify(title)}: ${names.join(", ")}`),
      "One `type` carrying more than one `title` means the title is a property of the route " +
        "rather than of the problem, which is the shape D-81-02 rules out by making it the " +
        "type's own.",
    ).toHaveLength(1);

    expect([...titles.keys()][0], "`title` is required by RFC 9457 §3.1").not.toBe("(absent)");
  }, 120_000);
});

describe("AC4/G2 — the problem document carries nothing the caller put in the URL", () => {
  /**
   * The block publishes AC4's `type` and status and is silent on `title` and `detail`, so
   * those cannot be pinned against a literal without inventing a wording. What is asserted
   * instead is the property the wording would have protected: drive one route twice with
   * different path segments and require the document to be identical apart from `instance`,
   * which is the request path and is the caller's own by construction (D-02).
   *
   * A `detail` interpolating the handle, slug, id or phase the caller asked about diverges
   * here. So does one interpolating a bound parameter, since those segments are what the
   * statement binds.
   */
  for (const name of ROUTE_NAMES.filter((n) => ROUTE_PROBES[n].variantPath !== undefined)) {
    it(`${ROUTE_PROBES[name].url}: two callers, one document`, async () => {
      const probe = ROUTE_PROBES[name];
      const first = await readAnswer(name, probe.path);
      const second = await readAnswer(name, probe.variantPath!);

      /* `instance` is the request path (D-02), so it is the one member that MUST move with the
         caller. Dropped by key rather than by destructuring-with-a-rest, which leaves an unused
         binding behind and a lint warning with it. */
      const strip = (answered: Answered): Record<string, unknown> =>
        Object.fromEntries(Object.entries(answered.body).filter(([key]) => key !== "instance"));

      expect(
        strip(second),
        `\`${probe.url}\` answered two different problem documents for two callers who differ ` +
          `only in what they asked about. Every field but \`instance\` describes the FAULT, ` +
          `and the fault is the same one: the store did not answer. A field that moves with ` +
          `the caller's input is carrying that input, which is D-13's bound-parameter clause ` +
          `arriving in the envelope rather than in the message.\n` +
          `  ${probe.path} -> ${first.text.slice(0, 300)}\n` +
          `  ${probe.variantPath} -> ${second.text.slice(0, 300)}`,
      ).toEqual(strip(first));

      expect(second.body.instance, "`instance` is the request path (D-02)").toBe(probe.variantPath);
    }, 60_000);
  }
});
