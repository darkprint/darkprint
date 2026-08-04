"use client";

/* ============================================================
   /spec/ontology — the `broader` relation, drawn.

   The vocabulary's third layer has one structural feature, and two
   separate checks in `lib/core` are built on it. A data type
   declares a `broader`, so the data types form a lattice, so:

     an edge type-checks when the producer's type is the consumer's
     or something narrower than it;

     a declared prohibition catches the type it names together with
     every kind of it.

   Both sentences were on the page as prose, and prose is the wrong
   medium for a shape. The chain is three terms deep and the middle
   term has five kinds under it, which a reader sees in one look and
   reconstructs from a paragraph slowly if at all.

   ── Nothing here is transcribed ──
   The page hands this component `view.ancestors("acceptance-criteria")`
   and `view.children` of the term in the middle of that chain, so
   the drawing is the vocabulary the build is holding rather than a
   picture of one. A term renamed in `lib/core/ontology/core.ts`
   arrives here on the next build, and a fifth kind of `structured`
   would appear in the fan without anybody drawing it.

   ── Why the light travels the chain ──
   Redesign spec §1's edges carry a pulse because a run carries
   something. A `broader` pointer is not a run, and the pulse is
   still right: the two checks above are walks up this lattice, and
   `ancestors` is literally a traversal of these edges. The light is
   the resolver going up.

   ── Rendering (spec §1) ──
   Every label is an SVG `<text>` written at SSR time.
   `useLuminousFlow` owns the only motion, and its `static` phase,
   which is the server, no JS and reduced motion, is the finished
   drawing with every label showing.
   ============================================================ */

