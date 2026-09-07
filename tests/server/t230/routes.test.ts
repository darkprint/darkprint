/* ============================================================
   T230 — the key routes, and the surface nobody scoped an
   instrument to

   T081's F1, quoted because this file exists because of it: "Every
   leak instrument in T081 is scoped to the problem document;
   nothing reads the response." Its adversary put a driver code on
   an `x-store-code` header on all eleven responses and it reddened
   nothing, blind or colocated, because the key-set whitelist was a
   whitelist over the BODY'S MEMBERS and not over the response.

   T230 ships the one surface in this system that hands a caller a
   credential. So the instrument here is the whole response —
   status line, every header, the body as text and as parsed JSON —
   and it looks for the secret BY PROVENANCE, because this suite
   minted it and holds it.

   ── F-230-B, again, and it is why this file discovers ──
   §T230's `Owns` names `app/api/account/keys/**` and the section
   publishes no URL, no method, no request body and no response
   shape for anything under it. So nothing here binds a path: the
   routes are discovered by walking the tree the contract owns, and
   the methods are whatever the module exports intersected with the
   App Router's own set. A red says the owned tree is unserved
   rather than that a path this suite guessed is wrong.
   ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";

import {
  type Namespace,
  type Scratch,
  type UnknownFn,
  accountActor,
  dropScratchDatabases,
  freeAccount,
  occurrencesOf,
  requiredFn,
  responseSurface,
  scratchDatabase,
} from "./contract";

/* --------------------- discovery --------------------- */

/** The App Router's own set. Not a list of the methods this suite expects. */
const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

const OWNED_TREE = "app/api/account/keys";
const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;
const TREE_ROOT = fileURLToPath(new URL(`../../../${OWNED_TREE}/`, import.meta.url));

interface DiscoveredRoute {
  /** The URL Next serves this file at, derived from the path rather than declared. */
  pattern: string;
  file: string;
}

