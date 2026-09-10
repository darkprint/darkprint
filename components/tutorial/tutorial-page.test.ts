/* ============================================================
   /tutorial: five steps, every command from its source, and a
   client island that renders without a browser.

   The page hands a reader four things to paste: two install lines,
   two MCP lines and two prompts. Each is held against the module that
   defines it, by the cell that prints it rather than by a `toContain`
   over the whole page, because a page that prints every string against
   the wrong label satisfies the weaker check. The second half reads the
   page's source and refuses to find any of those strings typed into it.

   The island is rendered in its resting states through the pure view
   it exports. A render is the only proof that it needs no app-router
   context, which is what lets `honesty.test.ts`-style suites render
   the page whole in a node environment.

   ── no component is built inside a render ──
   A component built from `useCallback` or `useMemo` inside a render
   changes identity when its dependencies do, and React remounts every
   element of that type, so a control the reader is using is replaced
   under them on the next state change. Proving focus survives needs a
   DOM this suite does not have; what can be checked is that the one
   construction that causes it is absent from the island.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TutorialPage from "@/app/tutorial/page";
import { MCP_CLIENTS } from "@/components/mcp/clients";
import { LEARN_PRACTICE } from "@/components/spec/sequence";
import { LivePromptView, StartLiveView } from "@/components/tutorial/StartLive";
import {
  DESIGN_PROMPT,
  ENRICH_PROMPT,
  LIVE_STORAGE_KEY,
  LIVE_URL_PLACEHOLDER,
  livePagePath,
  withLiveUrl,
} from "@/components/tutorial/prompts";
import { openText, plainText } from "@/components/ui/visible-text";
import { LIVE_TOKEN_PATTERN } from "@/lib/core/tutorial/live";
import { SKILL_INSTALL_COMMAND, SKILL_INSTALL_COMMAND_CODEX } from "@/lib/skill";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const MARKUP = renderToStaticMarkup(createElement(TutorialPage as never));
const PAGE = squeeze(plainText(MARKUP));
const OPEN = squeeze(openText(MARKUP));
const SOURCE = readFileSync(`${ROOT}app/tutorial/page.tsx`, "utf8");
const ISLAND = readFileSync(`${ROOT}components/tutorial/StartLive.tsx`, "utf8");

/** The five steps, in the order the page and the Learn rail both take them. */
const SECTION_IDS = ["install", "open-live", "design", "enrich", "keep"] as const;

/** A token of the shape the route mints, for the resume state. */
const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";
const LIVE_URL = `https://www.darkprint.io${livePagePath(TOKEN)}`;

function squeeze(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([,.;:)])/g, "$1");
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

/**
 * The text of the one element carrying `data-<attribute>="<value>"`, tags removed. A
 * whole-page `toContain` cannot tell a snippet on the right row from one on the wrong row.
 */
function cell(markup: string, attribute: string, value: string): string {
  const at = markup.indexOf(`data-${attribute}="${value}"`);
  expect(at, `nothing in the markup is marked ${attribute}="${value}"`).toBeGreaterThan(-1);
  const open = markup.indexOf(">", at) + 1;
  const tag = markup.slice(markup.lastIndexOf("<", at) + 1).match(/^[a-z]+/)?.[0] ?? "";
  const close = markup.indexOf(`</${tag}>`, open);
  return decode(markup.slice(open, close).replace(/<[^>]+>/g, ""));
}

/** The opening tag that declares `id`, as the markup or the source writes it. */
function declaringTag(text: string, id: string): string | undefined {
  const at = text.indexOf(`id="${id}"`);
  if (at === -1) return undefined;
  return text.slice(text.lastIndexOf("<", at), text.indexOf(">", at) + 1);
}

/** Block and line comments out, string literals kept. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
}

/** "the skill" with nothing in front of "skill": the phrase `lib/skill.ts` forbids on every surface. */
const UNQUALIFIED_SKILL = /\bthe skill\b/i;

describe("the render is the page", () => {
  it("does not pass vacuously", () => {
    expect(PAGE.length).toBeGreaterThan(2500);
    expect(SOURCE.length).toBeGreaterThan(3000);
    expect(ISLAND.length).toBeGreaterThan(3000);
    expect(MARKUP).toContain("<h1");
    expect(PAGE).toContain("Write your first blueprint");
  });

  it("keeps what the Learn sequence pins on it", () => {
    expect(SOURCE).toContain('const HERE = "/tutorial"');
    expect(SOURCE).toContain("<SpecPager href={HERE} />");
    expect(SOURCE).toContain('title: "Write your first blueprint"');
    expect(SOURCE).toMatch(/description:\s*\n?\s*"[^"]{40,}"/);
  });
});

