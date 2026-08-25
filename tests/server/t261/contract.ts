/* ============================================================
   T261 — the shared premises, and the reason each one is raised
   as its own failure rather than folded into an assertion.

   Every cell in this suite is either a FREEZE ("this still behaves
   as it did") or a NEGATIVE ("this no longer happens"). Both are
   green against an absent subject, so the subject's presence is
   raised separately, with its own repair. `tests/server/t260/
   contract.ts` established the construction and its own recorded
   failure mode is why: a walk that returns nothing satisfies every
   absence assertion at once.

   ── route paths are NAMED, never walked ──
   T260's and T262's partitions both record the rule and this task
   is the one it was written for: a route path IS a URL, so a
   deleted or moved route must red here rather than quietly shrink
   a scan. This is a URL migration; a scan that stopped matching
   would read exactly like a migration that completed.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";

export class PartitionError extends Error {
  override readonly name = "PartitionError";
}

/** Below this a source file cannot be carrying the declarations any cell here is about. */
export const BYTE_FLOOR = 200;

export interface Source {
  path: string;
  raw: string;
}

/**
 * Read named files, refusing every shape that would make a later assertion vacuous.
 *
 * The three refusals are ordered by how quietly each one passes: a shrunken LIST is the
 * quietest (nothing reds, the freeze simply covers less), a MISSING file is next, and an
 * EMPTIED file is the one that satisfies "exists" and every absence assertion at once.
 */
export function sources(paths: readonly string[], atLeast: number): Source[] {
  if (paths.length < atLeast) {
    throw new PartitionError(
      `expected at least ${atLeast} files, the list names ${paths.length}. A shrunken list is ` +
        `how a freeze goes vacuous without anything redding.`,
    );
  }
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new PartitionError(
      `these files do not exist: ${missing.join(", ")}. A freeze over a missing file passes.`,
    );
  }
  const read = paths.map((path) => ({ path, raw: readFileSync(path, "utf8") }));
  const thin = read.filter((source) => source.raw.length < BYTE_FLOOR);
  if (thin.length > 0) {
    throw new PartitionError(
      `below the ${BYTE_FLOOR}-byte floor: ${thin
        .map((source) => `${source.path} (${source.raw.length}B)`)
        .join(", ")}. An emptied file satisfies "exists" and every absence assertion at once.`,
    );
  }
  return read;
}

/* ============================================================
   THE URL MIGRATION'S OWN VOCABULARY

   Spelled once, here, because a suite that writes `/blueprints/`
   inline in forty places cannot be re-pointed and cannot be read
   for what it claims. D-261-01 rules the canonical shape and
   D-220-13 rules the key: `ownerHandle/slug`, never slug alone.
   ============================================================ */

/** D-261-01: the canonical public detail URL. */
export function canonicalBlueprintPath(ownerHandle: string, slug: string): string {
  return `/blueprints/${ownerHandle}/${slug}`;
}

/** The single-segment shape B-09 migrates away from, which D-261-02 turns into a redirector. */
export function legacyBlueprintPath(slug: string): string {
  return `/blueprints/${slug}`;
}

/**
 * The route files this task moves, named.
 *
 * `REDIRECTOR` and `CANONICAL` are siblings under `app/blueprints/` on purpose and the
 * pair is load-bearing: D-261-02 puts the redirector at `[slug]` and the canonical page
 * at `[owner]/[slug]`, which `route-shape.test.ts` measures as buildable AND as
 * foreclosing any page at `/blueprints/{owner}`.
 */
export const ROUTES = {
  /* The legacy-slug redirector lives in the SHARED `[owner]` slot, not in a `[slug]` slot
     of its own — D-261-17: Next allows ONE param name per slot at the runtime matcher, so
     `[slug]` beside `[owner]/[slug]` builds clean and throws when the server sorts routes.
     The segment is spelled `owner` and the VALUE arriving is the pre-B-09 slug. */
  redirector: "app/blueprints/[owner]/page.tsx",
  canonical: "app/blueprints/[owner]/[slug]/page.tsx",
  nodes: "app/nodes/[...id]/page.tsx",
  ontology: "app/ontology/[...term]/page.tsx",
  profileBundle: "app/u/[username]/[slug]/page.tsx",
} as const;

