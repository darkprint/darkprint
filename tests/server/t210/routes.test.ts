/* ============================================================
   T210 — the transport, per D-210-06 and D-210-09

     GET /api/ontology-usage             -> { usage: TermUsage[] }
     GET /api/ontology-usage/candidates  -> { candidates: PromotionCandidate[] }

   ── the routes are reached by URL and no route module is imported ──
   D-80-07 is the standing ruling and it was gate-blocking when it
   was found: a dynamic `import()` specifier resolves at COMPILE
   time, so a suite binding to `@/app/api/.../route` fails `tsc` and
   `next build` outright when the file is not there — which is
   exactly the blind position. The URLs are the contract; the file
   layout is the implementation's. So this file imports the handler
   through a specifier built at RUNTIME, which no compiler follows,
   and reports an absent route as a red rather than as a broken
   build.

   ── pointing a handler at this suite's database ──
   `getSharedDbClient()` reads `DATABASE_URL`, so the only way a
   route handler reaches a scratch database is for the variable to
   name it while the module is loaded. That is done per cell and
   restored in a `finally`, because a leaked `DATABASE_URL` would
   point every later suite in this worker at a database that is
   about to be dropped.

   ── what the route may NOT be tested for ──
   AC4's "zero, not 404" is the MODULE's property, not this
   surface's (D-210-09). The list carries every COUNTED term, so a
   term nothing names has no row here and that is correct. A cell
   demanding a zero row at the transport would red a correct route.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  CANDIDATES_PATH,
  CANDIDATES_PAYLOAD_KEY,
  USAGE_PATH,
  USAGE_PAYLOAD_KEY,
  assertCandidate,
  assertUsage,
  describe_,
  type Namespace,
} from "./contract";
import { AC1, ac1World, ac5World, dropScratchDatabases } from "./fixtures";

afterAll(async () => {
  await dropScratchDatabases();
});

/**
 * Loads a route handler by its URL path, with the specifier assembled at runtime.
 *
 * The two candidate file layouts are tried in order and BOTH are reported when neither
 * resolves. `Owns` is `app/api/ontology-usage/**` and D-210-09 gives the URLs; which folder
 * expresses them is the implementer's, and a suite that pinned one would be asserting a file
 * layout rather than a contract — the mistake D-80-07 ruled on.
 */
