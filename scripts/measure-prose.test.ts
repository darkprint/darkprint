import { describe, expect, it } from "vitest";

import { measureHtml } from "./measure-prose.ts";

/**
 * The instrument the whole length method rests on, so the cases here are the ones that
 * gave a wrong answer rather than a survey of the API.
 *
 * The bug worth a permanent test: stripping used to find a match and hand the rest of the
 * document to a tag-stripper, which took every later sibling sharing that tag with it. It
 * did not throw and it did not look wrong — `/spec/card` simply reported 101 words and
 * `/blueprints/[slug]` reported a third of its prose, and the ranking those numbers fed
 * put the wrong template at the top.
 */

const wrap = (body: string) => `<html><body><main>${body}</main></body></html>`;

describe("measureHtml", () => {
  it("keeps the siblings that follow a stripped element", () => {
    const m = measureHtml(
      "/t",
      wrap(`<p>one two three</p><span aria-hidden="true">◆</span><p>four five six seven</p>`),
    );
    expect(m.total).toBe(7);
  });

  it("keeps the siblings that follow a stripped listing", () => {
    const m = measureHtml(
      "/t",
      wrap(`<div role="listbox"><div>id: a</div></div><p>one two three four</p>`),
    );
    expect(m.total).toBe(4);
  });

  it("strips a nested element without eating the tail of its parent", () => {
    const m = measureHtml("/t", wrap(`<div><svg><svg>inner</svg></svg>one two</div><p>three</p>`));
    expect(m.total).toBe(3);
  });

  it("counts a closed <details> in total but not in open, and its summary in both", () => {
    const m = measureHtml("/t", wrap(`<details><summary>one two</summary><p>three four five</p></details>`));
    expect(m.total).toBe(5);
    expect(m.open).toBe(2);
  });

  it("counts an open <details> in both", () => {
    const m = measureHtml("/t", wrap(`<details open><summary>one two</summary><p>three four</p></details>`));
    expect(m.open).toBe(4);
  });

  /* Both listing components draw code lines; only one of them carries a role, which is
     why the class hook exists beside the role hook. See the header comment. */
  it("strips code lines drawn as spans outside a <pre>", () => {
    const m = measureHtml("/t", wrap(`<span class="whitespace-pre">id: code builder</span><p>one two</p>`));
    expect(m.total).toBe(2);
  });

  it("still strips them when another class sits beside the hook", () => {
    const m = measureHtml("/t", wrap(`<span class="text-xs whitespace-pre font-mono">id: code builder</span><p>one two</p>`));
    expect(m.total).toBe(2);
  });

  it("does not mistake whitespace-pre-wrap for a code line", () => {
    const m = measureHtml("/t", wrap(`<p class="whitespace-pre-wrap">one two three</p>`));
    expect(m.total).toBe(3);
  });

  it("reports what it removed, so a surprising number can be checked", () => {
    const m = measureHtml("/t", wrap(`<div role="listbox"><div>id: a b c</div></div><p>one</p>`));
    expect(m.removed.find((r) => r.what.includes("listbox"))?.words).toBe(4);
  });

  it("splits on headings and keeps the text before the first one", () => {
    const m = measureHtml("/t", wrap(`<p>lead words here</p><h2>A heading</h2><p>one two</p>`));
    expect(m.sections.map((s) => s.heading)).toEqual(["(before the first heading)", "A heading"]);
    expect(m.sections[1].total).toBe(4); // the heading's own words count toward its section
  });
});
