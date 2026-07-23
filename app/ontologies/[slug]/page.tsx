import Link from "next/link";
import { notFound } from "next/navigation";
import { ONTOLOGIES, getOntology } from "@/lib/data";
import { compact, prettyDate } from "@/lib/format";
import { KindBadge, Badge } from "@/components/ui/Badge";
import { AuthorChip } from "@/components/ui/Avatar";
import { TagPill } from "@/components/ui/TagPill";
import { NodeTypeTable, EdgeTypeTable } from "@/components/ontology/TypeTable";

export function generateStaticParams() {
  return ONTOLOGIES.map((ontology) => ({ slug: ontology.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/ontologies/[slug]">) {
  const { slug } = await params;
  const ontology = getOntology(slug);
  if (!ontology) return { title: "Ontology not found" };
  return { title: ontology.title, description: ontology.summary };
}

/** Small mono heading for the in-page panels. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
      {children}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-fg">{value}</dd>
    </div>
  );
}

export default async function Page({
  params,
}: PageProps<"/ontologies/[slug]">) {
  const { slug } = await params;
  const ontology = getOntology(slug);
  if (!ontology) notFound();

  const paragraphs = ontology.description
    .split("\n\n")
    .filter((p) => p.trim().length);

  return (
    <div className="container-page py-10 lg:py-12">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-5">
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/ontologies" className="transition-colors hover:text-cyan">
            ← Ontologies
          </Link>
          <span className="mx-2 text-faint">/</span>
          <span className="text-muted">{ontology.domain}</span>
        </nav>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <KindBadge kind={ontology.kind} />
            <Badge color="var(--color-violet)">{ontology.domain}</Badge>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
            {ontology.title}
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-muted">
            {ontology.summary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <AuthorChip author={ontology.author} />
          <span className="font-mono text-xs text-dim">
            {prettyDate(ontology.createdAt)}
          </span>
          <span className="font-mono text-xs text-dim">
            ↓ {compact(ontology.downloads)} downloads
          </span>
          <span className="font-mono text-xs text-dim">
            ▲ {compact(ontology.votes)} votes
          </span>
        </div>

        {ontology.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ontology.tags.map((t) => (
              <TagPill key={t} label={t} />
            ))}
          </div>
        )}
      </header>

      {/* ---------- Body ---------- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* MAIN */}
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          {/* Long description */}
          {paragraphs.length > 0 && (
            <section aria-labelledby="about-heading">
              <h2
                id="about-heading"
                className="mb-4 font-display text-xl font-semibold text-fg"
              >
                About this ontology
              </h2>
              <div className="flex flex-col gap-4">
                {paragraphs.map((p, i) => (
                  <p
                    key={`${i}-${p.slice(0, 16)}`}
                    className="text-[15px] leading-relaxed text-muted"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* Node types */}
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <PanelLabel>Node types</PanelLabel>
              <span className="font-mono text-[11px] text-faint">
                {ontology.nodeTypes.length} kinds
              </span>
            </div>
            <div className="px-5 py-4">
              <NodeTypeTable nodeTypes={ontology.nodeTypes} />
            </div>
          </section>

          {/* Edge types */}
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <PanelLabel>Edge types</PanelLabel>
              <span className="font-mono text-[11px] text-faint">
                {ontology.edgeTypes.length} kinds
              </span>
            </div>
            <div className="px-5 py-4">
              <EdgeTypeTable edgeTypes={ontology.edgeTypes} />
            </div>
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          {/* Registry stats */}
          <section className="panel p-5">
            <div className="mb-2">
              <PanelLabel>Registry stats</PanelLabel>
            </div>
            <dl className="flex flex-col divide-y divide-line">
              <StatRow label="Domain" value={ontology.domain} />
              <StatRow
                label="Node types"
                value={String(ontology.nodeTypes.length)}
              />
              <StatRow
                label="Edge types"
                value={String(ontology.edgeTypes.length)}
              />
              <StatRow
                label="Downloads"
                value={`↓ ${compact(ontology.downloads)}`}
              />
              <StatRow label="Votes" value={`▲ ${compact(ontology.votes)}`} />
              <StatRow label="Published" value={prettyDate(ontology.createdAt)} />
            </dl>
          </section>

          {/* Tags */}
          {ontology.tags.length > 0 && (
            <section className="panel p-5">
              <div className="mb-3">
                <PanelLabel>Tags</PanelLabel>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ontology.tags.map((t) => (
                  <TagPill key={t} label={t} />
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
