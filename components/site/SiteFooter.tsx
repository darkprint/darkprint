import Link from "next/link";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Registry",
    links: [
      { href: "/gallery", label: "Blueprints" },
      { href: "/parts", label: "Parts" },
      { href: "/ontologies", label: "Ontologies" },
      { href: "/upload", label: "Share a blueprint" },
    ],
  },
  {
    title: "Scoring",
    links: [
      { href: "/#scoring", label: "The 6 metrics" },
      { href: "/#autonomy", label: "Autonomy levels" },
      { href: "/#telemetry", label: "Telemetry & validators" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "/#what", label: "What is a dark factory" },
      { href: "/#content", label: "Content types" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/40">
      <div className="container-page grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            <span className="text-fg">Dark</span>
            <span className="text-cyan">Print</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-dim">
            The blueprint registry for autonomous AI factories. Autonomy you can
            read as a graph.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
              {col.title}
            </h4>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted transition-colors hover:text-fg"
                  >
                    {l.label}
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
          <span className="font-mono">a concept build · mock data</span>
        </div>
      </div>
    </footer>
  );
}
