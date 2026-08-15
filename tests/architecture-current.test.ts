/* ============================================================
   `CLAUDE.md` makes `docs/ARCHITECTURE.md` part of the definition
   of done and gives a change→section table for it. Nothing checked
   it, and it went stale exactly the way an unchecked rule does.

   Measured at `3331393` by T080's session, on its way out of a task
   the file is not part of: §6.2 recorded six `lib/server` modules
   while eight existed, and §4's sitemap recorded **zero** `/api`
   routes while fifteen existed. Two merged and tagged tasks — T030's
   `server/ontology/` and T080's `server/registry/` — were absent
   from the document that `CLAUDE.md` calls "the specification from
   which the backend will be built".

   The attribution matters and is the reason this guard exists rather
   than a reminder: `docs/ARCHITECTURE.md` is in **no task's `Owns`
   set**, so no task agent could have updated it without violating
   the one-writer partition. It is the orchestrator's, like
   `backend.md` — and "the orchestrator updates the docs when it
   remembers" is the shape this run has replaced with structure four
   times already.

   What is checked here is the part that goes stale *invisibly*: a
   module or a route that exists and is written down nowhere. Prose
   accuracy is not mechanisable and is not attempted. Deliberately
   NOT checked is whether the `Last verified` sha is recent, because
   that check oscillates — the line names the commit the document was
   read against, which is `HEAD` while the work is uncommitted and
   `HEAD~1` the moment it lands, so any recency assertion reds on the
   commit immediately after the one that satisfied it. The sha is
   only checked to be real and reachable, which catches a fabricated
   or mistyped one.

   Fails CLOSED: an empty discovery set is an error, not a pass.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
/*
 * Each check reads the file that OWNS its section, not the whole doc set.
 *
 * `docs/ARCHITECTURE.md`'s index says sections 2, 3, 4, 5 and 8 live in `docs/architecture/`
 * because their source material was too long to inline. So §6.2's directory tree is in
 * ARCHITECTURE.md and §4's sitemap is in `architecture/routes.md`, and a check pointed at the
 * wrong one measures a file that was never going to contain the answer.
 *
 * That is not hypothetical: the first version of this guard read ARCHITECTURE.md for both, and
 * T080's session measured "§4 records zero api routes" the same way. Both got the right answer,
 * because routes.md records zero as well — a correct conclusion from a measurement that could not
 * have produced any other, which is worth exactly as much as a coin landing the way you called it.
 *
 * Scoping each check to its owning file also keeps the checks meaningful: a route named in
 * `seams.md` as a PLANNED seam must not satisfy the sitemap, and a module named anywhere in prose
 * must not satisfy the directory tree.
 */
const TREE_DOC = fileURLToPath(new URL("../docs/ARCHITECTURE.md", import.meta.url));
const SITEMAP_DOC = fileURLToPath(new URL("../docs/architecture/routes.md", import.meta.url));

/**
 * The paths tracked on the `backend` branch — the code that has actually **shipped**.
 *
 * This is the domain, not the working tree, and the distinction is the whole correctness of this
 * guard. `docs/ARCHITECTURE.md` describes the merged system; a module sitting in an implementer's
 * worktree has not merged, is not part of that system, and is not owed a row yet.
 *
 * The first version read the working tree, which made the guard **red by construction in every
 * implementer worktree from the moment the module landed** — and unfixable there, because the guard's
 * own header says `docs/ARCHITECTURE.md` is in no task's `Owns` set. It demanded a row that only the
 * orchestrator may write, from a session forbidden to write it. T070's implementer hit it, declined
 * both the partition breach and a workaround, and asked instead.
 *
 * Reading `backend` fixes it from both ends: on base the answer is unchanged, because HEAD is
 * `backend`; in a worktree the new module is absent from `backend` and correctly not required, and
 * it becomes required the moment the merge commit lands — which is exactly when the orchestrator is
 * writing that row anyway.
 *
 * Fails CLOSED: if the ref does not resolve, that is an error rather than an empty domain.
 */
