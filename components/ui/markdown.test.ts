/* ============================================================
   The Markdown renderer, and the three things it must never do.

   `components/ui/markdown-parse.ts` is a parser written by hand for one document: the
   `README.md` that `lib/content/bundle-export.ts` generates into every bundle. That
   README is generated, but it is not trustworthy — the blueprint title, the summary, the
   card names and the node labels all flow into it from `blueprint.yaml` and
   `content/cards/*.yaml`, and on a live registry those are words a stranger typed. So
   the security half of this file is not decoration:

     1. a `<script>` in the source must come out as VISIBLE TEXT
     2. an `<img onerror=…>` in the source must come out as VISIBLE TEXT
     3. a `javascript:` destination must never become a live href

   Each of those was falsified before it was believed. Rendering the same fixtures
   through `dangerouslySetInnerHTML` on the raw source reds cells 1 and 2 (the markup
   arrives as markup and the literal text is nowhere in the visible reading); dropping
   `safeHref`'s scheme test reds cell 3 with `href="javascript:alert(1)"` in the output.
   The obfuscation cells were falsified separately: deleting the control-character strip
   in `safeHref` reds the U+0001 case alone and leaves every other link cell green, which
   is what says that strip is load-bearing and not decoration.

   The robustness half exists because this panel is the whole page section: a parser that
   throws on a malformed table does not degrade, it blanks the document. Every case here
   asserts non-throwing FIRST and shape second.

   The corpus half renders all nine shipped `public/bundles/<slug>/README.md` rather than
   fixtures alone, for the reason `components/site/honesty.test.ts` gives: a guard that
   only holds over an invented document is a guard about nothing. Its last case is the
   strongest claim this renderer makes — that no word of the source is dropped on the way
   to the screen.

   `dangerouslySetInnerHTML` appears in this file as a literal, and the guard that
   forbids it reads `Markdown.tsx` and `markdown-parse.ts` off disk, never this file. A guard
   whose domain includes its own accusation cannot pass.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown } from "@/components/ui/Markdown";
import { parseMarkdown, safeHref } from "@/components/ui/markdown-parse";
import { plainText } from "@/components/ui/visible-text";

function render(source: string): string {
  return renderToStaticMarkup(createElement(Markdown, { source }));
}

/** What a reader actually sees: tags gone, entities resolved. */
function visible(source: string): string {
  return plainText(render(source));
}

const BUNDLES_DIR = fileURLToPath(new URL("../../public/bundles", import.meta.url));

const READMES: { slug: string; text: string }[] = readdirSync(BUNDLES_DIR, {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    slug: entry.name,
    text: readFileSync(`${BUNDLES_DIR}/${entry.name}/README.md`, "utf8"),
  }));

describe("markdown: the input is real", () => {
  /* If this ever reads zero the whole corpus section below is vacuous and green, which is
     the one failure mode a suite cannot report on itself. */
  it("finds the shipped bundle READMEs", () => {
    expect(READMES.length).toBeGreaterThanOrEqual(9);
    for (const readme of READMES) expect(readme.text.length).toBeGreaterThan(500);
  });
});

describe("markdown: hostile source is text, never markup", () => {
  it("renders a script tag as visible characters", () => {
    const source = "Then <script>alert(1)</script> ran.";
    const html = render(source);

    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;script&gt;");
    expect(visible(source)).toBe("Then <script>alert(1)</script> ran.");
  });

  it("renders an onerror image as visible characters", () => {
    const source = '<img src=x onerror="alert(1)">';
    const html = render(source);

    expect(html).not.toMatch(/<img/i);
    expect(html).toContain("&lt;img");
    expect(visible(source)).toContain('<img src=x onerror="alert(1)">');
  });

  it("keeps hostile text as text inside every construct that carries text", () => {
    const payload = "<script>alert(1)</script>";
    const source = [
      `# ${payload}`,
      "",
      `A paragraph with ${payload} in it.`,
      "",
      `- a bullet with ${payload}`,
      "",
      `> a quote with ${payload}`,
      "",
      `\`a code span with ${payload}\``,
      "",
      "| head |",
      "| --- |",
      `| ${payload} |`,
      "",
      "```",
      payload,
      "```",
    ].join("\n");

    const html = render(source);

    expect(html).not.toMatch(/<script/i);
    /* Seven constructs, seven appearances, all of them as characters. A renderer that
       escaped the paragraph and forgot the table cell would still pass the line above. */
    expect(visible(source).match(/<script>alert\(1\)<\/script>/g)).toHaveLength(7);
  });

  it("escapes the ampersand, so an entity cannot be smuggled through", () => {
    const html = render("&lt;script&gt;alert(1)&lt;/script&gt;");

    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&amp;lt;");
  });

  it("carries no dangerouslySetInnerHTML in either module", () => {
    /* The domain is the two files that render, and deliberately not this one: the guard
       has to be able to name the thing it forbids.

       It looks for the prop being USED — `dangerouslySetInnerHTML=` as JSX, or
       `dangerouslySetInnerHTML:` as an object key — and not for the word. The word is in
       `Markdown.tsx`, in the paragraph that forbids it, so a substring test would have
       been red against the correct file and could only have been made green by deleting
       the explanation. A rule that cannot survive being written down is not a rule. */
    for (const name of ["Markdown.tsx", "markdown-parse.ts"]) {
      const source = readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
      expect(source).not.toMatch(/dangerouslySetInnerHTML\s*[=:]/);
    }
  });
});

