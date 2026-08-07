/* ============================================================
   The tutorial is the first thing on this site whose subject
   lives outside the repository.

   Every other claim the site makes is checkable against something
   in this tree: a bundle in `content/`, a digest the exporter
   produces, a diagnostic the resolver raises. The DarkPrint skill
   is read over git by an external CLI, so nothing in `npx tsc
   --noEmit` and nothing in the rest of the suite can fail on the
   day its behaviour stops matching what `/install` says about it.

   That is an argument for asserting MORE here, not less. What this
   file can hold is the half of the promise that is a property of
   this repository: that the page prints the exact command a reader
   pastes, that it renders as text with no JavaScript, that the four
   beats the route exists for are all present in the open, and that
   the two sentences reconciling this skill with the two other
   things on this site called by nearly the same names are still
   written down.

   `openText` and not `plainText` throughout, for the reason
   `components/site/honesty.test.ts` gives: a `<details>` keeps its
   contents in the markup, and a tutorial folded away is a tutorial
   nobody reads. Everything asserted below has to be visible on
   arrival.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import InstallPage from "@/app/install/page";
import { SKILL_INSTALL_COMMAND, SkillSetup } from "@/components/install/SkillSetup";
import { openText, plainText } from "@/components/ui/visible-text";

const SETUP = renderToStaticMarkup(createElement(SkillSetup));
const PAGE = renderToStaticMarkup(createElement(InstallPage as never));

describe("the install command", () => {
  /**
   * The command a reader copies is the command a reader reads.
   *
   * `CopyButton` puts the string on the clipboard from a prop, and the `<pre>` prints it
   * from the same constant, so the two cannot disagree. What this asserts is that the
   * constant is the one the skills CLI actually takes: the repository is read over git by
   * name, and a typo in the owner or the repo is a 404 in somebody else's terminal.
   */
  it("is the one the skills CLI takes, spelled out", () => {
    expect(SKILL_INSTALL_COMMAND).toBe("npx skills@latest add Brotherhood94/darkprint");
  });

  it("is real text on the page, not something a script fills in", () => {
    // No JavaScript, no hydration: the page is prerendered and this string is in the
    // markup. `openText` strips closed disclosures too, so this is the open page.
    expect(openText(PAGE)).toContain(SKILL_INSTALL_COMMAND);
  });

  it("hands the clipboard control the same string it prints", () => {
    // The `aria-label` is the only place the button says what it copies, and a reader on
    // a screen reader hears that and nothing else.
    expect(SETUP).toContain("Copy the command that installs the DarkPrint skill");
  });
});

describe("the tutorial covers what a reader is in for", () => {
  const text = openText(SETUP).toLowerCase();

  /**
   * The interview framing, which is the whole reason this is a tutorial rather than a
   * command in a box. A reader who expects a generator types one line, waits, and finds
   * the skill asking them questions.
   */
  it("says it is an interview and not a generator", () => {
    expect(text).toContain("interview and not a generator");
  });

  it("names the files it leaves behind, in the shape the registry stores", () => {
    for (const path of ["blueprint.dot", "cards/<node>.yaml", "readme.md", "agents.md"]) {
      expect(text, path).toContain(path.toLowerCase());
    }
  });

  /**
   * `/build`'s download exit leads on `factory.dot` and prints `attractor run
   * factory.dot`. The skill deliberately does not emit that file, so a reader who compares
   * the two folders finds one missing from theirs. One sentence reconciles them, and
   * without it the skill reads as broken.
   */
  it("says why there is no factory.dot in what it wrote", () => {
    expect(text).toContain("does not write");
    expect(text).toContain("factory.dot");
    expect(text).toContain("exporter compiles that");
  });

  /**
   * `lib/core/card/schema.ts` defines `skill?: string` as a per-node behaviour document,
   * and `/what-a-blueprint-is#the-words` prints "no skill document travels in the
   * download" in the open. This page installs a skill that WRITES the graph, which is the
   * opposite level of the same word.
   */
  it("tells the two meanings of the word apart", () => {
    expect(text).toContain("not the");
    expect(text).toContain("skill:");
    expect(text).toContain("field on a node card");
  });

  it("sends the reader to /upload to see the result, and says nothing leaves the tab", () => {
    expect(SETUP).toContain('href="/upload"');
    expect(text).toContain("nothing is uploaded and nothing is sent anywhere");
  });

  /**
   * No claim that a skill-written bundle comes back clean. `/upload` resolves against
   * `CORE_ONTOLOGY`, so a card naming a local term comes back with an unknown term and a
   * reading computed without it. The site already says that; the skill is the first thing
   * on the site that creates the case.
   */
  it("does not promise the result validates cleanly", () => {
    expect(text).toContain("comes back with that term unknown");
  });

  /**
   * Never "the skill" on its own, anywhere a reader can see it. The word means something
   * narrower elsewhere on this site, and an unqualified use on the page that installs one
   * is the use that gets misread.
   *
   * Two spellings are exempt and both are the point of the rule rather than holes in it:
   * "the skill document", which is the ontology's own sense, and "the `skill:` field",
   * which is the sentence telling the two apart. A trailing colon is what distinguishes
   * the second, since that is how the site writes a card field.
   */
  it("never says the bare phrase", () => {
    expect(openText(SETUP)).not.toMatch(/\bthe skill\b(?!:)(?! document)/i);
  });
});

describe("the route keeps what ships apart from what does not", () => {
  const page = openText(PAGE);

  it("prints the working command above the rule, and the unbuilt half below it", () => {
    const command = page.indexOf(SKILL_INSTALL_COMMAND);
    const rule = page.indexOf("Not built yet");
    expect(command, "the command is not on the page").toBeGreaterThan(-1);
    expect(rule, "the rule is not on the page").toBeGreaterThan(-1);
    expect(command).toBeLessThan(rule);
  });

  /**
   * One amber pill on the working half would say the install is coming rather than here.
   * Both sanctioned uses of the colour sit under the rule: the publishing panel's own
   * badge, and `InstallTabs`'s.
   */
  it("puts every coming-soon marker below the rule", () => {
    const rule = page.indexOf("Not built yet");
    const first = page.indexOf("Coming soon");
    expect(first, "no coming-soon marker on the page at all").toBeGreaterThan(-1);
    expect(first).toBeGreaterThan(rule);
    expect(plainText(PAGE).match(/Coming soon/g) ?? []).toHaveLength(2);
  });

  /** The four unbuilt capabilities, in the open, in one sentence rather than four claims. */
  it("refuses the account, the private draft, publishing and the live push", () => {
    for (const phrase of [
      "an account of your own",
      "kept private while it is under construction",
      "publishing one to the registry",
      "straight from Claude Code",
    ]) {
      expect(page, phrase).toContain(phrase);
    }
  });
});
