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
   `Topology file (DOT)` earns its parenthesis where the rail can afford it.
   ============================================================ */

/** The footer's wording for a Learn stop, where it says more than the nav's short form. */
const LEARN_LABELS: Record<string, string> = {
  "/spec/topology": "Topology file (DOT)",
  "/spec/card": "Node card (YAML)",
  /* The third spec stop joins its two siblings here. It spent one commit carrying the
     format in `sequence.ts` instead, and the author asked "(YAML)" off the Learn dropdown
     and the Learn rail — which is what `page.nav` draws. This table is the footer's own
     register and always was: a footer row stands alone with no run around it to say what
     kind of document it is, where a dropdown row sits under "Specification" beside
     "Topology" and "Node card". `nav` keeps the word "file", which is what holds it apart
     from the Browse row called "Ontology". */
  "/spec/ontology": "Ontology file (YAML)",
  /* The crosswalk names no file, because it is not a fourth layer: `sequence.ts` keeps it
     out of `SPEC_LAYERS` deliberately, since a blueprint has three documents and this page
     is about what happens to all three on the way to a runner. So the footer's register
     gives it the subject instead of a format. */
  "/spec/attractor": "Reading it as Attractor",
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
      /* The third thing the registry holds had a row here from the accounts pass until
         2026-09-06, when the owner folded its browser into `/spec/ontology` and deleted the
         index. The header's Browse row went in the same change and for the same reason, and
         `SiteHeader`'s header docblock carries the argument: repointing either row at the
         spec page would have given one route two names on one screen, which is the defect
         `nav.test.ts` opens with. The Specification column below names the survivor.

         `nav.test.ts` would have caught a repointing here on its own, and it is worth
         saying how, because the mechanism is not obvious: `HEADER_LABELS` is a Map keyed by
         href, so a second `NAV` row at `/spec/ontology` is overwritten by the docs row, and
         this row's "Ontology" would then be compared against "Ontology file (YAML)". */
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
         (`nav.test.ts`: a route is called the same thing everywhere). The sandbox that was
         left behind at `/build` after that merge is itself deleted since 2026-09-06, so the
         Learn column below lost its row too — it reads `SPEC_SEQUENCE`, which no longer
         carries the stop. */
      /* The author's order: the protocol, then the skill, then the ask. Publishing is last
         because it is the thing you do once you have made something, which is the order the
         other two put you in. */
      /* The two reference routes sit between the surfaces and the ask, because both are
         things a reader consults while making something rather than a fourth way to make
         one. `nav.test.ts` holds each label byte-identical to the header's. */
      { href: "/mcp", label: "MCP" },
      { href: "/skill", label: "Assisted Design" },
      { href: "/capabilities", label: "What you can do" },
      { href: "/tutorial", label: "Write your first blueprint" },
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
