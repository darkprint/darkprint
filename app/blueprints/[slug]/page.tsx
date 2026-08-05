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
  FACTORY_DOT,
  TOPOLOGY_DOT,
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
import { compact, prettyDate } from "@/lib/format";
import { AuthorChip } from "@/components/ui/Avatar";
import { KindBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { AutonomyMeter } from "@/components/ui/AutonomyMeter";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { TagPill } from "@/components/ui/TagPill";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { MetricBars } from "@/components/ui/MetricBars";
import { More } from "@/components/ui/More";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { absencesFor } from "@/components/panes/absences";
import { buildPaneModel, type PaneNodeInput } from "@/components/panes/build";
import { SynchronisedPanes } from "@/components/panes/SynchronisedPanes";
import { BundlePanel, type BundleNode } from "@/components/blueprint/BundlePanel";
import { DownloadPanel, type DownloadCard } from "@/components/blueprint/DownloadPanel";
import { Comments } from "@/components/blueprint/Comments";
import { ForkAction } from "@/components/blueprint/ForkAction";
import { ToolScopes } from "@/components/blueprint/Requirements";

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

  // The download is a directory of real files under `public/bundles/<slug>/`, written by
  // `scripts/generate-bundles.ts` before the build. The page only names them, and it
  // names them through the same helpers the generator writes them with, so a link here
  // and a file there cannot drift apart.
  const factoryHref = bundleHref(bp.slug, FACTORY_DOT);
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
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
            {bp.title}
          </h1>

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
            {/* This line sits beside the author and the date and reads as a fact about
                the artefact. Doc 2 §0.4: no counter produced any of these three. Votes
                and Comments joined Downloads here once the "Registry stats" panel that
                used to hold them was removed — same emerald accent across all three,
                since they are the same kind of fact. The visible "◐ seeded" pill that
                used to sit beside Downloads is gone (the author asked for it removed
                from this row specifically), and the Score panel's own "seeded" paragraph
                that used to carry the word elsewhere on this page is gone too (panel
                reorg pass). A `title` on the two seeded figures keeps the word in the
                rendered page honestly — `components/ui/autonomy-surfaces.test.ts` holds
                every file that reads `.votes`/`.downloads` to saying so somewhere in it
                — without reintroducing a visible marker nobody asked to see back. */}
            <span
              className="font-mono text-xs text-emerald"
              title="Seeded, no counter stands behind it"
            >
              ↓ {compact(bp.downloads)} downloads
            </span>
            <span
              className="font-mono text-xs text-emerald"
              title="Seeded, no ballot stands behind it"
            >
              ▲ {compact(bp.votes)} votes
            </span>
            <span className="font-mono text-xs text-emerald">
              {bp.comments.length} comments
            </span>
            {/* Fork first, download second — spec §3.2, both grouped at the row's right
                end. `ForkAction` is the disclosure spec §1 locks in rather than a second
                file download of its own; the button beside it is the one real download
                this row promises. */}
            <div className="ml-auto flex items-center gap-2">
              <ForkAction />
              {/* The topology, not the runnable pipeline: doc 2 §11 item 10's
                  command-line artefact is `factory.dot`, which the sidebar
                  `DownloadPanel` still leads with. This is a second, quicker entry point
                  to `blueprint.dot` specifically, so the label and the file it saves have
                  to name the same thing — `topologyHref`/`TOPOLOGY_DOT`, not
                  `factoryHref`/`FACTORY_DOT`. */}
              <ButtonLink href={topologyHref} download={TOPOLOGY_DOT} prefetch={false}>
                Download blueprint.dot
              </ButtonLink>
            </div>
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
            <FavoriteStar id={`blueprint:${bp.slug}`} className="ml-auto" />
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

      {/* ---------- Body ---------- */}
      {/* Panel reorg spec §A2, revised: the Score card is now the only thing riding in
          `SynchronisedPanes`'s `aside` slot, sticky beside the graph — Requirements
          and Bundle moved out of that column entirely, because stacking all three
          there made the column taller than the graph's own natural height, which
          left `position: sticky` with no slack to move Score within (a box already
          exactly as tall as the row it sits in has nowhere to go as the page
          scrolls). Requirements and Bundle now sit full width, below the graph+aside
          row, next to "Jump to a node" — the graph keeps its natural size instead of
          being stretched or grown to manufacture room for something beside it.
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

          The split is the page's now and runs the whole body: the left column carries the
          graph, the panels and the engine's working, and the right one carries Score and
          Bundle and stays put while the left scrolls. `lg:self-start` is what lets
          `sticky` move at all — a column stretched to the row's height has nowhere to go.

          Comments stay full width below, as asked. */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
        {/* The graph and the card skeleton, consolidated: doc 2 §5.1's pane 1 and
            pane 2, the first thing in the body after the header. Clicking a
            node — or picking one from the dropdown beside the card skeleton — moves
            the same `selection` both panes share, and the card it resolves opens
            its own page through the skeleton's "Open card" link. The raw DOT and
            the raw card YAML (the four-pane view's panes 3 and 4) are not redrawn
            here; `DownloadPanel` below already links to those exact bytes.

            The Score card rides along in `aside`, sticky beside the graph rather
            than under it — see the panel reorg spec §A2 for why: a reader gets the
            glance (the graph, what it draws) and the grade (Score) in one glance of
            the page, and Score stays in view while the graph is what scrolls. */}
        <SynchronisedPanes model={paneModel} graph={bp.graph} />

        {/* Requirements and Bundle, full width, right after the graph+Score row and
            the "Jump to a node" block `SynchronisedPanes` renders below it — moved
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

        {/* The right column: the reading, then the folder it came from. Bundle moved
            here from the full-width run below, on the author's instruction, so the two
            things a reader checks against the graph travel with it. */}
        <aside className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-20 lg:col-span-1 lg:self-start">
          <section className="panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <PanelLabel>Score</PanelLabel>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                6-metric card
              </span>
            </div>
            <div className="flex justify-center">
              <ScoreRadar metrics={bp.metrics} size={280} />
            </div>
            {/* `audit` is what makes this card a glance rather than a second audit.
                The explainability panel below prints the engine's rationale for
                Autonomy and for Security verbatim, and this card was printing the
                same two strings under its two computed rows, word for word, one
                screen away. Handed the raw reading and the marker count, the
                Security row states where the blueprint sits on the engine's own
                0–4 scale instead of restating the subtraction that got it there.
                `raw` and not `level`: the bar beside it is a rescale of `raw`, and
                a rounded level printed next to it disagreed with the bar on four
                of these nine pages (see `ScoreAudit`). The four seeded rows are
                untouched: their detail carries the seeded marker and belongs
                beside the figure. */}
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

          {/* No wrapper. `BundlePanel` draws its own bordered panel with its own
              "Bundle" header, so putting it inside a `panel` titled "Bundle" printed the
              word twice, one box inside another. Mine, from the two-column pass. */}
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
        </aside>
      </div>

      {/* Comments and the download, full width under both columns. Community notes
          "stay like now", per the author. */}
      <div className="mt-8 flex flex-col gap-8">
        <Comments comments={bp.comments} />

        {/* Doc 2 §11 item 10: the bundle as files, generated at build time under
            `public/bundles/<slug>/` and linked here. Its own disclosure, collapsed by
            default, at the end of the page's content. Bundle used to share this
            `<More>` and now sits in the right column beside Score, so this one holds
            only the download. */}
        <More summary="Download">
          <DownloadPanel
            factoryHref={factoryHref}
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
          />
        </More>
      </div>
    </div>
  );
}
