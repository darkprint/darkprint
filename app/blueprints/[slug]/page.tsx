import Link from "next/link";
import { notFound } from "next/navigation";
import {
  allBlueprints,
  bundleVocabulary,
  cardSource,
  getBlueprintBySlug,
  getRegistry,
} from "@/lib/content";
import {
  BUNDLE_AGENTS,
  BUNDLE_README,
    TOPOLOGY_DOT,
  bundleDownloadCommand,
  bundleFilePaths,
  bundleHref,
  cardFilePath,
} from "@/lib/content/bundle-export";
import { parseCardRef } from "@/lib/core";
import {
  CRITERIA_OUT_OF_BAND_CODE,
  CRITERIA_RELAYED_CODE,
  CRITERIA_SUSPECTED_CODE,
  CRITERIA_UNANCHORED_CODE,
} from "@/lib/criteria-state";
import { prettyDate } from "@/lib/format";
import { AuthorChip } from "@/components/ui/Avatar";
import { KindBadge } from "@/components/ui/Badge";
import { AutonomyMeter } from "@/components/ui/AutonomyMeter";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { TagPill } from "@/components/ui/TagPill";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { MetricBars } from "@/components/ui/MetricBars";
import { More } from "@/components/ui/More";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { absencesFor } from "@/components/panes/absences";
import { buildPaneModel, type PaneNodeInput } from "@/components/panes/build";
import { DotBreakdown } from "@/components/panes/DotBreakdown";
import { SynchronisedPanes } from "@/components/panes/SynchronisedPanes";
import { BundlePanel, type BundleNode } from "@/components/blueprint/BundlePanel";
import { DownloadPanel, type DownloadCard } from "@/components/blueprint/DownloadPanel";
import { Comments } from "@/components/blueprint/Comments";
import { ForkAction } from "@/components/blueprint/ForkAction";
import { ToolScopes } from "@/components/blueprint/Requirements";
import { EvidenceLayers } from "@/components/blueprint/EvidenceLayers";

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

/**
 * The rail every blueprint page draws, on the left.
 *
 * This was a `PageContents` panel at the foot of the header, and the author asked it into a
 * rail: "In each blueprint we have `On this blueprint` as a panel. Make it on the left as
 * you did for the pages in Learn." Same six destinations, same order; what changes is that
 * a reader four screens down can still see where they are, which is the whole reason the
 * Learn pages have one.
 *
 * A module constant rather than something derived per bundle, because these six sections
 * are the page's own structure and not the blueprint's: every slug renders all six, and the
 * two that live outside this file — `#evidence` in `EvidenceLayers` and `#community-notes`
 * in `Comments` — are mounted unconditionally alongside the four declared here. A bundle
 * with no comments still draws the section that says so.
 *
 * No `active`. `SideRail` reads that as "no row is the page you are on", which is the truth
 * here: all six are anchors into the page a reader is already reading. Lighting one would
 * need a scroll-spy, and a rail that claims a position it is not tracking is worse than a
 * rail that claims none.
 */
