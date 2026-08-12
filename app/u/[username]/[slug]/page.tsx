import Link from "next/link";
import { notFound } from "next/navigation";

import { prettyDate } from "@/lib/format";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { BundleHeader } from "@/components/bundle/BundleHeader";
import { FileTree } from "@/components/bundle/FileTree";
import { History } from "@/components/bundle/History";
import { VersionRow } from "@/components/bundle/VersionRow";
import {
  PageHolds,
  Releases,
  SeededBundleFacts,
  UpstreamMovedPanel,
  VisibilitySwitch,
} from "@/components/bundle/Aside";
import { BundlePanel, type BundleNode } from "@/components/blueprint/BundlePanel";
import { bundleView, ownedBundleParams } from "@/components/bundle/load";
import { parseCardRef } from "@/lib/core";
import { getRegistry } from "@/lib/content";
import { OWNED_BUNDLES } from "@/lib/data/bundles";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-65) (cited at line 68): GET /api/bundles/{owner}/{slug}

/* ============================================================
   /u/[username]/[slug] — a bundle you own, handled the way a repository is handled.

   Owner/name identity, public or private, lineage with a pointer at what it came from, a
   file listing, a version history and a set of releases. One thing is borrowed and not
   copied, and the page says so twice: **there is no repository behind a bundle.** History
   here is a list of published snapshots addressed by their own digests, not a chain of
   patches, and nothing on this page can be pulled, checked out or merged.

   ── Two kinds of page, one route ──
   Two of the five bundles are published in `content/`, so their digest, file listing,
   class and download command are read off the archive and the folder the command fetches
   is really there. The other three are rows in `lib/data/bundles.ts` and nothing else:
   every panel that comes from a fixture wears `◐ seeded`, and the header's `Get the
   folder` is switched off rather than offering a command that would 404 on every line.

   ── What this page does NOT carry yet ──
   The graph, the evidence panel and the DOT listing. They belong to the published view at
   `/blueprints/<slug>`, which moves onto this same shell in the next pass; the rail lists
   what the page actually has rather than promising a section that is not on it. A private
   bundle has no resolved graph to draw at all, which is why the rail is honest either way.
   ============================================================ */

/** Five bundles, all known at build time; anything else is a 404, not an on-demand render. */
export const dynamicParams = false;

export function generateStaticParams() {
  return ownedBundleParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]/[slug]">) {
  const { username, slug } = await params;
  const view = bundleView(username, slug);
  if (view === undefined) return { title: "Bundle not found" };
  return {
    title: `${username}/${slug}`,
    description: view.summary,
  };
}