function shippedPaths(): readonly string[] {
  const ref = spawnSync("git", ["rev-parse", "--verify", "--quiet", "backend"], { cwd: REPO_ROOT });
  if (ref.status !== 0) {
    throw new Error(
      "The `backend` branch does not resolve, so this guard cannot tell shipped code from code " +
        "that only exists in a worktree. That distinction is the whole check: without it this " +
        "either demands rows for unmerged modules or demands none at all.",
    );
  }
  return execFileSync("git", ["ls-tree", "-r", "--name-only", "backend"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .filter((line) => line.length > 0);
}

/** Every `lib/server/<name>/` that has merged. */
function serverModules(): readonly string[] {
  return [
    ...new Set(
      shippedPaths().flatMap((p) => {
        const m = /^lib\/server\/([^/]+)\//.exec(p);
        return m ? [m[1]!] : [];
      }),
    ),
  ].sort();
}

/**
 * Every routable `/api/...` path that has merged, from the same shipped set as the modules.
 *
 * Both halves now share one domain, which they did not before. T080's session found the two
 * disagreeing — the module half walked the filesystem, the route half read `git ls-files`, so a
 * route was covered one `git add` later than a module. That asymmetry is gone here rather than
 * patched: one function answers "what has shipped" and both checks ask it.
 */
function apiRoutes(): readonly string[] {
  return [
    ...new Set(
      shippedPaths()
        .filter((p) => p.startsWith("app/api/") && p.endsWith("/route.ts"))
        .map((p) => p.replace(/^app/, "").replace(/\/route\.ts$/, "")),
    ),
  ].sort();
}

describe("docs/ARCHITECTURE.md records what the tree actually contains", () => {
  it("every lib/server module appears in section 6.2's directory tree", () => {
    /*
     * Section 6.2 only, not the whole file — and this is not tidiness.
     *
     * Falsifying the whole-file version by renaming §6.2's `server/export/` row left it GREEN,
     * because §12's revision log says "`lib/server/export/` added" and the substring was still
     * present. So the directory-tree row could be deleted outright and the guard would report the
     * module as recorded, on the strength of a log entry saying it once was. A check satisfiable by
     * the record of a change rather than by the change is a check that cannot fail.
     */
    const whole = readFileSync(TREE_DOC, "utf8");
    const start = whole.indexOf("### 6.2");
    const after = whole.indexOf("\n## ", start);
    const doc = start === -1 ? "" : whole.slice(start, after === -1 ? undefined : after);
    expect(
      doc.length,
      "Section 6.2 was not found in docs/ARCHITECTURE.md. Its heading moved or the section is " +
        "gone; either way the assertion below would pass over an empty string.",
    ).toBeGreaterThan(0);

    const modules = serverModules();

    expect(
      modules.length,
      "No server modules were discovered, which would make the assertion below vacuous.",
    ).toBeGreaterThan(0);

    const missing = modules.filter((name) => !doc.includes(`server/${name}/`));
    expect(
      missing,
      "A module exists under lib/server and is recorded nowhere in docs/ARCHITECTURE.md. " +
        "CLAUDE.md makes that document the specification the backend is built from and requires " +
        "section 6 to be updated in the same commit as the module. Add a row for it, or the " +
        "document describes a system that is not the one in the tree.",
    ).toEqual([]);
  });

  it("every /api route appears in section 4's sitemap", () => {
    const doc = readFileSync(SITEMAP_DOC, "utf8");
    const routes = apiRoutes();

    expect(
      routes.length,
      "No /api routes were discovered, which would make the assertion below vacuous. If the API " +
        "genuinely has no routes, delete this test rather than letting it pass over an empty set.",
    ).toBeGreaterThan(0);

    /* Bracketed segments are written the same way in the tree and in the sitemap, so the path is
       compared literally. A route recorded under a prettified spelling is a route this cannot
       find, which is the correct outcome: the sitemap is for someone matching it against files. */
    const missing = routes.filter((route) => !doc.includes(route));
    expect(
      missing,
      "A route exists under app/api and is absent from docs/ARCHITECTURE.md. CLAUDE.md's " +
        "change table requires section 4's sitemap to gain every added route in the same commit. " +
        "A sitemap missing routes is worse than no sitemap: it reads as complete.",
    ).toEqual([]);
  });

  it("the Last verified line names a commit that exists in this history", () => {
    const doc = readFileSync(TREE_DOC, "utf8");
    const sha = /Last verified against commit `([0-9a-f]{7,40})`/.exec(doc)?.[1];

    expect(
      sha,
      "docs/ARCHITECTURE.md has no `Last verified against commit <sha>` line. CLAUDE.md requires " +
        "it to be updated whenever the document is touched, so its absence removes the only " +
        "record of what tree the document was last read against.",
    ).toBeDefined();

    /* Reachability, not recency — see the header for why recency oscillates. This catches the
       failure that actually happens: a sha copied from another branch, or mistyped. */
    const reachable = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", `${sha}`, "HEAD"],
      { cwd: REPO_ROOT },
    );
    expect(
      reachable.status,
      `The Last verified line names commit ${sha}, which is not an ancestor of HEAD. Either it ` +
        `does not exist, or it is on a branch this one never took — in both cases the line does ` +
        `not identify a tree anyone can check the document against.`,
    ).toBe(0);
  });
});
