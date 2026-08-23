/* ============================================================
   T262 — the surfaces this suite scans, and the three exclusions

   Derived where derivation is safe and named where it is not.

   ROUTE files are NAMED. A route path is a URL, so it cannot be
   renamed without changing the product, and naming them means a
   deleted route reds here instead of quietly shrinking the scan.
   COMPONENT files are WALKED, because a component may legitimately
   be renamed or split by the cutover — with a floor count, since a
   walk that returns nothing is the vacuity `sources()` exists to
   refuse.

   ── the three exclusions, each with the ruling that made it ──
   `app/u/[username]/[slug]/page.tsx`  D-262-08. Out of T262 and
       into T261: every import it has is `components/bundle/**`,
       which is T261's `Owns`. It carries 1 of the 19 `lib/data`
       import lines and 2 of the 10 rendered mentions, so leaving it
       in would red a correct T262 for a file T262 may not touch.
   `components/profile/tabs.ts`        D-262-03. FROZEN.
       `lib/server/naming/reserved.ts:13` imports
       `RESERVED_PROFILE_SEGMENTS` from it and `isReservedSlug()` is
       that import and nothing else, so merged T070's slug refusal is
       decided here. Read-only.
   `components/profile/tabs.test.ts`   D-262-03, beside it, and
       D-262-02: under D-262-01 the fixtures survive, so it is
       unchanged and AC5 holds. It holds 3 of the 19 import lines.

   That leaves AC6's subject at 15 import lines over 10 files, and
   D-262-10's rendered half at 8 lines over 6 files. Neither number
   is pinned as a total anywhere in this suite — a total is the
   masking shape, and every assertion below is scoped per file.
   ============================================================ */

import { readdirSync } from "node:fs";
import { join } from "node:path";

/* The scan is rooted so the adversary round can run this suite against a STAND-IN tree without
   editing the worktree it is measuring. It defaults to the repository, and it is safe to expose
   because `sources()` refuses a root whose partition is missing, emptied or short — pointing this
   at nothing produces a PartitionError, never a vacuous green. */
const ROOT = process.env.T262_SCAN_ROOT ?? ".";
const at = (p: string) => (ROOT === "." ? p : join(ROOT, p));

/** D-262-11 takes `dynamicParams`/`generateStaticParams` off these five. */
export const PROFILE_ROUTES = [
  "app/u/[username]/page.tsx",
  "app/u/[username]/blueprints/page.tsx",
  "app/u/[username]/cards/page.tsx",
  "app/u/[username]/saved/page.tsx",
  "app/u/[username]/terms/page.tsx",
] as const;

export const SETTINGS_ROUTE = "app/settings/page.tsx";

/** D-262-08 and D-262-03. Named so a reader sees WHY the scan stops short of them. */
export const EXCLUDED = [
  "app/u/[username]/[slug]/page.tsx",
  "components/profile/tabs.ts",
  "components/profile/tabs.test.ts",
] as const;

const isSource = (name: string) =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) &&
  !name.endsWith(".test.ts") &&
  !name.endsWith(".test.tsx");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (isSource(entry.name)) out.push(path);
  }
  return out;
}

/* `components/settings/**` is not walked: it does not exist in the tree this suite was written
   against, and a walk over a missing directory throws where a floor check would have reported it
   more usefully. If the cutover creates it, it joins `COMPONENTS` here and the floor moves. */
export function components(): string[] {
  return [
    ...walk(at("components/profile")).map((p) => (ROOT === "." ? p : p.slice(ROOT.length + 1))),
    "components/ui/FavoriteStar.tsx",
    /* D-262-06 granted this to T262: it was in nobody's `Owns`, AC1 reaches it as the most
       visible signed-in-versus-signed-out surface, and AC6 reaches its import. */
    "components/site/SiteHeader.tsx",
  ].filter((p) => !(EXCLUDED as readonly string[]).includes(p));
}

/** Everything AC6 and D-262-10 scan. Routes first so a red reads top-down like the site does. */
export function scanned(): string[] {
  return [...PROFILE_ROUTES, SETTINGS_ROUTE, ...components()];
}

/** Every scanned path resolved against the scan root. Cells report the REPO-relative path. */
export function resolved(path: string): string {
  return at(path);
}

/** Below this the walk has lost files and every absence assertion over it has gone vacuous. */
export const COMPONENT_FLOOR = 6;
