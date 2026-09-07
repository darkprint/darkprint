/* ============================================================
   How much does a reader actually have to read?

   The metric is the prose a reader has to read, and this script is
   the instrument for it. Three decisions shape it, each because
   the cruder version was acted on once and gave the wrong answer:

   - **Prose, not pixels.** Page height ranks `/nodes` worst. It is a
     grid of 53 tiles, skimmed in seconds. Height measures scrolling;
     the complaint was about reading.

   - **Prose, not raw words.** Raw counts rank `/blueprints/<slug>`
     worst, but about half of that is the four-pane viewer printing
     card YAML and DOT. A registry detail page showing its own source
     is doing its job, and counting it as prose is counting the wrong
     thing.

   - **Two numbers, never one.** `total` is everything; `open` is what
     reads without opening a disclosure. §3.1's finding was that
     cutting for pace does not delete honesty statements, it
     *promotes them to a disclosure* — the words stay in the HTML,
     every word-count check still passes, and the reader never sees
     them. A pass that moves `total` and leaves `open` alone has not
     cut anything a reader experiences; a pass that drops `open` far
     faster than `total` is hiding rather than cutting. Both are
     visible here and neither is visible in one number.

   **Why the built HTML and not the components.** `.next/server/app`
   is what a visitor is served — every template instance, all 136
   pages, with the layout chrome each one really carries. Rendering
   components in isolation measures a page nobody is served, and it
   silently drops the per-instance repetition that turns a 66-word
   note into 3,300 words across 50 term pages.

   **The listing trap, which has two instances and not one.** §3.1
   warns that a `<pre>`-based filter misses the pane listings, because
   `components/panes/SourcePane.tsx` draws its rows as
   `<div role="option">` with `whitespace-pre`, not as a `<pre>`. So
   `role="listbox"` is stripped as well.

   That is not the whole trap. `components/home/nodecard/YamlListing.tsx`
   draws the identical shape on `/spec/card` — rows of
   `<span class="whitespace-pre">` — and carries no role at all, so the
   listbox rule never reached it and 52 lines of
   `code-builder@1.0.0.yaml` were counted as prose. The class is the
   hook both components share, so it is stripped directly; measured
   over the whole build it removes text from exactly two routes, and
   `/build`'s copy is already inside a listbox. The node pages are
   safe by a different route: their listing really is in a `<pre>`.

   **Decorative glyphs are not words.** The site marks state with
   `aria-hidden` glyphs — ◐ ◌ ◈ ✓ ▸ — and a counter that splits on
   whitespace scores each one as a word. Across the build that is
   4,309 words of punctuation, about 33 a page, and on `/spec/card` it
   also covers `YamlListing`'s line-number gutters. Text hidden from a
   screen reader is by definition not text a reader reads, so it comes
   out. The guard stays on `aria-hidden="true"` alone; `="false"`
   appears nowhere in the build and would mean the opposite.

   Anything stripped is reported, so a route whose numbers look
   impossible can be checked against what was removed rather than
   guessed at.

   **What this deliberately cannot see.** Prerendered HTML holds the
   page's *initial* state. `/build` is a seven-step wizard and
   `/upload` a staged validator, so both report only the step a
   visitor lands on — `/build`'s 341 is one step of seven, not the
   path. Those two are flagged at the bottom of the report rather
   than quietly under-counted, and a reorg of either has to be
   measured step by step in the browser instead. Every other route on
   this site is SSG and fully present here.

   Usage:
     npm run measure:prose               # every route, grouped
     npm run measure:prose -- /spec/card # one route, section by section
     npm run measure:prose -- --json     # machine-readable
   ============================================================ */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { openText, plainText } from "../components/ui/visible-text.ts";

const BUILD_DIR = ".next/server/app";

/** Routes whose content sits behind client state, so the prerendered HTML is step one of N. */
const STAGED_ROUTES = ["/build", "/upload"];

/* --------------------- stripping --------------------- */

