/* ============================================================
   What the centrepiece is held to.

   Three kinds of thing are checked here, and each one exists
   because it is the kind of defect this section can have without
   anything throwing:

   1. The listing still *is* the card. The tokeniser rewrites a file
      into spans, and a colouring bug that eats a character is
      invisible on screen and fatal to the claim spec §3.2 makes
      about the YAML being real. So the tokens are reassembled and
      compared to the bytes on disk.

   2. The annotations still point at the things they name, and they
      still do it in document order. They resolve by key name
      against a file that another agent was editing during this same
      pass, and a run that silently moved to the wrong lines draws a
      leader to the wrong place rather than failing. The ordering
      case below is the author's bug report, kept: with the steps in
      the spec's reading order rather than the file's, scrolling
      down moved the highlight up.

   3. The arithmetic in `geometry.ts` holds. It is arithmetic
      precisely so that it can be checked without a DOM, which is
      what `vitest.config.ts` gives us (`environment: "node"`).

   The card is read off `content/` rather than fixtured, because a
   fixture would keep passing on the day the archive's copy changes.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NODE_CARD_ANNOTATIONS, resolveAnnotations } from "./annotations";
import { NC, reelShift } from "./geometry";
import { keyBlock, keySpan, tokenizeYaml } from "./yaml";

const CARD = readFileSync(
  join(process.cwd(), "content/cards/code-builder@1.0.0.yaml"),
  "utf8",
).trimEnd();

const LINES = CARD.split("\n");

describe("the listing is the card", () => {
  it("reassembles every line from its tokens, character for character", () => {
    const rebuilt = tokenizeYaml(CARD).map((line) =>
      line.tokens.map((token) => token.text).join(""),
    );
    expect(rebuilt).toEqual(LINES);
  });

  it("numbers the lines from one, with none missing", () => {
    const lines = tokenizeYaml(CARD);
    expect(lines).toHaveLength(LINES.length);
    expect(lines.map((line) => line.no)).toEqual(LINES.map((_, i) => i + 1));
  });

  it("colours a mapping key as a key and its scalar as a value", () => {
    const [line] = tokenizeYaml("model: claude-sonnet-5");
    expect(line?.tokens).toEqual([
      { kind: "key", text: "model" },
      { kind: "sep", text: ":" },
      { kind: "plain", text: " " },
      { kind: "string", text: "claude-sonnet-5" },
    ]);
  });

  it("reads an empty flow collection as punctuation rather than as a value", () => {
    // `tools: []` says the node reaches for nothing. Painted like a string it reads as
    // one, and annotation 4 is about exactly this line.
    const [line] = tokenizeYaml("tools: []");
    expect(line?.tokens.at(-1)).toEqual({ kind: "sep", text: "[]" });
  });

  /**
   * The whole reason the scanner tracks block scalars. `spec` and `notes` are folded
   * prose and both contain a colon; parsed line by line without state, "Doc 1 §3.2:
   * isolation is not only an absent edge" turns into a mapping key.
   */
  it("keeps folded prose out of the key colour", () => {
    const lines = tokenizeYaml(CARD);
    const notes = keyBlock(CARD, "notes");
    expect(notes).toBeDefined();
    const inside = lines.slice((notes?.from ?? 1), notes?.to ?? 1);
    expect(inside.length).toBeGreaterThan(3);
    for (const line of inside) {
      expect(line.tokens.every((token) => token.kind !== "key")).toBe(true);
    }
  });

  it("ends a block scalar at the next key at the same indent", () => {
    const lines = tokenizeYaml(["spec: >-", "  folded: prose", "model: x"].join("\n"));
    expect(lines[1]?.tokens[0]?.kind).toBe("text");
    expect(lines[2]?.tokens[0]).toEqual({ kind: "key", text: "model" });
  });
});

