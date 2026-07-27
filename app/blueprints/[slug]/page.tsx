import Link from "next/link";
import { notFound } from "next/navigation";
import { allBlueprints, getBlueprintBySlug, getRegistry } from "@/lib/content";
import { parseCardRef } from "@/lib/core";
import { compact, prettyDate } from "@/lib/format";
import { AuthorChip } from "@/components/ui/Avatar";
import { KindBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { AutonomyMeter } from "@/components/ui/AutonomyMeter";
import { TagPill } from "@/components/ui/TagPill";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { MetricBars } from "@/components/ui/MetricBars";
import { PhaseCoverageList } from "@/components/ui/PhaseCoverage";
import { DotSource } from "@/components/graph/DotSource";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { BundlePanel, type BundleNode } from "@/components/blueprint/BundlePanel";
import { Comments } from "@/components/blueprint/Comments";
import { Requirements } from "@/components/blueprint/Requirements";

/** Every slug is known at build time; an unknown one is a 404, not an on-demand render. */
export const dynamicParams = false;

export function generateStaticParams() {
  return allBlueprints().map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blueprints/[slug]">) {
  const { slug } = await params;
  const bp = getBlueprintBySlug(slug);
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
  const bp = getBlueprintBySlug(slug);
  if (!bp) notFound();

  const paragraphs = bp.description.split("\n\n").filter((p) => p.trim().length);
  const dotHref = `data:text/vnd.graphviz;charset=utf-8,${encodeURIComponent(
    bp.graph.dot,
  )}`;

  // The index row, for the two facts the view model does not carry: the vocabulary
  // version the manifest was written against, and how many distinct cards are pinned.
  const record = getRegistry().blueprint(bp.slug);

  // `graph.nodes` and `cardRefs` are both `ResolvedBlueprint.nodes` mapped one to one,
  // in the same order, so the index is the join between a drawn node and its card.
  const bundleNodes: BundleNode[] = bp.graph.nodes.map((node, i) => {
    const ref = bp.cardRefs[i] ?? "";
    const parsed = parseCardRef(ref);
    return {
      nodeId: node.id,
      label: node.label,
      cardId: parsed?.id ?? ref,
      version: parsed?.version ?? "",
    };
  });

  // An error-severity diagnostic never reaches this page — the loader refuses to
  // publish a bundle carrying one — so what is left is the engine's own footnotes.
  const notes = bp.analysis.diagnostics.filter((d) => d.severity !== "error");

  // DOT node id → the name the schematic prints on it, so the phase rows and the
  // drawing above them call the same node the same thing. `BlueprintCanvas` builds the
  // identical map for the explainability panel; this one is the server-side half.
  const nodeLabels: Record<string, string> = {};
  for (const node of bp.graph.nodes) nodeLabels[node.id] = node.label;

  return (
    <div className="container-page py-10 lg:py-12">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-5">
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/blueprints" className="transition-colors hover:text-cyan">
            ← Blueprints
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
                href={`/blueprints?tag=${encodeURIComponent(t)}`}
              />
            ))}
          </div>
        )}
      </header>

      {/* ---------- Body ---------- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* MAIN */}
        <div className="flex flex-col gap-8 lg:col-span-2">
          {/* Interactive schematic + the explanation of its two computed scores.
              One client boundary, because clicking a node name in a finding has to
              reach the schematic above it. */}
          <BlueprintCanvas graph={bp.graph} analysis={bp.analysis} />

          {/* Phase coverage — doc 2 §8. Computed off the same bundle as the two scores
              and sitting next to them, but carrying no number: which of the five
              lifecycle phases this graph acts in, and which node stands in each. Doc 2
              §1.1's last bullet puts it under the autonomy rule, so nothing here counts
              or completes — a phase with no node is where this factory stops, stated as
              a fact. The gallery card's strip says only which phases; this says which
              node, which is the half that earns the dimension. */}
          <section
            className="panel overflow-hidden"
            aria-labelledby="phase-coverage-heading"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 id="phase-coverage-heading">
                <PanelLabel>Phase coverage</PanelLabel>
              </h2>
              <span className="font-mono text-[11px] text-dim">
                the lifecycle, in order
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <PhaseCoverageList
                coverage={bp.analysis.phaseCoverage}
                nodeLabels={nodeLabels}
              />
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
            {/* Both take the band, and neither can name it without being handed it:
                autonomy is not a spoke on the radar and not a bar in the list (doc 2
                §1.1 — a length would state a shortfall), so it is *stated*, and the
                caption and the row are the two places it gets stated. Left off, the
                radar fell back to a caption pointing at a card row whose value slot
                was empty. `bp.autonomy` is the same band the header meter prints. */}
            <div className="flex justify-center">
              <ScoreRadar metrics={bp.metrics} autonomy={bp.autonomy} />
            </div>
            <MetricBars
              metrics={bp.metrics}
              autonomy={bp.autonomy}
              className="mt-4"
            />
            {/* The scorecard is the thing a reader actually consumes, so the split
                between what was computed and what was seeded belongs here and not
                only on the homepage. Glyph and word, never colour alone. */}
            <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-dim">
              <span className="font-mono text-emerald" aria-hidden>
                ✓
              </span>{" "}
              <span className="font-mono uppercase tracking-[0.12em] text-emerald">
                computed
              </span>{" "}
              — Autonomy and Security are read off this exact graph at build time, and
              both show their working below.{" "}
              <span className="font-mono text-amber" aria-hidden>
                ◐
              </span>{" "}
              <span className="font-mono uppercase tracking-[0.12em] text-amber">
                seeded
              </span>{" "}
              — the other four are rows in the index. Voting and run telemetry are
              designed and neither is built, so no ballot and no execution stands behind
              those numbers.{" "}
              <Link href="/#scoring" className="text-muted underline-offset-4 hover:text-cyan hover:underline">
                How a factory is graded
              </Link>
            </p>
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

          {/* What the bundle is, on disk */}
          <BundlePanel
            digest={bp.digest}
            ontologyVersion={record?.manifest.ontologyVersion ?? "unknown"}
            // Doc 3 §8: the version a score was computed under, which the engine takes
            // from the view the bundle was resolved against and not from the manifest.
            // Both metrics carry the same value; a test in `lib/core` asserts they and
            // `BlueprintAnalysis.ontologyVersion` can never disagree.
            scoredOntologyVersion={bp.analysis.autonomy.ontologyVersion}
            nodes={bundleNodes}
            pinnedCards={record?.cardRefs.length ?? new Set(bp.cardRefs).size}
            diagnostics={notes}
          />

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
