/* ============================================================
   A task's State says where its work IS. `impl-done` on a branch
   that has no commits is a claim about a tree nobody can check out.

   This happened: T050 was recorded `impl-done` at a sha that is
   base, on a branch zero commits ahead, with the whole
   implementation living only in the worktree. An adversary handed
   that sha would `git rev-parse HEAD`, get agreement, and measure
   nineteen files that exist in no commit — the contamination shape
   with the stamp passing.

   `tests/task-state-agreement.test.ts` cannot see it. It compares
   the State string in base against the State string on the branch,
   and when the branch IS base those are the same file, so they
   agree trivially. A guard built to catch base lagging a branch is
   blind to a branch with nothing on it, because that failure has no
   disagreement in it.

   Fails CLOSED: a task past `claimed` whose branch does not exist
   is an error, not a pass.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BACKEND_MD = fileURLToPath(new URL("../backend.md", import.meta.url));

/** States that assert work exists. `claimed` and `todo` do not; `merged` means base holds it. */
const ASSERTS_WORK = new Set(["impl-done", "tests-written", "adversarial-pass", "reverted"]);

interface Claim { task: string; state: string; branch: string }

function claims(): readonly Claim[] {
  const md = readFileSync(BACKEND_MD, "utf8");
  const out: Claim[] = [];
  for (const chunk of md.split(/^### /m).slice(1)) {
    const id = /^(T\d{3}),/.exec(chunk)?.[1];
    if (id === undefined) continue;
    const body = chunk.split("- **Log:**")[0] ?? "";
    const state = /- \*\*State:\*\* (\S+)/.exec(body)?.[1]?.replaceAll("*", "").trim();
    if (state === undefined || !ASSERTS_WORK.has(state)) continue;
    /* The branch is named in the task's own row/section rather than in a list here, so a task
       added later is covered without editing this file. */
    const branch = /`(feat\/[a-z0-9-]+)`/.exec(body)?.[1];
    if (branch === undefined) continue;
    out.push({ task: id, state, branch });
  }
  return out;
}

describe("a State past `claimed` names a branch that actually carries the work", () => {
  it("every such branch is ahead of backend", () => {
    const offenders: string[] = [];
    for (const { task, state, branch } of claims()) {
      const exists = spawnSync("git", ["rev-parse", "--verify", "--quiet", branch], { cwd: REPO_ROOT });
      if (exists.status !== 0) {
        offenders.push(`${task} is "${state}" and ${branch} does not exist`);
        continue;
      }
      const ahead = execFileSync("git", ["rev-list", "--count", `backend..${branch}`], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      }).trim();
      if (ahead === "0") {
        offenders.push(`${task} is "${state}" but ${branch} is 0 commits ahead of backend`);
      }
    }

    expect(
      offenders,
      "A task's State asserts its work exists, and its branch carries none. The sha in a handover " +
        "then names a tree without the work in it — a receiving agent runs `git rev-parse HEAD`, " +
        "gets agreement, and measures files that exist in no commit. task-state-agreement cannot " +
        "see this: it compares two State strings, and when the branch is base they are the same " +
        "file and agree trivially. Commit the work, or set the State back.",
    ).toEqual([]);
  });
});