describe("markdown: link destinations", () => {
  it("refuses a javascript: destination and shows the source instead", () => {
    const source = "[click me](javascript:alert(1))";
    const html = render(source);

    expect(html).not.toMatch(/<a\b/);
    /* The scheme is still in the OUTPUT, and that is the point: it is in the reader's
       text where anybody can see it, not in an attribute a browser would act on. So the
       assertion is about the attribute and not about the characters. */
    expect(html).not.toMatch(/href=/);
    expect(visible(source)).toContain("[click me](javascript:alert(1))");
  });

  it("refuses a javascript: destination whatever its case", () => {
    const html = render("[x](JaVaScRiPt:alert(1))");

    expect(html).not.toMatch(/<a\b/);
    expect(html).not.toMatch(/href=/);
  });

  it("refuses a destination that hides a control character inside the scheme", () => {
    /* A browser strips a control character before it reads the scheme, so the raw string
       and the string that gets navigated are not the same string, and `safeHref` tests the
       second one. Written as an escape, and U+0001 rather than a tab: a tab is whitespace,
       so the destination splitter would have cut the string in half long before the scheme
       test saw it, and the case would have passed for the wrong reason. */
    const hidden = "java\u0001script:alert(1)";
    expect(safeHref(hidden)).toBeUndefined();

    const html = render(`[x](${hidden})`);
    expect(html).not.toMatch(/<a\b/);
    expect(html).not.toMatch(/href=/);
  });

  it("refuses data: and vbscript: too", () => {
    expect(safeHref("data:text/html;base64,PHNjcmlwdD4=")).toBeUndefined();
    expect(safeHref("vbscript:msgbox(1)")).toBeUndefined();
    /* The NUL is written as an ESCAPE, not as a raw byte. `tests/no-raw-control-bytes.test.ts`
       refuses a literal control byte anywhere in a tracked source file, and it is right to: a raw
       NUL in a `.ts` file is invisible in every diff and every review. The escape is the same
       character to the parser, so the obfuscation this cell tests is unchanged. */
    expect(safeHref("  \u0000javascript:alert(1)")).toBeUndefined();
  });

  it("keeps http, https, mailto and relative destinations", () => {
    expect(safeHref("https://darkprint.io/x")).toBe("https://darkprint.io/x");
    expect(safeHref("http://example.test")).toBe("http://example.test");
    expect(safeHref("mailto:someone@example.test")).toBe("mailto:someone@example.test");
    expect(safeHref("/blueprints/incident-commander")).toBe("/blueprints/incident-commander");
    expect(safeHref("#run-it")).toBe("#run-it");
    expect(safeHref("./cards/a.yaml")).toBe("./cards/a.yaml");
    /* A colon that is not a scheme, because a `/` precedes it. */
    expect(safeHref("a/b:c")).toBe("a/b:c");
  });

  it("marks every rendered link nofollow and noreferrer", () => {
    const html = render("See [the site](https://darkprint.io/x).");

    expect(html).toContain('href="https://darkprint.io/x"');
    expect(html).toMatch(/rel="[^"]*nofollow[^"]*"/);
    expect(html).toMatch(/rel="[^"]*noreferrer[^"]*"/);
    /* The label survives as the reader's text and the URL does not appear in it, which
       is what a link is for. `plainText` puts a space where each tag was, so the
       sentence's own full stop is separated from the label. */
    const seen = visible("See [the site](https://darkprint.io/x).");
    expect(seen).toContain("See the site");
    expect(seen).not.toContain("darkprint.io");
  });
});

