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

import { stagesShown } from "@/components/viz/useScrollProgress";

import { NODE_CARD_ANNOTATIONS, resolveAnnotations } from "./annotations";
import {
  NC,
  PIN_TRAVEL,
  RAIL_PITCH,
  STEP_RESERVE,
  bandCentre,
  dezoom,
  dezoomProgress,
  leaderPath,
  railCentre,
  reelShift,
  stepProgress,
  stepScrollTop,
} from "./geometry";
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
    // `cannot` has two entries and a paragraph break under it. A run that swallowed the
    // break would highlight a blank line and draw the leader to the middle of nothing.
    const range = keyBlock(CARD, "cannot");
    expect(range).toBeDefined();
    expect(LINES[(range?.to ?? 1) - 1]?.trim()).toBe(
      "- read the checks the work will be run against",
    );
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
   * The choreographed layout gives a body a fixed box (`NC.body`), clipped rather than
   * scrolled, and the sentence that gets cut is always the last one, which is where the
   * consequence is. 300 characters is roughly six lines in the 22rem column.
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

describe("the reel's arithmetic", () => {
  const total = 52;

  it("does not scroll above the first line", () => {
    expect(reelShift(1, total)).toBe(0);
    expect(reelShift(NC.park, total)).toBe(0);
  });

  it("parks a run six lines down once there is room", () => {
    expect(reelShift(NC.park + 3, total)).toBe(-2 * NC.line);
  });

  it("never leaves blank space under the last line", () => {
    const furthest = -(total * NC.line - NC.window);
    expect(reelShift(total, total)).toBe(furthest);
    expect(reelShift(total, total)).toBeGreaterThanOrEqual(furthest);
  });

  it("does not scroll a card that already fits", () => {
    expect(reelShift(10, 6)).toBe(0);
  });

  it("puts a run's centre inside the window", () => {
    for (const from of [1, 12, 24, 33, 48]) {
      const centre = bandCentre({ from, to: from + 2 }, reelShift(from, total));
      expect(centre).toBeGreaterThan(0);
      expect(centre).toBeLessThan(NC.window);
    }
  });

  /**
   * Every collapsed head but one, plus the open body, come to exactly the height of the
   * listing window, which is what keeps the two columns level at every step. Written
   * against the count rather than against a literal 7, because the count changed once and
   * the four numbers did not follow it on their own: the next person to add a step gets
   * this failure instead of a rail that overflows its window by 42px in silence.
   */
  it("makes the notes column the same height as the listing", () => {
    const count = NODE_CARD_ANNOTATIONS.length;
    expect(count * NC.head + (count - 1) * NC.gap + NC.body).toBe(NC.window);
    expect(RAIL_PITCH).toBe(NC.head + NC.gap);
  });

  it("centres a rail head on its own row", () => {
    const last = NODE_CARD_ANNOTATIONS.length - 1;
    expect(railCentre(0)).toBe(NC.head / 2);
    expect(railCentre(last)).toBe(last * RAIL_PITCH + NC.head / 2);
    expect(railCentre(last)).toBeLessThan(NC.window);
  });
});

describe("both ends of the leader land inside the drawing, on the real card", () => {
  const resolved = resolveAnnotations(CARD);

  /**
   * The one check that would have caught a wrong constant. Every quantity in
   * `geometry.ts` is chosen so that particular runs of one particular file line up with
   * the rail heads beside them, and the way that goes wrong is quietly: a leader drawn to
   * y = 560 in a 504-high box simply is not there, and nothing throws.
   */
  it.each(resolved.map((a) => [a.id, a] as const))(
    "%s connects a visible run to a visible head",
    (_id, annotation) => {
      const shift = reelShift(annotation.from, LINES.length);
      const band = bandCentre(annotation, shift);
      const rail = railCentre(annotation.step - 1);
      expect(band).toBeGreaterThan(0);
      expect(band).toBeLessThan(NC.window);
      expect(rail).toBeGreaterThan(0);
      expect(rail).toBeLessThan(NC.window);
      // The run's last line is in the window too, so the reader sees the whole of what
      // the note is about rather than its first line.
      const bottom = (annotation.to - 1) * NC.line + shift + NC.line;
      expect(bottom).toBeLessThanOrEqual(NC.window);
      expect(leaderPath(band, rail, NC.gutter)).toContain("M 0 ");
    },
  );
});

