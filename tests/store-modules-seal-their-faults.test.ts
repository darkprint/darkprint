/* ============================================================
   D-13: no rejection may carry the failed statement or its bound
   parameters. Five of six `lib/server` modules ship an `errors.ts`
   and seal their faults. `lib/server/registry/` shipped none — and
   a closed-port probe against its merged, tagged routes returned a
   raw `DrizzleQueryError` opening with the full `select … from
   "bundle"`.

   `tests/error-hygiene.test.ts` cannot see that, and the reason is
   the interesting one. It builds its domain BY CONSTRUCTION — every
   barrel export whose `prototype instanceof Error` — so a module
   exporting no error class contributes an empty domain and passes.
   AN ABSENT CLASS LEAKS BY NOT EXISTING. Its `>= 8` floor does not
   help either: the floor counts across all modules, so one module
   contributing zero hides inside a total the others satisfy.

   A domain built by construction is only as complete as the thing
   it constructs over, and constructing over exported error classes
   exempts precisely the module most likely to be leaking.

   So this guard constructs over what a module REACHES instead: any
   `lib/server/<name>/` whose source imports `@/lib/db` is talking
   to Postgres, and must publish at least one sealed error class to
   wrap what the driver throws. Derived, so the next
   database-touching module is covered the day it lands.

   Fails CLOSED: no modules discovered is an error, not a pass.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Modules that have SHIPPED, so an unmerged worktree is never red for work in progress. */
function shippedServerFiles(): readonly string[] {
  return execFileSync("git", ["ls-tree", "-r", "--name-only", "backend", "lib/server"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .filter((p) => p.endsWith(".ts") && !p.endsWith(".test.ts"));
}

/**
 * The one module known to be unsealed, with the task that fixes it.
 *
 * This is an exemption and it is written to EXPIRE rather than to be maintained. The second
 * assertion below reds when an entry here gains an error class — so the day T081 lands, this guard
 * fails until the name is removed, and the exemption cannot outlive the defect it names.
 *
 * It exists rather than a red base because three adversary rounds are in flight with pre-registered
 * arithmetic keyed to base's current failing set, and moving that mid-round would invalidate their
 * reconciliations for a defect they did not introduce. It is not a judgement that the leak is
 * acceptable: T081 exists, it is a raw `DrizzleQueryError` escaping a merged tagged route with the
 * full query in its message, and D-13 is the clause it violates.
 */
const KNOWN_UNSEALED: readonly string[] = ["registry"]; // T081

describe("a lib/server module that reaches Postgres seals its faults", () => {
  it("every module importing @/lib/db exports at least one error class", () => {
    const files = shippedServerFiles();
    expect(
      files.length,
      "No shipped lib/server files were found, which would make the assertion below vacuous.",
    ).toBeGreaterThan(0);

    const reachesDb = new Set<string>();
    const declaresError = new Set<string>();
    for (const file of files) {
      const name = /^lib\/server\/([^/]+)\//.exec(file)?.[1];
      if (name === undefined) continue;
      /*
       * Read from `backend`, NOT from the working tree, and this is the whole correctness of the
       * check rather than a detail.
       *
       * The domain above is `git ls-tree backend` — the SHIPPED tree — and the first version of this
       * loop then read each path with `readFileSync` from the WORKING tree. Those are two different
       * trees, which is this file's own scope rule committed inside the guard written for it. The
       * moment T050 merged, `lib/server/accounts/errors.ts` existed on `backend` and did not exist
       * in any worktree that had not merged, so the guard died with ENOENT and reported NOTHING
       * about whether any module seals its faults — in every worktree at once, silently, because an
       * error is not a red about the subject.
       *
       * Found by T081's implementer, in a worktree behind base, which is exactly where it fires.
       */
      const source = execFileSync("git", ["show", `backend:${file}`], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
      /* `@/lib/db` is the only way to a connection; a module that never names it cannot raise a
         driver error and owes no wrapper. */
      if (/from\s+["']@\/lib\/db/.test(source)) reachesDb.add(name);
      if (/export\s+class\s+\w*Error\b/.test(source)) declaresError.add(name);
    }

    const unsealed = [...reachesDb]
      .filter((m) => !declaresError.has(m))
      .filter((m) => !KNOWN_UNSEALED.includes(m))
      .sort();
    expect(
      unsealed,
      "A lib/server module imports @/lib/db and publishes no error class, so whatever the driver " +
        "throws escapes as-is — and a DrizzleQueryError's message opens with the full query and " +
        "every bound parameter (D-13). tests/error-hygiene.test.ts cannot catch this: it builds " +
        "its domain from exported error classes, so a module with none contributes an empty domain " +
        "and passes. An absent class leaks by not existing. Add a sealed error class that carries " +
        "the operation alone, with the driver error on `cause`.",
    ).toEqual([]);
  });

  it("no exemption outlives the defect it names", () => {
    const files = shippedServerFiles();
    const stale: string[] = [];
    for (const name of KNOWN_UNSEALED) {
      const sealed = files
        .filter((f) => f.startsWith(`lib/server/${name}/`))
        /* `git show`, not `readFileSync` — same reason as the loop above: the domain is `backend`
           and reading the working tree makes the two disagree the moment a merge lands. */
        .some((f) =>
          /export\s+class\s+\w*Error\b/.test(
            execFileSync("git", ["show", `backend:${f}`], { cwd: REPO_ROOT, encoding: "utf8" }),
          ),
        );
      if (sealed) stale.push(name);
    }
    expect(
      stale,
      "A module in KNOWN_UNSEALED now exports an error class, so the exemption is stale and this " +
        "guard has stopped covering it. Remove the name. An exemption that survives its own fix is " +
        "how a blacklist stops being a record of what is owed and becomes a list of what is never " +
        "checked.",
    ).toEqual([]);
  });
});