describe("markdown: block grammar", () => {
  it("renders h1 through h6 at their own level", () => {
    for (let level = 1; level <= 6; level += 1) {
      const html = render(`${"#".repeat(level)} Title ${level}`);
      expect(html).toContain(`<h${level}`);
      expect(html).toContain(`Title ${level}`);
    }
  });

  it("does not read a hashtag as a heading", () => {
    const html = render("#hashtag is not a heading");
    expect(html).not.toContain("<h1");
    expect(visible("#hashtag is not a heading")).toBe("#hashtag is not a heading");
  });

  it("renders a fenced block verbatim, markers and all", () => {
    const source = ["```", "# not a heading", "| not | a table |", "- not a bullet", "```"].join("\n");
    const html = render(source);

    expect(html).toContain("<pre");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<li");
    expect(visible(source)).toContain("# not a heading");
  });

  it("renders a pipe table with a header row and a cell per column", () => {
    const source = ["| node | card |", "| --- | --- |", "| `a` | `x@1.0.0` |"].join("\n");
    const html = render(source);

    expect(html.match(/<th\b/g)).toHaveLength(2);
    expect(html.match(/<td\b/g)).toHaveLength(2);
    expect(html).toContain("x@1.0.0");
  });

  it("reads column alignment off the delimiter row", () => {
    const source = ["| l | c | r |", "| :-- | :-: | --: |", "| 1 | 2 | 3 |"].join("\n");
    const html = render(source);

    expect(html).toContain("text-left");
    expect(html).toContain("text-center");
    expect(html).toContain("text-right");
  });

  it("gives a table and a code block their own sideways scroll and a tab stop", () => {
    /* The page must never scroll sideways, and a scrollable box with no focusable cell
       is unreachable by keyboard without a tab stop of its own (WCAG 2.1.1). */
    const table = render(["| a |", "| --- |", "| b |"].join("\n"));
    const fence = render(["```", "x".repeat(400), "```"].join("\n"));

    for (const html of [table, fence]) {
      expect(html).toContain("overflow-x-auto");
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('role="group"');
      expect(html).toMatch(/aria-label="[^"]+"/);
    }
  });

  it("renders a blockquote, and folds its wrapped line into one paragraph", () => {
    const source = ["> 6 of 7 nodes run unattended,", "> 1 has a person in the loop."].join("\n");
    const html = render(source);

    expect(html).toContain("<blockquote");
    expect(html.match(/<p\b/g)).toHaveLength(1);
    expect(visible(source)).toBe("6 of 7 nodes run unattended, 1 has a person in the loop.");
  });

  it("renders bullets and ordered lists", () => {
    const bullets = render(["- one", "- two"].join("\n"));
    expect(bullets).toContain("<ul");
    expect(bullets.match(/<li\b/g)).toHaveLength(2);

    const ordered = render(["3. three", "4. four"].join("\n"));
    expect(ordered).toContain("<ol");
    expect(ordered).toContain('start="3"');
  });

  it("joins a wrapped bullet into its own item", () => {
    const source = ["- an item that", "  wraps at ninety columns", "- a second item"].join("\n");
    const html = render(source);

    expect(html.match(/<li\b/g)).toHaveLength(2);
    expect(visible(source)).toContain("an item that wraps at ninety columns");
  });

  it("renders a thematic break, and does not read one as a bullet", () => {
    const html = render(["text", "", "---", "", "more"].join("\n"));

    expect(html).toContain("<hr");
    expect(html).not.toContain("<li");
  });

  it("keeps paragraphs separate and folds the lines inside one", () => {
    const source = ["one line", "and its wrap", "", "a second paragraph"].join("\n");
    expect(render(source).match(/<p\b/g)).toHaveLength(2);
  });
});

describe("markdown: inline grammar", () => {
  it("renders a code span", () => {
    const html = render("Read it off `cards/<ref>.yaml`.");

    expect(html).toContain("<code");
    expect(html).toContain("cards/&lt;ref&gt;.yaml");
  });

  it("renders italic and bold", () => {
    expect(render("labelled *reported* for that reason")).toContain("<em");
    expect(render("labelled **reported** for that reason")).toContain("<strong");
  });

  it("leaves an underscore alone, because identifiers are full of them", () => {
    const source = "the field is risk_markers_v2 and the term is _draft_";
    expect(render(source)).not.toContain("<em");
    expect(visible(source)).toBe(source);
  });

  it("does not italicise a multiplication sign", () => {
    /* Three fixtures, because the two flank rules mask each other. A delimiter may not
       open with whitespace after it and may not close with whitespace before it, and the
       first case is satisfied by EITHER rule on its own: deleting one and keeping the
       other leaves it green, which reads as coverage while half the guard is gone. The
       second case can only be caught by the opening rule and the third only by the
       closing one. */
    for (const source of ["2 * 3 * 4 is twenty four", "2 * 3*4 is twelve", "*not italic *"]) {
      expect(render(source)).not.toContain("<em");
      expect(visible(source)).toBe(source);
    }
  });

  it("does not read markup inside a code span", () => {
    const source = "`*not italic*` and `[not a link](/x)`";
    const html = render(source);

    expect(html).not.toContain("<em");
    expect(html).not.toMatch(/<a\b/);
    expect(visible(source)).toBe("*not italic* and [not a link](/x)");
  });

  it("honours a backslash escape", () => {
    expect(render("a \\*not italic\\* b")).not.toContain("<em");
    expect(visible("a \\*not italic\\* b")).toBe("a *not italic* b");
  });
});

