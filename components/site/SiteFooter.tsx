import Link from "next/link";

import { RUNS, SPEC_SEQUENCE, type SpecRun } from "@/components/spec/sequence";

/* ============================================================
   Learn is two columns, because the sequence is two runs.

   It was one column of seven rows, which is the only place in the chrome that flattened
   the split every other surface draws: the rail groups them, the crumb names the run a
   reader is in, and the pager says which run it is stepping into. Seven links under one
   heading also asked a reader to hold an unstructured list at exactly the moment they are
   scanning for the one page they half-remember.

   The two headings are `RUNS`, the same constant the rail and the pager read, rather than
   words typed here. `nav.test.ts` forbids one route answering to two names, and the same
   argument covers a run: a reader who learns "In practice" from the rail should not meet
   "Practice" in the footer.

   ── The rows are the sequence, the wording is the footer's ──
   Which stop belongs to which run is read off `SPEC_SEQUENCE`, so a page that changes run
   changes column on the next build and cannot be left behind in the wrong one. The labels
   stay the footer's own: a footer row is met cold, with no crumb and no rail above it, so
   `Blueprint file (DOT)` earns its parenthesis where the rail can afford `Topology`.
   ============================================================ */

/** The footer's wording for a Learn stop, where it says more than the nav's short form. */
const LEARN_LABELS: Record<string, string> = {
  "/spec/topology": "Blueprint file (DOT)",
  "/spec/card": "Node card (YAML)",
  /* No row for `/spec/ontology`. It carries its long form in `sequence.ts` itself since the
     Vocabulary → Ontology rename, because the header's Learn dropdown prints `page.nav`
     directly and would otherwise have shown "Ontology" beside the Browse row of the same
     name. See the note on that stop. */
  "/reading-the-radar": "How a blueprint is graded",
};

function learnColumn(run: SpecRun) {
  return {
    title: RUNS[run],
    links: SPEC_SEQUENCE.filter((page) => page.run === run).map((page) => ({
      href: page.href,
      label: LEARN_LABELS[page.href] ?? page.nav,
    })),
  };
}

/* The Browse and Design titles match the header's groups exactly, which is what the accounts
   pass asked of the collapsed menu and is worth the footer having too: a reader who learns
   "Browse / Design" at the top of the page should not meet a different set of words at the
   bottom of it. Every label inside them is held to the header's by
   `components/site/nav.test.ts`.

   The second was "Build" until 2026-08-11, renamed with the header menu on the author's
   instruction. It moves in both places or it moves in neither: the whole reason this comment
   exists is that the two surfaces name the same group. */
export const COLS = [
  {
    title: "Browse",
    links: [
      { href: "/blueprints", label: "Blueprints" },
      { href: "/nodes", label: "Cards" },
      /* The third thing the registry holds. It had no row in either the header or the
         footer until this pass, and was called "Vocabulary" in both until 2026-08-12; see
         `SiteHeader`'s decision 1. `nav.test.ts` holds this label to the header's. */
      { href: "/ontology", label: "Ontology" },
    ],
  },
  {
    title: "Design",
    links: [
      /* One row for `/skill`, not two.

         This column used to list `/build` as "Create" and `/skill` as "DarkPrint authoring
         skill", which was two rows for what a reader does once. The `/build` split merged
         them: the authoring half is on `/skill` now, so the row that sent people to it and
         the row that named the tool are the same destination, and the header's label wins
         (`nav.test.ts`: a route is called the same thing everywhere). */
      /* The author's order: the protocol, then the skill, then the ask. Publishing is last
         because it is the thing you do once you have made something, which is the order the
         other two put you in. */
      { href: "/mcp", label: "MCP" },
      { href: "/skill", label: "Assisted Design" },
      { href: "/upload", label: "Publish" },
    ],
  },
  learnColumn("specification"),
  learnColumn("practice"),
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/40">
      {/* Four link columns now rather than three, so the brand block stops spanning three
          of four and the columns get a row of their own until there is width for five. */}
      <div className="container-page grid grid-cols-2 gap-8 py-12 sm:grid-cols-4 lg:grid-cols-5">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            <span className="text-fg">Dark</span>
            <span className="text-cyan">Print</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-dim">
            Reusable, inspectable blueprints for agent workflows.
          </p>
        </div>
        {COLS.map((column) => (
          <div key={column.title}>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
              {column.title}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/60">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-dim sm:flex-row">
          <span>© 2026 DarkPrint · darkprint.io</span>
          <span className="font-mono">version-pinned · statically checked · locally run</span>
        </div>
      </div>
    </footer>
  );
}