export default async function Page({ params }: PageProps<"/u/[username]/[slug]">) {
  const { username, slug } = await params;
  const view = bundleView(username, slug);
  if (view === undefined) notFound();

  const { bundle, owner, blueprint } = view;
  const published = blueprint !== undefined;

  /* The rail, and the `:target` mark for each row spelled out: Tailwind compiles the
     classes it can read in the source, and `components/site/anchors.test.ts` walks
     `href: "#…"` written in a table exactly like this one. */
  const sections: SideRailItem[] = [
    {
      href: "#overview",
      label: "Overview",
      step: "01",
    },
    {
      href: "#files",
      label: "Files",
      step: "02",
    },
    {
      href: "#history",
      label: "History",
      step: "03",
    },
    {
      href: "#visibility",
      label: "Visibility",
      step: "04",
    },
  ];

  // The engine's own panel, for a bundle the engine has actually resolved.
  const bundleNodes: BundleNode[] =
    blueprint === undefined
      ? []
      : blueprint.graph.nodes.map((node, i) => {
          const ref = blueprint.cardRefs[i] ?? "";
          const parsed = parseCardRef(ref);
          return {
            nodeId: node.id,
            label: node.label,
            cardId: parsed?.id ?? ref,
            version: parsed?.version ?? "",
          };
        });
  const record = blueprint === undefined ? undefined : getRegistry().blueprint(slug);

  /* Every non-error note, and none of them routed elsewhere.
     ------------------------------------------------------------
     `/blueprints/<slug>` splits these: the criteria-leak notes are printed in full inside
     the explainability panel, so `BundlePanel` is told what went there and says so. This
     page has no explainability panel, so nothing is routed away and the whole list belongs
     here. Passing `[]` would have `BundlePanel` print "No problems found" over eight of
     the nine bundles in the archive, which is the exact class of quiet false claim
     `components/site/honesty.test.ts` exists to catch. */
  const notes =
    blueprint === undefined
      ? []
      : blueprint.analysis.diagnostics.filter((d) => d.severity !== "error");

  /* Forks of this bundle, counted over the only population that can hold one: the account
     fixture. Nobody has forked Mara's own bundles, so this is honestly zero on all five
     pages, and it stays a count rather than a claim because the control beside it is off. */
  const forks = OWNED_BUNDLES.filter((b) => b.forkedFrom?.slug === slug).length;

  return (
    /* The rail wraps the band as well, so the left column runs unbroken from the header to
       the footer. See `/blueprints/[slug]` for the measurement that produced this. */
    <SideRail
      label="On this bundle"
      meta={`yours · ${sections.length} sections`}
      ariaLabel="On this bundle"
      items={sections}
      footer={
        <Link
          href={`/u/${username}/blueprints`}
          className="font-mono text-[11px] text-dim transition-colors hoverable:hover:text-cyan"
        >
          ← All your blueprints
        </Link>
      }
    >
      <BundleHeader
        owner={owner}
        slug={slug}
        visibility={bundle.visibility}
        summary={view.summary}
        {...(bundle.forkedFrom === undefined ? {} : { lineage: bundle.forkedFrom })}
        {...(bundle.drift?.tone === "moved"
          ? { driftNote: "upstream repinned 1 card since" }
          : {})}
        watchers={view.watchers}
        forks={forks}
        saveId={`bundle:${username}/${slug}`}
        {...(view.support === undefined ? {} : { support: view.support })}
        {...(view.clone === undefined ? {} : { clone: view.clone })}
      />

        <div className="container-page py-10 lg:py-12">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div className="flex min-w-0 flex-col gap-8">
              <section id="overview" className="scroll-mt-24 flex flex-col gap-5">
                <h1 className="sr-only">
                  {username}/{slug}
                </h1>
                <VersionRow
                  version={view.version}
                  versions={view.versions}
                  changes={view.changes}
                  hasUpstream={bundle.forkedFrom !== undefined}
                  addressedByDigest={published}
                />
                <dl className="panel grid grid-cols-2 gap-x-5 gap-y-4 p-5 sm:grid-cols-4">
                  <div>
                    <dt className="text-sm text-dim">Autonomy</dt>
                    <dd className="mt-1 font-mono text-sm text-fg">{view.autonomy}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-dim">Visibility</dt>
                    <dd className="mt-1 font-mono text-sm text-fg">
                      {bundle.visibility}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-dim">Last edit</dt>
                    <dd className="mt-1 font-mono text-sm text-fg">
                      {prettyDate(view.lastChange.at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-dim">Source</dt>
                    <dd className="mt-1 font-mono text-sm text-fg">
                      {published ? "the archive" : "lib/data"}
                    </dd>
                  </div>
                </dl>
                {!published && (
                  <p className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2/50 px-5 py-4 text-[13px] leading-relaxed text-muted">
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
                      ◐ seeded
                    </span>
                    <ComingSoonBadge />
                    <span className="min-w-0 flex-1">
                      This bundle exists as a row in{" "}
                      <span className="font-mono text-fg">lib/data/bundles.ts</span> and
                      nowhere else. The listing, the history and the releases below are
                      seeded: no folder was written, no digest was computed, and every
                      control that would change any of it is switched off.
                    </span>
                  </p>
                )}
              </section>

              <FileTree
                files={view.files}
                lastChange={view.lastChange}
                author={owner}
                {...(view.hrefFor === undefined ? {} : { hrefFor: view.hrefFor })}
                {...(view.readmeHref === undefined
                  ? {}
                  : { readmeHref: view.readmeHref })}
                footnote={view.fileFootnote}
              />

              <History entries={view.history} />
            </div>

            <aside
              aria-label="About this bundle"
              className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20 xl:self-start"
            >
              <PageHolds />

              <div id="visibility" className="scroll-mt-24">
                <VisibilitySwitch
                  visibility={bundle.visibility}
                  blocked={bundle.drift?.tone === "blocked"}
                />
              </div>

              {blueprint === undefined ? (
                view.facts !== undefined && (
                  <SeededBundleFacts
                    digest={view.facts.digest}
                    nodes={view.facts.nodes}
                    pinnedCards={view.facts.pinnedCards}
                    ontologyDeclared={view.facts.ontologyDeclared}
                    scoredUnder={view.facts.scoredUnder}
                    autonomy={view.autonomy}
                    resolves={view.facts.resolves}
                  />
                )
              ) : (
                <BundlePanel
                  digest={blueprint.digest}
                  ontologyVersion={record?.manifest.ontologyVersion ?? "unknown"}
                  scoredOntologyVersion={blueprint.analysis.autonomy.ontologyVersion}
                  nodes={bundleNodes}
                  pinnedCards={record?.cardRefs.length ?? new Set(blueprint.cardRefs).size}
                  diagnostics={notes}
                />
              )}

              {view.upstreamMoved !== undefined && bundle.forkedFrom !== undefined && (
                <UpstreamMovedPanel
                  moved={view.upstreamMoved}
                  upstream={bundle.forkedFrom}
                />
              )}

              <Releases releases={view.releases} fetchable={published} />

              {/* Where the reading lives, stated rather than implied.
                  ------------------------------------------------------------
                  This page is the folder and the identity: what the bundle is made of,
                  what changed, who can see it. The graph, the scorecard and the engine's
                  working belong to the published view, and the design's eight-row rail
                  would have put all three here as well — three heavy sections duplicated
                  onto a surface where two of five bundles could render them at all, since
                  a private one has no resolved graph to draw.

                  So the rail stays at four rows and the split gets a panel instead of a
                  footnote: a reader looking for the reading is told, once, where it is. */}
              {published ? (
                <section className="route-box p-5">
                  <span className="route-label">The reading</span>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted">
                    This page is the folder and who owns it. The graph, the six-metric
                    scorecard and the engine&rsquo;s own working for both computed readings
                    are on the published view.
                  </p>
                  <Link
                    href={`/blueprints/${slug}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-amber/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-amber transition-colors hoverable:hover:border-amber"
                  >
                    Open the published page →
                  </Link>
                </section>
              ) : (
                <section className="panel p-5">
                  <span className="label">The reading</span>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted">
                    There is none. A graph is scored when it resolves, and this bundle has
                    never been through the engine: it is a row in a fixture. Publishing is
                    what would run the validator over it and give it a scorecard of its own.
                  </p>
                </section>
              )}
            </aside>
          </div>
        </div>
    </SideRail>
  );
}
