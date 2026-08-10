import Link from "next/link";

export const COLS = [
  {
    title: "Explore",
    links: [
      { href: "/blueprints", label: "Blueprints" },
      { href: "/nodes", label: "Cards" },
    ],
  },
  {
    title: "Create and use",
    links: [
      /* One row for `/skill`, not two.

         This column used to list `/build` as "Create" and `/skill` as "DarkPrint authoring
         skill", which was two rows for what a reader does once. The `/build` split merged
         them: the authoring half is on `/skill` now, so the row that sent people to it and
         the row that named the tool are the same destination, and the header's label wins
         (`nav.test.ts`: a route is called the same thing everywhere). */
      { href: "/skill", label: "Create" },
      { href: "/upload", label: "Publish" },
      { href: "/mcp", label: "MCP" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/what-a-blueprint-is", label: "What a blueprint is" },
      { href: "/spec/topology", label: "Blueprint file (DOT)" },
      { href: "/spec/card", label: "Node card (YAML)" },
      { href: "/spec/ontology", label: "Ontology" },
      { href: "/build", label: "Customize the starter blueprint" },
      { href: "/reading-the-radar", label: "How a blueprint is graded" },
      { href: "/towards-a-dark-factory", label: "Towards a Dark Factory" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/40">
      <div className="container-page grid grid-cols-2 gap-8 py-12 sm:grid-cols-3 lg:grid-cols-4">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            <span className="text-fg">Dark</span>
            <span className="text-cyan">Print</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-dim">
            Reusable, inspectable blueprints for agent workflows.
          </p>
          <p className="mt-3 max-w-xs font-mono text-[11px] leading-relaxed text-dim">
            The registry publishes files. Your machine runs them.
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