describe("a key's block is the key plus what is indented under it", () => {
  it("finds a one-line key", () => {
    expect(keyBlock(CARD, "model")).toEqual({
      from: LINES.findIndex((l) => l.startsWith("model:")) + 1,
      to: LINES.findIndex((l) => l.startsWith("model:")) + 1,
    });
  });

  it("stops at the blank line after a sequence", () => {
    // `will_not` has an entry and a paragraph break under it. A run that swallowed the
    // break would highlight a blank line and draw the leader to the middle of nothing.
    // Asked of `will_not` rather than of `cannot` since the prohibition split: `cannot` is
    // now followed immediately by `will_not`, so it is the second of the pair that sits
    // against the break and the first that proves a run stops at the next KEY.
    const range = keyBlock(CARD, "will_not");
    expect(range).toBeDefined();
    expect(LINES[(range?.to ?? 1) - 1]?.trim()).toBe(
      "- read the checks the work will be run against",
    );
  });

  it("stops at the next top-level key, with no blank line to help it", () => {
    // The other half, and the split created the case: `cannot` and `will_not` are adjacent
    // with nothing between them, so a run that read to the next blank line would swallow
    // the second field whole and the enforced half would highlight the stated one.
    const range = keyBlock(CARD, "cannot");
    expect(range).toBeDefined();
    expect(LINES[(range?.to ?? 1) - 1]?.trim()).toBe("- acceptance-criteria");
  });

  it("is undefined for a key the card does not carry", () => {
    expect(keyBlock(CARD, "requires_approval")).toBeUndefined();
  });

  it("spans several keys as one run", () => {
    const tools = keyBlock(CARD, "tools");
    const mcp = keyBlock(CARD, "mcp");
    expect(keySpan(CARD, ["tools", "mcp"])).toEqual({
      from: tools?.from,
      to: mcp?.to,
    });
  });
});

describe("the annotations point at the places they name", () => {
  const resolved = resolveAnnotations(CARD);

  it("resolves every one against the archive's own copy of the card", () => {
    expect(resolved).toHaveLength(NODE_CARD_ANNOTATIONS.length);
    expect(resolved.map((a) => a.step)).toEqual(
      NODE_CARD_ANNOTATIONS.map((_, i) => i + 1),
    );
  });

  /**
   * THE ONE THE AUTHOR REPORTED. "When scrolling down, the highlighted elements should be
   * ordered from top to bottom. Right now, sometimes scrolling down, highlight something
   * above."
   *
   * The whole section is driven by `reelShift(current.from)`, so the walk's direction is
   * decided here, in the order of a plain array, and nowhere else. The old order followed
   * the spec's table, which puts `skill` (line 22) before `tools`/`mcp` (lines 19-21), so
   * step 4 scrolled the listing 66px back down while the reader was scrolling on. Strictly
   * increasing, not merely non-decreasing: two steps starting on the same line would leave
   * the leader pointing at one run twice with nothing moving between them, which reads as
   * a figure that has got stuck.
   */
  it("walks the card downwards, one run strictly after the last", () => {
    const starts = resolved.map((a) => a.from);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (let i = 1; i < resolved.length; i += 1) {
      const before = resolved[i - 1];
      const here = resolved[i];
      expect(
        here?.from,
        `step ${here?.step} (${here?.id}) starts at L${here?.from}, above step ${before?.step} (${before?.id}) at L${before?.from}-${before?.to}`,
      ).toBeGreaterThan(before?.to ?? 0);
    }
  });

  it.each([
    ["identity", "id: code-builder"],
    ["action", "action: >-"],
    ["spec", "spec: >-"],
    ["model", "model: claude-sonnet-5"],
    ["reach", "tools: []"],
    ["skill", "skill: skills/code-builder.md"],
    ["inputs", "inputs:"],
    ["outputs", "outputs:"],
    ["cannot", "cannot:"],
  ])("%s starts on `%s`", (id, head) => {
    const annotation = resolved.find((a) => a.id === id);
    expect(annotation).toBeDefined();
    expect(LINES[(annotation?.from ?? 1) - 1]).toBe(head);
  });

  /**
   * Spec §3.2 makes the prohibition the critical step and says what it has to claim. The
   * wording may be edited; the diagnostic code and the type it fires on may not quietly
   * drop out of it, because that sentence is the site's strongest checkable statement.
   */
  it("says what the engine does about the prohibition", () => {
    const cannot = resolved.find((a) => a.id === "cannot");
    expect(cannot?.body).toContain("bundle/prohibition-violated");
    expect(cannot?.body).toContain("acceptance-criteria");
  });

  it("names the reserved Attractor attribute the model becomes", () => {
    expect(resolved.find((a) => a.id === "model")?.body).toContain("llm_model");
  });

  /**
   * The two steps the author asked for, and the one honesty hazard they carry. `spec` is
   * the payload an agent is handed, and there is no backend here and nothing that runs a
   * graph, so the body has to put the running somewhere other than this site. It also has
   * to carry the one check the field does have, which is a length floor.
   */
  it("says what instructs the node, without claiming to run it", () => {
    const action = resolved.find((a) => a.id === "action");
    const spec = resolved.find((a) => a.id === "spec");
    expect(action?.body).toContain("`action`");
    expect(spec?.body).toContain("card/spec-too-thin");
    expect(spec?.body).toContain("own machine");
    for (const claim of ["we run", "runs it for you", "darkprint runs"]) {
      expect(spec?.body.toLowerCase()).not.toContain(claim);
    }
  });

  /**
   * The cap is still 300 characters and the reason changed with the layout.
   *
   * It used to be a clip: `NodeCardStage` gave a body a fixed 132px box and the sentence
   * that got cut was always the last one, which is where the consequence is. That
   * component is gone and `CardWalk` boxes nothing — a body runs as long as it likes in a
   * 433px column. What the cap buys now is the figure's HEIGHT: nine heads plus one open
   * body measure 470px against the listing's 530px window beside them, so the figure is
   * the listing's height and `CardWalk`'s `19.25rem` sticky half-height is right. A body
   * long enough to push the notes column past 530px moves the figure's centre and pins
   * the walk off-centre, in silence.
   */
  it.each(NODE_CARD_ANNOTATIONS.map((a) => [a.id, a] as const))(
    "%s fits the body box",
    (_id, annotation) => {
      expect(annotation.body.length).toBeLessThanOrEqual(300);
      expect(annotation.title.length).toBeLessThanOrEqual(26);
    },
  );

  /** Doc 2 §2.5. The em dash as a pause is one of the four patterns the site strips. */
  it.each(NODE_CARD_ANNOTATIONS.map((a) => [a.id, a] as const))(
    "%s uses no em dash",
    (_id, annotation) => {
      expect(annotation.body).not.toContain("—");
      expect(annotation.title).not.toContain("—");
    },
  );
});

