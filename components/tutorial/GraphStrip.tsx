"use client";

import { Fragment } from "react";

import { cx } from "@/lib/format";

/* ============================================================
   The graph so far, repainted on every keystroke
   ------------------------------------------------------------
   Four nodes, three forward edges, one return arc and a rubric that
   arrives at step 07. It is drawn from the same values the files are
   written from, so a reader watching it fill in is watching the
   folder they are about to download.

   ── two things the design prototype did that this cannot ──
   It drew the strip at 10px and 9px, and `app/globals.css` states
   that 11px is the absolute floor with no exceptions. And it spent
   `#5c6478` on every unset port line, a colour with no token in this
   repository that measures 3.42:1 on `--color-void`, under the AA
   floor for text this size. Both are fixed the same way: the strip
   runs at the 11px mono tier in `--color-dim`, which is the token
   whose own comment records it clearing 4.5:1 on these grounds. The
   boxes are wider for it, which is why the strip scrolls sideways on
   a phone rather than shrinking.

   ── why the type colours are the ontology's and not the mock's ──
   A node's accent says what KIND of node it is, so the map has to be
   the one the rest of the site draws types with. `--color-copper-*`
   is spoken for: `app/globals.css` gives the copper pole one job,
   the node card, and a second consumer here would make the two
   registers stop meaning different things. So the human types take
   `--color-violet`, which is what this site spends on where a person
   acts, and an unknown term takes `--color-signal`, which is what it
   spends on a defect. That is exactly what an unknown term is: the
   resolver refuses it.
   ============================================================ */

/** Type to accent, in tokens. An absent entry is a term the vocabulary does not hold. */
const TYPE_TONE: Record<string, { dot: string; border: string; text: string }> = {
  agent: { dot: "bg-emerald", border: "border-emerald", text: "text-emerald" },
  tool: { dot: "bg-cyan-bright", border: "border-cyan-bright", text: "text-cyan-bright" },
  validation: { dot: "bg-cyan", border: "border-cyan", text: "text-cyan" },
  decision: { dot: "bg-amber", border: "border-amber", text: "text-amber" },
  "human-gate": { dot: "bg-violet", border: "border-violet", text: "text-violet" },
  "human-input": { dot: "bg-violet", border: "border-violet", text: "text-violet" },
  parallel: { dot: "bg-blueprint-ink", border: "border-blueprint-ink", text: "text-blueprint-ink" },
  "parallel.fan-in": {
    dot: "bg-blueprint-ink",
    border: "border-blueprint-ink",
    text: "text-blueprint-ink",
  },
  "manager-loop": {
    dot: "bg-blueprint-line",
    border: "border-blueprint-line",
    text: "text-blueprint-line",
  },
};

const UNKNOWN = { dot: "bg-signal", border: "border-signal", text: "text-signal" };

export interface GraphNode {
  /** The node's name in the graph file, or its example while the field is empty. */
  readonly name: string;
  /** The `type` as typed. Empty until the reader fills it in. */
  readonly type: string;
  /** The card ref, or undefined while the id is empty. */
  readonly ref: string | undefined;
  /** How much of this node's card has been written, as filled over total. */
  readonly filled: number;
  readonly total: number;
  readonly ports: readonly string[];
  /** The prohibition the rubric adds, shown on the extractor once one exists. */
  readonly cannot?: string;
}

export interface GraphEdge {
  readonly label: string;
  /** The producing port's type, as typed. */
  readonly from: string;
  /** The consuming port's type, as typed. */
  readonly to: string;
  /** False when both ends are set and the engine would refuse the pairing. */
  readonly fits: boolean;
  /** The record shape both ends agree on, mirrored from the blanks. */
  readonly shape: string;
}

function NodeBox({ node }: { node: GraphNode }) {
  const tone = node.type === "" ? undefined : (TYPE_TONE[node.type] ?? UNKNOWN);
  const complete = node.filled === node.total;
  const started = node.filled > 0;

  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-1.5 rounded-lg bg-void/50 px-3 py-2.5",
        started ? "border" : "border border-dashed border-line-bright opacity-70",
        started && !complete ? "border-line" : "",
        complete && tone !== undefined ? cx(tone.border, "shadow-glow-sm") : "",
      )}
      /* `--glow` is what `shadow-glow-sm` reads, and it resolves where it is declared, so
         it is set on the element rather than in the class. `currentColor` cannot be used:
         the box's own text is the node name, not the accent. */
      style={complete && tone !== undefined ? ({ "--glow": "currentColor" } as React.CSSProperties) : undefined}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cx("size-2 shrink-0 rounded-full", tone === undefined ? "bg-line-bright" : tone.dot)}
        />
        <span className="min-w-0 truncate font-mono text-[11px] text-blueprint-ink">{node.name}</span>
        <span
          className={cx(
            /* `min-w-0 truncate` rather than `shrink-0`: the node column is 150px and the
               type is whatever the reader typed, so a pill that refuses to shrink walks
               out of the box once the value passes about nineteen characters. The name
               beside it already shrinks the same way. */
            "ml-auto min-w-0 truncate rounded-sm border px-1.5 font-mono text-[11px]",
            tone === undefined ? "border-line text-dim" : cx(tone.border, tone.text),
          )}
        >
          {node.type === "" ? "type?" : node.type}
        </span>
      </div>
      <span className="font-mono text-[11px] text-dim">
        {node.ref === undefined ? "card ?" : node.ref}
      </span>
      {node.ports.map((line) => (
        <span key={line} className="font-mono text-[11px] text-dim">
          {line}
        </span>
      ))}
      {node.cannot === undefined ? null : (
        <span className="font-mono text-[11px] text-violet">cannot {node.cannot}</span>
      )}
    </div>
  );
}