/** Elements whose text is never prose, and which nest, so a regex pass must be balanced. */
const NON_PROSE_TAGS = ["script", "style", "svg", "pre", "template", "noscript"] as const;

interface Stripped {
  html: string;
  /** What came out, so a surprising number can be checked rather than trusted. */
  removed: { what: string; words: number }[];
}

/**
 * Index just past the element opening at `start`, honouring nesting; `-1` if it never
 * closes.
 *
 * A non-greedy `<tag>...</tag>` regex closes on the first inner `</tag>`, which for
 * `<svg>` (nested `<svg>` symbols) and `<div>` (everything) leaves the tail of the
 * element in the text. This walks and counts depth instead.
 */
function elementEnd(html: string, start: number, tag: string): number {
  const tagEnd = html.indexOf(">", start);
  if (tagEnd === -1) return -1;
  // Self-closing (`<svg ... />`) never opens a depth level.
  if (html[tagEnd - 1] === "/") return tagEnd + 1;

  const open = new RegExp(`<${tag}\\b`, "gi");
  const close = new RegExp(`</${tag}\\s*>`, "gi");
  let depth = 1;
  let cursor = tagEnd + 1;
  while (depth > 0) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);
    if (nextClose === null) return -1;
    if (nextOpen !== null && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + 1;
    } else {
      depth -= 1;
      cursor = nextClose.index + nextClose[0].length;
    }
  }
  return cursor;
}

/** Drop every `<tag>` element and everything inside it. */
function dropTag(html: string, tag: string): { html: string; removedText: string } {
  return dropMatches(html, new RegExp(`<(${tag})\\b`, "gi"));
}

/**
 * The same, keyed on an attribute rather than a tag name — `attr` is regex source, so a
 * class hook can be written to survive a second class being added beside it.
 */
function dropByAttribute(html: string, attr: string): { html: string; removedText: string } {
  return dropMatches(html, new RegExp(`<(\\w+)\\b[^>]*\\b${attr}[^>]*>`, "gi"));
}

/**
 * Remove each element whose opening tag `marker` matches, and nothing else.
 *
 * The subtlety that produced a wrong number here once: it is not enough to find a match
 * and hand the rest of the document to a tag-stripper, because that strips every later
 * sibling sharing the tag too. On `/spec/card` one `aria-hidden` `<span>` took the rest
 * of the page with it and the route measured 101 words. Each match resolves to its own
 * end and the cursor resumes there.
 */
function dropMatches(html: string, marker: RegExp): { html: string; removedText: string } {
  let out = "";
  let removed = "";
  let i = 0;

  for (;;) {
    marker.lastIndex = i;
    const hit = marker.exec(html);
    if (hit === null) return { html: out + html.slice(i), removedText: removed };
    out += html.slice(i, hit.index);

    const end = elementEnd(html, hit.index, hit[1]);
    // Unbalanced: treat the rest as removed rather than silently keeping it.
    if (end === -1) return { html: out, removedText: removed + html.slice(hit.index) };
    removed += html.slice(hit.index, end);
    i = end;
  }
}

function stripNonProse(html: string): Stripped {
  const removed: { what: string; words: number }[] = [];
  let out = html;

  for (const tag of NON_PROSE_TAGS) {
    const r = dropTag(out, tag);
    out = r.html;
    const w = countWords(plainText(r.removedText));
    if (w > 0) removed.push({ what: `<${tag}>`, words: w });
  }

  // §3.1's named trap: the pane listings are not in a <pre>.
  // Both hooks are needed — SourcePane has the role and no shared class on the row,
  // YamlListing has the class and no role. Neither alone catches both listings.
  for (const [attr, label] of [
    ['role="listbox"', 'role="listbox" (source listings)'],
    ['class="[^"]*whitespace-pre(?![-\\w])[^"]*"', "code lines outside a <pre>"],
    ['aria-hidden="true"', "aria-hidden (glyphs, gutters)"],
  ] as const) {
    const r = dropByAttribute(out, attr);
    out = r.html;
    const w = countWords(plainText(r.removedText));
    if (w > 0) removed.push({ what: label, words: w });
  }

  return { html: out, removed };
}

