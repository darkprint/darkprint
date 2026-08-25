/* ============================================================
   The tutorial is the first thing on this site whose subject
   lives outside the repository.

   Every other claim the site makes is checkable against something
   in this tree: a bundle in `content/`, a digest the exporter
   produces, a diagnostic the resolver raises. The DarkPrint skill
   is read over git by an external CLI, so nothing in `npx tsc
   --noEmit` and nothing in the rest of the suite can fail on the
   day its behaviour stops matching what `/skill` says about it.

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

import SkillPage from "@/app/skill/page";
import { SKILL_INSTALL_COMMAND, SkillSetup } from "@/components/skill/SkillSetup";
import { openText, plainText } from "@/components/ui/visible-text";

const SETUP = renderToStaticMarkup(createElement(SkillSetup));
const PAGE = renderToStaticMarkup(createElement(SkillPage as never));

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
   *
   * Reworded 2026-08-11, not weakened, so the case follows the wording instead of failing
   * on it. The sentence was "It is an interview and not a generator"; the density pass made
   * it "An interview, not a generator", which drops four words and says the same thing in
   * the same place. The rule this file works to is the one its own deleted cases record: a
   * case comes out when the copy it guards is DELETED, with the reason in the commit. This
   * copy is not deleted, so neither is the case.
   *
   * What is held is still the claim and not the connective — the noun and the refusal, in
   * that order, at the head of step 2.
   */
  it("says it is an interview and not a generator", () => {
    expect(text).toContain("interview, not a generator");
  });

  it("names the files it leaves behind, in the shape the registry stores", () => {
    // "blueprint.dot" until the terminology pass (2026-08-25): the row reads live off
    // `TOPOLOGY_DOT`, which renamed to `topology.dot` in the same pass, in the shared
    // module this suite does not own (`lib/content/bundle-export.ts`) — retargeted, not
    // loosened, so this case still fails if the row ever drifts from that constant again.
    for (const path of ["topology.dot", "cards/<node>.yaml", "readme.md", "agents.md"]) {
      expect(text, path).toContain(path.toLowerCase());
    }
  });

  /* Two cases stood here and the author removed the copy they held, 2026-08-07.
     ------------------------------------------------------------------------
     "says why there is no factory.dot in what it wrote" held the sentence reconciling this
     folder with `/build`'s download exit, which leads on `factory.dot` and prints
     `attractor run factory.dot`. "tells the two meanings of the word apart" held the one
     separating this skill from a card's `skill:` field, which `/what-a-blueprint-is`
     describes in the open as a document the engine never reads.

     Both are deletions of copy, so both cases come out with the reason rather than being
     softened into something that still passes. What each was guarding is unchanged and
     unguarded now: a reader comparing the two folders finds `factory.dot` in one and not
     the other with no explanation on this page, and the homonym is kept apart only by the
     qualifier "the DarkPrint skill", which the case below still enforces.

     That last case is the one that matters most now and it is untouched: this page may
     never say "the skill" unqualified. It was the weakest of the three when all three
     existed and it is the only one left. */

  it("sends the reader to /upload to see the result, and says nothing leaves the tab", () => {
    expect(SETUP).toContain('href="/upload"');
    expect(text).toContain("nothing is uploaded and nothing is sent anywhere");
  });

  /*
   * "does not promise the result validates cleanly" stood here and asserted the sentence
   * "comes back with that term unknown". The author removed that paragraph on 2026-08-08
   * and the case goes with it, on the record, because this file's own rule is that a
   * removed limit sentence takes its guard out in the same commit with the reason.
   *
   * The limit is `/upload`'s and stays there: that page resolves against `CORE_ONTOLOGY`,
   * reports the unknown term, and says so with the result in front of the reader. What was
   * removed is this page pre-empting it — a caveat about a page a reader has not opened,
   * attached to a file they have not written, about a term they may never coin.
   *
   * What still holds here and is asserted two cases up: this page sends a reader to
   * `/upload` to see the result rather than claiming one. That is the assertion that stops
   * the page promising a clean bundle, and it is the stronger of the two, because it cannot
   * be satisfied by wording.
   */

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
   * An amber pill on the working half would say the install is coming rather than here.
   *
   * The count has been 2, then 1, then 2, and is 1 again: the publishing badge plus
   * `InstallTabs`'s until the author split the route on 2026-08-07, then the publishing
   * badge alone, then that badge plus the one on "Design against what exists" added
   * 2026-08-08, and now one for the whole section. The 2026-08-11 density pass replaced
   * those two panels with one `h2`, one badge and three rows, so the two capabilities each
   * badge stood over are rows under a single marker rather than cards with one apiece.
   *
   * The exact number is still asserted rather than a floor, and the reason is unchanged:
   * "at least one badge below the rule" would pass on the day an unrelated amber pill
   * appears anywhere on this page, and amber has exactly two sanctioned jobs sitewide. What
   * the case really protects is the POSITION — every badge below the rule and none above
   * it — and that is unchanged by the count, asserted for all of them rather than the first.
   *
   * Nothing this badge stood over left the page: `components/site/honesty.test.ts` still
   * holds all four refusals, in the open, in the section's own lead.
   */
  it("puts every coming-soon marker below the rule, and there is one", () => {
    const rule = page.indexOf("Not built yet");
    expect(rule, "the rule is not on the page").toBeGreaterThan(-1);
    const marks = [...page.matchAll(/Coming soon/g)].map((m) => m.index ?? -1);
    expect(marks.length, "no coming-soon marker on the page at all").toBeGreaterThan(0);
    for (const at of marks) expect(at).toBeGreaterThan(rule);
    expect(plainText(PAGE).match(/Coming soon/g) ?? []).toHaveLength(1);
  });

  /** The four capabilities, in the open, in one sentence rather than four claims. Since
      T280 three are named as LIVE and one is still refused (the live push, T270 todo) —
      the phrases are pinned either way, because a density pass dropping any of the four
      is the same failure in both eras. */
  it("names the account, the private draft and publishing as live, and refuses the live push", () => {
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
