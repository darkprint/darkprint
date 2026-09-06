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

import SkillPage, { metadata as skillMetadata } from "@/app/skill/page";
import { DraftLanding } from "@/components/bundle/DraftLanding";
import { SetupChips } from "@/components/hero/SetupChips";
import { SKILL_INSTALL_COMMAND, SkillSetup } from "@/components/skill/SkillSetup";
import { openText, plainText } from "@/components/ui/visible-text";

const SETUP = renderToStaticMarkup(createElement(SkillSetup));
const PAGE = renderToStaticMarkup(createElement(SkillPage as never));

/* The other two surfaces that print the command, rendered here rather than in two suites,
   because the claim being held is one claim about one string (see the block below and
   `lib/skill.ts`'s header). `/capabilities` is the fifth and is rendered by
   `app/capabilities/honesty.test.ts`, which owns it.

   Three surfaces until 2026-09-06. `AgentHandoff` was the agent-brief exit on `/build`, and
   the owner deleted that route and its whole component tree ("it is not useful and make
   confusion"). Its rows below came out with it, under this file's own rule that a case goes
   when the copy it guards is DELETED. Both sentences it held are still asserted here on
   live surfaces: the 404 qualification by `SkillSetup.tsx:361` and `DraftLanding.tsx:150`,
   and the written-not-installable half by the `is written` / `read access` case at the end
   of this block. Neither claim lost its last reader, which is the only condition under
   which a row here may be retired. */
const CHIPS = renderToStaticMarkup(createElement(SetupChips));
const DRAFT = renderToStaticMarkup(
  createElement(DraftLanding, {
    draft: {
      ownerHandle: "ada",
      slug: "empty-draft",
      visibility: "private" as const,
      createdAt: "2026-09-05T00:00:00.000Z",
    },
    owner: {
      username: "ada",
      displayName: "Ada",
      avatarHue: 200,
      validator: false,
    },
    /* The quick-setup panel this suite reads is owner-only: `isOwner: false` renders the
       four-line visitor branch and every case below would pass over an empty string.
       `visibilityApi` is left out on purpose, so no live control mounts. */
    isOwner: true,
  }),
);

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

/* ============================================================
   The command does not run, and the qualification travels with it (§11.0 Q8)
   ------------------------------------------------------------
   `api.github.com/repos/Brotherhood94/darkprint` answers 404 unauthenticated: DarkPrint's
   repository is private, the `skills` CLI reads the DarkPrint skill out of it over git, and
   the command above therefore fails for every reader except its owner. The owner ruled on
   2026-09-05 that the repository stays private and the command stays printed, qualified
   everywhere it renders.

   Six surfaces print it. Five are held here; `/capabilities` is held by
   `app/capabilities/honesty.test.ts`, which owns that page. **The case one file up is the
   reason this block has to exist at all**: "is real text on the page, not something a
   script fills in" passes on a page that prints a command nobody can run and says nothing
   about it, which is a guard passing over the claim it was written to hold.

   ── Why a phrase per surface and not one shared constant ──
   `components/site/honesty.test.ts` pins each surface's own words, and this follows it. A
   band cell has room for six words and `/skill` has room for three sentences, so a single
   exported sentence would either not fit the band or say almost nothing on `/skill`. What
   IS shared is the clause naming the cause, asserted separately below, so a surface cannot
   drop the reason and keep a vague hedge.

   ── The negative matters as much as the positive ──
   The DarkPrint skill is WRITTEN. A qualification that reads as "unfinished" replaces one
   false claim with another, which is why the last case holds the two surfaces with room to
   say so to saying it.
   ============================================================ */

/** One row per surface, in the order a reader is likeliest to meet them. */
const QUALIFIED = [
  {
    surface: "/skill · step 01, in the column beside the command",
    html: SETUP,
    says: "the command does not run yet",
  },
  {
    surface: "the landing band · the skill cell's own note",
    html: CHIPS,
    says: "fails today",
  },
  {
    surface: "a draft bundle · the quick-setup panel",
    html: DRAFT,
    says: "not runnable yet",
  },
] as const;