/* --------------------- counting --------------------- */

function countWords(text: string): number {
  const t = text.trim();
  if (t === "") return 0;
  return t.split(/\s+/).length;
}

/** `<main>` if the page has one, otherwise `<body>`, otherwise the whole document. */
function readerRegion(html: string): string {
  for (const tag of ["main", "body"]) {
    const open = new RegExp(`<${tag}\\b[^>]*>`, "i").exec(html);
    if (open === null) continue;
    const close = html.lastIndexOf(`</${tag}>`);
    if (close > open.index) return html.slice(open.index + open[0].length, close);
  }
  return html;
}

export interface SectionMeasure {
  heading: string;
  total: number;
  open: number;
}

export interface PageMeasure {
  route: string;
  total: number;
  open: number;
  sections: SectionMeasure[];
  removed: { what: string; words: number }[];
}

/**
 * Split on headings so a page reports section by section.
 *
 * §3.1 asks for this explicitly — "check by section first" — because a single page
 * number cannot distinguish a page that is uniformly dense from one carrying a single
 * 400-word block, and the two want opposite edits.
 */
function sections(html: string): SectionMeasure[] {
  const heading = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const marks: { at: number; label: string }[] = [];
  for (;;) {
    const m = heading.exec(html);
    if (m === null) break;
    marks.push({ at: m.index, label: plainText(m[2]) || `h${m[1]}` });
  }
  if (marks.length === 0) {
    return [{ heading: "(no headings)", total: countWords(plainText(html)), open: countWords(openText(html)) }];
  }

  const out: SectionMeasure[] = [];
  const preamble = html.slice(0, marks[0].at);
  if (countWords(plainText(preamble)) > 0) {
    out.push({
      heading: "(before the first heading)",
      total: countWords(plainText(preamble)),
      open: countWords(openText(preamble)),
    });
  }
  marks.forEach((mark, i) => {
    const chunk = html.slice(mark.at, i + 1 < marks.length ? marks[i + 1].at : undefined);
    out.push({
      heading: mark.label,
      total: countWords(plainText(chunk)),
      open: countWords(openText(chunk)),
    });
  });
  return out;
}

export function measureHtml(route: string, html: string): PageMeasure {
  const region = readerRegion(html);
  const { html: prose, removed } = stripNonProse(region);
  return {
    route,
    total: countWords(plainText(prose)),
    open: countWords(openText(prose)),
    sections: sections(prose),
    removed,
  };
}

/* --------------------- routes --------------------- */

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function routeOf(file: string): string {
  const rel = relative(BUILD_DIR, file).replace(/\.html$/, "").split(sep).join("/");
  return rel === "index" ? "/" : `/${rel}`;
}

/**
 * Group by template, not by URL.
 *
 * A 66-word note on `/ontology/<term>` is 66 words in one file and 3,300 words across
 * the 50 pages that ship it. Ranking by per-page length hides that entirely, and it is
 * where the cheapest reductions on this site are: one edit, every instance.
 */
function templateOf(route: string): string {
  const parts = route.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  if (parts[0] === "blueprints" && parts.length > 1) return "/blueprints/[slug]";
  if (parts[0] === "nodes" && parts.length > 1) return "/nodes/[...id]";
  if (parts[0] === "ontology" && parts.length > 1) return "/ontology/[...term]";
  if (parts[0] === "u" && parts.length > 1) return "/u/[username]";
  return route;
}

/* --------------------- reporting --------------------- */

function pad(s: string | number, n: number, right = false): string {
  const v = String(s);
  return right ? v.padStart(n) : v.padEnd(n);
}