async function handlerFor(path: string): Promise<(request: Request) => Promise<Response>> {
  const rel = path.replace(/^\/api\//, "");
  const attempts = [`@/app/api/${rel}/route`, `@/app/api/${rel}/route.ts`];
  const failures: string[] = [];
  for (const specifier of attempts) {
    try {
      /* The specifier is a VARIABLE. A literal here would be resolved by tsc and by the Next
         build, and a blind suite naming a route file that does not exist yet has blocked a
         gate in this repository before. */
      const mod = (await import(/* @vite-ignore */ specifier)) as Namespace;
      const GET = mod.GET;
      if (typeof GET !== "function") {
        failures.push(`${specifier} loaded but exports GET as ${describe_(GET)}`);
        continue;
      }
      return GET as (request: Request) => Promise<Response>;
    } catch (cause) {
      failures.push(`${specifier}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  throw new Error(
    `No GET handler serves \`${path}\`.\n` +
      `  D-210-06 publishes this URL and D-210-09 its payload; \`Owns\` is ` +
      "`app/api/ontology-usage/**`.\n" +
      `  tried:\n    ${failures.join("\n    ")}\n` +
      "  Against an unmerged implementation this is the blind position and not a defect.",
  );
}

/**
 * Runs one GET against a scratch database, with `DATABASE_URL` restored afterwards.
 *
 * The restore is in a `finally` rather than after the call. A handler that throws would
 * otherwise leave the variable pointing at a database this file drops in `afterAll`, and every
 * later suite in the same worker would fail against a name that no longer exists — a failure
 * that names somebody else's file and has nothing to do with them.
 */
async function get(path: string, url: string): Promise<{ status: number; body: unknown }> {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  try {
    const GET = await handlerFor(path);
    const response = await GET(new Request(`http://localhost${path}`));
    if (!(response instanceof Response)) {
      throw new Error(`GET ${path} returned ${describe_(response)}, not a Response.`);
    }
    return { status: response.status, body: await response.json() };
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

function payload(body: unknown, key: string, path: string): unknown[] {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`GET ${path} answered ${describe_(body)}; the contract publishes an object.`);
  }
  const keys = Object.keys(body as Namespace).sort();
  if (keys.join(",") !== key) {
    throw new Error(
      `GET ${path} answered an object keyed [${keys.join(", ")}]; D-210-09 publishes ` +
        `\`{ ${key}: … }\`.\n` +
        "  Compared as a SET rather than by membership: an extra member is a shape nobody " +
        "ruled on, and the payload key was ruled precisely because it had been inferred.",
    );
  }
  const list = (body as Namespace)[key];
  if (!Array.isArray(list)) {
    throw new Error(`GET ${path} answered \`${key}\` as ${describe_(list)}; expected an array.`);
  }
  return list;
}

describe("GET /api/ontology-usage", () => {
  it("answers 200 with `{ usage: TermUsage[] }`", async () => {
    const { scratch } = await ac1World();
    const { status, body } = await get(USAGE_PATH, scratch.url);
    expect(status).toBe(200);
    const rows = payload(body, USAGE_PAYLOAD_KEY, USAGE_PATH).map((row, i) =>
      assertUsage(row, `${USAGE_PATH} [${i}]`),
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("serves the same numbers the module does, term for term", async () => {
    const { scratch } = await ac1World();
    const { bind } = await import("./contract");
    const usage = await bind("usage");

    const direct = ((await usage(scratch.db, { kind: "anonymous" })) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    const { body } = await get(USAGE_PATH, scratch.url);
    const overWire = payload(body, USAGE_PAYLOAD_KEY, USAGE_PATH).map((row, i) =>
      assertUsage(row, `${USAGE_PATH} [${i}]`),
    );

    /* The whole list, compared element-wise and in order. Equal LENGTHS are not equal state —
       fourteen rows before and fourteen after with different contents has passed a check in
       this repository — and D-210-10 pins the order, so a route that re-sorted would be a real
       divergence rather than a formatting difference. */
    expect(overWire).toEqual(direct);
  });

  it("the term under test is present at the transport with its ruled counts", async () => {
    const { scratch } = await ac1World();
    const { body } = await get(USAGE_PATH, scratch.url);
    const rows = payload(body, USAGE_PAYLOAD_KEY, USAGE_PATH).map((row, i) =>
      assertUsage(row, `${USAGE_PATH} [${i}]`),
    );
    const mine = rows.filter((r) => r.termId === AC1.term);
    expect(mine).toHaveLength(1);
    /* JSON is where a count silently becomes a string. `assertUsage` has already excluded that
       above, which is the point of running it on the DECODED body rather than on the object the
       module returned: `Response.json` will happily serialise `"2"` and a matcher that only
       looked at the value would never notice. */
    expect(mine[0]).toEqual({
      termId: AC1.term,
      cards: AC1.expectedCards,
      blueprints: AC1.expectedBlueprints,
      authors: AC1.expectedAuthors,
    });
  });

  it("takes no query parameter — a filtered request answers the whole list", async () => {
    const { scratch } = await ac1World();
    const plain = await get(USAGE_PATH, scratch.url);
    const filtered = await get(`${USAGE_PATH}?term=${AC1.term}`, scratch.url);
    /* D-210-09 rules the route parameterless, and the reason is in the ruling: a map or a
       filtered answer silently omits what nothing names. A route that quietly honoured `?term`
       would pass every other cell in this file while changing what a client gets. */
    expect(filtered.status).toBe(200);
    expect(filtered.body).toEqual(plain.body);
  });
});

describe("GET /api/ontology-usage/candidates", () => {
  it("answers 200 with `{ candidates: PromotionCandidate[] }`", async () => {
    const { scratch } = await ac5World();
    const { status, body } = await get(CANDIDATES_PATH, scratch.url);
    expect(status).toBe(200);
    const rows = payload(body, CANDIDATES_PAYLOAD_KEY, CANDIDATES_PATH).map((row, i) =>
      assertCandidate(row, `${CANDIDATES_PATH} [${i}]`),
    );
    /* Against the synthetic world, never the seed: D-210-08 measured the seeded archive
       producing an EMPTY candidate list, so a route cell run over the seed would assert 200 and
       `[]` and would be satisfied by a handler that returns a constant. */
    expect(rows.length).toBeGreaterThan(0);
  });

  it("serves the same rows the module does, booleans included", async () => {
    const { scratch } = await ac5World();
    const { bind } = await import("./contract");
    const candidates = await bind("candidates");

    const direct = ((await candidates(scratch.db, { kind: "anonymous" })) as unknown[]).map(
      (row, i) => assertCandidate(row, `candidates()[${i}]`),
    );
    const { body } = await get(CANDIDATES_PATH, scratch.url);
    const overWire = payload(body, CANDIDATES_PAYLOAD_KEY, CANDIDATES_PATH).map((row, i) =>
      assertCandidate(row, `${CANDIDATES_PATH} [${i}]`),
    );

    /* `assertCandidate` checks both flags with `!== true && !== false`, so a boolean that
       crossed JSON as the STRING `"true"` reds here. That is the transport-specific hazard and
       is why this cell exists beside the module's own AC5 cells rather than instead of them. */
    expect(overWire).toEqual(direct);
  });

  it("the eligible subset survives the transport unchanged", async () => {
    const { scratch, plan, thresholds } = await ac5World();
    const { body } = await get(CANDIDATES_PATH, scratch.url);
    const rows = payload(body, CANDIDATES_PAYLOAD_KEY, CANDIDATES_PATH).map((row, i) =>
      assertCandidate(row, `${CANDIDATES_PATH} [${i}]`),
    );

    const eligible = rows
      .filter((r) => r.meetsAuthors && r.meetsBlueprints)
      .map((r) => r.termId)
      .sort();
    const predicted = plan
      .filter(
        (e) =>
          e.authors >= thresholds.distinctAuthors &&
          e.blueprints >= thresholds.distinctBlueprints,
      )
      .map((e) => e.term)
      .sort();
    /* AC5 is a criterion about the LIST, and a route that filtered to the eligible subset — the
       reading D-210-02 replaced — would satisfy "200 with an array of candidates" while losing
       the near-misses a caller needs to see. Both the subset and the full membership are pinned
       so the two cannot be confused at the transport either. */
    expect(eligible).toEqual(predicted);
    expect(rows).toHaveLength(plan.length);
  });
});

describe("both routes are anonymous-safe", () => {
  it.each([
    [USAGE_PATH, USAGE_PAYLOAD_KEY],
    [CANDIDATES_PATH, CANDIDATES_PAYLOAD_KEY],
  ])("%s answers 200 to a request carrying no cookie", async (path, key) => {
    const { scratch } = await ac5World();
    const { status, body } = await get(path, scratch.url);
    /* The counts are global and actor-independent (D-210-03), so neither route has any reason
       to refuse an anonymous caller — and a 401 here would be the criterion lost at the
       transport, which is the shape the signature block warned about for the nullable return.
       Asserted as a 200 AND a well-formed payload: a handler that returned 200 with an error
       body would pass a status-only check. */
    expect(status).toBe(200);
    expect(Array.isArray(payload(body, key, path))).toBe(true);
  });
});
