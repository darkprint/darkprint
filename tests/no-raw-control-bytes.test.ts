/* ============================================================
   T-01: a raw NUL byte lands in a test file while
   someone is writing a fixture for SQLSTATE 22021 — Postgres
   refusing a NUL in `text`. It has now happened three consecutive
   times, in three different tasks, written by three different
   agents, on that same fixture every time. `file(1)` reports the
   file as `data` rather than UTF-8 text, the diff looks fine, and
   nothing else complains.

   Four for four is not a run of bad luck, it is the default
   outcome of typing a control character into a source file: the
   author means the escape and writes the byte. The fourth was this
   file — the guard shipped with a raw NUL at offset 628, inside the
   sentence above describing exactly that mistake, so it failed on
   itself and reddened every worktree that rebased onto it. Caught by
   T020's adversary, not by me, and not by the falsification either:
   I falsified it against a planted NUL in a *different* file and
   never ran it against the tree it was about to join. Telling the next
   author to remember `file(1)` has been tried and is what failed
   three times, so this is the structural version of that reminder.

   Scanning bytes rather than trusting an extension list: the check
   is over what git tracks as text, and a file that is genuinely
   binary is skipped by its own content (a NUL in the first block
   is how git itself decides a file is binary) rather than by a
   suffix somebody has to maintain.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Extensions git tracks that are legitimately binary and are never source. */
// `onnx` joined at T300's merge: the vendored quantised encoder is genuinely binary, and its
// content is pinned by digest in its own falsified cell (D-300-08) — this guard's job here is
// only to not misread model weights as source.
const BINARY = /\.(png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|eot|pdf|zip|gz|tgz|tar|mp4|webm|onnx)$/i;

/**
 * Tracked files **and** untracked-but-not-ignored ones.
 *
 * `git ls-files` alone was the original and it is one commit too late for the case this guard
 * exists for: a blind test author's entire output is untracked until it commits, so the fifth and
 * sixth recurrences of T-01 both landed in files this check could not see. Found by T090's blind
 * author, which put two NULs in an uncommitted test file and then two more into the log entry
 * describing the first pair.
 *
 * `--others --exclude-standard` adds what is new and not gitignored, which is exactly the window
 * the guard was blind to.
 */
function candidateTextFiles(): string[] {
  const args = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"];
  const out = execFileSync("git", args, { cwd: REPO_ROOT, encoding: "buffer" });
  return [...new Set(out.toString("utf8").split("\0"))].filter(
    (p) => p.length > 0 && !BINARY.test(p),
  );
}

describe("no source file carries a raw control byte", () => {
  it("finds no NUL byte in any tracked or newly added text file (T-01)", () => {
    const offenders: string[] = [];

    for (const relative of candidateTextFiles()) {
      let bytes: Buffer;
      try {
        bytes = readFileSync(new URL(relative, `file://${REPO_ROOT}`));
      } catch {
        continue; // a tracked path that is not readable here (submodule, broken link) is not ours to judge
      }
      const at = bytes.indexOf(0);
      if (at === -1) continue;

      /* Reported flatly rather than guessed at. A first attempt tried to separate "source file
         with a stray NUL" from "binary file missing from the extension list" by sniffing the
         first 64 bytes — and called a 20-byte TypeScript file binary, because the stray NUL was
         itself inside the window being sniffed. The heuristic answered a question about the
         prefix, not about the file. The message names both possibilities and lets a human pick;
         a wrong guess in a failure message is worse than no guess. */
      offenders.push(
        `${relative}: raw NUL byte at offset ${at}. ` +
          "If this is source, escape it (\\u0000). If it is genuinely binary, add its extension to BINARY.",
      );
    }

    expect(offenders).toEqual([]);
  });
});