/* ============================================================
   The reel, and what this block used to be.

   It held two sets of arithmetic, because there were two walks:
   `CardWalk` on the landing with its own `shiftFor`, and
   `NodeCardStage` on `/spec/card` with `reelShift` clamped against
   a shorter window, a rail pitch, a leader elbow and a dezoom ramp.
   The author asked for one figure ("make /spec/card's scrollable
   node panel the same as the home's"), so there is one component
   and one reel, and the rail, leader, dezoom and pin-budget cases
   went with the code they were about rather than being kept over
   functions nothing calls.

   What is checked below is what survived, and it now covers BOTH
   routes rather than one: `reelShift` is the function the landing
   used to duplicate, and these are its cases against the numbers
   `CardWalk` actually draws (`NC.park` 3, `NC.window` 528).
   ============================================================ */

describe("the reel's arithmetic", () => {
  const total = 52;

  /**
   * The window is whole rows and nothing else, and `CardWalk` declares it as
   * `NC.window + PAD_Y`. If the two ever disagree the listing shows 23 rows and a sliver
   * of a 24th in every state but the first, which reads as a rendering fault.
   */
  it("is a whole number of rows", () => {
    expect(NC.window).toBe(NC.rows * NC.line);
  });

  it("does not scroll above the first line", () => {
    expect(reelShift(1, total)).toBe(0);
    expect(reelShift(NC.park, total)).toBe(0);
  });

  it("parks a run three lines down once there is room", () => {
    expect(reelShift(NC.park + 3, total)).toBe(-2 * NC.line);
  });

  it("moves in whole rows, so the window never shows half a line", () => {
    for (const from of [1, 4, 9, 17, 26, 38, 52]) {
      // `Math.abs` before the modulo: `-44 % 22` is `-0`, and `toBe` is `Object.is`, which
      // separates the two zeroes. The assertion is about the remainder, not its sign.
      expect(Math.abs(reelShift(from, total)) % NC.line).toBe(0);
    }
  });

  it("never leaves blank space under the last line", () => {
    const furthest = -(total * NC.line - NC.window);
    expect(reelShift(total, total)).toBe(furthest);
    expect(reelShift(total, total)).toBeGreaterThanOrEqual(furthest);
  });

  it("does not scroll a card that already fits", () => {
    expect(reelShift(10, 6)).toBe(0);
  });
});