function EdgeConnector({ edge }: { edge: GraphEdge }) {
  const both = edge.from !== "" && edge.to !== "";
  const tone = !both ? "text-dim" : edge.fits ? "text-emerald" : "text-signal";
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 px-2">
      <span className={cx("font-mono text-[11px]", tone)}>{edge.label}</span>
      <span aria-hidden="true" className="flex w-full items-center">
        <span className={cx("h-px flex-1 bg-current", tone)} />
        <span
          className={cx(
            "size-0 border-y-4 border-l-[6px] border-y-transparent border-l-current",
            tone,
          )}
        />
      </span>
      {/* Capped and WRAPPED, where the shape line below truncates. The connector sits in a
          fixed 128px track and both ends are vocabulary the reader types, so
          `unstructured-text ≠ acceptance-criteria` is 39 characters in a 112px box: without
          a cap it overflows the column at every viewport and lands on the node boxes either
          side. Truncating it would be worse than the overflow — the `≠` is the whole
          content of the line, and `unstructured-tex…` reads as a pair that matches. */}
      <span className={cx("max-w-full break-words text-center font-mono text-[11px]", tone)}>
        {!both ? "?" : edge.fits ? edge.from : `${edge.from} ≠ ${edge.to}`}
      </span>
      <span className="max-w-full truncate font-mono text-[11px] text-dim">{edge.shape}</span>
    </div>
  );
}

export function GraphStrip({
  nodes,
  edges,
  rubric,
  returnArc,
  stats,
  faults,
}: {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  /** The fifth node, drawn faint until step 07 gives it an id. */
  rubric: { readonly on: boolean; readonly ref: string; readonly into: string };
  /** The dashed arc that sends an unsupported entry back, described in words. */
  returnArc: string;
  stats: string;
  /** Every edge the engine would refuse, said in the engine's own words. */
  faults: readonly string[];
}) {
  return (
    <div className="sticky top-16 z-40 mt-6 min-w-0 rounded-xl border border-line bg-surface-2/95 px-4 py-4 backdrop-blur-md">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="label">The graph so far</span>
        <span className="ml-auto font-mono text-[11px] text-dim">{stats}</span>
      </div>

      <div className="mt-3 min-w-0 overflow-x-auto">
        <div className="grid min-w-[56rem] grid-cols-[minmax(150px,1fr)_128px_minmax(150px,1fr)_128px_minmax(150px,1fr)_128px_minmax(150px,1fr)] gap-y-2">
          {nodes.map((node, index) => (
            /* The node and the connector that leaves it are one grid pair, and the
               fragment is keyed rather than the two children: a node renamed mid-run
               would otherwise take a new key and remount the box the reader is watching. */
            <Fragment key={index}>
              <NodeBox node={node} />
              {index < edges.length ? <EdgeConnector edge={edges[index]} /> : null}
            </Fragment>
          ))}

          {/* The return arc, spanning the three columns it travels back across. Words
              rather than a second drawn line: it runs right to left under four boxes, and
              a reader following it needs to know what it carries more than where it bends. */}
          <div className="col-start-3 col-end-7 flex items-center gap-2 font-mono text-[11px] text-blueprint-line">
            <span aria-hidden="true" className="size-0 border-y-4 border-r-[6px] border-y-transparent border-r-current" />
            <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-current" />
            <span>{returnArc}</span>
          </div>

          <div className={cx("col-start-5 col-end-6", rubric.on ? "" : "opacity-40")}>
            <div
              className={cx(
                "flex min-w-0 flex-col gap-1.5 rounded-lg bg-void/50 px-3 py-2.5",
                rubric.on ? "border border-violet shadow-glow-sm" : "border border-dashed border-line-bright",
              )}
              style={rubric.on ? ({ "--glow": "currentColor" } as React.CSSProperties) : undefined}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cx("size-2 shrink-0 rounded-full", rubric.on ? "bg-violet" : "bg-line-bright")}
                />
                <span className="font-mono text-[11px] text-blueprint-ink">rubric</span>
                <span
                  className={cx(
                    "ml-auto shrink-0 rounded-sm border px-1.5 font-mono text-[11px]",
                    rubric.on ? "border-violet text-violet" : "border-line text-dim",
                  )}
                >
                  human-input
                </span>
              </div>
              <span className="font-mono text-[11px] text-dim">{rubric.ref}</span>
              <span className={cx("font-mono text-[11px]", rubric.on ? "text-emerald" : "text-dim")}>
                ▲ criteria: acceptance-criteria → {rubric.into}
              </span>
            </div>
          </div>
        </div>
      </div>

      {faults.length === 0 ? null : (
        <ul className="mt-3 flex flex-col gap-1 border-l-2 border-signal pl-3">
          {faults.map((fault) => (
            <li key={fault} className="font-mono text-[11px] leading-relaxed text-signal">
              {fault}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