describe("five sections the rail can reach", () => {
  it.each(SECTION_IDS)("#%s is a <section> that clears the sticky header", (id) => {
    /* Both in the markup, which is what the browser scrolls, and in the source, which is
       what `components/site/anchors.test.ts` walks: an id composed at render time would
       satisfy the first and be invisible to the second. */
    const rendered = declaringTag(MARKUP, id);
    expect(rendered, `the markup declares no id="${id}"`).toBeDefined();
    expect(rendered).toMatch(/^<section\b/);
    expect(rendered).toContain("scroll-mt-24");
    const written = declaringTag(SOURCE, id);
    expect(written, `the source writes no literal id="${id}"`).toBeDefined();
    expect(written).toContain("scroll-mt-24");
  });

  it("writes no other literal id into the page source", () => {
    /* `anchors.test.ts` finds a fragment's target by the first `id="…"` in the tree that
       spells it, `app/` sorting before `components/`. A prop that happened to be called
       `id` would put a row name on a tag with no scroll offset, and a link to that fragment
       from another page would then red against this file. */
    const ids = [...SOURCE.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual([...SECTION_IDS]);
  });

  it("orders them as the reader takes them", () => {
    const positions = SECTION_IDS.map((id) => MARKUP.indexOf(`id="${id}"`));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    /* Each step carries a numbered `h2`, so the outline a screen reader walks is the
       sequence and nothing else on the page competes with it. */
    expect(MARKUP.match(/<h2\b/g)).toHaveLength(SECTION_IDS.length);
    for (const [index] of SECTION_IDS.entries()) {
      expect(PAGE).toContain(`${index + 1}. `);
    }
  });

  it("is the list the Learn rail links from", () => {
    const stop = LEARN_PRACTICE.find((page) => page.href === "/tutorial");
    expect(stop, "the tutorial left the practice run").toBeDefined();
    expect(stop?.sections.map((section) => section.id)).toEqual([...SECTION_IDS]);
    for (const section of stop?.sections ?? []) {
      expect(section.label.length).toBeGreaterThan(4);
      expect(section.label.length).toBeLessThan(32);
      expect(section.label).not.toMatch(UNQUALIFIED_SKILL);
      expect(`${section.id} ${section.label}`.toLowerCase()).not.toMatch(/build|sandbox/);
    }
  });
});

describe("every command a reader pastes is the one its module defines", () => {
  it("prints both install lines from lib/skill.ts, byte for byte", () => {
    expect(cell(MARKUP, "command", "claude-code")).toBe(SKILL_INSTALL_COMMAND);
    expect(cell(MARKUP, "command", "codex")).toBe(SKILL_INSTALL_COMMAND_CODEX);
    expect(SKILL_INSTALL_COMMAND).not.toBe(SKILL_INSTALL_COMMAND_CODEX);
  });

  it("says what the install line does, and that no account is created", () => {
    expect(OPEN.toLowerCase()).toContain("no account is created");
    expect(OPEN).toContain("skills/darkprint");
  });

  /**
   * The two lines above this sentence fetch a package `npm view darkprint` answers 404 for,
   * and this is the page a first-time reader is sent to before any other. The limit is held
   * inside step 1 rather than over the whole page: a sentence about npm printed down beside
   * the account step qualifies nothing, and a reader copies the command before reading on.
   *
   * `openText`, because the thing it qualifies is printed in the open beside it. Verbatim,
   * because the same sentence stands on six other surfaces and all seven come off together
   * in the one commit that follows `npm publish`.
   */
  it("says the install lines fetch a package npm does not have, inside step 1", () => {
    const step = MARKUP.slice(MARKUP.indexOf('id="install"'), MARKUP.indexOf('id="open-live"'));
    expect(step.length, "step 1 is not the first section of the page").toBeGreaterThan(500);
    const open = squeeze(openText(step));
    expect(
      open,
      "the tutorial prints two npx lines and the package behind them is not published",
    ).toContain(
      "Not installable yet: the darkprint package is not published to npm, so npx finds " +
        "nothing to run.",
    );
    expect(open, "the limit carries the badge the other six surfaces carry").toContain(
      "Coming soon",
    );
  });

  it.each(["claude-code", "codex"])(
    "prints the %s MCP line exactly as MCP_CLIENTS holds it",
    (id) => {
      const client = MCP_CLIENTS.find((entry) => entry.id === id);
      expect(client, `MCP_CLIENTS has no ${id} entry`).toBeDefined();
      expect(cell(MARKUP, "client", id)).toBe(client?.snippet);
      expect(PAGE).toContain(client?.label ?? "");
    },
  );

  it("sends the other clients to /mcp rather than retyping their JSON", () => {
    expect(MARKUP).toContain('href="/mcp"');
    for (const client of MCP_CLIENTS.filter((entry) => entry.snippet.startsWith("{"))) {
      expect(MARKUP).not.toContain(`data-client="${client.id}"`);
    }
  });

  /**
   * No command literal in the page source. A page that typed a command would render
   * correctly today and keep rendering the old string on the day the command changes; the
   * error would land in somebody else's shell, never in a test here.
   */
  const RETYPED: readonly (readonly [string, string])[] = [
    [SKILL_INSTALL_COMMAND, "the Claude Code install line belongs in `lib/skill.ts`"],
    [SKILL_INSTALL_COMMAND_CODEX, "the Codex install line belongs in `lib/skill.ts`"],
    ...MCP_CLIENTS.map(
      (client) => [client.snippet, `the ${client.label} entry belongs in MCP_CLIENTS`] as const,
    ),
    [DESIGN_PROMPT.slice(0, 60), "the first prompt belongs in `prompts.ts`"],
    [ENRICH_PROMPT.slice(0, 60), "the enrich prompt belongs in `prompts.ts`"],
  ];

  it.each(RETYPED)("does not write `%s` in the page source", (needle, why) => {
    expect(stripComments(SOURCE), why).not.toContain(needle);
  });

  it("reaches every module it renders from", () => {
    for (const specifier of [
      "@/lib/skill",
      "@/components/mcp/clients",
      "@/components/tutorial/StartLive",
      "@/components/spec/SpecPager",
    ]) {
      expect(SOURCE, `${specifier} is not imported`).toContain(specifier);
    }
  });
});

describe("the prompts", () => {
  it("each name the live page once, by the placeholder", () => {
    for (const prompt of [DESIGN_PROMPT, ENRICH_PROMPT]) {
      expect(prompt.split(LIVE_URL_PLACEHOLDER)).toHaveLength(2);
    }
  });

  it("fill the address in, and leave the prompt alone without one", () => {
    const filled = withLiveUrl(DESIGN_PROMPT, LIVE_URL);
    expect(filled).toContain(LIVE_URL);
    expect(filled).not.toContain(LIVE_URL_PLACEHOLDER);
    expect(withLiveUrl(DESIGN_PROMPT, undefined)).toBe(DESIGN_PROMPT);
    expect(withLiveUrl(ENRICH_PROMPT, LIVE_URL)).toContain(LIVE_URL);
  });

  it("describe the task the tutorial suggests and the enrichment it asks for", () => {
    const design = DESIGN_PROMPT.toLowerCase();
    expect(design).toContain("pokémon");
    expect(design).toContain("three sites");
    expect(design).toContain("lowest price");
    expect(design).toContain("every morning");
    expect(design).toContain("darkprint skill");
    const enrich = ENRICH_PROMPT.toLowerCase();
    expect(enrich).toContain("darkprint mcp");
    expect(enrich).toContain("observability");
    expect(enrich).toContain("enrich mode");
    /* By need and never by slug: the search is the step the reader is meant to watch. */
    expect(enrich).not.toContain("pipeline-observability");
  });

  it("are printed on the page as the placeholder form, since the server holds no token", () => {
    expect(cell(MARKUP, "prompt", "design")).toBe(DESIGN_PROMPT);
    expect(cell(MARKUP, "prompt", "enrich")).toBe(ENRICH_PROMPT);
    expect(PAGE).toContain("Open your live page in step 2");
  });

  it("read as one block with the address in once a token exists", () => {
    const html = renderToStaticMarkup(
      createElement(LivePromptView, {
        name: "design",
        prompt: withLiveUrl(DESIGN_PROMPT, LIVE_URL),
        filled: true,
      }),
    );
    expect(cell(html, "prompt", "design")).toContain(LIVE_URL);
    expect(html).not.toContain("fills in here");
  });
});

describe("the door to a live page", () => {
  it("offers to open one when nothing is stored", () => {
    const html = renderToStaticMarkup(
      createElement(StartLiveView, { token: null, pending: false, onStart: () => {} }),
    );
    expect(html).toMatch(/<button[^>]*>Open my live page<\/button>/);
    expect(html).not.toContain("Resume your live page");
    expect(html).not.toContain('role="alert"');
    expect(plainText(html)).toContain("24 hours");
  });

  it("offers to resume the stored one, and to start over", () => {
    const html = renderToStaticMarkup(
      createElement(StartLiveView, { token: TOKEN, pending: false, onStart: () => {} }),
    );
    expect(html).toContain(`href="${livePagePath(TOKEN)}"`);
    expect(html).toContain("Resume your live page");
    expect(html).toMatch(/<button[^>]*>start a new one<\/button>/);
    expect(html).not.toContain("Open my live page");
  });

  it("says in one sentence when the site refused", () => {
    const error = "This site could not be reached, so no live page was opened.";
    const html = renderToStaticMarkup(
      createElement(StartLiveView, { token: null, pending: true, error, onStart: () => {} }),
    );
    expect(html).toContain(`role="alert"`);
    expect(plainText(html)).toContain(error);
    expect(html).toMatch(/<button[^>]*\bdisabled=""[^>]*>/);
  });

  it("posts an empty object to the route and keeps the token under the agreed key", () => {
    expect(LIVE_STORAGE_KEY).toBe("darkprint:tutorial-live");
    const code = stripComments(ISLAND);
    expect(code).toContain('fetch("/api/tutorial/live"');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('body: "{}"');
    expect(code).toContain("window.location.assign(");
    /* Every touch of storage sits directly inside a `try`: a private window throws on the
       accessor itself, and the page has to render with no stored value. */
    const lines = code.split("\n");
    const touches = lines.map((line, i) => [line, i] as const).filter(([line]) => line.includes("localStorage."));
    expect(touches.length).toBeGreaterThan(1);
    for (const [line, i] of touches) {
      const previous = lines.slice(0, i).reverse().find((candidate) => candidate.trim() !== "");
      expect(previous?.trim(), `${line.trim()} is not inside a try block`).toBe("try {");
    }
  });

  it("only trusts a stored value of the shape the route mints", () => {
    expect(TOKEN).toMatch(LIVE_TOKEN_PATTERN);
    expect(stripComments(ISLAND)).toContain("isLiveToken(value)");
  });

  it("builds no component from a hook", () => {
    /* A capitalised binding assigned a hook call is a component made during a render. */
    const componentInRender = /\bconst\s+[A-Z]\w*\s*(?::[^=]+)?=\s*use(?:Callback|Memo)\s*\(/;
    expect(componentInRender.test("  const B = useCallback(({ id }: { id: string }) => (")).toBe(true);
    expect(componentInRender.test("  const v = useCallback((id: string) => x, [])")).toBe(false);
    const offender = ISLAND.split("\n").find((line) => componentInRender.test(line));
    expect(
      offender,
      "A component built from `useCallback`/`useMemo` changes identity whenever its " +
        "dependencies do, so React remounts every element of that type and the control the " +
        "reader is using is replaced under them. Declare it at module scope.",
    ).toBeUndefined();
  });
});

describe("what the page says", () => {
  it("links the account door and the upload door", () => {
    expect(MARKUP).toContain('href="/welcome"');
    expect(MARKUP).toContain('href="/upload"');
    const keep = squeeze(plainText(MARKUP.slice(MARKUP.indexOf('id="keep"'))));
    expect(keep).toContain("visibility defaults to private");
    expect(keep).toContain("API key");
  });

  it("says the site runs nothing, in the open", () => {
    expect(OPEN.toLowerCase()).toContain("nothing runs on this site");
  });

  it("never prints the skill unqualified", () => {
    for (const [name, text] of [
      ["the page", PAGE],
      ["the first prompt", DESIGN_PROMPT],
      ["the enrich prompt", ENRICH_PROMPT],
    ] as const) {
      expect(text, `${name} says "the skill" with no qualifier`).not.toMatch(UNQUALIFIED_SKILL);
    }
  });

  it("keeps the deleted route's words out of its ids and chrome", () => {
    for (const id of MARKUP.matchAll(/\bid="([^"]+)"/g)) {
      expect(id[1].toLowerCase()).not.toMatch(/build|sandbox/);
    }
    expect(PAGE).not.toContain("SANDBOX");
  });
});