import {
  FLOW,
  FlowEdge,
  FlowNode,
  FlowScene,
  VIZ,
  labelOffset,
  toneColor,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

import { FigureFrame } from "./FigureFrame";
import { fadeInFurniture, furniture } from "./furniture";

const W = 720;
const H = 360;

/* --------------------- geometry ---------------------

   The chain runs left to right, broadest first, so an arrow drawn along it points the
   way `broader` points and a reader gets the direction of the relation without a legend.
   The fan sits in the rightmost column, which is the narrow end, because everything in
   it is a kind of the term one column to its left. */

/**
 * Centre of the leftmost column.
 *
 * 104 rather than 96 because the caption centred under it, "the top of the lattice", is
 * the widest thing in this column and it is centred on this x. When `VIZ.font.sub` rose
 * from 10 to 12 units — so the annotations would clear the legibility floor on a phone
 * rather than rendering at 8.44 CSS px — the caption grew past the left edge of the
 * viewBox and `scene-labels.test.ts` caught it starting 4 units outside. The column
 * moves in by 8; nothing else in the figure is anchored to it.
 */
const LEFT = 104;
/** Distance between columns. */
const STEP = 228;
/** The row the chain sits on. */
const MID = 180;
/** Vertical spacing inside the fan. Wide enough that a label clears the disc below it. */
const ROW = 58;

/** Radius of a term in the fan that is not the one the argument is about. */
const KIN_R = 6;

/** The register's own node radius, which the chain's discs are drawn at. */
const FLOW_NODE_R = FLOW.node.r;

/** Column centre for the `i`th term of the chain, counting from the broadest. */
function columnX(i: number): number {
  return LEFT + i * STEP;
}

/**
 * Rows for the terms fanned around the focus, nearest the middle first.
 *
 * Alternating above and below rather than filling downwards, so the focus keeps the
 * middle of the column and the fan stays symmetrical whatever its size. The sign flips on
 * each step and the distance grows every second one: 1, -1, 2, -2, and so on.
 */
function fanRow(i: number): number {
  const step = Math.floor(i / 2) + 1;
  return MID + (i % 2 === 0 ? -step : step) * ROW;
}

export function LatticeFigure({
  chain,
  kin,
}: {
  /**
   * The subsumption chain, nearest first, exactly as `view.ancestors` returns it.
   *
   * `["acceptance-criteria", "structured", "any"]` in this build. Drawn reversed, so the
   * top of the lattice is on the left. Any length works; the columns are laid out from it.
   */
  chain: readonly string[];
  /** The other kinds of `chain[1]`, in the vocabulary's own order. */
  kin: readonly string[];
}) {
  const flow = useLuminousFlow<SVGSVGElement>({
    amount: 0.2,
    onScene: fadeInFurniture,
  });

  /* Broadest first, which is left to right on the sheet. */
  const ladder = [...chain].reverse();
  const focus = ladder[ladder.length - 1];
  const parent = ladder[ladder.length - 2];
  const focusX = columnX(ladder.length - 1);
  const parentX = columnX(ladder.length - 2);
  /* The lowest row the fan reaches. Taken from the rows themselves rather than from the
     last index: `fanRow` alternates, so which index lands at the bottom depends on how
     many terms the vocabulary has under `parent`. */
  const fanBottom = kin.reduce((low, _term, i) => Math.max(low, fanRow(i)), MID);

  return (
    <FigureFrame
      label="DRW-103 · the data lattice, three terms deep"
      title={`ontology · broader · ${focus}`}
      note={`${kin.length + 1} kinds of ${parent}`}
      scrollLabel="Fig. 3"
      caption={`The chain the isolation argument walks, read off the vocabulary at build time. An edge type-checks when the producer's type is the consumer's or something narrower than it, and a prohibition catches the type it names together with every kind of it, so a node refusing ${parent} is also refusing the ${kin.length + 1} terms fanned to its right.`}
    >
      <FlowScene
        {...flow.scene}
        width={W}
        height={H}
        label={`The subsumption chain from ${focus} up to ${ladder[0]}`}
        description={`A chain of terms running left to right, broadest first: ${ladder.join(", then ")}. Each arrow points at the term that subsumes the one it leaves, which is what the broader field declares. Fanned around ${focus} at the narrow end are the other kinds of ${parent}: ${kin.join(", ")}. Every one of them is caught by a prohibition naming ${parent}.`}
      >
        {/* The chain, broadest on the left. The arrow points the way `broader` points. */}
        {ladder.slice(1).map((term, i) => (
          <FlowEdge
            key={term}
            from={[columnX(i + 1), MID]}
            to={[columnX(i), MID]}
            tone="emerald"
            /* Named once. Two edges carrying the same word is the same word twice. */
            label={i + 1 === ladder.length - 1 ? "broader" : undefined}
            name={`${term} is a kind of ${ladder[i]}`}
            reveal="always"
            id={`broader-${term}`}
          />
        ))}

        {/* The fan. Each of these is a kind of the term in the middle column, and each is
            drawn smaller than the focus: they are what the argument sweeps up rather than
            what it is about.

            No `name`, deliberately, and it is the one place on this sheet where that is a
            decision. A name makes a glyph a tab stop, and these four would announce
            "json is a kind of structured" one keystroke after the disc at the other end of
            them has already said the same thing. The four discs keep their names; the
            curves between them are structure a reader has from the `<desc>`. */}
        {kin.map((term, i) => (
          <FlowEdge
            key={term}
            from={[focusX, fanRow(i)]}
            to={[parentX, MID]}
            fromRadius={KIN_R}
            tone="emerald"
            id={`kin-${term}`}
          />
        ))}

        {ladder.slice(0, -1).map((term, i) => (
          <FlowNode
            key={term}
            x={columnX(i)}
            y={MID}
            tone="emerald"
            label={term}
            name={`${term}, a data type in the ontology`}
            reveal="always"
            id={term}
          />
        ))}

        {/* Lit, because this is the term the chain is walked from on every page that
            argues about the builder's prohibition. */}
        <FlowNode
          x={focusX}
          y={MID}
          tone="emerald"
          label={focus}
          name={`${focus}, a data type in the ontology`}
          lit
          reveal="always"
          id={focus}
        />

        {kin.map((term, i) => (
          <FlowNode
            key={term}
            x={focusX}
            y={fanRow(i)}
            r={KIN_R}
            tone="emerald"
            label={term}
            name={`${term}, a data type in the ontology and another kind of ${parent}`}
            id={term}
          />
        ))}

        <g {...furniture}>
          {/* The two poles of the relation, named where they sit rather than on a curve.
              A word on every edge would be the same word four times over. */}
          <text
            x={LEFT}
            y={MID + labelOffset(FLOW_NODE_R) + 26}
            textAnchor="middle"
            fontSize={VIZ.font.sub}
            fill={toneColor("dim")}
            letterSpacing="0.14em"
          >
            the top of the lattice
          </text>
          <text
            x={focusX}
            y={fanBottom + labelOffset(KIN_R) + 20}
            textAnchor="middle"
            fontSize={VIZ.font.sub}
            fill={toneColor("dim")}
            letterSpacing="0.14em"
          >
            {`every kind of ${parent}`}
          </text>
        </g>
      </FlowScene>
    </FigureFrame>
  );
}
