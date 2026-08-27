/* ============================================================
   Owner instruction, 2026-08-14: recompute the dependency graph
   before every wave and reassign the next wave accordingly.

   The reason it is a guard and not a note: the Phase 0 graph went
   stale in three ways while six tasks merged, and nothing noticed
   until the owner asked. `Depends on` lines were written once and
   never re-derived, so T080 reached wave 4 while consuming a
   dependency it does not declare, and T050 reached it while its
   blind suite could not typecheck.

   What this checks is narrower than a graph and is the part that
   actually breaks a dispatch: **a task that has been claimed must
   not consume a barrel whose owning task has not merged.** A blind
   suite imports the barrel it tests against, and a dynamic
   `import()` specifier resolves at compile time (T030 proved this),
   so an unmerged dependency is not a contract-only relationship —
   it is a gate that cannot go green.

   Fails CLOSED: an unrecognised barrel is an error, not a pass,
   because the failure mode being caught is a dependency nobody
   listed.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BACKEND_MD = fileURLToPath(new URL("../backend.md", import.meta.url));

/** Which task owns each `@/lib/server/<name>` barrel. Derived from every task's `Owns` line. */
const BARREL_OWNER: Readonly<Record<string, string>> = {
  auth: "T000", http: "T000", types: "T000", db: "T000",
  archive: "T010", cards: "T020", versioning: "T025", policy: "T060",
  naming: "T070", observability: "T240", ontology: "T030", accounts: "T050",
  engine: "T040", registry: "T080", export: "T090", saves: "T140",
  limits: "T230", publish: "T100", profiles: "T130", counters: "T150",
  ballot: "T160", notes: "T170", runs: "T180", search: "T200",
  terms: "T210", lineage: "T110", lifecycle: "T120", mcp: "T220",
  seed: "T250", notifications: "T190",
};

/** A task has merged when its verified tag exists. The tags are the record, not this file. */
function mergedTasks(): ReadonlySet<string> {
  const tags = execFileSync("git", ["tag"], { cwd: REPO_ROOT, encoding: "utf8" });
  return new Set(
    tags.split("\n").flatMap((tag) => {
      const match = /^(t\d{3})-verified$/.exec(tag.trim());
      return match ? [match[1]!.toUpperCase()] : [];
    }),
  );
}

interface Task { id: string; state: string; consumes: ReadonlySet<string>; unknown: readonly string[] }

function tasks(): readonly Task[] {
  const md = readFileSync(BACKEND_MD, "utf8");
  return md
    .split(/^### /m)
    .slice(1)
    .flatMap((section) => {
      const id = /^(T\d{3}),/.exec(section)?.[1];
      if (id === undefined) return [];
      /* Only the contract, never the Log — a Log entry quoting a barrel is a record of what
         happened, not a declaration of what this task consumes. That distinction cost a false
         defect report earlier in this run. */
      const body = section.split("- **Log:**")[0] ?? "";
      const state = /- \*\*State:\*\* (\S+)/.exec(body)?.[1] ?? "unknown";
      const names = [...body.matchAll(/@\/lib\/server\/([a-z]+)/g)].map((m) => m[1]!);
      const consumes = new Set(
        names.filter((n) => BARREL_OWNER[n] !== undefined).map((n) => BARREL_OWNER[n]!),
      );
      /* Declared dependencies count too, and the first version of this guard missed them —
         it scanned only barrel paths, so falsifying it by claiming T050 (which needs T070 for
         handle allocation, named as `T070` in prose and in `Depends on` rather than as
         `@/lib/server/naming`) reddened nothing. The guard's scope did not cover the way the
         dependency is actually written down, which is the exact failure it exists to catch,
         arriving inside it. Both spellings are read now. */
      const declared = /- \*\*Depends on:\*\* (.*)/.exec(body)?.[1] ?? "";
      for (const dep of declared.matchAll(/T\d{3}/g)) consumes.add(dep[0]);
      consumes.delete(id);
      return [{ id, state, consumes, unknown: [...new Set(names.filter((n) => BARREL_OWNER[n] === undefined))] }];
    });
}

describe("the dependency graph is recomputed before a wave is dispatched", () => {
  it("no claimed task consumes a barrel whose owning task has not merged", () => {
    const merged = mergedTasks();
    const offenders = tasks()
      .filter((t) => t.state !== "todo" && !merged.has(t.id))
      .flatMap((t) => {
        const unmet = [...t.consumes].filter((dep) => !merged.has(dep)).sort();
        return unmet.length > 0 ? [`${t.id} (${t.state}) consumes unmerged: ${unmet.join(", ")}`] : [];
      });

    expect(
      offenders,
      "A claimed task depends on a module that has not merged. A blind suite imports the barrel " +
        "it tests against and a dynamic import()'s specifier resolves at compile time, so this is " +
        "not a contract-only relationship — the gate cannot go green. Recompute the graph and " +
        "move the task to a later wave, or merge the dependency first.",
    ).toEqual([]);
  });

  it("every barrel a contract names is one this guard knows the owner of", () => {
    const unknown = tasks().flatMap((t) => t.unknown.map((n) => `${t.id}: @/lib/server/${n}`));
    expect(
      unknown,
      "A contract names a barrel with no known owning task. Add it to BARREL_OWNER, or the " +
        "dependency it represents is invisible to the check above — which is the failure mode " +
        "this guard exists to catch.",
    ).toEqual([]);
  });
});