describe("the leader", () => {
  it("starts on the listing edge and arrives on the rail", () => {
    const d = leaderPath(120, 240, NC.gutter);
    expect(d.startsWith("M 0 120")).toBe(true);
    expect(d.endsWith(`H ${NC.gutter}`)).toBe(true);
  });

  it("is a straight run when both ends are level", () => {
    expect(leaderPath(200, 200, NC.gutter)).toBe(`M 0 200 H ${NC.gutter}`);
  });

  it("bends the same way whichever end is higher", () => {
    expect(leaderPath(300, 60, NC.gutter)).toContain("Q");
    expect(leaderPath(60, 300, NC.gutter)).toContain("Q");
  });
});

describe("the dezoom", () => {
  it("has not started while the annotations are still attaching", () => {
    expect(dezoomProgress(0)).toBe(0);
    expect(dezoomProgress(0.7)).toBe(0);
    expect(dezoom(0.5)).toEqual({ scale: 1, fade: 1, graph: 0 });
  });

  it("is finished by the end of the scroll", () => {
    expect(dezoomProgress(1)).toBe(1);
    const landed = dezoom(1);
    expect(landed.scale).toBeLessThan(0.25);
    expect(landed.fade).toBe(0);
    expect(landed.graph).toBe(1);
  });

  /**
   * The card holds its opacity through the first third of the shrink. A card that starts
   * fading the instant it starts moving reads as a dismissal, and the point spec §3.2 is
   * making is one about scale.
   */
  it("keeps the card visible while it is still shrinking", () => {
    // 0.91 is a fifth of the way into the shrink. The dezoom no longer starts at 0.76: it
    // is derived from `STEP_RESERVE.tail`, which came down from 0.26 to 0.12, so it starts
    // at 0.89 and the whole move is over by 0.99.
    const early = dezoom(0.91);
    expect(early.scale).toBeLessThan(1);
    expect(early.fade).toBe(1);
  });

  /**
   * The one that made the derivation necessary. The seventh note attaches at
   * `1 - STEP_RESERVE.tail`, and a dezoom that begins before then shrinks the card out from
   * under a note nobody has read yet. The two numbers used to agree by hand.
   */
  it("has not started until the last note has attached", () => {
    const count = NODE_CARD_ANNOTATIONS.length;
    const lastAttached = 1 - STEP_RESERVE.tail;
    expect(stagesShown(lastAttached, count, STEP_RESERVE)).toBe(count);
    expect(dezoomProgress(lastAttached)).toBe(0);
  });

  it("never leaves both the card and the graph invisible", () => {
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const state = dezoom(p);
      expect(Math.max(state.fade, state.graph)).toBeGreaterThan(0.35);
    }
  });
});

/* --------------------- any note, on demand --------------------- */

