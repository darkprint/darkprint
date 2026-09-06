/* ============================================================
   Every link into a page lands where it points.

   `components/site/SiteHeader.tsx` is `sticky top-0` over a 4rem
   row, so a fragment link scrolls its target to y=0 and the header
   is drawn on top of it. The house fix is `scroll-mt-24` on the
   element the id is on, and it was applied one anchor at a time by
   whoever noticed. Two shipped without it: `#explainability-heading`
   and `#security-explained`, which the bundle panel links from the
   same page.

   `#explainability-heading` no longer has a link pointing at it —
   the panel reorg pass removed the Score panel's "See the working."
   paragraph, which was its only route in — but the id and its
   `scroll-mt-24` stay on the heading regardless. The rule below no
   longer names it as one of its known-good examples for exactly
   that reason.

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

   ── the third half, added 2026-09-06 ──
   The join above only ever saw links a `.tsx` file spells out. The
   Learn rail spells none: `components/spec/sequence.ts` is a `.ts`
   table of bare ids and `components/learn/LearnShell.tsx` composes
   the href from it in a template literal, so every rail anchor on
   every specification page was outside this walk. It was widened the
   day the owner removed two bands from `/spec/ontology`, because two
   of the ids that walk declared went with them and nothing in the
   tree could have said so. A rail row pointing at a heading that no
   longer exists renders a link that scrolls nowhere, which is this
   file's whole subject.
   ============================================================ */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SPEC_SEQUENCE } from "@/components/spec/sequence";

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
 *
 * **Two spellings, because a component may build its links from a table.**
 * `components/ontology/VocabularyShapes.tsx` renders five links into the vocabulary
 * sections from an `ENTRIES` array whose members carry `href: "#phases"`, and the JSX
 * therefore reads `href={entry.href}` — invisible to a walk looking only for
 * `href="…"`. That regression was real: this suite silently dropped from 14 cases to 9
 * the moment those links moved into a table, and five anchors stopped being checked
 * while still resolving. The second pattern is the fix, and it widens what the guard
 * sees rather than lowering what it demands.
 */
const HREF_PATTERNS = [
  /href="[^"#]*#([A-Za-z][\w-]*)"/g, // written in JSX: href="#phases"
  /\bhref:\s*"[^"#]*#([A-Za-z][\w-]*)"/g, // written in a table: { href: "#phases" }
] as const;

/**
 * The Learn rail's anchors, taken from the constant rather than from a regex.
 *
 * THIS IS THE THIRD SPELLING, and it was invisible to both patterns above for two reasons
 * at once. `components/spec/sequence.ts` gives every stop a `sections` table of bare ids —
 * `{ id: "overlay-heading", label: "Local overlay" }` — with no `href` anywhere in it, and
 * `components/learn/LearnShell.tsx:67` composes the link as `` `${page.href}#${section.id}` ``,
 * a template literal no `href="…"` match can see. It is also a `.ts` file, which
 * `sourcesUnder` filters out, so the walk never even opened it.
 *
 * `sequence.ts`'s own docblock records the cost of that blindness: a `{ id: "phases" }` row
 * pointed at an element declared on another route and rendered a rail link that scrolled
 * nowhere, and its comment says in as many words that this guard "could not catch it and
 * still cannot". It can now.
 *
 * READ OFF `SPEC_SEQUENCE` AND NOT OFF THE SOURCE TEXT, deliberately, and for the reason
 * the route-box assertion in `components/ontology/canonical-route.test.ts` gives. That file
 * quotes the deleted `{ id: "phases", label: "Term catalog" }` row inside the docblock
 * explaining why it went; a regex over the text would resurrect it as a phantom link and go
 * red against a correct tree. The imported constant is what `LearnShell` actually renders.
 *
 * The composition is duplicated from `LearnShell` rather than shared, which is a real cost
 * and the alternative is worse: importing the component pulls JSX into a `node` environment
 * test. If that line changes shape, this guard measures a link the rail no longer draws.
 */
const RAIL_LINKS: FragmentLink[] = SPEC_SEQUENCE.flatMap((page) =>
  page.sections.map((section) => ({ id: section.id, from: "components/spec/sequence.ts" })),
);

const LINKS: FragmentLink[] = [
  ...[...SOURCE].flatMap(([path, text]) =>
    HREF_PATTERNS.flatMap((pattern) =>
      [...text.matchAll(pattern)].map((match) => ({ id: match[1], from: path })),
    ),
  ),
  ...RAIL_LINKS,
];

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

