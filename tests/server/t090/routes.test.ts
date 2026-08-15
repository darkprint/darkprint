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
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";

import { describe as show, loadExport, requiredFn } from "./contract";
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

/** A private bundle and its owner, for the half of the route surface that reads a session. */
const PRIVATE_SLUG = "frontline-triage";
let privateOwner: SeededAccount;
let privateRelease: SeededRelease;

beforeAll(async () => {
  withRelease = await scratchDatabase("routes");
  empty = await scratchDatabase("routes_empty");
  await seedOntology(withRelease.db);
  owner = await seedAccount(withRelease, "routes");
  release = await seedRelease(withRelease, owner, bundleBySlug(SUBJECT));

  privateOwner = await seedAccount(withRelease, "routespriv");
  privateRelease = await seedRelease(withRelease, privateOwner, bundleBySlug(PRIVATE_SLUG), {
    visibility: "private",
  });

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

async function getByDigest(
  digest: string,
  path: string,
  handle = owner.handle,
  slug = SUBJECT,
  cookie?: string,
): Promise<Response> {
  const handler = await loadRoute(BLUEPRINTS_BY_DIGEST);
  const url = `${ORIGIN}/api/files/blueprints/${encodeURIComponent(handle)}/${slug}/d/${encodeURIComponent(digest)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  return handler(
    new Request(url, cookie === undefined ? undefined : { headers: { cookie } }),
    context({ owner: handle, slug, digest, path: path.split("/") }),
  );
}

/**
 * The first file of this release whose UTF-8 byte length differs from its JS string length.
 *
 * Derived rather than named: 41 of the 101 files the nine bundles ship differ, because the
 * generated `README.md` and `AGENTS.md` carry `—`, `§`, `→` and `·` — but which file differs is a
 * property of the archive, and hardcoding one would make this test silently non-discriminating
 * the day that file's prose changed.
 */
async function aFileWhoseByteLengthDiffers(): Promise<string> {
  const mod = await loadExport();
  const files = (await requiredFn(mod, "exportRelease")(
    withRelease.db,
    { kind: "anonymous" },
    release.bundleId,
    release.digest,
  )) as readonly { path: string; text: string }[];
  const found = files.find((f) => new TextEncoder().encode(f.text).byteLength !== f.text.length);
  if (found === undefined) {
    throw new Error(
      `No file in \`${SUBJECT}\` has a byte length differing from its string length, so the ` +
        `content-length test would pass against an implementation sending either. Pick a bundle ` +
        `whose README carries a non-ASCII character.`,
    );
  }
  return found.path;
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

  it("sends the file's BYTE length as content-length, not its string length", async () => {
    /*
     * Asserted nowhere in either suite until now, and the input is real: 41 of the 101 files the
     * nine shipped bundles contain have a UTF-8 byte length that differs from their JS string
     * length, because `README.md` and `AGENTS.md` carry `—`, `§`, `→` and `·`. `ServedFile`
     * publishes `bytes`, and the clause is that what a caller receives is those bytes, entire.
     *
     * A wrong `content-length` is not cosmetic. It is the header a client uses to decide the
     * response is complete: too small and a `curl` writes a truncated file and exits 0, too large
     * and it hangs waiting for bytes that never come. `bundleDownloadCommand` hands readers a
     * curl glob, so this is the path the product actually ships.
     *
     * The witness is DERIVED — the first served file whose two lengths differ — and the premise
     * that they differ is asserted before anything is concluded from it. A file where the two
     * happen to agree would make this test pass against an implementation that sends either.
     */
    const path = await aFileWhoseByteLengthDiffers();
    const response = await getByDigest(release.digest, path);
    expect(response.status).toBe(200);

    const body = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder().decode(body);
    expect(
      body.byteLength,
      `\`${path}\` has ${body.byteLength} bytes and ${text.length} characters, so this test ` +
        `cannot tell a byte count from a string count. Pick a file where they differ.`,
    ).not.toBe(text.length);

    const header = response.headers.get("content-length");
    expect(header, "The route sends no `content-length` for a file body.").toBeTruthy();
    expect(
      Number(header),
      `\`content-length\` is ${header} for \`${path}\`, whose body is ${body.byteLength} ` +
        `bytes and ${text.length} characters. Sending the string length truncates every file ` +
        `carrying a non-ASCII character — and every README in this archive does.`,
    ).toBe(body.byteLength);
  }, 120_000);

  it("serves a private bundle to its owner and not to an anonymous caller", async () => {
    /*
     * No test in this suite authenticated through a route until now: collapsing the route's actor
     * derivation to always-anonymous reddened nothing, because every fixture was public. Every
     * reader in T090's contract takes an `Actor` and the route is where one is derived from a
     * request, so an unexercised derivation is an unexercised parameter on all three functions.
     *
     * Both halves are needed and neither alone says anything. The 404 alone passes against a
     * route that refuses everything private, including to its owner; the 200 alone passes against
     * one that ignores visibility entirely. Together they say the route reads the session.
     *
     * B-03: the anonymous answer is 404 and not 403, so existence does not leak through the
     * status code either.
     */
    const anonymous = await getByDigest(privateRelease.digest, "README.md", privateOwner.handle, PRIVATE_SLUG);
    expect(
      anonymous.status,
      "A private bundle answered an anonymous caller with something other than 404. B-03: a " +
        "private resource the caller may not see returns 404, never 403, so existence does not " +
        "leak through the status code.",
    ).toBe(404);

    const cookie = `${SESSION_COOKIE_NAME}=${encodeSession({
      accountId: privateOwner.accountId,
      handle: privateOwner.handle,
    })}`;
    const asOwner = await getByDigest(
      privateRelease.digest,
      "README.md",
      privateOwner.handle,
      PRIVATE_SLUG,
      cookie,
    );
    expect(
      asOwner.status,
      `The owner's own session did not open their own private bundle (got ${asOwner.status}). ` +
        `Every reader in this contract takes an \`Actor\`; the route is where one comes from.`,
    ).toBe(200);
    expect((await asOwner.text()).length).toBeGreaterThan(0);
  }, 120_000);

  it("refuses a FORGED session cookie, which tests the route's choice and not T000's crypto", async () => {
    /*
     * Worth being exact about what this does and does not test, because the naive reading makes it
     * an outcome another layer already guarantees — T-03's species.
     *
     * It is NOT a test of HMAC verification. `decodeSession` is T000's, merged and verified, and
     * asserting that a bad signature fails would be asserting what that module already promises.
     *
     * It IS a test of this route's composition. A handler that reached for `parseCookieHeader` and
     * then `JSON.parse`d the payload — which is a perfectly natural thing to write, and reads as
     * "get the session out of the cookie" — would hand an unsigned body straight through and let
     * anybody mint an owner. The two implementations are indistinguishable on every legitimate
     * request and differ only here. So this discriminates *which function the route called*, which
     * is squarely T090's.
     *
     * The forged value is built to be exactly what a hand-rolled parser would accept: the same
     * base64url body the real encoder produces, with a signature that is not the real one.
     */
    const real = encodeSession({
      accountId: privateOwner.accountId,
      handle: privateOwner.handle,
    });
    const body = real.slice(0, real.lastIndexOf("."));
    const forged = `${body}.${"0".repeat(43)}`;
    expect(forged, "The forgery is the genuine token, so it proves nothing.").not.toBe(real);
    expect(
      forged.slice(0, forged.lastIndexOf(".")),
      "The forgery does not carry the real payload, so a hand-rolled parser would reject it for " +
        "the wrong reason and this test would pass against the implementation it is meant to catch.",
    ).toBe(body);

    const response = await getByDigest(
      privateRelease.digest,
      "README.md",
      privateOwner.handle,
      PRIVATE_SLUG,
      `${SESSION_COOKIE_NAME}=${forged}`,
    );
    expect(
      response.status,
      `A cookie carrying the owner's payload with a bad signature opened their private bundle ` +
        `(got ${response.status}). That is what a route that parses the cookie instead of ` +
        `verifying it does, and it is indistinguishable from a correct route on every legitimate ` +
        `request.`,
    ).toBe(404);
  }, 120_000);

  it("answers 500, not 404, when the read itself fails", async () => {
    /*
     * Ruled at the implementation's handback, and it became testable only once `readFailed`
     * returned a sibling class rather than an `ExportError`: while both shared a type, catching
     * everything as 404 changed nothing and this suite's zero was explained rather than open.
     *
     * The distinction is not pedantry. A client holding a pinned digest — the case AC6 exists
     * for — reads 404 as *withdrawn, stop retrying*, where 500 says retry. So a database outage
     * that answers 404 tells every pinned consumer the release was deleted, at the one address
     * the contract promises never moves.
     *
     * The failure is injected by renaming the table the read touches, so it arrives through the
     * path a caller takes rather than being constructed.
     */
    /*
     * The control, and it is here because its absence made this test VACUOUS. Accepting a throw as
     * the ruled rethrow means an ABSENT route module — which throws from the loader — satisfied the
     * assertion too, so the test passed with no implementation at all. Caught by recapturing the
     * module-absent baseline and finding this test in the passing column, which is the only place
     * it could have shown.
     *
     * So the route is proved to work first, and only then is the read broken. A module that does
     * not load fails here, where it should, instead of quietly counting as a rethrow.
     */
    const control = await getByDigest(release.digest, "README.md");
    expect(
      control.status,
      "The route did not serve a file that exists, so the failure injected below could not be " +
        "attributed to the broken read — an absent module throws exactly like the ruled rethrow.",
    ).toBe(200);

    await withRelease.pool.query('alter table "release" rename to "release_t090_hidden"');
    let answer: { kind: "status"; status: number } | { kind: "threw"; message: string };
    try {
      const response = await getByDigest(release.digest, "README.md");
      answer = { kind: "status", status: response.status };
    } catch (err) {
      answer = { kind: "threw", message: err instanceof Error ? err.message : String(err) };
    } finally {
      await withRelease.pool.query('alter table "release_t090_hidden" rename to "release"');
    }

    /*
     * Two admissible shapes, one forbidden outcome. The contract says the route **rethrows** the
     * read failure and "the caller gets a generic 500 with no body from this module" — the
     * framework turns an uncaught throw into a 500, and a handler called directly in a test
     * therefore throws rather than returning one. Published as `-> file bytes | problem+json 404`,
     * so a 500 Response is not in the route's own vocabulary either.
     *
     * So a throw and a 500 are both the ruled behaviour and neither is asserted over the other.
     * What is forbidden is 404, and the reason is the product one rather than a status-code
     * preference: a client holding a pinned digest reads 404 as *withdrawn, stop retrying*, so an
     * outage answering 404 tells every pinned consumer the release was deleted at the one address
     * the contract promises never moves.
     */
    if (answer.kind === "status") {
      expect(
        answer.status,
        `A failed read answered ${answer.status}. 404 means absent or invisible (B-03), and a ` +
          `client with a pinned digest reads that as withdrawn; an outage must say retry.`,
      ).toBe(500);
    } else {
      expect(
        answer.message,
        "The read failure was rethrown, which is the ruled behaviour — the framework renders it " +
          "as a 500. Recorded here so the throw is not mistaken for a broken test.",
      ).toBeTruthy();
    }
  }, 120_000);

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
