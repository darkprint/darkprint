/* ============================================================
   T090 — the three routes D-90-04 published

       GET /api/files/blueprints/[owner]/[slug]/v/[version]/[...path]
       GET /api/files/blueprints/[owner]/[slug]/d/[digest]/[...path]
       GET /api/files/cards/[...ref]

   All seven criteria are reachable through the barrel, so nothing
   here is a criterion's only witness. What is only reachable here
   is the part the barrel cannot express: the two-segment split that
   keeps a digest from resolving as a version, that the body is file
   bytes rather than a JSON envelope, and that D-90-01's two
   internal answers are one externally indistinguishable 404.

   ── how a route test gets off the shared database ──
   A route handler takes no `Db`; it reaches for
   `getSharedDbClient()`, which `lib/db/client.ts` caches on
   `globalThis` behind `Symbol.for("darkprint.db.sharedClient")`,
   documented as living there so the pool survives Next's hot
   reload. A scratch client is installed in that slot before the
   first request and removed after the last, so nothing here opens
   the shared `darkprint` database.

   That substitution is checked rather than assumed: the first test
   fetches a release that exists **only** in the scratch database,
   so a 200 is proof the route used the installed client and a 404
   would mean it built its own and this file had been quietly
   testing an empty database.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DbClient } from "@/lib/db";

import { describe as show } from "./contract";
import {
  bundleBySlug,
  scratchDatabase,
  seedAccount,
  seedOntology,
  seedRelease,
  type Scratch,
  type SeededAccount,
  type SeededRelease,
} from "./fixtures";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const SUBJECT = "guarded-merge-bot";
const ORIGIN = "http://localhost";

const BLUEPRINTS_BY_VERSION =
  "@/app/api/files/blueprints/[owner]/[slug]/v/[version]/[...path]/route";
const BLUEPRINTS_BY_DIGEST = "@/app/api/files/blueprints/[owner]/[slug]/d/[digest]/[...path]/route";
const CARDS = "@/app/api/files/cards/[...ref]/route";

type Handler = (request: Request, context: { params: Promise<unknown> }) => Promise<Response>;

let withRelease: Scratch;
let empty: Scratch;
let owner: SeededAccount;
let release: SeededRelease;
let previous: DbClient | undefined;

beforeAll(async () => {
  withRelease = await scratchDatabase("routes");
  empty = await scratchDatabase("routes_empty");
  await seedOntology(withRelease.db);
  owner = await seedAccount(withRelease, "routes");
  release = await seedRelease(withRelease, owner, bundleBySlug(SUBJECT));

  previous = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
  useDatabase(withRelease);
}, 300_000);

/*
 * The explicit timeout is not decoration. `vitest.config.ts` raises `testTimeout` to 20s and
 * says why; it does not raise `hookTimeout`, which stays at vitest's 10s default — and dropping
 * a scratch database (close the pool, open an admin pool, `drop database … with (force)`) crosses
 * that under the parallel worktree load this repository runs at. When it does, the run reports
 * `Tests 75 passed (75)` with two FAILED FILES and exit 1, because a hook that fails runs no
 * test and adds nothing to the failed column. That is backend.md's "read the exit code and the
 * failed-file count, never the test total", arriving in this suite's own teardown; it was found
 * by the falsification harness refusing to measure against an unclean baseline.
 */
afterAll(async () => {
  const withShared = globalThis as GlobalWithSharedClient;
  if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
  else withShared[SHARED_CLIENT_KEY] = previous;
  /*
   * Both, independently. The first version awaited them in sequence, so the run whose teardown
   * hit the 10s hook default left `darkprint_t090_routes_empty_<pid>` behind — the first drop
   * consumed the whole budget and the second never ran. Found by checking `pg_database` after a
   * full run rather than by trusting the teardown, which is the residue rule applied to the one
   * medium this file actually writes to.
   */
  const dropped = await Promise.allSettled(
    [withRelease, empty].filter((s) => s !== undefined).map((s) => s.drop()),
  );
  const failed = dropped.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    throw new Error(
      `${failed.length} scratch database(s) could not be dropped, so this run left residue: ` +
        failed.map((r) => String((r as PromiseRejectedResult).reason)).join("; "),
    );
  }
}, 120_000);

function useDatabase(scratch: Scratch): void {
  (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] = scratch.client;
}

/**
 * Load one route module, or throw naming the path D-90-04 published it at.
 *
 * A literal specifier so the `@` alias resolves, and a dynamic import so an absent route reds
 * the test that needs it rather than the whole file at collection.
 */
