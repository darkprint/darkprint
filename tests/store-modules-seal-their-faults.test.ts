/* ============================================================
   A lib/server module that reaches Postgres seals its faults.

   No rejection may carry the failed statement or its bound
   parameters. `tests/error-hygiene.test.ts` cannot see a module
   that exports no error class at all: it builds its domain from
   exported classes, so a module with none contributes an empty
   domain and passes. The registry once shipped exactly that way
   and answered a closed-port probe with a raw `DrizzleQueryError`
   opening with the full `select … from "bundle"`. AN ABSENT CLASS
   LEAKS BY NOT EXISTING.

   So this guard constructs over what a module REACHES instead: any
   `lib/server/<name>/` whose committed source imports `@/lib/db`
   at runtime is talking to Postgres, and must publish at least one
   error class to wrap what the driver throws. Derived, so the next
   database-touching module is covered the day it lands.

   Fails CLOSED: no modules discovered is an error, not a pass.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The committed tree, read through `git` rather than the working directory, so the file list
 * and the file contents below describe one tree: a module added or deleted is measured once
 * the change is committed and never half-way.
 */
function committedServerFiles(): readonly string[] {
  return execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "lib/server"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .filter((p) => p.endsWith(".ts") && !p.endsWith(".test.ts"));
}

function committedSource(file: string): string {
  return execFileSync("git", ["show", `HEAD:${file}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/**
 * Modules known to be unsealed, each an exemption written to EXPIRE rather than to be
 * maintained: the second cell reds when an entry here gains an error class, so an exemption
 * cannot outlive the defect it names.
 */
const KNOWN_UNSEALED: readonly string[] = [];

describe("a lib/server module that reaches Postgres seals its faults", () => {
  it("every module importing @/lib/db exports at least one error class", () => {
    const files = committedServerFiles();
    expect(
      files.length,
      "No committed lib/server files were found, which would make the assertion below vacuous.",
    ).toBeGreaterThan(0);

    const reachesDb = new Set<string>();
    const declaresError = new Set<string>();
    for (const file of files) {
      const name = /^lib\/server\/([^/]+)\//.exec(file)?.[1];
      if (name === undefined) continue;
      const source = committedSource(file);
      /* `@/lib/db` is the only way to a connection; a module that never names it at runtime
         cannot raise a driver error and owes no wrapper. `import type` is erased at build, so
         it cannot raise anything either and is excluded for the same reason. */
      if (/(?<!import\s+type\s[^;]{0,200})from\s+["']@\/lib\/db/.test(source)) {
        const typeOnly = /import\s+type\s[^;]*from\s+["']@\/lib\/db/.test(source);
        const valueImport = /import\s+(?!type\s)[^;]*from\s+["']@\/lib\/db/.test(source);
        if (valueImport || !typeOnly) reachesDb.add(name);
      }
      if (/export\s+class\s+\w*Error\b/.test(source)) declaresError.add(name);
    }

    const unsealed = [...reachesDb]
      .filter((m) => !declaresError.has(m))
      .filter((m) => !KNOWN_UNSEALED.includes(m))
      .sort();
    expect(
      unsealed,
      "A lib/server module imports @/lib/db and publishes no error class, so whatever the driver " +
        "throws escapes as-is, and a DrizzleQueryError's message opens with the full query and " +
        "every bound parameter. tests/error-hygiene.test.ts cannot catch this: it builds its " +
        "domain from exported error classes, so a module with none contributes an empty domain " +
        "and passes. An absent class leaks by not existing. Add a sealed error class that " +
        "carries the operation alone, with the driver error on `cause`.",
    ).toEqual([]);
  });

  it("no exemption outlives the defect it names", () => {
    const files = committedServerFiles();
    const stale: string[] = [];
    for (const name of KNOWN_UNSEALED) {
      const sealed = files
        .filter((f) => f.startsWith(`lib/server/${name}/`))
        .some((f) => /export\s+class\s+\w*Error\b/.test(committedSource(f)));
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
