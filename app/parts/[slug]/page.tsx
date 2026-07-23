import Link from "next/link";
import { notFound } from "next/navigation";
import { PARTS, getPart } from "@/lib/data";
import { compact, prettyDate, PART_KIND_META } from "@/lib/format";
import { KindBadge, Badge } from "@/components/ui/Badge";
import { AuthorChip } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { TagPill } from "@/components/ui/TagPill";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { DotSource } from "@/components/graph/DotSource";
import { PartInterface } from "@/components/parts/PartInterface";

export function generateStaticParams() {
  return PARTS.map((part) => ({ slug: part.slug }));
}

export async function generateMetadata({ params }: PageProps<"/parts/[slug]">) {
  const { slug } = await params;
  const part = getPart(slug);
  if (!part) return { title: "Part not found" };
  return { title: part.title, description: part.summary };
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

export default async function Page({ params }: PageProps<"/parts/[slug]">) {
  const { slug } = await params;
  const part = getPart(slug);
  if (!part) notFound();

  const kindMeta = PART_KIND_META[part.partKind];
  const paragraphs = part.description
    .split("\n\n")
    .filter((p) => p.trim().length);
  const dotHref = `data:text/vnd.graphviz;charset=utf-8,${encodeURIComponent(
    part.graph.dot,
  )}`;

  return (
    <div className="container-page py-10 lg:py-12">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-5">
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/parts" className="transition-colors hover:text-cyan">
            ← Parts
          </Link>
          <span className="mx-2 text-faint">/</span>
          <span className="text-muted">{kindMeta.label}</span>
        </nav>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <KindBadge kind={part.kind} />
            <Badge color={kindMeta.color}>{kindMeta.label}</Badge>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
            {part.title}
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-muted">
            {part.summary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <AuthorChip author={part.author} />
          <span className="font-mono text-xs text-dim">
            ↓ {compact(part.downloads)} downloads
          </span>
          <span className="font-mono text-xs text-dim">
            used in {part.usedIn} blueprints
          </span>
          <ButtonLink
            href={dotHref}
            download={`${part.slug}.dot`}
            prefetch={false}
            className="ml-auto"
          >
            Download .dot
          </ButtonLink>
        </div>

        {part.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {part.tags.map((t) => (
              <TagPill key={t} label={t} />
            ))}
          </div>
        )}
      </header>

      {/* ---------- Body ---------- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* MAIN */}
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          {/* Interactive schematic */}
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <PanelLabel>Sub-graph schematic</PanelLabel>
              <span className="font-mono text-[11px] text-faint">
                {part.graph.nodes.length} nodes · {part.graph.edges.length} edges
              </span>
            </div>
            <div className="p-3">
              <BlueprintGraph graph={part.graph} />
            </div>
          </section>

          {/* DOT source */}
          <section id="dot-source" className="scroll-mt-24">
            <DotSource dot={part.graph.dot} />
          </section>

          {/* Long description */}
          {paragraphs.length > 0 && (
            <section aria-labelledby="about-heading">
              <h2
                id="about-heading"
                className="mb-4 font-display text-xl font-semibold text-fg"
              >
                How it works
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
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          {/* Interface */}
          <section className="panel p-5">
            <div className="mb-4">
              <PanelLabel>Interface</PanelLabel>
            </div>
            <PartInterface
              inputs={part.interface.inputs}
              outputs={part.interface.outputs}
            />
          </section>

          {/* Registry stats */}
          <section className="panel p-5">
            <div className="mb-2">
              <PanelLabel>Registry stats</PanelLabel>
            </div>
            <dl className="flex flex-col divide-y divide-line">
              <StatRow label="Downloads" value={`↓ ${compact(part.downloads)}`} />
              <StatRow label="Votes" value={`▲ ${compact(part.votes)}`} />
              <StatRow label="Used in" value={`${part.usedIn} blueprints`} />
              <StatRow label="Published" value={prettyDate(part.createdAt)} />
            </dl>
          </section>

          {/* Tags */}
          {part.tags.length > 0 && (
            <section className="panel p-5">
              <div className="mb-3">
                <PanelLabel>Tags</PanelLabel>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {part.tags.map((t) => (
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