function walk(dir: string, segments: string[], out: DiscoveredRoute[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; /* a tree the implementation has not created */
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walk(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      out.push({ pattern: `/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

function discovered(): DiscoveredRoute[] {
  const found: DiscoveredRoute[] = [];
  walk(TREE_ROOT, ["api", "account", "keys"], found);
  return found.sort((a, b) => a.pattern.localeCompare(b.pattern));
}

/** A concrete path for a pattern, with every dynamic segment filled by a value we hold. */
function instantiate(pattern: string, fill: string): string {
  return pattern.replace(/\[\[?\.{0,3}(\w+)\]?\]/g, fill);
}

/* --------------------- the shared client, repointed --------------------- */

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: unknown };

let scratch: Scratch;
let savedDatabaseUrl: string | undefined;

beforeAll(async () => {
  scratch = await scratchDatabase();
  savedDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = scratch.url;
  /* Clearing the cache turns "no other file in this worker made one first" from a
     premise into an operation, which is this run's standing rule about premises. */
  delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
});

afterAll(async () => {
  if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDatabaseUrl;
  /*
   * F-230-J's sibling, F-230-F: CLOSE the client before dropping the reference.
   *
   * This deleted the global key and nothing else, which drops the REFERENCE and never closes the
   * POOL. The connections stayed open against the scratch database, so `DROP DATABASE` refused
   * with "is being accessed by other users" — thrown from `afterAll`, which vitest reports as a
   * FILE-level failure while every cell in the file passes. Read by test total the file was
   * `Tests 3 passed (3)`; read by exit code and failed-file count it was red. Both true of one run.
   *
   * It was also an unbounded leak on infrastructure every worktree on this machine shares: one
   * scratch database per run, invisible to a load average, measured at 25 → 26 → 27 → 28 across
   * three consecutive runs. `DbClient.close` (`lib/db/client.ts:46`) is `pool.end()` and was
   * published all along — the suite had the affordance and dropped the reference instead.
   */
  const shared = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] as
    | { close?: () => Promise<void> }
    | undefined;
  if (typeof shared?.close === "function") await shared.close();
  delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
  await dropScratchDatabases();
});

async function drive(
  route: DiscoveredRoute,
  method: string,
  handler: UnknownFn,
  path: string,
  cookie: string,
  body: unknown,
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: { cookie, "content-type": "application/json" },
  };
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    init.body = JSON.stringify(body);
  }
  const request = new Request(`https://darkprint.test${path}`, init);
  const params: Record<string, string> = {};
  for (const match of route.pattern.matchAll(/\[\[?\.{0,3}(\w+)\]?\]/g)) {
    params[match[1]] = path.split("/").pop() ?? "";
  }
  const answered = await handler(request, { params: Promise.resolve(params) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `${method} ${route.pattern} answered something that is not a Response; a route handler ` +
        `returns one. Answered: ${String(answered)}`,
    );
  }
  return answered;
}

describe("T230 the owned route tree", () => {
  it("serves something under the tree the contract owns", () => {
    expect(
      discovered().map((r) => r.pattern),
      `No route file exists under \`${OWNED_TREE}/**\`.\n` +
        `  T230's \`Owns\` names that tree, and nothing here binds a path — the ` +
        `routes are discovered, so this says the owned tree is unserved rather than that a ` +
        `guessed path is wrong.\n` +
        `  F-230-B: the section publishes no URL, method, request body or response shape for ` +
        `anything under it, so this is the only assertion about those routes a blind suite ` +
        `can make from the contract as written.`,
    ).not.toEqual([]);
  });
});

describe("T230 no response under the owned tree renders a secret", () => {
  /**
   * THE CONTROL, and a separate test for the reason the other two controls in this
   * suite are separate: a control asserting a property of the FIXTURE can be mutated
   * and caught, while an inline two-factor assertion can only be deleted and a suite
   * cannot catch the deletion of its own assertion.
   *
   * It establishes that the response-surface scan can SEE a value that really reached
   * a response — headers included. Without it the leak scan's `[]` is the same `[]` a
   * scan over zero responses produces.
   */
  it("CONTROL — the response-surface scan sees a value that really rendered", async () => {
    const routes = discovered();
    expect(routes, `nothing to drive; see the tree test above`).not.toEqual([]);

    const accountId = await freeAccount(scratch);
    const cookie = `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle: null })}`;
    const label = `t230-route-control-${process.pid}`;

    /* Minted through the module rather than through a route, so this control does not
       depend on the request shape the contract never published. */
    const issueKey = await requiredFn("issueKey");
    await issueKey(scratch.db, accountActor(accountId), accountId, label);

    const seen: string[] = [];
    for (const route of routes) {
      const mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
      for (const method of HTTP_METHODS) {
        const handler = mod[method];
        if (typeof handler !== "function") continue;
        const path = instantiate(route.pattern, "probe");
        const answered = await drive(route, method, handler as UnknownFn, path, cookie, { label });
        seen.push(...occurrencesOf(label, await responseSurface(answered)));
      }
    }

    expect(
      seen.length,
      `No response under \`${OWNED_TREE}\` rendered the \`label\` of a key this account owns. ` +
        `\`label\` is on \`ApiKeyRecord\` and is the one member of it a listing exists to ` +
        `show, so a tree that never renders it is a tree the leak scan beside this one is ` +
        `reading nothing out of — and that scan's empty result would then mean nothing.`,
    ).toBeGreaterThan(0);
  });

  /**
   * The invariant, over every method of every discovered route, whatever it answers.
   * It holds at 200, at 400 and at 500 alike, which is what lets it run against routes
   * whose request shape this suite cannot know: a malformed request answers a problem
   * document, and a problem document must not carry the credential either.
   */
  it("no status, header or body of any method carries a live secret", async () => {
    const routes = discovered();
    expect(routes).not.toEqual([]);

    const accountId = await freeAccount(scratch);
    const cookie = `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle: null })}`;
    const issueKey = await requiredFn("issueKey");

    /* Two keys, so a response listing "the account's keys" has more than one row to
       get wrong, and so a leak of the older one is not mistaken for the echo a
       creating response is entitled to. */
    const first = (await issueKey(scratch.db, accountActor(accountId), accountId, "one")) as {
      secret: string;
    };
    const second = (await issueKey(scratch.db, accountActor(accountId), accountId, "two")) as {
      secret: string;
    };

    const leaks: string[] = [];
    for (const route of routes) {
      const mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
      for (const method of HTTP_METHODS) {
        const handler = mod[method];
        if (typeof handler !== "function") continue;
        const path = instantiate(route.pattern, "probe");
        const surface = await responseSurface(
          await drive(route, method, handler as UnknownFn, path, cookie, { label: "probe" }),
        );
        for (const [name, secret] of [["one", first.secret], ["two", second.secret]] as const) {
          leaks.push(
            ...occurrencesOf(secret, surface).map(
              (where) => `${method} ${route.pattern} → ${name}: ${where}`,
            ),
          );
        }
      }
    }

    expect(
      leaks,
      `A response under \`${OWNED_TREE}\` rendered a secret that was issued earlier in this ` +
        `test.\n` +
        `  "\`issueKey\` returns the secret exactly once" — so a key that already exists is ` +
        `unrecoverable, and any surface that hands one back has undone the whole design.\n` +
        `  The scan covers the status, every header and the body as both text and parsed ` +
        `JSON, and it looks for the secret BY PROVENANCE rather than by a list of things a ` +
        `secret is thought to look like. T081's F1 was a leak instrument scoped to the ` +
        `problem document while a driver value sat on a header of all eleven responses, ` +
        `redding nothing.`,
    ).toEqual([]);
  });
});
