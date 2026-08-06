/* ============================================================
   The block's width is one number, said in two places.
   ------------------------------------------------------------
   `block.ts` states it and `AgentNode.tsx` draws it, and Tailwind is the reason the two
   cannot be one: it reads class names out of the source and generates CSS for the ones it
   finds, so `w-[150px]` has to be a literal in the JSX and cannot be interpolated from a
   constant. A comment asking the next author to keep the pair in step is not a mechanism.

   This is, because everything downstream of that number assumes the drawn block is exactly
   `BLOCK_WIDTH` wide: `lib/content/layout.ts`'s `layerGap` clears it, `framing.ts` sizes a
   frame edge beside it, and `components/build/stage-labels.test.ts` measures a node's name
   inside it with no browser to check against. A block that quietly drew at 220 again would
   leave all three arguing about a drawing none of them was looking at.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BLOCK_WIDTH } from "./block";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();

describe("the schematic's block", () => {
  it("is drawn at exactly the width `block.ts` states", () => {
    const source = readFileSync(join(REPO_ROOT, "components/graph/AgentNode.tsx"), "utf-8");
    expect(source).toContain(`w-[${BLOCK_WIDTH}px]`);
    // And at ONE width: a `min-w`/`max-w` pair is the range this replaced, and a range is
    // what let a long name reach into the next column. `w-` is a fixed width; either
    // constraint utility would reopen it. Scoped to `className` attributes rather than the
    // whole file, because the docblock beside the box quotes the old `max-w-[220px]` to
    // say what changed, and a guard that read prose as markup would have deleted the
    // record of its own reason.
    for (const [, classes] of source.matchAll(/className="([^"]*)"/g)) {
      expect(classes).not.toMatch(/\b(min|max)-w-\[/);
    }
  });
});