async function loadRoute(specifier: string): Promise<Handler> {
  let mod: Record<string, unknown>;
  try {
    mod =
      specifier === BLUEPRINTS_BY_VERSION
        ? ((await import(
            "@/app/api/files/blueprints/[owner]/[slug]/v/[version]/[...path]/route"
          )) as never)
        : specifier === BLUEPRINTS_BY_DIGEST
          ? ((await import(
              "@/app/api/files/blueprints/[owner]/[slug]/d/[digest]/[...path]/route"
            )) as never)
          : ((await import("@/app/api/files/cards/[...ref]/route")) as never);
  } catch (cause) {
    throw new Error(
      `${specifier} does not load.\n` +
        `  backend.md §T090 D-90-04 publishes three routes under \`app/api/files/**\`, which is ` +
        `this task's \`Owns\`:\n` +
        `    GET /api/files/blueprints/[owner]/[slug]/v/[version]/[...path]\n` +
        `    GET /api/files/blueprints/[owner]/[slug]/d/[digest]/[...path]\n` +
        `    GET /api/files/cards/[...ref]\n` +
        `  Two segments rather than one, "so AC6's digest/version distinction lives in the URL ` +
        `rather than in a heuristic on a segment's shape".`,
      { cause },
    );
  }
  const get = mod.GET;
  if (typeof get !== "function") {
    throw new Error(
      `${specifier} exports no \`GET\`; it exports [${Object.keys(mod).sort().join(", ")}].`,
    );
  }
  return get as Handler;
}

/** `ctx.params` is a Promise in this version of Next — see `node_modules/next/dist/docs`. */
function context(params: Record<string, unknown>): { params: Promise<unknown> } {
  return { params: Promise.resolve(params) };
}

async function getByDigest(digest: string, path: string, handle = owner.handle): Promise<Response> {
  const handler = await loadRoute(BLUEPRINTS_BY_DIGEST);
  const url = `${ORIGIN}/api/files/blueprints/${encodeURIComponent(handle)}/${SUBJECT}/d/${encodeURIComponent(digest)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  return handler(
    new Request(url),
    context({ owner: handle, slug: SUBJECT, digest, path: path.split("/") }),
  );
}

async function getByVersion(version: string, path: string): Promise<Response> {
  const handler = await loadRoute(BLUEPRINTS_BY_VERSION);
  const url = `${ORIGIN}/api/files/blueprints/${encodeURIComponent(owner.handle)}/${SUBJECT}/v/${encodeURIComponent(version)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  return handler(
    new Request(url),
    context({ owner: owner.handle, slug: SUBJECT, version, path: path.split("/") }),
  );
}

describe("the three routes D-90-04 published", () => {
  it("serves a release file at /d/[digest]/, which also proves this file's database substitution", async () => {
    /*
     * The premise check for every other test here. This release exists only in the scratch
     * database installed above, so a 200 is proof the handler used the installed client. A 404
     * would mean it opened its own connection and this file had been asserting against an empty
     * database with every test still green — D-08's shape, and the reason `scratchDatabase` also
     * checks `select current_database()`.
     */
    const response = await getByDigest(release.digest, "README.md");
    expect(
      response.status,
      "The route did not serve a file that exists in the database installed at " +
        "`Symbol.for(\"darkprint.db.sharedClient\")`. Either the release is not being found, or " +
        "the handler is not reaching for the shared client — and until this is 200, every other " +
        "test in this file is measuring an empty database.",
    ).toBe(200);
    const body = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(body)).toContain(release.digest);
  }, 60_000);

  it("answers with the file's own bytes at its own content type, not a JSON envelope", async () => {
    /*
     * D-90-04: "Bodies are the file's bytes at its own content type, not a JSON envelope: these
     * are files a `curl` writes to disk, and B-03's envelope is for payloads."
     *
     * The assertion is on the bytes rather than on the header alone, because a handler that
     * wrapped the file in `ok(...)` and then set a `text/markdown` header would pass a
     * header-only check while writing `{"data":…}` to the reader's disk.
     */
    const response = await getByDigest(release.digest, "blueprint.dot");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(
      text.startsWith("{"),
      `\`blueprint.dot\` came back as what looks like JSON: ${JSON.stringify(text.slice(0, 80))}. ` +
        `A reader curls this to disk under a \`.dot\` name.`,
    ).toBe(false);
    expect(text).toContain("digraph");
    const contentType = response.headers.get("content-type");
    /* Present, not merely not-JSON: an absent header satisfies "does not contain json" and is
       what a handler that forgot to set one produces. Found by asking what a mutation not on
       this suite's list would do. */
    expect(
      contentType,
      "The route sets no `content-type` on a file body, so a reader gets the browser's guess.",
    ).toBeTruthy();
    expect(
      contentType as string,
      "The DOT file is served as JSON. Its content type is the file's own (D-90-04).",
    ).not.toContain("json");
  }, 60_000);

  it("does not let a digest resolve through the version segment", async () => {
    /*
     * D-90-04's reason for two segments rather than one: "a digest reference must never resolve
     * as a version by accident". With one segment and a shape heuristic, this is the request that
     * decides whether the heuristic is right; with two, it cannot arise — the digest arrives in
     * the slot that means version, matches no version, and is refused.
     */
    const response = await getByVersion(release.digest, "README.md");
    expect(
      response.status,
      `A digest passed in the \`/v/[version]/\` segment resolved. The two segments exist so that ` +
        `cannot happen.`,
    ).toBe(404);
  }, 60_000);

  it("serves the same file through /v/[version]/ as through /d/[digest]/", async () => {
    /* The control for the test above: the version segment does work, so its 404 there is about
       the digest and not about the route being broken. */
    const byVersion = await getByVersion(release.version, "README.md");
    expect(byVersion.status).toBe(200);
    const byDigest = await getByDigest(release.digest, "README.md");
    expect(await byVersion.text()).toBe(await byDigest.text());
  }, 60_000);

  it("resolves a card at /api/files/cards/[...ref] with no blueprint in the URL", async () => {
    /* AC5 through the route rather than through the barrel: the address has no owner and no slug
       in it at all, which is the shape assertion made structural. */
    const handler = await loadRoute(CARDS);
    const entry = bundleBySlug(SUBJECT);
    const ref = entry.blueprint.nodes[0]?.ref as string;
    const response = await handler(
      new Request(`${ORIGIN}/api/files/cards/${ref.split("/").map(encodeURIComponent).join("/")}`),
      context({ ref: [ref] }),
    );
    expect(response.status, `The card route did not resolve \`${ref}\``).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(0);
  }, 60_000);
});

