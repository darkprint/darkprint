/* ============================================================
   `backend.md` records each task's State twice — once in the task
   index table near the top, once in the task's own section some
   two thousand lines below. Two places holding one fact drift.

   They have now drifted in both directions inside six hours:
   `8f01945` updated sections and left rows behind, and `9eac04a`
   — the commit that fixed that — set rows from implementer
   reports and left sections behind.

   The rule written after the second was "a state change touches
   both, in one edit". T080's blind test author pointed out that
   this does not survive a **rebase**: the two lines are far apart
   in one file and git resolves them independently, so its own
   replay conflicted on the section and merged the row silently,
   twice. An edit-time rule cannot reach a merge-time divergence.

   It also named why no resolver fixes it: resolving toward the
   more advanced of the two was luck, not judgement — had the
   drift gone the other way the same reasoning would have picked
   the other line and been right for the same accidental reason.
   A tie between two places holding one fact has no local
   tiebreak. So the check is that they agree, not which wins.

   Fails CLOSED: a task whose section state cannot be found is an
   error, not a pass, because a missing section is one of the ways
   the two stop agreeing.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BACKEND_MD = fileURLToPath(new URL("../backend.md", import.meta.url));

/** `| T080 | Registry read model … | impl-done | … |` — State is the second-to-last cell. */
const INDEX_ROW = /^\| (T\d{3}) \|(.+)\|\s*$/gm;
const SECTION_STATE = /- \*\*State:\*\* (\S+)/;

interface Disagreement { task: string; row: string; section: string }

function disagreements(): readonly Disagreement[] {
  const md = readFileSync(BACKEND_MD, "utf8");

  /* Sections first: split on the task headings and read each one's own State line. */
  const sectionState = new Map<string, string>();
  for (const chunk of md.split(/^### /m).slice(1)) {
    const id = /^(T\d{3}),/.exec(chunk)?.[1];
    if (id === undefined) continue;
    /* Only above the Log — a Log entry quoting a State is a record of what happened, not the
       task's current state. That distinction has already produced one false report in this run. */
    const body = chunk.split("- **Log:**")[0] ?? "";
    const state = SECTION_STATE.exec(body)?.[1]?.replaceAll("*", "").trim();
    if (state !== undefined) sectionState.set(id, state);
  }

  const out: Disagreement[] = [];
  for (const match of md.matchAll(INDEX_ROW)) {
    const task = match[1]!;
    const cells = match[2]!.split("|").map((c) => c.trim());
    /* The row's trailing cells are … | State | Evidence |, so State is the second from last. */
    /* Markup is not state: the index bolds a merged task's cell and the section does not, so
       `**merged**` and `merged` are the same fact spelled twice. Normalised rather than reported,
       because a guard that fires on emphasis trains its reader to ignore it. */
    const row = (cells.at(-2) ?? "").replaceAll("*", "").trim();
    if (row === "" || /^-+$/.test(row)) continue; // the header separator row, not a task
    const section = sectionState.get(task);
    if (section === undefined) {
      out.push({ task, row, section: "(no section State found)" });
    } else if (section !== row) {
      out.push({ task, row, section });
    }
  }
  return out;
}

/**
 * What each task's own branch says its State is.
 *
 * The agreement check below compares two places in one file and is therefore **blind to both being
 * wrong together** — T090's adversary found exactly that: row and section both read `claimed` while
 * the implementation was finished and handed back, so the guard stayed green over a fact that was
 * stale twice. Consistency is not correctness.
 *
 * The evidence that settles it is the task's own `feat/` branch, which the implementer updates when
 * it sets its State. In an implementer's or adversary's worktree the two are the same file and this
 * is trivially satisfied; on `backend` it reds precisely when the orchestrator has fallen behind a
 * handback, which is the one place the drift actually lives.
 */
function branchState(task: string): string | undefined {
  const branch = TASK_BRANCH[task];
  if (branch === undefined) return undefined;

  /* Existence is asked separately, and NOT by wrapping the read in a `catch` that returns
     `undefined`. The first version did exactly that and was silently inert: any failure — a missing
     branch, a git error, an option this runner does not like — became "nothing to compare", so the
     assertion passed over the very state it was written for. Falsification caught it; reading did
     not. A `catch` that answers "no evidence" is a guard that cannot fail. */
  const exists = spawnSync("git", ["rev-parse", "--verify", "--quiet", branch], { cwd: REPO_ROOT });
  if (exists.status !== 0) return undefined; // a `todo` task has no branch to disagree with

  const md = execFileSync("git", ["show", `${branch}:backend.md`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const section = md.split(/^### /m).find((c) => c.startsWith(`${task},`));
  const body = section?.split("- **Log:**")[0] ?? "";
  return SECTION_STATE.exec(body)?.[1]?.replaceAll("*", "").trim();
}

/**
 * Branches for tasks **in flight**. A task absent here is one nothing has claimed — and a task
 * that has **merged** is removed, because its branch stops being the evidence the moment `backend`
 * holds the work: the branch then reports whatever it said at handback while the truth is `merged`.
 * Leaving T080 here after its merge reddened this guard against a correct file.
 */
const TASK_BRANCH: Readonly<Record<string, string>> = {
  T070: "feat/t070-naming",
};

describe("backend.md records each task's State once, in effect", () => {
  it("the index row and the task section agree for every task", () => {
    expect(
      disagreements(),
      "A task's State differs between its index row and its own section. The two are 2,300 lines " +
        "apart in one file, so an edit-time rule does not survive a rebase — git resolves them " +
        "independently. Whichever is correct, set both: there is no local tiebreak between two " +
        "places holding one fact, and resolving toward the more advanced one is luck rather than " +
        "judgement.",
    ).toEqual([]);
  });

  it("no task's State on this branch lags what its own branch reports", () => {
    const md = readFileSync(BACKEND_MD, "utf8");
    const stale: string[] = [];
    for (const [task, branch] of Object.entries(TASK_BRANCH)) {
      const section = md.split(/^### /m).find((c) => c.startsWith(`${task},`));
      const here = SECTION_STATE.exec(section?.split("- **Log:**")[0] ?? "")?.[1]
        ?.replaceAll("*", "")
        .trim();
      const there = branchState(task);
      if (there !== undefined && here !== undefined && here !== there) {
        stale.push(`${task}: here "${here}", ${branch} reports "${there}"`);
      }
    }
    expect(
      stale,
      "A task's State here disagrees with what its own branch reports. The agreement check above " +
        "compares two places in one file and cannot see both being wrong together, which is how a " +
        "finished implementation sat at `claimed` in both. The branch is the evidence; update here.",
    ).toEqual([]);
  });
});
