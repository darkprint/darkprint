/* ============================================================
   Nothing on /capabilities is retyped
   ------------------------------------------------------------
   `components/site/honesty.test.ts` holds the SENTENCES this site
   may not stop saying. This file holds the opposite claim about one
   route: that every command, flag, tool name, client snippet and
   environment variable on it is the one its own module defines, and
   that none of them is a copy sitting in the page.

   The two halves are both necessary and neither implies the other.
   Rendering the page and finding `darkprint clone <owner>/<slug> …`
   in the markup proves the string is on screen and proves nothing
   about where it came from: a hand-typed copy that happens to match
   today passes it. So the second half reads the page's SOURCE and
   refuses to find a command literal in it. A page that renders from
   `CLI_VERBS` cannot fail the first; a page that retypes one cannot
   pass the second.

   ── why this is not in `components/site/honesty.test.ts` ──
   That file is a ledger of prose, imported page by page, and three
   other test files cite its line numbers in their own comments.
   Adding a block to the middle of it moves those citations. This is
   also a different kind of assertion: an equality against a module,
   not a sentence somebody might cut for length.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import CapabilitiesPage from "@/app/capabilities/page";
import { MCP_CLIENTS } from "@/components/mcp/clients";
import { QUESTIONS } from "@/components/skill/SkillSetup";
import { plainText } from "@/components/ui/visible-text";
import { SKILL_INSTALL_COMMAND } from "@/lib/skill";
import { CLI_ENV, CLI_INVOCATION, CLI_VERBS, NPX_INVOCATION } from "@/packages/cli/src/index";
import { TOOLS } from "@/packages/mcp/src/tools";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The whole page, all three panels.
 *
 * `plainText` and not `openText`: the two inactive panels are rendered and carried in the
 * markup behind a `hidden` attribute rather than being unmounted, which is what lets
 * `/capabilities#mcp` deep-link and what gives a reader with no JavaScript the whole page.
 * A `hidden` panel is not a closed `<details>`, so `openText` would not drop it either;
 * `plainText` is used because what is asserted here is that a string is present, and which
 * tab it sits behind is the tab bar's business.
 */
const MARKUP = renderToStaticMarkup(createElement(CapabilitiesPage as never));
const PAGE = squeeze(plainText(MARKUP));

/**
 * Runs of whitespace to one space, on both sides of every comparison below.
 *
 * `plainText` puts a space where it removes a tag, which is right for its own job and is an
 * artefact here: a sentence rendered as three elements comes back with a space before the
 * comma that follows a `<code>` run. Both rules touch whitespace only, so neither can make
 * two different sentences equal, and the second is narrow on purpose: it drops a space
 * before punctuation, which is the exact shape a stripped closing tag leaves behind and
 * which no source string in this repository contains. What they buy is that these cells
 * measure the page's words rather than its markup.
 */
function squeeze(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([,.;:)])/g, "$1");
}

/**
 * The text of the one element carrying `data-<attribute>="<value>"`, tags removed.
 *
 * `PAGE` answers "is this string anywhere on the page", and a mutation testing that
 * assertion found what it cannot answer: give Cursor the VS Code snippet and Claude
 * Desktop's, and every snippet is still somewhere on the page. Both cells passed. So the
 * rows that pair a NAME with a VALUE are read one row at a time, from the element the page
 * marks with its own identity.
 *
 * Tags are removed without putting anything in their place, unlike `plainText`, so the
 * comparison is exact rather than whitespace-normalised. That is affordable here because
 * one cell is one run of inline elements; it would glue words together across block
 * boundaries, which is why `plainText` pads and why this is not a replacement for it.
 */
