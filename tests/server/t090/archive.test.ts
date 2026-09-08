/* ============================================================
   GET /api/bundles/[owner]/[slug]/archive — the release as one .tgz

   Three things only this route can get wrong, held here over a
   scratch database of this file's own: that a private bundle is a
   404 to everyone but its owner (B-03, the same answer for absent
   and unreadable), that the archive holds exactly the files
   `exportRelease` answers and their bytes, and that the query names
   a release the way the file routes do. The tar is read back by
   hand: the writer is in-house, so the reader that checks it must
   not be the writer's own code.

   The shared client is swapped the way `routes.test.ts` swaps it, so
   nothing here opens the shared `darkprint` database.
   ============================================================ */

import { gunzipSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DbClient } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { exportRelease } from "@/lib/server/export";

import { GET } from "@/app/api/bundles/[owner]/[slug]/archive/route";
import {
  bundleBySlug,
  scratchDatabase,
  seedAccount,
  seedRelease,
  type Scratch,
  type SeededAccount,
  type SeededRelease,
} from "./fixtures";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const PUBLIC_SLUG = "guarded-merge-bot";
const PRIVATE_SLUG = "frontline-triage";
const ORIGIN = "http://localhost";

let scratch: Scratch;
let owner: SeededAccount;
let stranger: SeededAccount;
let release: SeededRelease;
let secret: SeededRelease;
let previous: DbClient | undefined;

beforeAll(async () => {
  scratch = await scratchDatabase("archive");
  owner = await seedAccount(scratch, "archive");
  stranger = await seedAccount(scratch, "archivestranger");
  release = await seedRelease(scratch, owner, bundleBySlug(PUBLIC_SLUG));
  secret = await seedRelease(scratch, owner, bundleBySlug(PRIVATE_SLUG), { visibility: "private" });

  previous = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
  (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] = scratch.client;
}, 300_000);

afterAll(async () => {
  const withShared = globalThis as GlobalWithSharedClient;
  if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
  else withShared[SHARED_CLIENT_KEY] = previous;
  await scratch.drop();
}, 120_000);