/** Every file writing a link to `id`, so a red names where to go and delete a row. */
function linkedFrom(id: string): string {
  return [...new Set(LINKS.filter((link) => link.id === id).map((link) => link.from))].join(", ");
}

describe("the walk finds both halves", () => {
  it("reads the tree rather than a list", () => {
    // A walk that matched nothing passes the rule below on every anchor there is.
    expect(FILES.length).toBeGreaterThan(40);
    expect(LINKS.length).toBeGreaterThan(5);

    /* The rail's own premise, and it is separate because the rail contributes through an
       import rather than through the walk. `SPEC_SEQUENCE` reshaped so that `sections` came
       back empty, or renamed out from under this file, would leave every rail anchor
       unchecked while `LINKS.length` stayed comfortably over its floor on the `.tsx` links
       alone. The floor is 10 against 19 rail sections today, set well clear of the count for
       the reason the ontology route guard states about its own: a stop losing a section is a
       normal day, and a premise that reds on one says the instrument is broken when it is
       not. A rail this file has stopped seeing contributes 0. */
    expect(
      RAIL_LINKS.length,
      `\`SPEC_SEQUENCE\` yielded ${RAIL_LINKS.length} section anchors, so the Learn rail is ` +
        `no longer being checked and a rail row pointing nowhere would pass here`,
    ).toBeGreaterThan(10);
  });

  it("finds the anchors this rule was written for", () => {
    const ids = new Set(LINKS.map((link) => link.id));
    /* Lifecycle-scoring spec §4.4: every internal `href="/spec#scoring"` was corrected to
       the real route on purpose, and the IA pass then merged that route into
       `/reading-the-radar`. `#scoring` is a fragment nothing links to and nothing renders
       any more: the compatibility door lived on `app/spec/page.tsx`, and that page is
       deleted. The three fragments that DID survive that deletion are `#topology`,
       `#card` and `#ontology`, which moved onto the three bands of
       `/what-a-blueprint-is` — nothing links those either, so this walk cannot see them,
       and `components/spec/spec-routes.test.ts` is what holds them.

       `#weights` stood second in this pair until 2026-09-04. It was declared by
       `components/spec/ScoringModel.tsx` and reached from `app/ontology/[...term]` and
       `components/blueprint/Explainability.tsx`. The author asked the graded page off the
       site and both links went with it, so the id was already neither rendered nor linked.
       The declaring file is gone too since 2026-09-05: the owner asked `ScoringModel` and
       its test deleted (§11.0 Q13), so there is no element left for this walk to find and
       none for `declaringTag` to fail on.

       `#run` takes the slot rather than the pair dropping to one, because what the pair
       is for is the JOIN: a link in one file against a target in another, which is the
       only thing this walk does that a render test could not. `#run` is declared by
       `app/what-a-blueprint-is/page.tsx` and linked from
       `components/home/SectionSameRun.tsx`, so it crosses the `app`/`components` boundary
       the way `#weights` did. `components/site/nav.test.ts` named the same anchor for the
       same reason on the same day, having lost the same link.

       `vocabulary-heading` is the third, added 2026-09-06 with the rail widening above, and
       it is the only one of the three whose link is not written as a link. It is a row in
       `components/spec/sequence.ts`'s `sections` table, composed into an href by
       `components/learn/LearnShell.tsx` and landing on a heading in
       `app/spec/ontology/page.tsx` — a `.ts` table, a `.tsx` composer and a `.tsx` target,
       which is the shape the walk was blind to in both directions at once. Naming it here is
       what keeps the third spelling honest: drop the `RAIL_LINKS` import and this cell reds
       by name rather than the suite quietly shrinking, which is how the second spelling was
       lost for a while and only noticed afterwards.

       It is deliberately an id from the band the 2026-09-06 removal LEFT standing. The two
       it took, `#overlay-heading` and `#ontology-checks-heading`, would pin this file to a
       state of the page rather than to the join it is about. */
    for (const id of ["security-explained", "run", "vocabulary-heading"]) {
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
      /* The message names the LINKING file as well as the id. A dangling fragment is
         repaired where the link is written and not where the target used to be, and the
         rail's links are written in a file this walk does not otherwise mention, so a red
         reading only "nothing declares #x" sends the next reader hunting through the tree
         for an element that was deleted on purpose. */
      expect(
        found,
        `nothing in the tree declares id="${id}", linked from ${linkedFrom(id)}`,
      ).toBeDefined();
      expect(
        found?.tag,
        `${found?.file} declares id="${id}" with no scroll-mt, so a link to it from ` +
          `${linkedFrom(id)} lands under the header`,
      ).toMatch(/scroll-mt-/);
    },
  );
});