function reportOne(m: PageMeasure): void {
  console.log(`\n${m.route}`);
  console.log(`  ${m.total} prose words, ${m.open} of them readable without opening a disclosure`);
  if (m.total > 0) {
    const folded = m.total - m.open;
    if (folded > 0) console.log(`  ${folded} words sit behind a closed <details> (${Math.round((folded / m.total) * 100)}%)`);
  }
  if (m.removed.length > 0) {
    console.log(`  not counted: ${m.removed.map((r) => `${r.words}w ${r.what}`).join(", ")}`);
  }
  console.log(`\n  ${pad("total", 7, true)} ${pad("open", 7, true)}  section`);
  for (const s of m.sections) {
    console.log(`  ${pad(s.total, 7, true)} ${pad(s.open, 7, true)}  ${s.heading}`);
  }
}

function reportAll(measures: PageMeasure[]): void {
  const groups = new Map<string, PageMeasure[]>();
  for (const m of measures) {
    const t = templateOf(m.route);
    groups.set(t, [...(groups.get(t) ?? []), m]);
  }

  const rows = [...groups.entries()]
    .map(([template, ms]) => {
      const instances = ms.length;
      const total = Math.round(ms.reduce((a, m) => a + m.total, 0) / instances);
      const open = Math.round(ms.reduce((a, m) => a + m.open, 0) / instances);
      return { template, instances, total, open, siteWide: total * instances };
    })
    .sort((a, b) => b.siteWide - a.siteWide);

  console.log(
    `\n  ${pad("site-wide", 10, true)} ${pad("per page", 9, true)} ${pad("open", 6, true)} ${pad("×", 4, true)}  template`,
  );
  console.log(`  ${"-".repeat(70)}`);
  for (const r of rows) {
    console.log(
      `  ${pad(r.siteWide, 10, true)} ${pad(r.total, 9, true)} ${pad(r.open, 6, true)} ${pad(r.instances, 4, true)}  ${r.template}`,
    );
  }
  const grand = rows.reduce((a, r) => a + r.siteWide, 0);
  console.log(`  ${"-".repeat(70)}`);
  console.log(`  ${pad(grand, 10, true)} words of prose served across ${measures.length} pages\n`);
  console.log(`  Ranked by site-wide words (per page × instances), which is what a template edit moves.`);
  console.log(`  "open" is the per-page average readable without opening a disclosure.\n`);

  // Understated rather than wrong, and saying so beats a footnote nobody reads.
  const staged = rows.filter((r) => STAGED_ROUTES.includes(r.template));
  if (staged.length > 0) {
    console.log(
      `  Understated — prerendered HTML is the first state only, so these report one step:\n${staged
        .map((r) => `    ${r.template} (${r.total}w served on arrival)`)
        .join("\n")}\n  Measure a reorg of either in the browser, step by step.\n`,
    );
  }
}

/* --------------------- entry --------------------- */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const routes = args.filter((a) => !a.startsWith("--"));

  let files: string[];
  try {
    files = await htmlFiles(BUILD_DIR);
  } catch {
    console.error(
      `No prerendered pages at ${BUILD_DIR}. This measures what a visitor is served, so it needs a build first:\n\n  npm run build\n`,
    );
    process.exitCode = 1;
    return;
  }

  const wanted = files.filter((f) => {
    const r = routeOf(f);
    if (r.startsWith("/_")) return false;
    return routes.length === 0 || routes.includes(r) || routes.includes(templateOf(r));
  });

  if (wanted.length === 0) {
    console.error(`No prerendered page matches ${routes.join(", ")}.`);
    process.exitCode = 1;
    return;
  }

  const measures: PageMeasure[] = [];
  for (const f of wanted) {
    measures.push(measureHtml(routeOf(f), await readFile(f, "utf8")));
  }
  measures.sort((a, b) => b.total - a.total);

  if (asJson) {
    console.log(JSON.stringify(measures, null, 2));
    return;
  }

  if (routes.length > 0 && measures.length <= 3) {
    for (const m of measures) reportOne(m);
    return;
  }
  reportAll(measures);
}

// Only when run as a command. `measure-prose.test.ts` imports `measureHtml`, and a
// top-level `main()` would make that import scan the build and print a report.
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