describe("markdown: malformed input degrades, and never throws", () => {
  const cases: [string, string][] = [
    ["empty document", ""],
    ["whitespace only", "   \n\n \t \n"],
    ["unterminated fence", ["# Title", "", "```", "still open", "and open"].join("\n")],
    ["unterminated code span", "a `code span that never closes"],
    ["unterminated bold", "an **emphasis that never closes"],
    ["unterminated link", "an [label](/dest that never closes"],
    ["ragged table", ["| a | b | c |", "| --- | --- | --- |", "| 1 |", "| 1 | 2 | 3 | 4 |"].join("\n")],
    ["table with no body", ["| a | b |", "| --- | --- |"].join("\n")],
    ["heading with no text", "##"],
    ["heading of hashes only", "###   "],
    ["pipes and nothing else", "|||"],
    ["a lone asterisk", "*"],
    ["a lone bracket", "["],
    ["a lone backtick", "`"],
    ["nothing but a rule", "---"],
    ["CRLF document", "# Title\r\n\r\nA paragraph.\r\n\r\n- a bullet\r\n"],
    ["lone CR document", "# Title\r\rA paragraph.\r"],
  ];

  for (const [name, source] of cases) {
    it(`survives: ${name}`, () => {
      expect(() => parseMarkdown(source)).not.toThrow();
      expect(() => render(source)).not.toThrow();
    });
  }

  it("runs an unterminated fence to the end of the document rather than dropping it", () => {
    const source = ["```", "line one", "line two"].join("\n");
    const html = render(source);

    expect(html).toContain("<pre");
    expect(visible(source)).toContain("line one line two");
  });

  it("shows an unterminated code span as the backtick it is", () => {
    const source = "a `code span that never closes";
    expect(render(source)).not.toContain("<code");
    expect(visible(source)).toBe(source);
  });

  it("pads a short table row and keeps a long one whole", () => {
    const source = [
      "| a | b | c |",
      "| --- | --- | --- |",
      "| 1 |",
      "| 1 | 2 | 3 | 4 |",
    ].join("\n");
    const html = render(source);

    /* Three columns declared. The short row is padded to three so the grid holds, and
       the long row keeps its fourth cell, because dropping it would silently eat a word
       somebody wrote. */
    expect(html.match(/<th\b/g)).toHaveLength(3);
    expect(html.match(/<td\b/g)).toHaveLength(7);
    expect(visible(source)).toContain("4");
  });

  it("reads a CRLF document exactly as it reads the same document with LF", () => {
    const lf = READMES[0].text;
    expect(render(lf.replace(/\n/g, "\r\n"))).toBe(render(lf));
  });

  it("renders an empty document as an empty container", () => {
    expect(visible("")).toBe("");
  });
});

describe("markdown: the nine shipped bundle READMEs", () => {
  for (const readme of READMES) {
    it(`renders ${readme.slug} whole`, () => {
      const html = render(readme.text);

      /* The constructs this corpus is measured to contain. If a future README loses one
         that is a change to the document, not to the renderer, and it should be seen. */
      expect(html).toContain("<h1");
      expect(html).toContain("<h2");
      expect(html).toContain("<pre");
      expect(html).toContain("<table");
      expect(html).toContain("<blockquote");
      expect(html).toContain("<code");
      expect(html).toContain("<hr");
      expect(html).not.toMatch(/<script/i);
    });
  }

  it("drops no word of any README on the way to the screen", () => {
    /* The strongest claim this renderer makes, and the one that catches a construct
       being swallowed rather than rendered plainly. Every token of four or more
       word characters in the source has to be readable in the output. */
    for (const readme of READMES) {
      const seen = visible(readme.text);
      const tokens = new Set(readme.text.match(/[A-Za-z0-9_.@/-]{4,}/g) ?? []);
      const missing = [...tokens].filter((token) => !seen.includes(token));
      expect({ slug: readme.slug, missing }).toEqual({ slug: readme.slug, missing: [] });
    }
  });

  it("puts no raw angle bracket from the source into the markup", () => {
    for (const readme of READMES) {
      const html = render(readme.text);
      /* `cards/<ref>.yaml` appears in every one of them, inside a code span. It must be
         escaped rather than opening an element nobody wrote. */
      expect(html).toContain("&lt;ref&gt;");
    }
  });
});