describe("a note's own head knows where its step is", () => {
  const count = NODE_CARD_ANNOTATIONS.length;

  /**
   * The inversion has to round-trip through the map it inverts. A head that lands a pixel
   * outside its own band opens the neighbouring note, and the reader has no way to know
   * why the thing they clicked is not the thing that opened.
   */
  it.each(NODE_CARD_ANNOTATIONS.map((_, i) => i))(
    "puts step %i in the middle of its own band",
    (index) => {
      expect(stagesShown(stepProgress(index, count), count, STEP_RESERVE)).toBe(index + 1);
    },
  );

  it("clamps an index past either end onto a real step", () => {
    expect(stepProgress(-3, count)).toBe(stepProgress(0, count));
    expect(stepProgress(99, count)).toBe(stepProgress(count - 1, count));
  });

  /**
   * Never above the point where the section locks, never past the point where it lets go.
   * Either one scrolls the reader out of the figure they clicked inside.
   */
  it("stays inside the pin at both ends", () => {
    const top = 1200;
    for (const index of [-1, 0, 3, count - 1, 40]) {
      const y = stepScrollTop(index, count, top, 900 + PIN_TRAVEL, 900);
      expect(y).toBeGreaterThanOrEqual(top);
      expect(y).toBeLessThanOrEqual(top + PIN_TRAVEL);
    }
  });

  /**
   * What the stage is sized for. `PIN_TRAVEL` is stated in pixels rather than in `vh`
   * precisely so this number is the same on every screen.
   *
   * 231px, where seven steps got 296. `PIN_TRAVEL` deliberately did not grow with the two
   * steps the author asked for, and `geometry.ts` argues that trade beside the number; the
   * assertion is here so that raising the count again is a decision somebody makes on
   * purpose rather than a figure that quietly gets faster.
   */
  it("spends the pin evenly, at the distance the stage is sized for", () => {
    const at = (index: number) => stepScrollTop(index, count, 0, 900 + PIN_TRAVEL, 900);
    const travel = at(1) - at(0);
    expect(Math.round(travel)).toBe(231);
    for (let i = 1; i < count; i += 1) {
      expect(at(i) - at(i - 1)).toBeCloseTo(travel, 6);
    }
  });
});

/* --------------------- the notes stay reachable --------------------- */

describe("the choreography hides the six inactive notes without deleting them", () => {
  /**
   * `lg:hidden` is `display: none`, which removes an element from the accessibility tree
   * as well as from the layout. Every annotation body but one carried it at `lg` with
   * motion allowed, so a screen reader, find-in-page and a text extractor all saw one note
   * out of seven, and the only route to the rest was scrolling a 420vh section. Spec §3.2
   * asks for the choreography and asks for nothing to be unreachable; `sr-only` is
   * `position: absolute` with a 1px clip, so the reel steps exactly as it did.
   *
   * A source scan because the state under test is a client one: `renderToStaticMarkup`
   * runs with `motion === false` (see `ssr.test.ts`), which is the branch where every
   * body is open, so no server render can reach the class this is about.
   */
  const SOURCE = readFileSync(
    join(process.cwd(), "components/home/nodecard/NodeCardStage.tsx"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("takes the inactive body out of the layout with sr-only", () => {
    expect(SOURCE).toContain('motion && !isActive && "lg:sr-only"');
  });

  /**
   * The rail collapses every head but one at `lg`, so each head is a button that puts the
   * page back where its own step is the one being read. That button exists only where
   * there is a pin to scroll: `motion === false` is the server, the reader with no JS and
   * the reader who asked for stillness, and all three still get the list exactly as it was,
   * every note open and nothing to operate. The way that goes wrong is somebody hoisting
   * the button out of the ternary to tidy the JSX, which is what this pins.
   */
  it("puts the head's button behind the motion gate", () => {
    const gate = SOURCE.indexOf("{motion ? (");
    expect(gate).toBeGreaterThan(-1);
    expect(SOURCE.indexOf("<button")).toBeGreaterThan(gate);
  });

  it("puts no display:none on an annotation body", () => {
    // The body wrapper is the element carrying `data-nc-body`; the gutter above it is
    // `hidden` on purpose and is `aria-hidden` besides, so the search is scoped to the
    // element this rule is about.
    //
    // Anchored on `data-nc-body={`, the JSX attribute, and not on the bare name: the
    // effect above the markup reads the same attribute through `querySelector`, that
    // occurrence comes first in the file, and a scan that landed on it sliced a span with
    // no class list in it and passed whatever the element said.
    const at = SOURCE.indexOf("data-nc-body={");
    expect(at).toBeGreaterThan(-1);
    const element = SOURCE.slice(at, SOURCE.indexOf("\n                      >", at));
    expect(element).toContain("className");
    expect(element).not.toContain("lg:hidden");
    expect(element).not.toContain('"hidden"');
  });
});
