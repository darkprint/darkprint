import Link from "next/link";
import { notFound } from "next/navigation";
import { BLUEPRINTS, getBlueprint } from "@/lib/data";
import { compact, prettyDate } from "@/lib/format";
import { AuthorChip } from "@/components/ui/Avatar";
import { KindBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { AutonomyMeter } from "@/components/ui/AutonomyMeter";
import { TagPill } from "@/components/ui/TagPill";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { MetricBars } from "@/components/ui/MetricBars";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { DotSource } from "@/components/graph/DotSource";
import { Comments } from "@/components/blueprint/Comments";
import { Requirements } from "@/components/blueprint/Requirements";

export function generateStaticParams() {
  return BLUEPRINTS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blueprints/[slug]">) {
  const { slug } = await params;
  const bp = getBlueprint(slug);
  if (!bp) return { title: "Blueprint not found" };
  return { title: bp.title, description: bp.summary };
}

/** Small mono heading for the in-page panels. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
      {children}
    </span>
  );
}

export default async function Page({ params }: PageProps<"/blueprints/[slug]">) {
  const { slug } = await params;
  const bp = getBlueprint(slug);
  if (!bp) notFound();

  const paragraphs = bp.description.split("\n\n").filter((p) => p.trim().length);
  const dotHref = `data:text/vnd.graphviz;charset=utf-8,${encodeURIComponent(
    bp.graph.dot,
  )}`;

  return (
    <div className="container-page py-10 lg:py-12">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-5">
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/gallery" className="transition-colors hover:text-cyan">
            ← Gallery
          </Link>
          <span className="mx-2 text-faint">/</span>
          <span className="text-muted">{bp.category}</span>
        </nav>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <KindBadge kind={bp.kind} />
            <AutonomyMeter autonomy={bp.autonomy} />
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
            {bp.title}
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-muted">
            {bp.summary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <AuthorChip author={bp.author} />
          <span className="font-mono text-xs text-dim">
            {prettyDate(bp.createdAt)}
          </span>
          <span className="font-mono text-xs text-dim">
            ↓ {compact(bp.downloads)} downloads
          </span>
          <ButtonLink
            href={dotHref}
            download={`${bp.slug}.dot`}
            prefetch={false}
            className="ml-auto"
          >
            Download .dot
          </ButtonLink>
        </div>

        {bp.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bp.tags.map((t) => (
              <TagPill
                key={t}
                label={t}
                href={`/gallery?tag=${encodeURIComponent(t)}`}
              />
            ))}
          </div>
        )}
      </header>

      {/* ---------- Body ---------- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* MAIN */}
        <div className="flex flex-col gap-8 lg:col-span-2">
          {/* Interactive schematic */}
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <PanelLabel>Pipeline schematic</PanelLabel>
              <span className="font-mono text-[11px] text-dim">
                {bp.graph.nodes.length} nodes · {bp.graph.edges.length} edges
              </span>
            </div>
            <div className="p-3">
              <BlueprintGraph graph={bp.graph} />
            </div>
          </section>

          {/* DOT source */}
          <section id="dot-source" className="scroll-mt-24">
            <DotSource dot={bp.graph.dot} />
          </section>

          {/* Long description */}
          {paragraphs.length > 0 && (
            <section aria-labelledby="about-heading">
              <h2
                id="about-heading"
                className="mb-4 font-display text-xl font-semibold text-fg"
              >
                About this blueprint
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

          {/* Comments */}
          <Comments comments={bp.comments} />
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          {/* Score card */}
          <section className="panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <PanelLabel>Score</PanelLabel>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                6-metric card
              </span>
            </div>
            <div className="flex justify-center">
              <ScoreRadar metrics={bp.metrics} />
            </div>
            <MetricBars metrics={bp.metrics} className="mt-4" />
          </section>

          {/* Requirements */}
          <section className="panel p-5">
            <div className="mb-4">
              <PanelLabel>Requirements</PanelLabel>
            </div>
            <Requirements
              agents={bp.requiredAgents}
              tools={bp.requiredTools}
            />
          </section>

          {/* Stats */}
          <section className="panel p-5">
            <div className="mb-4">
              <PanelLabel>Registry stats</PanelLabel>
            </div>
            <dl className="flex flex-col divide-y divide-line">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-muted">Votes</dt>
                <dd className="font-mono text-sm tabular-nums text-emerald">
                  ▲ {compact(bp.votes)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-muted">Downloads</dt>
                <dd className="font-mono text-sm tabular-nums text-fg">
                  ↓ {compact(bp.downloads)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-muted">Updated</dt>
                <dd className="font-mono text-sm tabular-nums text-fg">
                  {prettyDate(bp.updatedAt)}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
