// components/build/BuildWorkspace.test.ts
/* ============================================================
   Fix round 1, FIX 4 — this file did not exist before this round.
   ------------------------------------------------------------
   Task 6's review found `BuildWorkspace.tsx` carrying the plan's most carefully specified
   behaviour — marker REPLACEMENT, not accumulation, spec §2.2 — with zero automated
   coverage. `setMarks([...current, ...next])` in place of the correct `setMarks(next)` is a
   one-keystroke mistake that produces no symptom on a reader's FIRST choice, only their
   second, which is exactly the kind of defect a human clicking through the page once (the
   only verification this component had) will not catch. "No DOM in this harness" was never
   a real excuse: `components/site/honesty.test.ts` already `renderToStaticMarkup`s
   `DownloadStep` and `AgentHandoff`, two of this file's own children, in this same node
   environment.

   Two kinds of test live here. `nextMarks` — the pure diff `choose()` commits, exported from
   `BuildWorkspace.tsx` for exactly this file to import — gets driven directly, sequence and
   all, with no rendering at all. The SSR markup tests below it pin the shape a static build
   actually ships: both route-box hrefs, the absence of the step machinery `GuidedPath.tsx`
   carried, and the section headings this fix round's other findings touched.
   ============================================================ */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { plainText } from "@/components/ui/visible-text";
import { BuildWorkspace, nextMarks } from "./BuildWorkspace";
import { DEFAULT_ITERATIONS } from "./choices";
import { buildState } from "./state";

// `StarterChoices` spells the cap `maxIterations` (`lib/starter/variants.ts`), not
// `iterations` — the same fixture `surfaces.test.ts` and `WorkspaceStage.test.ts` use.
const base = { output: "python", approval: "tester", maxIterations: DEFAULT_ITERATIONS } as const;

describe("nextMarks", () => {
  it("marks nothing when the choice does not move any surface", () => {
    expect(nextMarks(buildState(base), base)).toEqual([]);
  });

  it("marks dot, cards and vocabulary when the output kind changes", () => {
    // `nextMarks` is `changedSurfaces` composed with `buildState`, so this is the same claim
    // `surfaces.test.ts` already pins — asserted again here because it is the "before" half
    // of the sequential case immediately below, and that case is only convincing if this
    // half is independently true.
    const after = { ...base, output: "react" } as const;
    const marks = nextMarks(buildState(base), after);
    expect(marks).toContain("dot");
    expect(marks).toContain("cards");
    expect(marks).toContain("vocabulary");
  });

  /**
   * The reviewer's exact case (task 6 fix round 1, FIX 4's brief, verbatim): the output
   * choice marks Vocabulary; a SUBSEQUENT cap change must leave Vocabulary unmarked, even
   * though Vocabulary still differs from the DEFAULT. This passes only if `BuildWorkspace`'s
   * `choose()` REPLACES `marks` on every call rather than accumulating onto them —
   * `setMarks([...current, ...next])` in place of `setMarks(next)` would keep Vocabulary
   * marked here forever, with no symptom visible on the first choice alone.
   */
  it("replaces marks per choice — a later choice does not keep an earlier mark alive", () => {
    const afterOutput = { ...base, output: "react" } as const;
    const marksAfterOutput = nextMarks(buildState(base), afterOutput);
    expect(marksAfterOutput).toContain("vocabulary");

    // The cap moves no `type`/`phases`/`riskMarkers`/`tools` (`surfaces.ts`'s own
    // `terms()`), so this second, independent diff must not mark vocabulary on its own.
    const afterCap = { ...afterOutput, maxIterations: afterOutput.maxIterations + 1 };
    const marksAfterCap = nextMarks(buildState(afterOutput), afterCap);
    expect(marksAfterCap).not.toContain("vocabulary");

    // Proof this is a replacement guarantee and not a coincidence: the vocabulary genuinely
    // still differs from where the sequence STARTED (`base`, output "python") — the output
    // choice is still "react" — so a diff taken against the ORIGINAL default would mark
    // vocabulary here too. An accumulating `setMarks` would therefore have kept it marked;
    // only replacing `marks` on every `choose()` call clears it.
    expect(nextMarks(buildState(base), afterCap)).toContain("vocabulary");
  });
});

describe("BuildWorkspace — SSR markup", () => {
  const html = renderToStaticMarkup(createElement(BuildWorkspace));

  it("holds both outbound links of the route-box", () => {
    // Spec §2.2: one route-box, both destinations, above the workspace.
    expect(html).toContain('href="/what-a-blueprint-is"');
    expect(html).toContain('href="/spec/topology"');
  });

  it("carries no step counter and no Back/Next pair", () => {
    // `GuidedPath.tsx`'s own step machinery — deleted from this route by task 6, and never
    // reintroduced by this fix round's other edits.
    const text = plainText(html);
    expect(text).not.toMatch(/step\s+\d+\s+of\s+\d+/i);
    expect(text).not.toContain("← Back");
  });

  it("names the workspace section without repeating ScoreStrip's own eyebrow", () => {
    // Fix round 1, FIX 2: this heading used to read "Your blueprint", the same three words
    // `ScoreStrip` prints as its own eyebrow 44px below it on every one of the five tabs.
    const match = html.match(/<h2 id="workspace-heading"[^>]*>([^<]*)<\/h2>/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("Your workspace");
  });

  it("names the exits section, and gives both exits a peer title", () => {
    const exitsHeading = html.match(/<h2 id="exits-heading"[^>]*>([^<]*)<\/h2>/);
    expect(exitsHeading).not.toBeNull();
    expect(exitsHeading?.[1]).toBe("You leave with one of two things");

    // Fix round 1, FIX 1: only the download exit's own title is new; `AgentHandoff`'s lost
    // its leading "Or" ("Or have your agent write one for your own goal") so the two read
    // as siblings rather than a stated option and its alternative.
    const text = plainText(html);
    expect(text).toContain("This starter, as files");
    expect(text).toContain("Have your agent write one for your own goal");
    expect(text).not.toContain("Or have your agent");
  });
});
