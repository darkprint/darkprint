/* ============================================================
   Nothing on /capabilities is retyped

   Every command, flag, tool name, client snippet and environment
   variable on the page is the one its own module defines, and none
   is a copy sitting in the page. Both halves are needed: finding a
   string in the markup proves it is on screen and nothing about
   where it came from, so the second half reads the page's SOURCE
   and refuses to find a command literal in it.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import CapabilitiesPage, { metadata } from "@/app/capabilities/page";
import { MCP_CLIENTS } from "@/components/mcp/clients";
import { QUESTIONS } from "@/components/skill/SkillSetup";
import { plainText } from "@/components/ui/visible-text";
import { SKILL_INSTALL_COMMAND } from "@/lib/skill";
import { CLI_ENV, CLI_INVOCATION, CLI_VERBS, NPX_INVOCATION } from "@/packages/cli/src/index";
import { TOOL_DEFINITIONS } from "@/packages/mcp/src/definitions";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The whole page, all three panels. `plainText` rather than `openText`: the two inactive
 * panels are rendered behind a `hidden` attribute rather than unmounted, which is what lets
 * `/capabilities#mcp` deep-link and gives a reader with no JavaScript the whole page.
 */
const MARKUP = renderToStaticMarkup(createElement(CapabilitiesPage as never));
const PAGE = squeeze(plainText(MARKUP));

/**
 * Runs of whitespace to one space, on both sides of every comparison. `plainText` puts a
 * space where it removes a tag, so a sentence rendered as three elements comes back with a
 * space before the comma that follows a `<code>` run. Both rules touch whitespace only.
 */
function squeeze(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([,.;:)])/g, "$1");
}

/**
 * The text of the one element carrying `data-<attribute>="<value>"`, tags removed. A
 * whole-page `toContain` cannot tell a snippet on the right row from one on the wrong row.
 */
