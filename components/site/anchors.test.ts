/* ============================================================
   Every link into a page lands where it points.

   `components/site/SiteHeader.tsx` is `sticky top-0` over a 4rem
   row, so a fragment link scrolls its target to y=0 and the header
   is drawn on top of it. The house fix is `scroll-mt-24` on the
   element the id is on, and it was applied one anchor at a time by
   whoever noticed. Two shipped without it: `#explainability-heading`,
   which is the scorecard's only route to the audit and lands the
   heading under the chrome, and `#security-explained`, which the
   bundle panel links from the same page.

   Nothing could see either one. A link and its target are in
   different files, often in different trees, and no render test
   covers scroll position. So this walks the source for both halves
   and joins them: every `href` carrying a fragment, and the element
   in the tree that declares that id.

   ── Why the source and not the build ──
   The rule is about a class name, which survives into the markup
   but is far harder to attribute there: a page carries a hundred
   elements with ids and the walk would have to guess which of them
   a `href="#x"` in another route meant. In the source the id is
   written once, next to the class list it is being checked against.
   ============================================================ */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The one id a fragment may point at without an offset.
 *
 * `#main` is the skip link in `app/layout.tsx`, and its target is the top of the document.
 * There is nothing above it for the header to cover, and a scroll margin on it would ask
 * the browser to scroll above the start of the page.
 */
const TOP_OF_PAGE = new Set(["main"]);

/** Every `.tsx` under `dir`, tests excluded. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourcesUnder(child));
      continue;
    }
    if (!/\.tsx$/.test(entry.name) || /\.test\.tsx$/.test(entry.name)) continue;
    out.push(child);
  }
  return out;
}

const FILES = [...sourcesUnder("components"), ...sourcesUnder("app")].sort();
const SOURCE = new Map(FILES.map((path) => [path, readFileSync(join(ROOT, path), "utf8")]));

/** One `href` with a fragment on it, and the file that writes it. */
interface FragmentLink {
  id: string;
  from: string;
}

/**
 * Every fragment a link points at, whether the route in front of it is this page or
 * another. `href="/spec#scoring"` is the same rule as `href="#scoring"`: it lands on an
 * element under the same header.
 */
const LINKS: FragmentLink[] = [...SOURCE].flatMap(([path, text]) =>
  [...text.matchAll(/href="[^"#]*#([A-Za-z][\w-]*)"/g)].map((match) => ({
    id: match[1],
    from: path,
  })),
);

/**
 * The opening tag that declares an id, as written.
 *
 * From the id back to the `<` that starts its element and forward to the `>` that ends
 * it. The tags this walks are plain JSX with no `>` inside an attribute value, and a tag
 * that is never found fails the case rather than passing it.
 */
function declaringTag(id: string): { file: string; tag: string } | undefined {
  for (const [path, text] of SOURCE) {
    const at = text.indexOf(`id="${id}"`);
    if (at === -1) continue;
    const open = text.lastIndexOf("<", at);
    const close = text.indexOf(">", at);
    if (open === -1 || close === -1) continue;
    return { file: path, tag: text.slice(open, close + 1) };
  }
  return undefined;
}

describe("the walk finds both halves", () => {
  it("reads the tree rather than a list", () => {
    // A walk that matched nothing passes the rule below on every anchor there is.
    expect(FILES.length).toBeGreaterThan(40);
    expect(LINKS.length).toBeGreaterThan(5);
  });

  it("finds the anchors this rule was written for", () => {
    const ids = new Set(LINKS.map((link) => link.id));
    for (const id of ["explainability-heading", "security-explained", "scoring", "weights"]) {
      expect(ids, `nothing links #${id} any more`).toContain(id);
    }
  });
});

describe("every fragment link clears the sticky header", () => {
  it.each([...new Set(LINKS.map((link) => link.id))].sort())(
    "#%s is on an element with a scroll offset",
    (id) => {
      if (TOP_OF_PAGE.has(id)) return;
      const found = declaringTag(id);
      expect(found, `nothing in the tree declares id="${id}"`).toBeDefined();
      expect(
        found?.tag,
        `${found?.file} declares id="${id}" with no scroll-mt, so a link to it lands under the header`,
      ).toMatch(/scroll-mt-/);
    },
  );
});