const BLUEPRINT_SECTIONS: readonly SideRailItem[] = [
  { href: "#overview", label: "Overview", step: "01" },
  { href: "#blueprint-workspace", label: "Graph and cards", step: "02" },
  { href: "#evidence", label: "Evidence", step: "03" },
  { href: "#use-this-blueprint", label: "Use this release", step: "04" },
  { href: "#blueprint-source", label: "Source", step: "05" },
  { href: "#community-notes", label: "Community notes", step: "06" },
];

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

  // The download is a directory of real files under `public/bundles/<slug>/`, written by
  // `scripts/generate-bundles.ts` before the build. The page only names them, and it
  // names them through the same helpers the generator writes them with, so a link here
  // and a file there cannot drift apart.
  /* `factoryHref` was here. `DownloadPanel` stopped drawing `factory.dot` on 2026-08-08
     and no other element on this page names it, so the binding went with the prop. The
     file is still generated into every bundle by `scripts/generate-bundles.ts`. */
  // Spec §3.1: the header's quick download used to point at `factoryHref` under a
  // "Download factory.dot" label and got renamed to "Download blueprint.dot" without
  // moving what it saves — a label and a saved filename that disagree is a defect this
  // project has fixed before. Computed once, here, so the header button and
  // `DownloadPanel`'s own topology row can never point at two different hrefs for the
  // same file.
  const topologyHref = bundleHref(bp.slug, TOPOLOGY_DOT);
  const downloadCards: DownloadCard[] = [...new Set(bp.cardRefs)]
    .sort()
    .map((ref) => ({ ref, href: bundleHref(bp.slug, cardFilePath(ref)) }));
  // Doc 3 §7: present only for a bundle whose cards declare a local term, which is the
  // same condition the generator writes the file under.
  const vocabulary = bundleVocabulary(bp.slug);

  // The whole folder in one command. Built from `bundleFilePaths`, which is derived beside
  // `exportBundle` from the same constants and held to its output by
  // `lib/content/bundle-export.test.ts`, so the URL list a reader pastes into a terminal is
  // the file list the generator actually wrote — not a second, hand-kept copy of it. The
  // same `vocabulary` value decides both the extra row in `DownloadPanel` and the extra URL
  // in the command, so a folder can never be fetched short of the file that prices it.
  const cloneCommand = bundleDownloadCommand(
    bp.slug,
    bundleFilePaths({ cardRefs: bp.cardRefs, vocabulary: vocabulary !== undefined }),
  );
  const clone = {
    command: cloneCommand,
    cliCommand: `darkprint clone ${bp.slug}`,
  };

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

  // Doc 2 §5.1's four panes, assembled here because the parse that supplies their line
  // numbers is build-time work: the client gets the finished, serializable model and
  // none of the engine. Same join as `bundleNodes` above, plus the resolved card and the
  // document behind it, which are what panes 2 and 4 read.
  const registry = getRegistry();
  const paneNodes: PaneNodeInput[] = bp.graph.nodes.map((node, i) => {
    const ref = bp.cardRefs[i] ?? "";
    const entry: PaneNodeInput = { nodeId: node.id, label: node.label };
    if (ref !== "") entry.ref = ref;
    const card = registry.card(ref)?.card;
    if (card !== undefined) entry.card = card;
    const yaml = cardSource(ref);
    if (yaml !== undefined) entry.yaml = yaml;
    return entry;
  });
  const paneModel = buildPaneModel({
    slug: bp.slug,
    title: bp.title,
    dot: bp.graph.dot,
    nodes: paneNodes,
    absences: absencesFor(
      bp.slug,
      paneNodes.map((node) => node.nodeId),
    ),
  });

  // An error-severity diagnostic never reaches this page — the loader refuses to
  // publish a bundle carrying one — so what is left is the engine's own footnotes.
  //
  // PROJECT.md §3.1: those footnotes used to print twice at full length, once inside the
  // explainability panel's criteria block and once again in the sidebar's validation
  // notes, message and hint both. Measured on the archive it is every note there is:
  // eight bundles carry `criteria-leak-unanchored`, two of those also carry
  // `criteria-out-of-band`, and the starter carries `criteria-relayed-through-judge`.
  // The panel is the better home because it says what the state means, so the sidebar
  // counts them and links up. Anything the panel does not render still lists there,
  // which is why this is a split rather than a filter.
  const notes = bp.analysis.diagnostics.filter((d) => d.severity !== "error");
  const explainedCodes = new Set<string>([
    CRITERIA_UNANCHORED_CODE,
    CRITERIA_OUT_OF_BAND_CODE,
    CRITERIA_SUSPECTED_CODE,
    CRITERIA_RELAYED_CODE,
  ]);
  const explainedNotes = notes.filter((d) => explainedCodes.has(d.code));
  const otherNotes = notes.filter((d) => !explainedCodes.has(d.code));

  return (
    <SideRail label="On this blueprint" items={BLUEPRINT_SECTIONS} ariaLabel="On this blueprint">
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
              {bp.title}
            </h1>
            <FavoriteStar id={`blueprint:${bp.slug}`} count={bp.votes} seeded />
          </div>

          {/* Provenance and the two actions, directly under the title rather than below
              the summary and the collapsed description. Who made this, when, and how to
              take it are what a reader looks for first on a registry entry; leaving them
              at the foot of the header put three paragraphs between the name and the
              answer. The row itself is unchanged — only where it sits. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <AuthorChip author={bp.author} />
            <span className="font-mono text-xs text-dim">
              {prettyDate(bp.createdAt)}
            </span>
            <span className="font-mono text-xs text-dim" title={bp.digest}>
              exact digest {bp.digest.slice(0, 12)}…
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <KindBadge kind={bp.kind} />
            {/* The per-node reading goes with the class, the way it does on the gallery
                tile. Without it the meter can only render the half of itself that a graph
                with nobody in it earns — the dark factory token is gated on the flag, and
                both counterpart statements are gated on having the contributions — so the
                header of a supervised blueprint showed one token and the header of a
                closed-loop one showed two. That is the asymmetry the meter is built to
                avoid: a graph where a person acts answers with the nodes they act at,
                which is more said about it rather than less. */}
            <AutonomyMeter
              autonomy={bp.autonomy}
              contributions={bp.analysis.autonomy.contributions}
            />
          </div>
          {/* Full width: same ask as `SectionHeading`'s lead. */}
          <p className="text-lg leading-relaxed text-muted">
            {bp.summary}
          </p>
        </div>

        {/* Long description, collapsed by default. PROJECT.md §3.1 first moved this
            above the four panes; a later pass moved it into the header itself so it
            reads as more of the same claim rather than a separate body section below the
            schematic. It now closes the header — the author/date/actions row moved up
            under the title — which suits it: it is the last thing a reader needs before
            the schematic, and the only part of the header that is optional.
            `More` is a native `<details>` (already used by `DownloadPanel` and the
            disclosures further down), which keeps the prose in the prerendered HTML
            regardless of `open`. */}
        {paragraphs.length > 0 && (
          <More summary="Read more" bare>
            {paragraphs.map((p, i) => (
              <p
                key={`${i}-${p.slice(0, 16)}`}
                className="text-[15px] leading-relaxed text-muted"
              >
                {p}
              </p>
            ))}
          </More>
        )}

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

      <section id="overview" aria-labelledby="fit-title" className="mt-10 scroll-mt-24">
        <article className="panel p-5">
          <PanelLabel>Overview</PanelLabel>
          <h2 id="fit-title" className="mt-2 font-display text-xl font-semibold text-fg">
            At a glance
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-dim">Domain</dt>
              <dd className="mt-1 text-fg">{bp.category}</dd>
            </div>
            <div>
              <dt className="text-dim">Shape</dt>
              <dd className="mt-1 text-fg">{bp.graph.nodes.length} nodes · {bp.graph.edges.length} handoffs</dd>
            </div>
            <div>
              <dt className="text-dim">Tool scopes</dt>
              <dd className="mt-1 text-fg">{bp.requiredTools.length}</dd>
            </div>
            <div>
              <dt className="text-dim">Release</dt>
              <dd className="mt-1 font-mono text-[12px] text-fg">{bp.digest.slice(0, 12)}…</dd>
            </div>
          </dl>
        </article>
      </section>

      {/* ---------- Body ---------- */}
      {/* Panel reorg spec §A2, revised three times: the Score card rode in
          `SynchronisedPanes`'s own `aside` slot, sticky beside the graph — Requirements
          and Bundle moved out of that column entirely, because stacking all three
          there made the column taller than the graph's own natural height, which
          left `position: sticky` with no slack to move Score within (a box already
          exactly as tall as the row it sits in has nowhere to go as the page
          scrolls). Score then moved into the page's own right column, the graph left
          the grid altogether to be as wide as the body, and the graph is now back in
          the grid's two-thirds column with Score beside it — see its mount below for
          what that is worth and what it costs.
          The body used to be `mx-auto max-w-4xl`, which is 896px inside this page's
          1152px `container-page`. The author read the result: the panels have to occupy
          the same horizontal space as the title section above them, and a body inset by
          128px a side under a full-width header reads as two pages stacked.

          The 2:1 graph/aside split still happens inside this one column; the column is
          now the page's.

          It does **not** fix the radar's clipped axis labels, which render as "Reli" and
          "rity" here. That was worth checking rather than assuming: the aside went from
          under 300px to about 370px and the labels are clipped exactly as before, so they
          are being cut by the figure's own bounds and not by the column around it. See
          `components/viz/RadarChart.tsx`. */}
      {/* Two columns, the node page's shape.
          ------------------------------------------------------------
          The author: the panels "should be placed like the structure we have in the node
          webapge where each box on the left occupised 2/3 of the column and the right
          part is made by this attached ... I want the radard panel behaving like the one
          attached for the node card; this up to the community notes which stay like now."

          `SynchronisedPanes` used to own a 2:1 split of its own, for the graph row alone,
          with the Score card in its `aside`. Everything under that row went full width,
          so the page had one shape for its first screen and another for the rest, and the
          Score card stopped being sticky the moment the graph ended.

          The split is the page's and runs the whole body, graph included: the left column
          carries the graph, the panels and the engine's working, and the right one carries
          Score and Bundle and stays put while the left scrolls. `lg:self-start` is what lets
          `sticky` move at all — a column stretched to the row's height has nowhere to go.

          Comments stay full width below, as asked. */}

      {/* ---------- the body grid, and why it has four children rather than two ----------
          The author: on narrow screens the Score panel goes DIRECTLY BELOW the block the
          "Jump to a node" label opens, using CSS grid `order`/`row-start` and not a second
          copy of the markup. `architecture/website.md` has recorded that behaviour since
          the two-column pass; the page never had it. Score was the first child of a
          sticky aside that sat after the whole left column, so below `lg` — where the
          grid collapses to one column and DOM order IS reading order — it landed 2,619px
          down the page, behind Tool scopes and an ~1,800px explainability block. Measured
          on `starter-software-factory` at 390: the "Jump to a node" label at y=1245, Score
          at y=3864.

          `order` alone cannot fix that, and this is the trap worth writing down: `order`
          reorders SIBLINGS inside one container. Score is a child of the aside and the
          skeleton pane is a grandchild of the left column, so no value of `order` on the
          two grid children can interleave one into the other. Something has to become a
          grid item, which is what `display: contents` does — below `lg` the aside has no
          box of its own and Score and Bundle are direct children of this grid.

          So the grid has four children, in DOM order: the graph panel, Score, Bundle, and
          then everything that used to follow the graph in the same column.

            below lg   one column, DOM order, with `order-1` holding Bundle last:
                       graph + skeleton → SCORE → tool scopes + explainability → bundle
            at lg      `lg:flex` gives the aside its box back and `lg:row-span-2` gives it
                       both rows, so the three grid areas are exactly what they were:
                       graph (row 1, cols 1-2), aside (col 3, rows 1-2, sticky), the rest
                       (row 2, cols 1-2). Nothing about the wide layout moves.

          `lg:row-span-2` is not decoration. Without it the aside is trapped in row 1 and
          `position: sticky` stops moving once row 1 ends — a regression invisible in a
          screenshot of the top of the page.

          `min-w-0` moves onto Score and onto Bundle's wrapper for the same reason: below
          `lg` the aside is not a box any more, so the overflow guard cannot live on it.

          `components/panes/archive-labels.test.ts` reads this file's SOURCE TEXT and pins
          four things in order — the grid literal, then the two-thirds column class, then
          the panes mount, then the aside — because every canvas measurement in that file
          is computed from them. It matches on the column class WITH ITS CLOSING QUOTE, so
          prose above the grid may not spell that class out; this sentence used to and
          moved the first match 328 characters before the grid literal, which fails with a
          message about a column that had not moved. All four still hold: the wrapper is
          still the first `lg:col-span-2` and still precedes the mount, and the aside still
          follows it. */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div id="blueprint-workspace" className="scroll-mt-24 flex min-w-0 flex-col gap-8 lg:col-span-2">
        {/* The graph and the card skeleton, consolidated: doc 2 §5.1's pane 1 and pane 2, the
            first thing in the body after the header. Clicking a node — or picking one from
            the dropdown beside the card skeleton — moves the same `selection` both panes
            share, and the card it resolves opens its own page through the skeleton's "Open
            card" link. The raw DOT and the raw card YAML (the four-pane view's panes 3 and
            4) are not redrawn here; `DownloadPanel` below already links to those exact bytes.

            ── This panel is in the column, and what that costs, measured ──
            It spent one commit outside the grid at the full width of the body, because the
            width of the box is the only lever on how large a schematic is drawn: every
            archive drawing is width-bound at every viewport, so a taller pane buys literally
            nothing and a wider one buys everything. The author has ruled for the LAYOUT.
            Two thirds of the body is a 729px canvas at 1440 against the body's 1124, and on
            a six-column drawing that is a whole-graph fit of 0.599 against 0.943 — so
            `AgentNode`'s 11px kind row renders at 6.6 CSS px here and its 14px name at 8.4,
            where the full body gave 10.4 and 13.2. The site holds its figures to 10 CSS px,
            and `starter-software-factory` at 12.1 is the only blueprint that clears it in
            this column. The trade is the author's, made with the numbers in front of them:
            the panels "should be placed like the structure we have in the node webpage where
            each box on the left occupies 2/3 of the column", and reorg spec §A2 wants a
            reader to get "the glance and the grade in one glance of the page" — which is
            Score, sticky, beside the drawing.

            What did NOT come back with the layout is the crop. The fit still draws every
            blueprint whole at every width, with no floor under it; the drawing is smaller in
            this column, not cut off. `components/graph/framing.ts` carries the table of what
            each blueprint measures where, and `components/panes/archive-labels.test.ts`
            asserts both halves — whole everywhere, and the 6.6 CSS px floor this column
            actually achieves rather than the one the site would prefer. */}
        <SynchronisedPanes model={paneModel} graph={bp.graph} />
        </div>

        {/* The right column: the reading, then the folder it came from. Bundle moved
            here from the full-width run below, on the author's instruction, so the two
            things a reader checks against the graph travel with it.

            `contents` below `lg`, a flex column at `lg` — see the note on the grid above
            for what that buys and what `lg:row-span-2` is holding up. */}
        <aside
          aria-label="The reading, and the folder it came from"
          className="contents lg:sticky lg:top-20 lg:col-span-1 lg:row-span-2 lg:flex lg:min-w-0 lg:flex-col lg:gap-8 lg:self-start"
        >
          <section className="panel min-w-0 p-5">
            <div className="mb-3 flex items-center justify-between">
              <PanelLabel>Score</PanelLabel>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                6-metric card
              </span>
            </div>
            <div className="flex justify-center">
              <ScoreRadar metrics={bp.metrics} size={280} />
            </div>
            <MetricBars
              metrics={bp.metrics}
              autonomy={bp.autonomy}
              compact
              audit={{
                securityRaw: bp.analysis.security.raw,
                securityMarkers: bp.analysis.security.penalties.length,
              }}
              className="mt-4"
            />
          </section>

          {/* No wrapper of its own, once: `BundlePanel` draws its own bordered panel with
              its own "Bundle" header, so putting it inside a `panel` titled "Bundle"
              printed the word twice. It has a bare `<div>` now for two jobs the dissolved
              aside can no longer do — `order-1` keeps it LAST below `lg`, where it is a
              sibling of Score and of both left-column blocks rather than a child of a box
              that already ordered it, and `min-w-0` is the overflow guard that used to sit
              on the aside. `lg:order-none` is defensive rather than needed: inside the
              flex column at `lg` it is already the last child. */}
          <div className="order-1 min-w-0 lg:order-none">
            <BundlePanel
              digest={bp.digest}
              ontologyVersion={record?.manifest.ontologyVersion ?? "unknown"}
              // Doc 3 §8: the version a score was computed under, which the engine
              // takes from the view the bundle was resolved against and not from
              // the manifest. Both metrics carry the same value; a test in
              // `lib/core` asserts they and `BlueprintAnalysis.ontologyVersion`
              // can never disagree.
              scoredOntologyVersion={bp.analysis.autonomy.ontologyVersion}
              nodes={bundleNodes}
              pinnedCards={record?.cardRefs.length ?? new Set(bp.cardRefs).size}
              diagnostics={otherNotes}
              explainedNotes={explainedNotes}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
        {/* Tool scopes and the engine's working, in the same column as the graph and
            under the "Jump to a node" block `SynchronisedPanes` renders below it — moved
            out of the sticky aside column (see the comment above) so the graph and
            Score keep their own natural sizes instead of the column being stretched
            to hold three panels' worth of content. */}
        {/* Two panels where there was one called "Requirements". The models are a
            suggestion the author ran on and a reader may override; what the graph is
            allowed to reach is a fact about its blast radius and the input to the
            security reading, so it stands on its own. */}
        {/* Open, not folded. The author: "Make suggested model box and tool scope
            always open and not collapsed." Both are short, both answer a question a
            reader has while looking at the graph beside them, and a disclosure over four
            lines costs a click to save nothing. */}
        {/* "Suggested models" stood here and is gone. The author: the model "should be
            listed in the node description as a entry", and it already is: `model` is a
            Behaviour row in the card skeleton directly above, per node, read off the card
            it belongs to. The panel aggregated the same field across the graph and put a
            second answer on the same screen.

            `Tool scopes` stays, and the difference is worth stating rather than assuming:
            what a graph is allowed to reach is the input to the security reading, so the
            union of it is a fact about the blueprint and not just a per-node one. If that
            reasoning does not hold for you either, the panel goes the same way. */}
        <section className="panel flex flex-col gap-3 p-5">
          <PanelLabel>Tool scopes</PanelLabel>
          <ToolScopes tools={bp.requiredTools} />
        </section>


        {/* Explainability: the engine's own working for Autonomy and Security, in
            that order. `BlueprintCanvas` no longer draws its own schematic (the
            merged graph panel above already covers that) and no longer takes a Score
            panel as `children` either, now that Score lives in the aside beside the
            graph instead — it owns only the client boundary that shares a
            `highlighted` node id across Explainability's own sub-lists, so clicking a
            contribution row and a finding row naming the same node still cross-light
            each other. */}
        <BlueprintCanvas graph={bp.graph} analysis={bp.analysis} />

        </div>

      </div>

      {/* Comments and the download, full width under both columns. Community notes
          "stay like now", per the author. */}
      <div className="mt-8 flex flex-col gap-8">
        <EvidenceLayers blueprint={bp} />

        <details
          id="use-this-blueprint"
          className="group scroll-mt-24 rounded-xl border border-cyan/35 bg-surface p-5 sm:p-7"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-5 [&::-webkit-details-marker]:hidden">
            <div className="max-w-2xl">
              <PanelLabel>Exact release</PanelLabel>
              <h2 className="mt-2 font-display text-2xl font-semibold text-fg">Use this blueprint</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Take the complete bundle, adapt it locally, and validate the result before
                you run or publish it. DarkPrint distributes these files; your own harness
                decides how to execute them.
              </p>
            </div>
            <span className="mt-1 inline-flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
              <span className="group-open:hidden">Show files</span>
              <span className="hidden group-open:inline">Hide files</span>
              <span
                aria-hidden
                className="text-lg transition-transform duration-150 group-open:rotate-45"
              >
                +
              </span>
            </span>
          </summary>
          <div className="mt-5 border-t border-line pt-5">
            <div className="flex justify-end">
              <ForkAction />
            </div>
            <p className="my-4 break-all font-mono text-[11px] text-dim">
              digest {bp.digest}
            </p>
            <DownloadPanel
              topologyHref={topologyHref}
              readmeHref={bundleHref(bp.slug, BUNDLE_README)}
              agentsHref={bundleHref(bp.slug, BUNDLE_AGENTS)}
              {...(vocabulary === undefined
                ? {}
                : {
                    vocabulary: {
                      href: bundleHref(bp.slug, vocabulary.file),
                      termIds: vocabulary.termIds,
                    },
                  })}
              cards={downloadCards}
              clone={clone}
            />
          </div>
        </details>

        {/* ---------- the file itself, at the width the file needs ----------
            The author asked for the `<slug>/blueprint.dot` panel to be BIGGER, for the
            important tag to light up in blue, and — this pass — for the highlight to be
            driven by a CLICK on the rail beside the file rather than by the page's scroll
            position. The scroll choreography that stood here for one release is gone, not
            gated: `components/panes/DotBreakdown.tsx` records what replaced it.

            Both asks are answered by taking the listing out of a column. The page carried
            `blueprint.dot` only as a download button, and the panel the ask describes —
            `components/ui/SourcePanel.tsx` — is a half-grid box that measures 564x320
            against 713x578 of content wherever it is mounted: 45% of the file hidden
            downward, 21% of it hidden sideways, in a box a reader has to scroll inside a
            page they are already scrolling. Full width is 1152px here, the listing takes
            two thirds of that, and every line of every blueprint in the archive is on
            screen at once with no nested scrolling of any kind.

            WHY IT IS HERE AND NOT IN THE LEFT COLUMN. Two thirds of the body is 757px, and
            the same 2:1 figure inside it would give the listing 463px against a longest
            line of about 690px — which is smaller than the panel this replaces, not
            bigger. A figure whose whole argument is "you can read the file" cannot be
            width-starved to sit beside something.

            It follows the two columns and precedes the community notes, which keeps the
            drawing, the reading and the folder together above it and leaves this as the
            last thing the page says in its own voice: here is the source, and here is what
            each part of it is.

            `components/panes/DotBreakdown.tsx` carries the register and the contrast
            numbers; `components/panes/dot-breakdown.ts` derives every block from the file
            so that nine different DOTs cannot drift out of a hand-typed table. The same
            figure is mounted on `/spec/topology`, over the same file, which is why it takes
            its source and its title as props and holds no knowledge of either page.

            No `downloadName` here. This page already offers `blueprint.dot` in its
            `Download` disclosure a few hundred pixels below, and two buttons for the same
            bytes is two answers to one question. `/spec/topology`, which has no such
            disclosure, passes one. */}
        <div id="blueprint-source" className="scroll-mt-24">
          <DotBreakdown source={bp.graph.dot} title={`${bp.slug}/${paneModel.dotFile}`} />
        </div>

        <Comments comments={bp.comments} />
      </div>
    </div>
    </SideRail>
  );
}
