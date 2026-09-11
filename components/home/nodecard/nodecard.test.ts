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
   * The rail's order is the order of a plain array, and the breakdown steps through it in
   * that order, so the direction of the walk is decided here and nowhere else. The spec's
   * table puts `skill` (line 22) before `tools`/`mcp` (lines 19-21), and following it sent
   * the reader's eye back up the listing between two steps. Strictly increasing, not merely
   * non-decreasing: two steps starting on the same line would mark one run twice with
   * nothing moving between them, which reads as a figure that has got stuck.
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