/* ============================================================
   D-261-18 — WHICH ROUTES A NODE-ENVIRONMENT CELL CAN DRIVE, AND
   WHY TWO OF THEM CANNOT BE DRIVEN AT ALL

   AC1's behavioural cells lived here and are RETIRED as undrivable.
   The boundary they found is kept, because it is the useful part
   and a deletion that takes the knowledge with it is how the next
   author rediscovers this at their own cost.

   A page function invoked directly — the idiom this suite and
   `honesty.test.ts` both use — runs outside a request scope. Two
   separate mechanisms can stop it, and only one of them is the
   segment config:

     `connection()`          throws outside a request scope, which is
                             why D-260-09 ruled the spelling
                             `export const dynamic = "force-dynamic"`
                             instead. That one is a CHOICE and it was
                             made correctly.

     `cookies()`             throws the same way and NO choice avoids
                             it: a page that reads the session cannot
                             be invoked directly at all. Measured
                             per route, `readSession`/`cookies()`
                             occurrences:

       app/blueprints/[owner]/page.tsx           3   UNDRIVABLE
       app/blueprints/[owner]/[slug]/page.tsx    2   UNDRIVABLE
       app/nodes/[...id]/page.tsx                0   drivable
       app/ontology/[...term]/page.tsx           0   drivable

   The asymmetry is structural rather than accidental: an API route
   takes a `Request` and a test can hand it a cookie header
   (`app/api/files/serve.test.ts:153` does), while a page reaches
   for `next/headers`. Nothing merged drives a cookie-reading page,
   because there is no way to.

   **The measurement that was true and insufficient**: this suite
   earlier proved `force-dynamic` does not block direct invocation,
   on `app/nodes/page.tsx` — a page that reads no session. The
   control lacked the property whose blocking was in question, so
   the proof generalised further than the evidence did.

   AC1's standing evidence is therefore the implementer's real-HTTP
   measurement over `next start` (308s with query strings intact),
   cited in D-261-18. `ac1-redirector.test.ts` keeps the MECHANISM
   pins beside it — those need no request scope and still hold what
   `permanentRedirect` does and does not do for a caller.
   ============================================================ */

/** D-261-03: the ruled per-request spelling, and the one it is ruled AGAINST. */
export const FORCE_DYNAMIC = 'export const dynamic = "force-dynamic"';
export const REFUSED_MARKER = "connection()";

/** The deletions AC3 rests on (`dynamicParams = false` and the static-params generator). */
export const STATIC_PARAMS_MARKERS = [
  "export const dynamicParams",
  "generateStaticParams",
] as const;

/* ============================================================
   WHAT A ROUTE DID, AS ONE VALUE

   A page function can do three things a cell cares about: render,
   redirect, or 404. Next signals the last two by THROWING, with
   the kind in `error.digest`:

       permanentRedirect  ->  NEXT_REDIRECT;replace;<url>;308;
       notFound           ->  NEXT_HTTP_ERROR_FALLBACK;404

   Both measured, not recalled.

   One reader for both, here, because AC1's mechanism cells and its
   behavioural cells must not come to disagree about what a 308
   looks like — and because a cell that merely asserted
   `rejects.toThrow()` would accept ALL THREE outcomes plus a
   database error, which is the laundering shape this project has
   already paid for once.

   Anything that is not one of the two known digests is RE-THROWN.
   A connection failure must never be readable as a 404.
   ============================================================ */

export type RouteOutcome =
  | { kind: "rendered"; element: unknown }
  | { kind: "redirect"; destination: string; status: number; query: string }
  | { kind: "notFound" };

export async function outcomeOf(run: () => unknown): Promise<RouteOutcome> {
  try {
    return { kind: "rendered", element: await run() };
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== "string") throw error;

    if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) return { kind: "notFound" };

    if (digest.startsWith("NEXT_REDIRECT")) {
      const [, , url = "", status = ""] = digest.split(";");
      const at = url.indexOf("?");
      return {
        kind: "redirect",
        destination: at === -1 ? url : url.slice(0, at),
        status: Number(status),
        query: at === -1 ? "" : url.slice(at + 1),
      };
    }

    throw error;
  }
}