function cookieFor(account: SeededAccount): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId: account.accountId, handle: account.handle })}`;
}

async function get(
  slug: string,
  query = "",
  cookie?: string,
  handle = owner.handle,
): Promise<Response> {
  const url = `${ORIGIN}/api/bundles/${encodeURIComponent(handle)}/${slug}/archive${query}`;
  return GET(
    new Request(url, cookie === undefined ? undefined : { headers: { cookie } }),
    { params: Promise.resolve({ owner: handle, slug }) },
  );
}

/** One entry of a tar, as a reader independent of the writer sees it. */
interface Entry {
  name: string;
  bytes: Buffer;
}

/**
 * A ustar stream read the way `tar -t` reads one: a 512-byte header, the size in octal at
 * offset 124, the name at 0 joined onto the prefix at 345, the data padded to the block,
 * until the first all-zero block. The checksum is recomputed rather than trusted, since a
 * wrong one is the defect a reader written by the writer's author would forget to check.
 */
function entriesOf(tgz: Uint8Array): Entry[] {
  const tar = gunzipSync(tgz);
  const out: Entry[] = [];
  let at = 0;
  while (at + 512 <= tar.length) {
    const block = tar.subarray(at, at + 512);
    if (block.every((byte) => byte === 0)) break;
    const field = (from: number, width: number) =>
      block.subarray(from, from + width).toString("utf8").replace(/\0[\s\S]*$/, "");
    const declared = parseInt(field(148, 8).trim(), 8);
    let sum = 0;
    for (let i = 0; i < 512; i += 1) sum += i >= 148 && i < 156 ? 0x20 : block[i]!;
    if (sum !== declared) throw new Error(`checksum mismatch at offset ${at}: ${sum} vs ${declared}`);
    if (field(257, 6) !== "ustar") throw new Error(`no ustar magic at offset ${at}`);
    const prefix = field(345, 155);
    const name = prefix === "" ? field(0, 100) : `${prefix}/${field(0, 100)}`;
    const size = parseInt(field(124, 12), 8);
    const start = at + 512;
    out.push({ name, bytes: Buffer.from(tar.subarray(start, start + size)) });
    at = start + Math.ceil(size / 512) * 512;
  }
  return out;
}

describe("the archive of a public release", () => {
  it("answers a gzip attachment named after the slug and the version", async () => {
    const response = await get(PUBLIC_SLUG);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/gzip");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="${PUBLIC_SLUG}-${release.version}.tgz"`,
    );
    const body = new Uint8Array(await response.arrayBuffer());
    expect(String(body.byteLength)).toBe(response.headers.get("content-length"));
    // gzip's own two magic bytes: the body is compressed, not a tar handed over bare.
    expect([body[0], body[1]]).toEqual([0x1f, 0x8b]);
  });

  it("lists exactly the release's files under a folder named after the slug, byte for byte", async () => {
    const expected = await exportRelease(scratch.db, { kind: "anonymous" }, release.bundleId, release.digest);
    expect(expected.length, "the fixture release exports no files").toBeGreaterThan(2);

    const response = await get(PUBLIC_SLUG);
    const entries = entriesOf(new Uint8Array(await response.arrayBuffer()));
    expect(entries.map((entry) => entry.name)).toEqual(
      expected.map((file) => `${PUBLIC_SLUG}/${file.path}`),
    );
    for (const [i, file] of expected.entries()) {
      // UTF-8 bytes, not string equality: the README carries characters whose byte length
      // differs from their string length, and a size field written from the wrong one would
      // truncate the file for every reader.
      expect(entries[i]!.bytes.equals(Buffer.from(file.text, "utf8")), file.path).toBe(true);
    }
  });

  it("names the release by digest, and refuses a digest it does not have", async () => {
    const byDigest = await get(PUBLIC_SLUG, `?digest=${encodeURIComponent(release.digest)}`);
    expect(byDigest.status).toBe(200);
    const byVersion = await get(PUBLIC_SLUG, `?version=${encodeURIComponent(release.version)}`);
    expect(byVersion.status).toBe(200);

    const unknown = await get(PUBLIC_SLUG, `?digest=sha256:${"0".repeat(64)}`);
    expect(unknown.status).toBe(404);
    const noSuchVersion = await get(PUBLIC_SLUG, "?version=9.9.9");
    expect(noSuchVersion.status).toBe(404);
  });

  it("refuses a version and a digest together", async () => {
    const both = await get(
      PUBLIC_SLUG,
      `?version=${encodeURIComponent(release.version)}&digest=${encodeURIComponent(release.digest)}`,
    );
    expect(both.status).toBe(400);
    expect(both.headers.get("content-type")).toContain("application/problem+json");
  });

  it("answers the same 404 for a slug nobody published", async () => {
    const response = await get("no-such-bundle");
    expect(response.status).toBe(404);
  });
});

describe("a private release", () => {
  /**
   * The 404 alone would pass against a route that refuses every private bundle, its owner
   * included; the owner's 200 alone would pass against one that ignores visibility. Both
   * halves, with a stranger's real session between them, say the route reads the session
   * and applies the grant rather than the cookie's presence.
   */
  it("is a 404 to an anonymous caller and to another account, and the archive to its owner", async () => {
    const anonymous = await get(PRIVATE_SLUG);
    expect(anonymous.status, "an anonymous caller was answered something other than 404").toBe(404);

    const asStranger = await get(PRIVATE_SLUG, "", cookieFor(stranger));
    expect(asStranger.status, "another account's session opened a private bundle").toBe(404);

    const asOwner = await get(PRIVATE_SLUG, "", cookieFor(owner));
    expect(asOwner.status, "the owner's own session did not open their private bundle").toBe(200);
    const entries = entriesOf(new Uint8Array(await asOwner.arrayBuffer()));
    expect(entries.map((entry) => entry.name)).toContain(`${PRIVATE_SLUG}/README.md`);
    expect(secret.digest).not.toBe(release.digest);
  });

  it("does not tell the two refusals apart in the body", async () => {
    const absent = await (await get("no-such-bundle")).text();
    const hidden = await (await get(PRIVATE_SLUG)).text();
    // `instance` is the request path and differs by construction; everything else is one text.
    const strip = (body: string) => body.replace(/"instance":"[^"]*"/, "");
    expect(strip(hidden)).toBe(strip(absent));
  });
});
