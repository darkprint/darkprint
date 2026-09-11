/* ============================================================
   Source hygiene — no raw NUL bytes
   ------------------------------------------------------------
   `components/build/surfaces.ts` shipped, for two commits, with a literal NUL byte (the
   single-quote-delimited join delimiter in its `cardsText` helper) written directly into the
   source as the raw control byte, instead of as the source-level escape sequence for it.
   Nothing about that is wrong at the *value* level — a NUL is a genuinely collision-proof
   delimiter, since none of the text being joined can contain one — but writing it as a raw
   byte instead of the source-level escape sequence is a defect with a much larger blast
   radius than the line it sits on: git classifies a file as binary the moment it finds a NUL
   in the first 8000 bytes, and a binary file gets no diff. `git diff`, `git show`, `git log
   -p`, `git blame` and every PR review tool built on them all render `Bin NNN -> MMM bytes`
   in place of the change. The file was silently unreviewable, and nothing about a raw NUL
   makes that visible in an editor — the byte renders as nothing at all.

   `components/graph/BlueprintGraph.tsx` had the identical bug, independently, for the
   identical reason (a Set-key separator for a pair of node ids) — and it had gone unnoticed
   for longer, because its NULs happen to sit past git's 8000-byte binary-detection window, so
   `git diff` on that file kept working by luck rather than by correctness. That is why this
   guard walks every tracked file rather than just re-checking the one file that got caught:
   the failure mode has already reproduced once by the same mechanism, in a different file, and
   an invisible byte is exactly the kind of defect a human reviewer cannot be relied on to spot
   by reading the diff — because there is no diff to read.

   `git ls-files` is the file list, not a hand-maintained array, so a new file that makes the
   same mistake is caught the first time this suite runs against it rather than only if someone
   remembers to add it here.

   ── Why it sits in `components/site` ──
   It was written in `components/build`, beside the file that got caught. The owner deleted
   that route and its component tree on 2026-09-06, and this guard walks every tracked
   `.ts`/`.tsx` in the repository: it never had anything to do with `/build` except its
   birthplace. It has caught a raw NUL twice since, both times in files
   under `tests/server/`, so deleting it with the directory it happened to live in would have
   removed a live tree-wide check on the strength of its path. `components/site` is where the
   site-wide guards are.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();

/** Every tracked `.ts`/`.tsx` file, repo-root-relative. */
function trackedSourceFiles(): string[] {
  const listing = execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf-8" });
  return listing.split("\n").filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));
}

describe("source hygiene", () => {
  it("contains no raw NUL byte in any tracked .ts or .tsx file", () => {
    const offenders = trackedSourceFiles().filter((path) => {
      const absolute = join(REPO_ROOT, path);
      try {
        return readFileSync(absolute).includes(0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    });
    expect(
      offenders,
      offenders.length === 0
        ? undefined
        : `Found a raw NUL byte in: ${offenders.join(", ")}. A NUL in a source file is ` +
            `invisible in every editor and makes git treat the whole file as binary — no diff, ` +
            `no blame, no review. Replace the raw byte with the source-level escape "\\u0000" ` +
            `instead; the runtime string is identical, only the encoding changes.`,
    ).toEqual([]);
  });
});
