"use client";

import { useMemo, useState } from "react";
import { isReleasable, shortDigest, summarize, type LoadBundleResult } from "@/lib/core";
import { cx } from "@/lib/format";
import { graphForBlueprint } from "@/lib/graph-seed";
import { SourcePanel } from "@/components/ui/SourcePanel";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { BLOCK_MAX_HEIGHT, BLOCK_WIDTH } from "@/components/graph/block";
import { drawnExtent, graphPaneHeightCss } from "@/components/graph/framing";
import { GraphPane } from "@/components/panes/GraphPane";
import { buildPaneModel, type PaneNodeInput } from "@/components/panes/build";
import { announce, resolveFocus } from "@/components/panes/model";
import { bundleProgress } from "./progress";

/* --------------------- presentation --------------------- */

/**
 * The bundle-relative name every diagnostic on the topology is located against —
 * `lib/core/bundle/resolve.ts`'s own `DOT_FILE`. The source panel below wears it as its
 * title so a reader reading `topology.dot:2:3` in the validator report can see, without
 * translating anything, which panel holds line 2.
 */
const DOT_FILE = "topology.dot";

/**
 * "2 errors · 1 warning", or the affirmative form. Words, never a colour alone.
 *
 * Exported because the downloadable `REPORT.md` on step 4 has to open on the same verdict
 * the strip below prints. Two spellings of one count is how a report and the page it came
 * from start disagreeing.
 */
export function verdictLine(result: LoadBundleResult): string {
  const counts = summarize(result.diagnostics);
  const parts: string[] = [];
  if (counts.error > 0) parts.push(`${counts.error} error${counts.error === 1 ? "" : "s"}`);
  if (counts.warning > 0) {
    parts.push(`${counts.warning} warning${counts.warning === 1 ? "" : "s"}`);
  }
  if (counts.info > 0) parts.push(`${counts.info} info`);
  return parts.length === 0 ? "nothing to report" : parts.join(" · ");
}


/**
 * What the validator found, and — only when it found nothing fatal — the schematic and
 * the two computed readings it unlocked.
 *
 * §8.3: the validator is the gate. A bundle carrying an error gets its diagnostics and
 * nothing else, because a score read off a graph the engine could not resolve is a
 * number with no claim behind it.
 *
 * ── Two things this component draws that it used not to ──
 *
 * **The graph.** `graphForBlueprint` was already being called here, and its result went
 * to `BlueprintCanvas`, whose own docblock records that it stopped drawing a schematic
 * when the detail page moved that job into `SynchronisedPanes`. So the one surface where
 * the graph belongs to the reader who drew it answered with tables. `GraphPane` is the
 * same component the detail page and `/build` mount, over the same `PaneModel` builder,
 * so the lit-disc nodes, the absent-edge contrast floor and the click-to-select
 * behaviour arrive here with no viz code written for this route.
 *
 * **The source, on the rejection.** `SourcePanel` used to live inside the `usable`
 * branch only, which put the DOT one click away exactly when nothing was wrong with it
 * and out of reach the moment a diagnostic cited a line of it. It is rendered for any
 * bundle that carries a topology now, open by default when the bundle was rejected, and
 * the cited lines are named above it so `topology.dot:2:3` and the gutter agree.
 */