describe("every surface that prints the install command says it does not run", () => {
  it.each(QUALIFIED.map((q) => [q.surface, q] as const))("%s", (_name, entry) => {
    const text = openText(entry.html).toLowerCase();
    // The premise. A surface that stopped printing the command needs no qualification, and
    // this case would otherwise pass for that reason rather than for the right one.
    expect(text, `${entry.surface} no longer prints the command`).toContain(
      SKILL_INSTALL_COMMAND.toLowerCase(),
    );
    expect(text, `${entry.surface} prints the command with no qualification`).toContain(
      entry.says,
    );
  });

  /**
   * The cause, in the same words on all four, because it is the thing that changes.
   *
   * A hedge that says "not yet" and nothing else survives the repository going public: it
   * stays true-sounding and nobody deletes it. Naming the repository is what makes the
   * qualification obviously wrong the day it stops applying, which is the property the
   * owner's ruling is buying — one edit per surface, and the edit is visible.
   */
  it.each(QUALIFIED.map((q) => [q.surface, q] as const))(
    "%s · names the private repository as the cause",
    (_name, entry) => {
      expect(openText(entry.html).toLowerCase()).toContain("repository is private");
    },
  );

  /**
   * The reader who never opens the page. `/capabilities` carries the npm limit in its own
   * description for this reason and `app/skill/page.tsx` argues it in a comment; the first
   * sentence of this one is "one command puts a blueprint-writing skill in your own agent",
   * which is the sentence a reader acts on from a search result.
   *
   * The T280 refusal is asserted beside it rather than replaced. Two different limits: the
   * command cannot run at all, and a release cannot be cut from inside the agent even once
   * it can.
   */
  it("says it in the metadata description too, without displacing the T280 refusal", () => {
    const description = skillMetadata.description ?? "";
    expect(description).toContain("The command fails today: DarkPrint's repository is private.");
    expect(description).toContain("Not built yet: releasing straight from your agent");
  });

  /**
   * The claim that was actually on the page, held as its own inversion.
   *
   * `/build`'s label read "The DarkPrint skill · installs today" and `/skill`'s panel led
   * with "The DarkPrint skill installs today.", and neither is true while the repository is
   * private. Removing them is invisible to every case above — a surface can carry the
   * qualification AND the sentence it contradicts, and that reads worse than either alone.
   * Measured: reverting the label alone reddened nothing until this case existed.
   *
   * Both halves are part of the undo. When the repository goes public, this case comes out
   * in the same commit that puts "installs today" back, which is the point of asserting the
   * exact string rather than a paraphrase.
   */
  it("no surface still says the DarkPrint skill installs today", () => {
    for (const [name, html] of [
      ["/skill · the whole route", PAGE],
      ["a draft bundle · the quick-setup panel", DRAFT],
      ["the landing band", CHIPS],
    ] as const) {
      expect(openText(html).toLowerCase(), name).not.toContain("installs today");
    }
    // The label that carried the replacement wording, "written, not yet installable", was
    // `AgentHandoff`'s and went with `/build`. The half it protected — that the document
    // EXISTS and only read access is missing — is asserted directly below, on the two live
    // surfaces that have room to say it. A negative sweep alone would be satisfied by a
    // site that stopped mentioning the skill, which is why that positive has to stay.
  });

  /**
   * The DarkPrint skill is built. This is the half of the ruling that is easiest to lose in
   * a later wording pass, because "does not run" and "does not exist" compress to the same
   * short hedge, and only one of them is true.
   *
   * Held on the two surfaces with room for the distinction; the band has six words. This
   * pair is now the ONLY positive holding it. `AgentHandoff` carried a third rendering of
   * it and was deleted with `/build` on 2026-09-06, so the sweep above no longer has a
   * positive of its own and leans on this case instead.
   */
  it.each([
    ["/skill · step 01", SETUP],
    ["a draft bundle · the quick-setup panel", DRAFT],
  ] as const)("%s · says the document exists and read access is what is missing", (name, html) => {
    const text = openText(html).toLowerCase();
    expect(text, name).toContain("is written");
    expect(text, name).toContain("read access");
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
    for (const path of ["topology.dot", "cards/<node>.yaml", "readme.md"]) {
      expect(text, path).toContain(path.toLowerCase());
    }
  });

  // Owner instruction, 2026-08-25: the skill stopped writing `AGENTS.md` in the same pass
  // that took the file out of every published bundle. The row above would have gone on
  // passing if this page had simply forgotten to update — a negative is what catches that.
  it("no longer lists agents.md among what it writes", () => {
    expect(text).not.toContain("agents.md");
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

  /* "prints the WORKING command above the rule" until 2026-09-05. The command does not
     work, and the block above holds every surface to saying so; what this case is really
     about, and always was, is the page's ORDER — what exists leads, what does not is
     grouped once below the rule and labelled once. That order is unchanged by Q8: the
     DarkPrint skill is written, and the registry push below the rule is not. */
  it("prints the command above the rule, and the unbuilt half below it", () => {
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
   * appears anywhere on this page. Amber has THREE sanctioned jobs sitewide since
   * 2026-09-06, when the owner added the card register to the two claims — which makes the
   * exact count more worth keeping rather than less, since a hue with a third job is a hue
   * that turns up in more places. This page is not a card and takes none of that. What
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