function cell(attribute: string, value: string): string {
  const at = MARKUP.indexOf(`data-${attribute}="${value}"`);
  expect(at, `nothing on the page is marked ${attribute}="${value}"`).toBeGreaterThan(-1);
  const open = MARKUP.indexOf(">", at) + 1;
  /* To the matching close of the element the attribute sits on. The cells this reads hold
     inline elements only and never a nested copy of their own tag, so the first close of
     that tag name is the right one. */
  const tag = MARKUP.slice(MARKUP.lastIndexOf("<", at) + 1).match(/^[a-z]+/)?.[0] ?? "";
  const close = MARKUP.indexOf(`</${tag}>`, open);
  return decode(MARKUP.slice(open, close).replace(/<[^>]+>/g, ""));
}

/** The entities `renderToStaticMarkup` writes, back to the characters they stand for. */
function decode(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The page as written, for the half of the claim a render cannot make. */
const SOURCE = readFileSync(`${ROOT}app/capabilities/page.tsx`, "utf8");

describe("the render carries what the modules define", () => {
  it("does not pass vacuously", () => {
    /* Every loop below is `it.each` over an imported array. An array that arrived empty
       would run zero cells and the file would report green over nothing. */
    expect(PAGE.length).toBeGreaterThan(3000);
    expect(CLI_VERBS.length).toBe(7);
    expect(CLI_ENV.length).toBe(3);
    expect(TOOLS.length).toBe(5);
    expect(MCP_CLIENTS.length).toBe(6);
    expect(QUESTIONS.length).toBe(5);
  });

  it.each(CLI_VERBS.map((verb) => [verb.name, verb] as const))(
    "prints `%s` with the grammar `darkprint --help` prints",
    (_name, verb) => {
      expect(PAGE).toContain(squeeze(verb.args));
      /* Against the verb's OWN row. `does: ""` reddened nothing while this was a
         `toContain` over the page, because every string contains the empty one. */
      expect(verb.does.length, "a verb with no description").toBeGreaterThan(20);
      expect(cell("does", verb.name)).toBe(verb.does);
    },
  );

  it.each(CLI_ENV.map((variable) => [variable.name, variable] as const))(
    "prints %s and what it does",
    (_name, variable) => {
      expect(PAGE).toContain(variable.name);
      expect(PAGE).toContain(squeeze(variable.does));
    },
  );

  /**
   * `Takes` is the schema's `required` list, not a description of it.
   *
   * These are the argument names an agent has to send. A page that paraphrased them would
   * be a second statement of the wire contract, and the first time one was renamed the two
   * would disagree with nothing to notice.
   */
  it.each(TOOLS.map((tool) => [tool.name, tool] as const))(
    "prints the %s tool, its required arguments and its own description",
    (_name, tool) => {
      expect(PAGE).toContain(tool.name);
      /* Without its backticks: the page renders those as `<code>` runs rather than as
         characters, which `Ticks` explains. Every other character is the module's. */
      expect(PAGE).toContain(squeeze(tool.description.replaceAll("`", "")));
      const required = (tool.inputSchema as { required?: readonly string[] }).required ?? [];
      expect(required.length, "a tool with no required argument").toBeGreaterThan(0);
      expect(PAGE).toContain(required.join(", "));
    },
  );

  /**
   * Six client rows, and each carries the snippet its own entry holds.
   *
   * The design handoff collapsed four of the six into one row under a single line of JSON.
   * That line is in no client's configuration: Claude Desktop, Cursor and Gemini CLI wrap
   * the entry in `"mcpServers"` and VS Code wraps it in `"servers"`, so a reader pasting
   * the collapsed form into VS Code gets a configuration it ignores.
   */
  it.each(MCP_CLIENTS.map((client) => [client.label, client] as const))(
    "prints the %s configuration exactly as `MCP_CLIENTS` holds it",
    (_label, client) => {
      expect(PAGE).toContain(client.label);
      /* The row's own snippet and not merely a snippet somewhere on the page. Giving Cursor
         the VS Code entry reddened nothing while this was a `toContain`, and that is the
         exact mistake the design handoff made: it collapsed four clients onto one line of
         JSON that is correct for none of them, because VS Code's key is `servers` and the
         other three use `mcpServers`. */
      expect(cell("client", client.id)).toBe(client.snippet);
    },
  );

  it("prints the DarkPrint skill's install command from `lib/skill.ts`", () => {
    expect(PAGE).toContain(squeeze(SKILL_INSTALL_COMMAND));
  });

  it.each(QUESTIONS.map((question) => [question.label, question] as const))(
    "prints the interview's `%s` row as `/skill` states it",
    (_label, question) => {
      expect(PAGE).toContain(question.label);
      expect(PAGE).toContain(squeeze(question.text));
    },
  );
});

describe("nothing on the page is a retyped copy", () => {
  /**
   * No command literal in the source.
   *
   * `lib/skill.ts:14` names the failure this prevents: "a wrong command produces an error
   * in somebody else's shell, never a red test here." A page that typed `npx -y darkprint
   * mcp` would render correctly today and keep rendering the old string on the day the
   * package is renamed.
   *
   * The patterns are the three command prefixes this page could plausibly hard-code. Each
   * is checked against the source with its own message, so a red says which one was typed
   * rather than that "a command" was.
   */
  const FORBIDDEN: readonly (readonly [string, string])[] = [
    /* Derived from the modules rather than guessed at, which is what keeps the needle
       narrow enough to be true and wide enough to bite. `darkprint ` alone would forbid the
       product's own name in a sentence; `darkprint clone` is unambiguously a command. */
    ...CLI_VERBS.map(
      (verb) => [`${CLI_INVOCATION} ${verb.name}`, "a CLI verb belongs in `CLI_VERBS`"] as const,
    ),
    /* A grammar only when there is one. `mcp`'s `args` is the bare word, which this page's
       source carries legitimately in three import specifiers and in the panel's own `id`;
       the row above already forbids it as a command. */
    ...CLI_VERBS.filter((verb) => verb.args !== verb.name).map(
      (verb) => [verb.args, "a verb's grammar belongs in `CLI_VERBS`"] as const,
    ),
    [NPX_INVOCATION, "the npm invocation belongs in `NPX_INVOCATION`"],
    ...CLI_ENV.map(
      (variable) => [variable.name, "an environment variable belongs in `CLI_ENV`"] as const,
    ),
    ...TOOLS.map((tool) => [tool.description, "a tool's description belongs in `TOOLS`"] as const),
    ...MCP_CLIENTS.map(
      (client) => [client.snippet, "a client configuration belongs in `MCP_CLIENTS`"] as const,
    ),
    [SKILL_INSTALL_COMMAND, "the install command belongs in `SKILL_INSTALL_COMMAND`"],
    ...QUESTIONS.map((question) => [question.text, "an interview row belongs in `QUESTIONS`"] as const),
  ];

  it.each(FORBIDDEN)("does not write `%s` in the page source", (needle, why) => {
    /* Comments are stripped first: this file's own docblocks discuss the strings they
       forbid, and so does the page's. What is forbidden is writing one into the markup,
       not naming one in the prose that explains why it is not written. */
    expect(stripComments(SOURCE), why).not.toContain(needle);
  });

  it("reaches every source module it renders from", () => {
    for (const specifier of [
      "@/packages/cli/src/index",
      "@/packages/mcp/src/tools",
      "@/components/mcp/clients",
      "@/components/skill/SkillSetup",
      "@/lib/skill",
    ]) {
      expect(SOURCE, `${specifier} is not imported`).toContain(specifier);
    }
  });
});

/**
 * Block and line comments out, string literals kept.
 *
 * Deliberately not a parser: what this has to be right about is that a `darkprint …` in a
 * docblock is not a command the page prints, and a regex over the two comment forms is
 * enough for a file with no comment-like content inside a string. If that ever stops being
 * true the cells above red rather than going quiet, because a comment that survived the
 * strip can only ADD a match.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}