export function ValidationReport({
  result,
  dot,
  className,
}: {
  result: LoadBundleResult;
  /**
   * The topology as the reader supplied it.
   *
   * Only read when the DOT failed to parse: `result.blueprint` is absent in that case and
   * it carries the only copy of the source, so without this the one rejection whose whole
   * complaint is about a character position had no file to show. Resolution that got far
   * enough to produce a blueprint uses the blueprint's own bytes, which are the ones the
   * digest was taken over.
   */
  dot?: string;
  className?: string;
}) {
  const { blueprint, analysis } = result;
  /* D-109: `usable` decides whether a score is shown, and it has to keep agreeing with
     `bundleProgress`'s `resolves` or the same bundle gets two verdicts on one screen. Both
     ask `isReleasable`, so a port that does not fit is now printed as a finding under a
     score rather than used to withhold one.

     A separate `failed = hasErrors(...)` stood here and fed only this line. It is gone
     rather than re-pointed at `isStorable`: `progress.state === "rejected"` below is that
     question already, and a second spelling of it beside the first is how two readings of
     one bundle start disagreeing on one screen. */
  const usable = blueprint !== undefined && analysis !== undefined && isReleasable(result.diagnostics);

  /* Which of three states this bundle is in, and how far the graph got. `components/
     upload/progress.ts` says at length why "rejected" is the wrong word for a folder the
     DarkPrint skill is still filling in: the ordinary visitor now has the whole topology
     and some of the cards, and every error against it is the same fact said once per
     node. The engine's severities are printed unchanged either way — the diagnostic list
     below is untouched — and what changes is only what this page CALLS that state. */
  const progress = useMemo(() => bundleProgress(result), [result]);
  const unfinished = progress.state === "unfinished";

  const graph = useMemo(
    () => (usable && blueprint !== undefined ? graphForBlueprint(blueprint) : undefined),
    [usable, blueprint],
  );

  /**
   * The same serializable model `/blueprints/<slug>` builds at build time, built here in
   * the tab instead. `lib/core` already runs on this page — `loadBundle` is called a few
   * components up — so the DOT parse that supplies every line number costs this route
   * nothing it was not already paying.
   *
   * No card document is attached: pane 2 is not mounted here, and the YAML is only ever
   * read to give the skeleton its line ranges. The resolved card itself is passed, so the
   * live region below can name the card a node pins rather than claim there is none.
   */
  const paneModel = useMemo(() => {
    if (!usable || blueprint === undefined) return undefined;
    const nodes: PaneNodeInput[] = blueprint.nodes.map((node) => ({
      nodeId: node.nodeId,
      label: node.card.name,
      ref: node.ref,
      card: node.card,
    }));
    return buildPaneModel({
      slug: blueprint.manifest.slug,
      title: blueprint.manifest.title,
      dot: blueprint.dot,
      dotFile: DOT_FILE,
      nodes,
    });
  }, [usable, blueprint]);

  /* Held by id rather than by index, and resolved through `resolveFocus`, which falls
     back to the first node for an id this model does not carry. A reader who picked a
     node, went back a step and dropped a different bundle therefore lands on something
     drawn rather than on a blank pane. */
  const [selectedNode, setSelectedNode] = useState<string | undefined>(undefined);
  const focus =
    paneModel === undefined
      ? undefined
      : resolveFocus(paneModel, {
          nodeId: selectedNode ?? paneModel.nodes[0]?.nodeId ?? "",
        });

  /** The lines of the topology the validator pointed at, ascending and distinct. */
  const citedLines = useMemo(() => {
    const lines = new Set<number>();
    for (const diagnostic of result.diagnostics) {
      const at = diagnostic.location;
      if (at?.file === DOT_FILE && at.line !== undefined) lines.add(at.line);
    }
    return [...lines].sort((a, b) => a - b);
  }, [result.diagnostics]);

  /* The bytes the reader dropped when nothing resolved, the bytes the digest was taken
     over when something did. */
  const source = blueprint?.dot ?? dot;

  return (
    <div className={cx("flex flex-col gap-5", className)}>
      {/* ---------- verdict strip ---------- */}
      {/* Three states, not two. `✕ BUNDLE REJECTED` in signal red was the first thing an
          author with three of eight cards written saw, and signal means a defect on every
          other surface of this site — so the strip said "you broke it" to somebody who
          had simply not finished. The half-filled disc in `--color-warn` is the register
          `BundleDropzone` already uses for "something here needs your attention and none
          of it is wrong", and it is deliberately not `--color-amber`: amber has two
          sanctioned jobs sitewide and neither of them is this.

          The count beside it is still `verdictLine`, unedited. The engine raised those
          errors and the list below prints every one; what the token does is name what
          they add up to. */}
      <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface-2/40 px-4 py-3">
        <span
          className="font-mono text-sm"
          style={{
            color: usable
              ? "var(--color-emerald)"
              : unfinished
                ? "var(--color-warn)"
                : "var(--color-signal)",
          }}
          aria-hidden
        >
          {usable ? "✓" : unfinished ? "◐" : "✕"}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-fg">
          {usable ? "bundle resolves" : unfinished ? "bundle unfinished" : "bundle rejected"}
        </span>
        <span className="font-mono text-xs text-dim">{verdictLine(result)}</span>
        {blueprint !== undefined && (
          <span className="ml-auto font-mono text-[11px] text-dim" title={blueprint.digest}>
            {/* `blueprint.nodes` holds the nodes that RESOLVED, so on a half-written
                bundle the old line quietly under-reported the graph: eight nodes in the
                DOT, "3 nodes" in the strip. The progress reading carries both numbers,
                off `graph.ids` and `nodes`, and prints them as the fraction they are. */}
            {unfinished
              ? `${progress.placed} of ${progress.total} nodes carded`
              : `${blueprint.nodes.length} nodes`}{" "}
            · {blueprint.edges.length} edges · {shortDigest(blueprint.digest)}
          </span>
        )}
      </div>

      {/* ---------- the reader's own graph ----------
          Directly under the verdict, because the site's whole claim is that autonomy is
          something you read as a graph and this is the one page where the graph belongs
          to the person looking at it. Click a block and the pane's own footer says what
          that node hears from and what it sends to — the same selection behaviour the
          detail page and `/build` have. */}
      {graph !== undefined && paneModel !== undefined && focus !== undefined && (
        <>
          {/* Mounted whether or not anything has been picked, so a screen reader hears
              the change rather than the region arriving with it. */}
          <p aria-live="polite" className="sr-only">
            {announce(paneModel, focus)}
          </p>
          <GraphPane
            paneNumber={1}
            graph={graph}
            model={paneModel}
            focus={focus}
            graphId={`upload-${paneModel.slug}`}
            /* The drawing's own height, the same arithmetic every other schematic on the
               site now uses. This pane took 380 as a fixed number for the reason the
               general rule states — it has the full container to itself, `fitView` is
               width-bound on every archive-shaped graph, and anything taller is empty
               graticule — but the graph here is the READER's, uploaded a moment ago, and
               its depth is not something this file can pick a number for. A one-row DOT
               and a five-row one get different panes now, and neither is cropped: the fit
               scales the drawing down rather than clipping it, per
               `components/graph/framing.ts`. */
            height={graphPaneHeightCss(
              drawnExtent(graph, BLOCK_WIDTH, BLOCK_MAX_HEIGHT),
            )}
            onSelectNode={setSelectedNode}
          />
        </>
      )}

      {/* ---------- what the verdict means, before the list that produced it ----------
          The same withholding, said three ways. What the engine does is identical in all
          three — no schematic, no autonomy fraction, no security ledger, because a reading
          taken over nodes it could not open is a number with nothing behind it — but "you
          have not finished" and "something you wrote contradicts something else you wrote"
          are different facts about the author, and one heading for both told the commonest
          visitor the wrong one.

          It sat UNDER `DiagnosticList` and moved above it in the same pass. Five rows
          headed `✕ ERROR` in signal red are the whole screen on a half-written bundle, and
          an explanation reached after scrolling past them is an explanation the reader has
          already talked themselves out of. The list is unchanged and every severity in it
          is still the engine's; this is the sentence that says what they add up to, and it
          now arrives first. Nothing moves for the `usable` case — the panel is not rendered
          at all there, and the scores still follow the list. */}
      {!usable && (
        <div className="rounded-lg border border-line bg-surface-2/40 p-5">
          <h3 className="font-display text-xl font-semibold text-fg">
            {unfinished ? "Not finished. Nothing wrong." : "No schematic and no readings"}
          </h3>
          <p className="prose-lane mt-4 text-sm leading-relaxed text-muted">
            {blueprint === undefined
              ? "The DOT could not be parsed into a directed graph, so there is no topology to draw and nothing to analyse. The source is open below, with the lines the validator named."
              : unfinished
                ? `Your topology parsed. ${progress.placed} of its ${progress.total} nodes have their card. The rest are named below, one line each. None of that is a defect. A blueprint is written a card at a time, and this stage is normal. The schematic and the two computed readings wait for the last card, because a number taken over nodes the engine could not open would have no basis. Drop the folder again whenever you like.`
                : "The bundle resolved far enough to report on, but it still has errors. DarkPrint will not put a number on a graph whose references it could not check. Fix the errors below. Then the schematic, the autonomy fraction and the security ledger appear here."}
          </p>
        </div>
      )}

      {/* THREE READINGS CAME OFF THIS PREVIEW, 2026-09-06, on the owner's instruction:
         "in preview of the upload, remove Validator report, Auto-computed from your graph,
         Autonomy and static risk sections as we removed that feature."

         `Validator report` was the whole diagnostic list. `Auto-computed from your graph`
         was the heading over the pair, and the pair was `Autonomy` (the meter and its
         per-node contributions) and `Static risk exposure`. They were the last mounts of
         the scoring reading the owner has been taking off the site since 2026-09-04, and
         this was the surface where it survived longest because it is the one place a reader
         is looking at their OWN graph rather than somebody else's.

         WHAT STAYS, and it is the reason this is a sub-range cut rather than dropping the
         `usable` branch whole: `BlueprintCanvas` below is the drawing of the uploaded graph,
         and the topology panel under it is the file. Neither is a score. An earlier pass
         nearly deleted `BlueprintCanvas` as dead and it is live only here, so the branch
         that renders it is load-bearing. */}

      {usable && (
        <>

          {/* The ledger the two readings are made of: every contribution and every
              finding, cross-referenced by node. The drawing above is the other half. */}
          {graph !== undefined && <BlueprintCanvas graph={graph} analysis={analysis} />}
        </>
      )}

      {/* ---------- the topology, whatever the verdict ----------
          This sat inside the branch above, so a reader told the problem was at
          `topology.dot:2:3` was shown the file only in the case where nothing was wrong
          with it. It is here now for any bundle that carries a topology at all, and it
          opens itself on a rejection: the fix starts by looking at the line. */}
      {source !== undefined && (
        <div className="flex flex-col gap-2">
          {citedLines.length > 0 && (
            <p className="font-mono text-[11px] text-dim">
              <span className="uppercase tracking-[0.18em] text-signal">cited</span>{" "}
              {citedLines.map((line) => `line ${line}`).join(" · ")}. The gutter below
              numbers them.
            </p>
          )}
          <SourcePanel
            source={source}
            language="DOT"
            title={DOT_FILE}
            {...(blueprint === undefined ? {} : { meta: shortDigest(blueprint.digest) })}
            downloadName={
              blueprint === undefined ? DOT_FILE : `${blueprint.manifest.slug}.dot`
            }
            collapsible
            defaultOpen={!usable}
          />
        </div>
      )}
    </div>
  );
}
