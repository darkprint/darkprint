/* ============================================================
   Every route served under `app/api/` belongs to SOME task.

   ── why this file exists rather than the check it replaces ──
   This lived in `tests/server/t050/routes.test.ts`, where it
   compared every served pattern under `app/api/account/` against
   T050's five published paths and called the difference **a
   partition breach** — its own word. But `Forbidden` in T050's
   section means *forbidden to T050*:
   `app/api/account/{notifications,saves,delete,keys}/**` are
   T190's, T140's, T120's and T230's `Owns`. **The predicate
   turned "not mine" into "must not exist", and those are
   different claims.** T140's implementer met it as two reds
   naming paths its own `Owns` grants and D-140-07 publishes, in
   a merged blind suite it may not edit; T230's `app/api/account/
   keys/**` was next.

   ── and why it MOVED rather than being fixed in place ──
   Two reasons, and the second is T140's implementer's.

   Scope: the criterion is about the whole partition, not about
   T050. Restricted to `app/api/account/` it covered 5 of the 29
   routes that have shipped. Here it covers all 29, and the
   generalisation was measured before it was written — zero
   unclaimed across the whole tree.

   Cost: that file opens a scratch database in `beforeAll`. The
   standing rule is *prose in `backend.md` is not inert, so
   re-gate rather than carrying a triple over it* — and once the
   check parses `backend.md`, a prose-only commit moving an
   `Owns` line could flip a **database-touching** guard, which
   the cheap file-guard exemption does not cover. **A check whose
   input is a document belongs with the guards that read
   documents.** Nothing here opens a connection.

   ── what is checked, and what a red means ──
   A route file under `app/api/` is claimed when some task's
   `Owns` line names it: a `/**` glob claims its subtree, an
   exact `route.ts` claims its own path and nothing beneath it.
   The two are NOT the same shape, and collapsing them is a bug
   this guard was written with: normalised to one string,
   `app/api/account/route.ts` became the bare claim
   `/api/account`, prefix-matching made it swallow the tree, and
   an unclaimed route went green. **The narrowest claim in the
   document subsumed every other**, and only re-running an
   earlier falsification — and finding it no longer red — said so.

   A red means a route exists whose contract, error surface and
   auth rule have no author. The fix is a grant in `backend.md`
   or a move, and which one it is belongs to the orchestrator,
   because `Owns` is not a task's to widen for itself.

   ── the working tree, deliberately, not the shipped tree ──
   `architecture-current` and `error-hygiene` read `git ls-tree
   backend` so an implementer is never red for unmerged work.
   This one reads the working tree on purpose: the failure it
   catches is a route landing outside every grant, and catching
   that at the merge is catching it after the partition has
   already been crossed. A route inside its own task's grant is
   green in that task's worktree from the moment it is written.

   Fails CLOSED: no routes discovered, or no claims parsed, are
   errors rather than an empty comparison.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BACKEND_MD = join(REPO_ROOT, "backend.md");
const API_ROOT = join(REPO_ROOT, "app", "api");

/** A claim from an `Owns` line. `subtree` distinguishes `.../**` from an exact `route.ts`. */
interface Claim {
  pattern: string;
  subtree: boolean;
}

/** Every `/api/...` path a `route.ts` serves, from the working tree. */
function servedRoutes(dir = API_ROOT, prefix = "/api"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...servedRoutes(join(dir, entry.name), `${prefix}/${entry.name}`));
    else if (entry.name === "route.ts") out.push(prefix);
  }
  return out.sort();
}

/**
 * Every `app/api/...` path claimed by some task's `Owns` line.
 *
 * Contract only, never the Log — a Log entry quoting a path is a record of what happened, not a
 * declaration of what a task owns. Same rule as `wave-dependencies`, and it cost a false defect
 * report earlier in this run to learn it.
 */
function claims(): readonly Claim[] {
  const md = readFileSync(BACKEND_MD, "utf8");
  return md
    .split(/^### /m)
    .slice(1)
    .flatMap((section) => {
      if (!/^T\d{3},/.test(section)) return [];
      const owns = /- \*\*Owns:\*\* (.*)$/m.exec(section.split("- **Log:**")[0] ?? "")?.[1] ?? "";
      return [...owns.matchAll(/`(app\/api\/[^`]*)`/g)].map((match) => {
        const path = match[1]!.replace(/^app/, "");
        return path.endsWith("/route.ts")
          ? { pattern: path.replace(/\/route\.ts$/, ""), subtree: false }
          : { pattern: path.replace(/\/\*+$/, "").replace(/\/$/, ""), subtree: true };
      });
    });
}

describe("the app/api partition has no unowned routes", () => {
  it("every served route is claimed by some task's Owns line", () => {
    const served = servedRoutes();
    const claimed = claims();

    expect(
      served.length,
      "No route.ts was found under app/api/, which would make the assertion below vacuous.",
    ).toBeGreaterThan(0);
    expect(
      claimed.length,
      "No `app/api/...` path was found in any task's Owns line in backend.md. Either the Owns " +
        "format moved or the section split did — both make the assertion below vacuous, and a " +
        "vacuous version of this check passes every unclaimed route in the tree.",
    ).toBeGreaterThan(0);

    const unclaimed = served.filter(
      (route) =>
        !claimed.some((c) => route === c.pattern || (c.subtree && route.startsWith(`${c.pattern}/`))),
    );

    expect(
      unclaimed,
      "A route is served under app/api/ and no task's Owns line in backend.md claims it. A path " +
        "that belongs to nobody is a route whose contract, error surface and auth rule have no " +
        "author, and the partition is what stops two tasks discovering at merge that they built " +
        "the same URL. Ask the orchestrator for a grant or move the route: `Owns` is not a " +
        `task's to widen for itself. Claimed today: ${claimed
          .map((c) => (c.subtree ? `${c.pattern}/**` : c.pattern))
          .join(", ")}`,
    ).toEqual([]);
  });

  it("a subtree claim and a single-file claim are read as different shapes", () => {
    /*
     * The regression guard for the bug above, asserted on the parse rather than on an outcome.
     *
     * `app/api/account/route.ts` is one of T050's five and must produce an EXACT claim. If it
     * ever normalises to a subtree claim again, `/api/account` claims the whole account tree and
     * the check above passes over every unowned route beneath it — silently, and while still
     * reporting a pass. That is precisely how it went green the first time.
     */
    const all = claims();
    const exact = all.filter((c) => !c.subtree).map((c) => c.pattern);

    expect(
      exact,
      "No exact (single-file) claim was parsed at all. T050's Owns enumerates five exact route " +
        "FILES rather than a subtree — `lib/server/accounts/http.ts` says so and explains why — " +
        "so an empty set here means the `/route.ts` branch stopped being reached and every claim " +
        "is now a subtree claim.",
    ).toContain("/api/account");

    expect(
      all.find((c) => c.pattern === "/api/account")?.subtree,
      "`app/api/account/route.ts` parsed as a SUBTREE claim. It claims its own path and nothing " +
        "beneath it. As a subtree claim it swallows /api/account/**, which is every route the " +
        "four Forbidden trees hold, and the check above then passes over all of them.",
    ).toBe(false);
  });
});