describe("D-90-01's two internal answers are one externally indistinguishable 404", () => {
  /*
   * "The route maps both to the identical `problem+json` 404 body, so nothing is externally
   * distinguishable and the distinction is diagnostic only."
   *
   * The two answers are produced at the SAME URL, so `instance` — which `problem.ts` derives from
   * the request path — is identical too and the whole body can be compared byte for byte. Only
   * the database differs between the two requests: one holds the release, so an unknown path
   * takes the throw branch; the other holds nothing, so the same request takes the `undefined`
   * branch. Anything that leaked the difference would have to leak it into the body or the
   * status, and both are compared.
   */
  it("returns a byte-identical problem+json body whether the release or only the path is missing", async () => {
    useDatabase(withRelease);
    const resolved = await getByDigest(release.digest, "no-such-file.txt");

    useDatabase(empty);
    const absent = await getByDigest(release.digest, "no-such-file.txt");

    useDatabase(withRelease);

    expect(resolved.status, "A path outside the release is not a 404").toBe(404);
    expect(absent.status, "An absent release is not a 404").toBe(404);
    expect(resolved.headers.get("content-type")).toBe("application/problem+json");
    expect(absent.headers.get("content-type")).toBe("application/problem+json");

    const a = await resolved.text();
    const b = await absent.text();
    expect(
      b,
      `The two 404s differ.\n  release present, path unknown: ${a}\n  release absent:               ${b}\n` +
        `  D-90-01 makes the internal distinction diagnostic only; B-03 says a private resource ` +
        `"returns 404, never 403, so existence does not leak", and a body that differs leaks the ` +
        `same fact the status code was kept from leaking.`,
    ).toBe(a);
  }, 120_000);

  it("returns that same 404 for a traversal path, so AC7 does not leak through the route either", async () => {
    /*
     * These two requests are at different URLs by construction, so `instance` — RFC 9457's
     * "identifies this specific occurrence", which `problem.ts` derives from the request path —
     * necessarily differs and is compared out. Everything a caller could read a difference from
     * is what remains: `type`, `title`, `status`, `detail` and any extension member.
     */
    useDatabase(withRelease);
    const traversal = await getByDigest(release.digest, "../../etc/passwd");
    const unknown = await getByDigest(release.digest, "no-such-file.txt");
    expect(traversal.status).toBe(404);
    expect(unknown.status).toBe(404);

    const withoutInstance = async (response: Response): Promise<Record<string, unknown>> => {
      const body = (await response.json()) as Record<string, unknown>;
      delete body.instance;
      return body;
    };

    const a = await withoutInstance(traversal);
    const b = await withoutInstance(unknown);
    expect(
      a,
      `A traversal path produced a different 404 from an ordinary unknown one: ${show(a)} against ` +
        `${show(b)}. Both are "not in this release's file list" and there is nothing for the ` +
        `route to tell a caller about which of the two it was.`,
    ).toEqual(b);
  }, 120_000);
});