/**
 * The one check that would have caught a wrong constant.
 *
 * Every quantity in `geometry.ts` is chosen so that particular runs of one particular
 * file land inside the window they are supposed to be read in, and the way that goes
 * wrong is quietly: a run whose last line sits at y = 560 in a 528-high box simply is not
 * there, the note beside it says what it is about, and nothing throws.
 *
 * Both ends are asserted. The first line has to be visible or the note points at nothing;
 * the last line has to be visible or the reader gets the head of a run and not the
 * consequence, which for `spec` and `notes` is most of what the run says.
 */
describe("every annotated run lands inside the window, on the real card", () => {
  const resolved = resolveAnnotations(CARD);

  it.each(resolved.map((a) => [a.id, a] as const))(
    "%s is visible from its first line to its last",
    (_id, annotation) => {
      const shift = reelShift(annotation.from, LINES.length);
      const top = (annotation.from - 1) * NC.line + shift;
      const bottom = (annotation.to - 1) * NC.line + shift + NC.line;
      expect(top).toBeGreaterThanOrEqual(0);
      expect(bottom).toBeLessThanOrEqual(NC.window);
    },
  );
});

/* --------------------- the notes stay reachable --------------------- */

describe("the choreography hides the eight closed notes without deleting them", () => {
  /**
   * `lg:hidden` is `display: none`, which removes an element from the accessibility tree
   * as well as from the layout. Every annotation body but one carried it at `lg` with
   * motion allowed, so a screen reader, find-in-page and a text extractor all saw one note
   * out of nine, and the only route to the rest was scrolling a 190vh section one step at
   * a time. Spec §3.2 asks for the choreography and asks for nothing to be unreachable;
   * `sr-only` is `position: absolute` with a 1px clip, so the reel steps exactly as it did
   * and the notes column measures the same.
   *
   * This case was written over `NodeCardStage`, which had the bug first and fixed it this
   * way. That component is deleted and `CardWalk` had inherited the bug rather than the
   * fix, so the case moves here with the mount instead of being deleted with the file it
   * happened to be pointed at.
   *
   * A source scan because the state under test is a client one: `renderToStaticMarkup`
   * runs with `motion === false` (see `ssr.test.ts`), which is the branch where every body
   * is open, so no server render can reach the class this is about.
   */
  const SOURCE = readFileSync(
    join(process.cwd(), "components/home/nodecard/CardWalk.tsx"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("takes the closed body out of the layout with sr-only", () => {
    expect(SOURCE).toContain('motion && !isOpen && "lg:sr-only"');
  });

  it("puts no display:none on an annotation body", () => {
    expect(SOURCE).not.toContain("lg:hidden");
  });

  /**
   * The figure is driven by the reader's own scroll and by nothing else. `NodeCardStage`
   * made each rail head a button that scrolled the page to its own step, and that button
   * went with it: a walk with nine controls beside it invites a reader to operate the
   * figure instead of reading it, and the author asked for the landing's version, which
   * has none. Pinned because the obvious way to "improve" this list is to make the heads
   * clickable again, and `stepScrollTop` no longer exists to make it work.
   *
   * ── This case is now load-bearing in a second way ──
   * A rail of nine buttons over these nine annotations EXISTS: `./CardBreakdown.tsx`, which
   * `/spec/card` mounts, on the author's instruction that the scroll effect come off that
   * page and stay everywhere else ("keep it for the other pages"). This scan is what makes
   * the parenthesis enforceable. The tempting shape is one component with a `mode` prop,
   * and that shape puts the buttons in THIS file and obliges whoever writes it to loosen
   * this case — at which point nothing is left saying the landing's beat has no controls.
   * If the two ever do merge, the replacement has to assert the landing's mount renders no
   * button, not merely that some mount might not.
   */
  it("gives the reader nothing to click inside the walk", () => {
    expect(SOURCE).not.toContain("<button");
    expect(SOURCE).not.toContain("onClick");
  });
});
