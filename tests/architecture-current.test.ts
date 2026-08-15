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
import { readFileSync, readdirSync } from "node:fs";
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

/** Every `lib/server/<name>/` on disk. The filesystem is the domain, so a new module is covered. */
function serverModules(): readonly string[] {
  return readdirSync(fileURLToPath(new URL("../lib/server", import.meta.url)), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Every routable `/api/...` path, derived from where `route.ts` files actually are rather than from
 * a list.
 *
 * `--cached --others --exclude-standard`, so an **untracked** route counts. The first version was
 * `git ls-files` alone, which made the two halves of this guard disagree about their own domain:
 * the module check walks the filesystem and covers a module the moment it exists, while the route
 * check covered a route only one `git add` later. The normal order is write the route, run the
 * gates, then stage — so a route written and gated before staging passed a check whose failure
 * message reads "A sitemap missing routes is worse than no sitemap: it reads as complete", while
 * the tree was in exactly that state.
 *
 * This repo has paid for this precise blind spot before: `tests/no-raw-control-bytes.test.ts` was
 * `git ls-files`-only, was blind to a blind author's uncommitted work, and T-01 recurred twice
 * inside that window before the same one-flag fix.
 *
 * Found by T080's session falsifying the *forward-looking* claim rather than the one demonstrated
 * — not "a recorded row was renamed" but "a new module or route lands unrecorded", which is the
 * claim that has to hold for the next twenty tasks. `--exclude-standard` still keeps genuinely
 * ignored paths out, so a build artefact is not mistaken for a shipped route.
 */
function apiRoutes(): readonly string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "app/api"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return [
    ...new Set(
      out
        .split("\0")
        .filter((p) => p.endsWith("/route.ts"))
        .map((p) => p.replace(/^app/, "").replace(/\/route\.ts$/, "")),
    ),
  ].sort();
}

describe("docs/ARCHITECTURE.md records what the tree actually contains", () => {
  it("every lib/server module appears in section 6.2's directory tree", () => {
    const doc = readFileSync(TREE_DOC, "utf8");
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
