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
   actually ships: both route-box hrefs, the absence of the step machinery the deleted
   `GuidedPath.tsx` carried, and the section headings this fix round's other findings
   touched.
   ============================================================ */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { plainText } from "@/components/ui/visible-text";
import { SKILL_INSTALL_COMMAND } from "@/lib/skill";
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

  /**
   * Spec §2.2 asked for one route-box with BOTH destinations above the workspace. The
   * author removed `/spec/topology` on 2026-08-07 and `/what-a-blueprint-is` on 2026-08-08,
   * so the row is empty and the case is inverted rather than deleted.
   *
   * Inverted and not dropped, because the thing worth failing on has not changed — it has
   * only changed sign. A workspace that quietly grows an exit back is what this case exists
   * to catch, and the argument is now the one both removals were made on: two exits from a
   * workspace, both to reading, is the workspace pointing away from itself. Both routes are
   * a click away in the header on every page, and a reader who arrived HERE chose to build.
   */
  it("offers no reading exit above the workspace", () => {
    expect(html).not.toContain('href="/what-a-blueprint-is"');
    expect(html).not.toContain('href="/spec/topology"');
  });

  it("carries no step counter and no Back/Next pair", () => {
    // The step machinery the deleted `GuidedPath.tsx` carried — off this route since task 6,
    // and never reintroduced by any edit since.
    const text = plainText(html);
    expect(text).not.toMatch(/step\s+\d+\s+of\s+\d+/i);
    expect(text).not.toContain("← Back");
  });

  it("names the workspace section without repeating ScoreStrip's own eyebrow", () => {
    // Fix round 1, FIX 2: this heading used to read "Your blueprint", the same three words
    // `ScoreStrip` prints as its own eyebrow 44px below it, on four of the five tabs —
    // `WorkspaceStage.tsx` hides the strip on the fifth, `Score`, per fix round 2.
    const match = html.match(/<h2 id="workspace-heading"[^>]*>([^<]*)<\/h2>/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("Your workspace");
  });

  it("gives both exits a peer title, and the section no heading of its own", () => {
    /* The `h2` read "You leave with one of two things" and the author asked it out on
       2026-08-08: a heading whose only content is that there are two of the things directly
       under it is a caption for a count. The region keeps an `aria-label`, so a screen
       reader is told where it is without a visible heading standing in for that.

       Held as an absence rather than dropped, because the two exit titles below only work
       as peers if nothing sits above them claiming to introduce them. */
    expect(html).not.toContain('id="exits-heading"');
    expect(html).not.toContain("You leave with one of two things");
    expect(html).toContain('aria-label="What you leave with"');

    // Fix round 1, FIX 1: `AgentHandoff`'s title lost its leading "Or" ("Or have your agent
    // write one…") so the two read as siblings rather than a stated option and its
    // alternative. Both were renamed on 2026-08-08 and both are still peers.
    const text = plainText(html);
    expect(text).toContain("Download the bundle");
    expect(text).toContain("DarkPrint skill");
    expect(text).not.toContain("Or have your agent");
  });

  /**
   * The skill announcement, held to the placement the investigation chose over two others.
   *
   * `AgentHandoff.tsx`'s docblock argues it at length; this is the part of the argument a
   * later pass can break without noticing. The install command has to be on the route at
   * all (otherwise the landing's hero chip is the only place it is ever printed, and a
   * reader who arrived at `/build` first never meets it), and it has to be inside the
   * second exit rather than beside the two — which is what the `h3` count asserts. Two exit
   * titles, and no third.
   */
  it("announces the skill inside the second exit, not as a third one", () => {
    const text = plainText(html);
    expect(text).toContain(SKILL_INSTALL_COMMAND);
    expect(text).toContain("The DarkPrint skill");

    // Both exits still title themselves with a `font-display` `h3` and nothing else on this
    // route does; a third would mean the skill had been promoted out of `AgentHandoff`.
    const exitTitles = [...html.matchAll(/<h3 class="font-display[^"]*">([^<]*)<\/h3>/g)].map(
      (match) => match[1],
    );
    expect(exitTitles).toEqual(["Download the bundle", "DarkPrint skill"]);
  });

  /**
   * The naming hazard, as an assertion rather than as a note in a docblock.
   *
   * `lib/core/card/schema.ts` defines `skill?: string` as a node card's behaviour document,
   * and `/what-a-blueprint-is#the-words` prints that definition in the open. A surface that
   * says "the skill" unqualified is contradicting a definition the site publishes two nav
   * entries away, so every mention on this route carries the qualifier.
   */
  it("never says \"the skill\" unqualified", () => {
    const text = plainText(html);
    expect(text).not.toMatch(/\bthe skill\b(?! document)/i);
    expect(text).toMatch(/\bthe DarkPrint skill\b/i);
  });

  /**
   * The two folder shapes, now that there is only one of them.
   *
   * This case held a reconciliation: `DownloadStep` led on `factory.dot` and `DownloadPanel`
   * printed `attractor run factory.dot` inside it, while the skill deliberately emits the
   * registry shape and no `factory.dot`. Both folders were described on one screen, so the
   * difference had to be stated on that screen — "Not factory.dot, which DarkPrint's
   * exporter compiles from those two on the way out".
   *
   * The author took `factory.dot` off the download on 2026-08-08, so both halves of the row
   * name the same four files and there is nothing left to explain away. The case is
   * INVERTED rather than deleted: the sentence must not come back while the download does
   * not lead on the file, because an apology for a difference that no longer exists reads
   * as a fault where there is none. What both halves must still agree on is the list, and
   * that is what the first assertion holds.
   */
  it("describes one folder shape, with nothing to reconcile", () => {
    const text = plainText(html);
    // "blueprint.dot" until the terminology pass (2026-08-25): `AgentHandoff` names the
    // topology file by its new name and this case follows the copy rather than the old
    // filename.
    expect(text).toMatch(/it writes what the registry stores: topology\.dot/i);
    expect(text).not.toMatch(/\bNot\s+factory\.dot\b/i);
    expect(text).not.toMatch(/exporter compiles from those two on the way out/i);
  });
});