function cell(attribute: string, value: string): string {
  const at = MARKUP.indexOf(`data-${attribute}="${value}"`);
  expect(at, `nothing on the page is marked ${attribute}="${value}"`).toBeGreaterThan(-1);
  const open = MARKUP.indexOf(">", at) + 1;
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

/**
 * One tab panel's own text, from its `id` to the next panel's.
 *
 * The three panels are rendered together and hidden rather than unmounted, so a whole-page
 * `toContain` is satisfied by a sentence written on a panel the reader is not looking at.
 * A limit stated beside a command has to be on the panel that prints that command.
 */
const PANELS = ["cli", "mcp", "skill"] as const;
function panel(id: (typeof PANELS)[number]): string {
  const at = MARKUP.indexOf(`id="${id}"`);
  expect(at, `no panel is marked id="${id}"`).toBeGreaterThan(-1);
  /* Cut at the panel's own `</section>` rather than at wherever the next panel starts. The
     last panel in the list has no next one, so a split alone hands it the whole rest of the
     document, and a cell saying a sentence is ON that panel would be satisfied by the page
     footer. The nesting check is what makes the first closer the right one. */
  const end = MARKUP.indexOf("</section>", at);
  expect(end, `the panel marked id="${id}" is never closed`).toBeGreaterThan(-1);
  const inner = MARKUP.slice(at, end);
  expect(
    inner.includes("<section"),
    `the panel marked id="${id}" now nests a <section>, so its first </section> closes the ` +
      `inner one and every cell reading this panel is reading a fragment of it.`,
  ).toBe(false);
  return squeeze(plainText(inner));
}

/**
 * One row of the intent list, as text: its name, what it answers with, and its status.
 *
 * Split on the opening `<li>` rather than read through `cell`, because an intent's answer
 * is composed of `<code>` and `<span>` runs and the first `</span>` after the marker closes
 * the innermost of them. The chunk is then cut at its own `</li>` rather than left to run to
 * the next row: a split alone leaves the LAST row of a list holding the rest of the document,
 * so a cell saying a word is ABSENT from one row would be reading the page below it, and the
 * row that is last changes whenever somebody reorders `INTENTS`.
 */
function intentRow(intent: string): string {
  const rows = MARKUP.split("<li").filter((row) => row.includes(`>${intent}<`));
  expect(rows.length, `the intent list carries no one row named "${intent}"`).toBe(1);
  const end = rows[0].indexOf("</li>");
  expect(end, `the row for "${intent}" is never closed`).toBeGreaterThan(-1);
  return squeeze(plainText(rows[0].slice(0, end)));
}

describe("the render carries what the modules define", () => {
  it("does not pass vacuously", () => {
    /* Every loop below is `it.each` over an imported array. An array that arrived empty
       would run zero cells and the file would report green over nothing. */
    expect(PAGE.length).toBeGreaterThan(3000);
    expect(CLI_VERBS.length).toBe(8);
    expect(CLI_ENV.length).toBe(3);
    expect(TOOL_DEFINITIONS.length).toBe(7);
    expect(MCP_CLIENTS.length).toBe(6);
    expect(QUESTIONS.length).toBe(6);
  });

  it.each(CLI_VERBS.map((verb) => [verb.name, verb] as const))(
    "prints `%s` with the grammar `darkprint --help` prints",
    (_name, verb) => {
      expect(PAGE).toContain(squeeze(verb.args));
      /* Against the verb's OWN row: `does: ""` reddened nothing while this was a
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
   * `Takes` is the schema's `required` list, not a description of it: these are the
   * argument names an agent has to send, and a paraphrase would drift.
   */
  it.each(TOOL_DEFINITIONS.map((tool) => [tool.name, tool] as const))(
    "prints the %s tool, its required arguments and its own description",
    (_name, tool) => {
      expect(PAGE).toContain(tool.name);
      /* Without its backticks: the page renders those as `<code>` runs. */
      expect(PAGE).toContain(squeeze(tool.description.replaceAll("`", "")));
      const required = (tool.inputSchema as { required?: readonly string[] }).required ?? [];
      expect(required.length, "a tool with no required argument").toBeGreaterThan(0);
      expect(cell("takes", tool.name)).toBe(required.join(", "));
    },
  );

  /**
   * Six client rows, and each carries the snippet its own entry holds. Giving Cursor the
   * VS Code entry reddened nothing while this was a `toContain` over the page.
   */
  it.each(MCP_CLIENTS.map((client) => [client.label, client] as const))(
    "prints the %s configuration exactly as `MCP_CLIENTS` holds it",
    (_label, client) => {
      expect(PAGE).toContain(client.label);
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
   * No command literal in the source. A page that typed a command would render correctly
   * today and keep rendering the old string on the day the command is renamed; the error
   * would land in somebody else's shell, never in a test here.
   */
  const FORBIDDEN: readonly (readonly [string, string])[] = [
    ...CLI_VERBS.map(
      (verb) => [`${CLI_INVOCATION} ${verb.name}`, "a CLI verb belongs in `CLI_VERBS`"] as const,
    ),
    /* A grammar only when there is one: `mcp`'s `args` is the bare word, which the source
       carries legitimately in import specifiers and in the panel's own `id`. */
    ...CLI_VERBS.filter((verb) => verb.args !== verb.name).map(
      (verb) => [verb.args, "a verb's grammar belongs in `CLI_VERBS`"] as const,
    ),
    [NPX_INVOCATION, "the npm invocation belongs in `NPX_INVOCATION`"],
    ...CLI_ENV.map(
      (variable) => [variable.name, "an environment variable belongs in `CLI_ENV`"] as const,
    ),
    ...TOOL_DEFINITIONS.map(
      (tool) => [tool.description, "a tool's description belongs in `TOOL_DEFINITIONS`"] as const,
    ),
    ...MCP_CLIENTS.map(
      (client) => [client.snippet, "a client configuration belongs in `MCP_CLIENTS`"] as const,
    ),
    [SKILL_INSTALL_COMMAND, "the install command belongs in `SKILL_INSTALL_COMMAND`"],
    ...QUESTIONS.map((question) => [question.text, "an interview row belongs in `QUESTIONS`"] as const),
  ];

  it.each(FORBIDDEN)("does not write `%s` in the page source", (needle, why) => {
    /* Comments are stripped first: the page's own docblocks discuss the strings they forbid. */
    expect(stripComments(SOURCE), why).not.toContain(needle);
  });

  it("reaches every source module it renders from", () => {
    for (const specifier of [
      "@/packages/cli/src/index",
      "@/packages/mcp/src/definitions",
      "@/components/mcp/clients",
      "@/components/skill/SkillSetup",
      "@/lib/skill",
    ]) {
      expect(SOURCE, `${specifier} is not imported`).toContain(specifier);
    }
  });

  it("does not drag the CLI's executor or the database into the page", () => {
    /* `definitions.ts` is pure data. `tools.ts` reaches the engine and `local.ts` reaches
       the driver, and neither belongs in a prerendered reference page. */
    expect(SOURCE).not.toContain("@/packages/mcp/src/tools");
    expect(SOURCE).not.toContain("@/packages/mcp/src/local");
  });
});

/* ============================================================
   What the page owes a reader beside a command it prints

   `npm view darkprint` answers 404. Every npx line on this site is
   printed under the sentence saying so, and this page prints two of
   them, on two different tabs. A reader sees one panel at a time, so
   the limit is held per panel: a page-wide `toContain` is met by a
   sentence on a panel nobody has opened.

   These come off in the one commit that follows `npm publish`,
   with the sentence itself on the other surfaces.
   ============================================================ */

describe("the limit every printed npx line is under", () => {
  it("rendered three distinct panels, so no cell below reads the wrong one", () => {
    const texts = PANELS.map(panel);
    for (const [index, text] of texts.entries()) {
      expect(text.length, `the ${PANELS[index]} panel`).toBeGreaterThan(400);
    }
    expect(new Set(texts).size).toBe(PANELS.length);
    /* Three different lengths would satisfy the line above. What the two cells below need is
       that a panel stops where the next one starts, so the CLI panel is held to NOT carrying
       the DarkPrint skill panel's sentence. */
    expect(panel("cli")).not.toContain("the line above finds nothing to run");
  });

  it("says it on the CLI panel, which is where the npx invocation is printed", () => {
    expect(
      panel("cli"),
      "the panel prints a command for every verb and the package behind them is not on npm",
    ).toContain("The package is not published to npm yet, so npx finds nothing to run today.");
  });

  it("says it on the DarkPrint skill panel, which prints a whole install line", () => {
    expect(
      panel("skill"),
      "the panel prints the install command under a copy button, on its own tab",
    ).toContain("The package is not published to npm yet, so the line above finds nothing to run");
  });

  it("says it above the intent list, which prints six npx lines before any panel", () => {
    /* The intent list renders ahead of the three panels, so a reader meets `npx -y darkprint
       <verb>` in six rows before reaching the panel that states the limit. Cut at the tab
       section rather than read off the whole page, since every panel below says it too. */
    const at = MARKUP.indexOf('id="intent-title"');
    const end = MARKUP.indexOf('id="cli"');
    expect(at, "no section is marked intent-title").toBeGreaterThan(-1);
    expect(end, "the intent list no longer renders before the CLI panel").toBeGreaterThan(at);
    expect(
      squeeze(plainText(MARKUP.slice(at, end))),
      "the rows answer with a command the reader cannot run yet, and this is where that is said",
    ).toContain("is not published to npm");
  });

  it("says it in the description a shared link carries", () => {
    const description = metadata.description ?? "";
    /* `components/mcp/honesty.test.ts` holds this description to `install from npm`, so the
       provenance stays and the limit is stated after it rather than in place of it. */
    expect(description).toContain("install from npm");
    expect(description).toContain("not published to npm yet");
  });
});

/* ============================================================
   The intent list is the site's index of what a reader can do

   A row that is missing is an operation a reader concludes is not
   offered. Each cell below names one address and holds it against
   its own row, since a `toContain` over the page is satisfied by an
   address printed on any of the other twenty.
   ============================================================ */

describe("the intent list names every door a reader has", () => {
  it("sends a release publisher to the address that takes one", () => {
    const row = intentRow("Publish a release from your agent");
    expect(row.length).toBeGreaterThan(60);
    /* Named in the row itself: `/settings` prints the curl only after the scope dropdown is
       moved to Write, so a reader who has not made that click had nowhere to read it. */
    expect(row).toContain("POST /api/bundles");
    expect(row).toContain("write-scoped API key");
  });

  it("sends a card publisher to the address that takes a card", () => {
    const row = intentRow("Publish one card on its own");
    expect(row.length).toBeGreaterThan(40);
    expect(row).toContain("POST /api/cards");
    /* Its own row and not a widened one: a reader holding a single node reads past a row
       whose answer names a release. */
    expect(row).not.toContain("release");
  });

  it("names the visibility route, and says it is the blueprint's and not a release's", () => {
    const row = intentRow("Change who can see a blueprint");
    expect(row.length).toBeGreaterThan(40);
    expect(row).toContain("PATCH /api/bundles/<owner>/<slug>/visibility");
    /* `visibility` is a column on `bundle` (`lib/db/schema.ts`). A row that said release
       would promise a per-version switch that does not exist and cannot be built from this
       route. */
    expect(row).not.toContain("release");
  });
});

/**
 * Block and line comments out, string literals kept. Deliberately not a parser: a comment
 * that survived the strip can only ADD a match, so the cells above red rather than go quiet.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}
