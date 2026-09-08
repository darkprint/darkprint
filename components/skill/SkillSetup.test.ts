/* ============================================================
   `/skill` prints the exact commands a reader pastes, describes the
   folder the DarkPrint skill leaves behind in the shape the registry
   stores, and keeps the two other things on this site called by nearly
   the same name apart from it.

   The skill's behaviour is a document an agent reads, so nothing here
   can run the interview. What is held is the half of the promise that
   is a property of this repository: the strings, their order, and the
   negatives that would make the page false again.

   `openText` throughout: a `<details>` keeps its contents in the
   markup, and a tutorial folded away is a tutorial nobody reads.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SkillPage, { metadata as skillMetadata } from "@/app/skill/page";
import { DraftLanding } from "@/components/bundle/DraftLanding";
import { QUESTIONS, SkillSetup } from "@/components/skill/SkillSetup";
import { openText, plainText } from "@/components/ui/visible-text";
import {
  SKILL_INSTALL_COMMAND,
  SKILL_INSTALL_COMMAND_CODEX,
  SKILL_INSTALL_FROM_REPOSITORY,
  SKILL_MANIFEST_PATH,
  SKILL_TREE_PATH,
} from "@/lib/skill";

const SETUP = renderToStaticMarkup(createElement(SkillSetup));
const PAGE = renderToStaticMarkup(createElement(SkillPage as never));
const DRAFT = renderToStaticMarkup(
  createElement(DraftLanding, {
    draft: {
      ownerHandle: "ada",
      slug: "empty-draft",
      visibility: "private" as const,
      createdAt: "2026-09-05T00:00:00.000Z",
    },
    owner: { username: "ada", displayName: "Ada", avatarHue: 200, validator: false },
    /* The quick-setup panel is owner-only; the visitor branch prints no command at all. */
    isOwner: true,
  }),
);

describe("the install commands", () => {
  /**
   * Pinned as literals, because a typo in the host or the folder is a 404 or a skill
   * nothing loads, in somebody else's terminal, and no test in this tree can see it.
   */
  it("are the curl and tar lines, spelled out", () => {
    expect(SKILL_INSTALL_COMMAND).toBe(
      "curl -fsSL https://www.darkprint.io/skill/darkprint.tgz | tar -xzf - -C ~/.claude",
    );
    expect(SKILL_INSTALL_COMMAND_CODEX).toBe(
      "mkdir -p ~/.agents; curl -fsSL https://www.darkprint.io/skill/darkprint.tgz | tar -xzf - -C ~/.agents",
    );
  });

  it("are real text on the page, not something a script fills in", () => {
    const text = openText(PAGE);
    expect(text).toContain(SKILL_INSTALL_COMMAND);
    expect(text).toContain(SKILL_INSTALL_COMMAND_CODEX);
  });

  it("hand the clipboard controls the same strings they print", () => {
    expect(SETUP).toContain("Copy the command that installs the DarkPrint skill for Claude Code");
    expect(SETUP).toContain("Copy the command that installs the DarkPrint skill for Codex");
  });

  /**
   * The `skills` CLI form clones a private repository, so it is printed under a label that
   * says who it is for and never as the first line. A reader who pastes it without access
   * gets a 404, and the page has to have said so beside it.
   */
  it("print the repository form only under its access label", () => {
    const text = openText(SETUP);
    expect(text).toContain(SKILL_INSTALL_FROM_REPOSITORY);
    const label = text.indexOf("If you have access to the repository");
    const command = text.indexOf(SKILL_INSTALL_FROM_REPOSITORY);
    expect(label).toBeGreaterThan(-1);
    expect(command).toBeGreaterThan(label);
    expect(text.indexOf(SKILL_INSTALL_COMMAND)).toBeLessThan(command);
    expect(text.toLowerCase()).toContain("the repository is private");
  });

  it("link the served tree and the manifest, as plain anchors to static files", () => {
    expect(SETUP).toContain(`href="${SKILL_TREE_PATH}/SKILL.md"`);
    expect(SETUP).toContain(`href="${SKILL_MANIFEST_PATH}"`);
  });

  /**
   * The claims that were true while the repository was the only source, held as their own
   * inversion: the command runs now, and a page that kept saying otherwise would be the
   * false claim in the other direction. The landing band is not a row here: it prints two
   * links and no command, and `components/hero/Wordmark.test.ts` holds it to that.
   */
  it.each([
    ["/skill · the whole route", PAGE],
    ["a draft bundle · the quick-setup panel", DRAFT],
  ] as const)("%s no longer says the command fails", (_name, html) => {
    const text = openText(html).toLowerCase();
    expect(text).toContain(SKILL_INSTALL_COMMAND.toLowerCase());
    for (const stale of ["fails today", "not runnable", "answers 404", "does not run yet"]) {
      expect(text).not.toContain(stale);
    }
  });
});

describe("the tutorial covers what a reader is in for", () => {
  const text = openText(SETUP).toLowerCase();

  it("says it is an interview and not a generator", () => {
    expect(text).toContain("interview, not a generator");
  });

  it("names the six rows in the order the interview asks them, with the registry search among them", () => {
    expect(QUESTIONS.map((q) => q.label)).toEqual([
      "the outcome",
      "the check",
      "the registry",
      "the nodes",
      "the boundaries",
      "the loop",
    ]);
    for (const question of QUESTIONS) {
      expect(text).toContain(question.label);
      expect(text).toContain(question.text.toLowerCase());
    }
  });

  it("says it can decline to draw a graph", () => {
    expect(text).toContain("it can decline");
  });

  it("names the four files it leaves behind, in the shape the registry stores", () => {
    for (const path of ["topology.dot", "cards/<node>.yaml", "blueprint.yaml", "readme.md"]) {
      expect(text, path).toContain(path);
    }
  });

  it("lists neither agents.md nor factory.dot among what it writes", () => {
    expect(text).not.toContain("agents.md");
    expect(text).not.toContain("factory.dot");
  });

  it("sends the reader to Upload and to Settings for the two ways to publish", () => {
    expect(SETUP).toContain('href="/upload"');
    expect(SETUP).toContain('href="/settings"');
    expect(text).toContain("write-scoped api key");
  });

  /**
   * Never "the skill" on its own, anywhere a reader can see it. The word means something
   * narrower elsewhere on this site, and an unqualified use on the page that installs one
   * is the use that gets misread. "the skill document" and "the `skill:` field" are the
   * ontology's own sense and stay allowed.
   */
  it("never says the bare phrase", () => {
    expect(openText(PAGE)).not.toMatch(/\bthe skill\b(?!:)(?! document)/i);
  });
});

describe("the route", () => {
  const page = openText(PAGE);

  it("keeps the name the nav sends a reader to", () => {
    expect(skillMetadata.title).toBe("Assisted Design");
    expect(page).toContain("Assisted Design");
  });

  it("prints the commands first and the three limits after the tutorial", () => {
    const command = page.indexOf(SKILL_INSTALL_COMMAND);
    const never = page.indexOf("What it never does");
    expect(command).toBeGreaterThan(-1);
    expect(never).toBeGreaterThan(command);
    for (const label of ["run", "publish by itself", "send"]) {
      expect(page.indexOf(label, never), label).toBeGreaterThan(never);
    }
  });

  /**
   * No amber on this page. Every capability the closing section points at exists, and a
   * "coming soon" marker over a design statement would read as an unbuilt feature.
   */
  it("carries no coming-soon marker and no not-built rule", () => {
    expect(plainText(PAGE).toLowerCase()).not.toContain("coming soon");
    expect(plainText(PAGE).toLowerCase()).not.toContain("not built yet");
  });
});
