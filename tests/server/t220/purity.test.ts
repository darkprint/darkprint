/* ============================================================
   T220 AC1 — no operation writes

   The block makes this one STRUCTURAL rather than behavioural, in
   its own words: *"every verb is a read composed from read-only
   barrels, and this module takes no write path at all. The
   discriminating test is not 'a write was refused' but that the
   module's imports contain no writing function — a source-level
   assertion, in the shape T060's purity check established."*

   So this file reads `lib/server/mcp/**` off disk. That is not a
   breach of the blind partition: the CELL reads it, at run time,
   after the hand-off. The author of this file has not opened it and
   says so in the handback.

   ── why the source is stripped of comments first ──
   This repository has paid for both directions of the same mistake.
   A mutation anchor scored a false ZERO because its marker matched a
   comment rather than code, and a copy guard reddened a correct page
   on that page's own explanatory prose. `lib/server/**` here is
   written in long docblocks that name the very functions this file
   forbids — `export/index.ts` discusses `recordDownload` by name in
   a comment, and `export-release.ts`'s header names `ServedFile` and
   the serving verbs to explain why it is NOT one of them. A scan
   over raw text would red a correct module on the comment that
   proves the author understood the rule.

   ── why the specifier check is not the whole check ──
   An allowlist of barrels catches a deep path and a foreign module.
   It does not catch `import { serveCard } from "@/lib/server/export"`,
   which is an allowed barrel and a writing function: `serveCard`
   (`serve-card.ts:58`) and `serveFile` (`serve-file.ts:109`) both
   call `recordDownload`, which writes a counter row. Those two are
   the obvious composition for "read a card" and "fetch a release"
   and they break AC1 while looking exactly right. So both halves
   run, and each is reported separately — a single merged assertion
   would let one half's silence read as the other half's pass.
   ============================================================ */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { COMPOSABLE, MCP, WRITERS, importsOf } from "./contract";

const MCP_DIR = fileURLToPath(new URL("../../../lib/server/mcp", import.meta.url));

/** Every `.ts` file under a directory, or `undefined` when the directory is not there. */
function sources(dir: string): { file: string; text: string }[] | undefined {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return undefined;
  }
  const found: { file: string; text: string }[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...(sources(full) ?? []));
      continue;
    }
    if (!entry.endsWith(".ts")) continue;
    /* A test file inside the module would legitimately import a writer to build its own
       fixture, and charging that would make AC1 unsatisfiable for anyone who tests. */
    if (entry.endsWith(".test.ts")) continue;
    found.push({ file: full, text: readFileSync(full, "utf8") });
  }
  return found;
}

const files = sources(MCP_DIR);

describe("T220 AC1 — no operation writes", () => {
  /* The premise, asserted as its own cell rather than folded into the two below. If the
     module is absent both scans would find zero violations and pass, which is a green
     reporting that a directory nobody has written contains no writes. */
  it("has a module to scan at all", () => {
    expect(
      files === undefined ? "lib/server/mcp does not exist" : `${files.length} files`,
    ).not.toBe("lib/server/mcp does not exist");
    expect(files?.length ?? 0).toBeGreaterThan(0);
  });

  it("imports no writing function", () => {
    expect(files, `${MCP} has no source to scan`).toBeDefined();
    const violations = (files ?? [])
      .flatMap((f) => importsOf(f.file, f.text))
      .flatMap((imp) =>
        imp.names
          .filter((name) => WRITERS.includes(name))
          .map((name) => `${imp.file.split("/lib/server/")[1]} imports \`${name}\` from "${imp.specifier}"`),
      );
    expect(
      violations,
      "AC1 is structural: the module's imports must contain no writing function. " +
        "`serveCard` and `serveFile` both call `recordDownload`, which writes a counter row — " +
        "`exportRelease` is the read-only verb and its own header says why.",
    ).toEqual([]);
  });

  it("reaches no deep path and no barrel outside the composable set", () => {
    expect(files, `${MCP} has no source to scan`).toBeDefined();
    const outside = (files ?? [])
      .flatMap((f) => importsOf(f.file, f.text))
      .filter((imp) => imp.specifier.startsWith("@/"))
      .filter((imp) => !(COMPOSABLE as readonly string[]).includes(imp.specifier))
      .map((imp) => `${imp.file.split("/lib/server/")[1]} imports "${imp.specifier}"`);
    expect(
      outside,
      "T000's contract D-01 makes a deep path into another module internal, and D-220-03 " +
        "names the barrels this task composes. A specifier outside the set is either a deep " +
        "path or a dependency the contract does not sanction.",
    ).toEqual([]);
  });
});
