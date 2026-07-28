"use client";

/* ============================================================
   Beat 4 of redesign spec §2: the lights go out on the graph.

   ── The constraint this beat is written against ──
   Doc 2 §1.1: "Un blueprint non deve essere completamente autonomo
   per avere valore su DarkPrint. Un grafo con un nodo di intervento
   umano è legittimo e benvenuto." The section names the barrier it
   is guarding against by name: somebody looks at their own
   pipeline, sees a manual step, and decides they are not far enough
   along to publish. A beat where the lights going out is the reward
   for getting there builds exactly that barrier.

   So the lights are a **description**, and three decisions carry
   that:

   1. **Two runs, one scene, one wash.** The room light comes off
      both of them together. What separates the two is who is
      standing in each, and nothing else: same work, same four
      glyphs, same tone, same weight, same size, drawn on one sheet.
      A single run going dark would be a before and an after.
   2. **Nothing is scored, ranked, counted or awarded.** No chip, no
      badge, no ordinal, no gold, no "achieved". The word "dark
      factory" is in the prose as a name for a shape and the sheet's
      own note says both drawings are blueprints.
   3. **The violet stays violet, and stays lit.** `HumanFlowNode`
      takes the mark from `HUMAN_PRESENCE_MARK` and accepts no
      colour argument, so where a person acts can never be painted
      in `--color-signal`, which this site spends on defects only.
      When the wash goes, that lamp is still on. A person in a graph
      is a thing the drawing shows, and never a thing it laments.

   ── Rendering ──
   Spec §1: the static markup is the finished drawing, which here
   means the wash is already gone. `useLuminousFlow` puts it back at
   the top of the timeline and takes it away again, so the server,
   a reader without JS and a reader who asked for reduced motion all
   get the lit machines on a dark sheet, in order, with the two
   labels showing.
   ============================================================ */

import { utils } from "animejs";

import { FlowEdge, FlowNode, FlowScene, HumanFlowNode, Sheet, VIZ_INK } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ==================== the drawing, as numbers ====================

   One near-square frame for both breakpoints, for the reason
   `./graph.test.ts` sets out: a label is drawn in viewBox units, so
   a wide frame renders it at a few pixels on a phone.
   ==================================================================*/

/**
 * The frame. 400 and not 440: `FLOW.frame` carries the arithmetic, and this sheet renders
 * 320 CSS px wide on a phone, where 440 put the two run labels at 9.5 CSS px and 400 puts
 * them over `FLOW.frame.legible`.
 */
const FIGURE = { width: 400, height: 291 } as const;

/** Where the four glyphs of a run stand. Both runs use the same column centres. */
const COLUMNS = [55, 145, 236, 327] as const;

/** The two rows, and what stands at the end of each. */
const ROWS = [
  { y: 91, key: "attended" },
  { y: 224, key: "unattended" },
] as const;

const NODE_R = 7;
/** Larger than a `FlowNode`, because the pause glyph has to fit inside the ring. */
const HUMAN_R = 9;

/**
 * How much room light is on the sheet before it goes.
 *
 * Painted in the sheet's own ink over the top of the drawing, which is what a lit room
 * does to a lamp: it does not remove the light, it removes the contrast.
 */
const WASH = 0.17;

const WASH_MARK = '[data-beat="wash"]';

/** Milliseconds. After the shared entrance has landed the discs and drawn the runs. */
const WASH_AT = 700;
const FLARE_AT = 1500;

function run(y: number): { from: [number, number]; to: [number, number]; id: string }[] {
  return COLUMNS.slice(0, -1).map((x, i) => ({
    from: [x, y],
    to: [COLUMNS[i + 1], y],
    id: `${y}-${i}`,
  }));
}

function Drawing() {
  const flow = useLuminousFlow({
    amount: 0.25,
    onScene: ({ root, timeline, blooms }) => {
      const wash = root.querySelectorAll<SVGRectElement>(WASH_MARK);
      if (wash.length === 0) return;
      /* Set rather than declared as a `from` value: a layout effect runs before paint, so
         the lit room is the reader's first frame and there is no dark sheet flashing up
         before the lights come on to go out again. */
      utils.set(wash, { opacity: WASH });
      timeline
        .add(wash, { opacity: 0, duration: 1700, ease: "inOutQuad" }, WASH_AT)
        /* The discs come up as the room goes down. `blooms` rather than the node group,
           because the group's box includes the label hanging below it and a lamp growing
           about that centre slides sideways as it brightens. */
        .add(blooms, { scale: [1, 1.14, 1], duration: 1100, ease: "inOutSine" }, FLARE_AT);
    },
  });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      label="The same run of work drawn twice, once with a person standing in it and once without"
      description="Two runs of four agents doing the same work. In the upper run the last step waits for a person to approve the release, marked in violet. In the lower run no step waits for anyone. Both are blueprints."
      id="lights-out"
    >
      {ROWS.map((row) =>
        run(row.y).map((edge) => (
          <FlowEdge
            key={edge.id}
            id={edge.id}
            from={edge.from}
            to={edge.to}
            fromRadius={NODE_R}
            toRadius={
              /* The last run of the upper row arrives at the violet mark, which is drawn
                 larger, so its curve has to stop further back or it would end inside it. */
              row.key === "attended" && edge.to[0] === COLUMNS[COLUMNS.length - 1]
                ? HUMAN_R
                : NODE_R
            }
          />
        )),
      )}

      {/* ---------- the run a person stands in ---------- */}
      {COLUMNS.slice(0, -1).map((x) => (
        <FlowNode key={`attended-${x}`} x={x} y={ROWS[0].y} r={NODE_R} tone="cyan" />
      ))}
      {/* `reveal="always"`, like the absent edge in beat 2. This label and the one below it
          are the whole of what separates the two drawings, and a reader who never moves a
          pointer has to be able to read both. */}
      <HumanFlowNode
        x={COLUMNS[COLUMNS.length - 1]}
        y={ROWS[0].y}
        r={HUMAN_R}
        label="waits for a person"
        reveal="always"
        id="approver"
      />

      {/* ---------- the run nobody stands in ---------- */}
      {COLUMNS.slice(0, -1).map((x) => (
        <FlowNode key={`unattended-${x}`} x={x} y={ROWS[1].y} r={NODE_R} tone="cyan" />
      ))}
      <FlowNode
        x={COLUMNS[COLUMNS.length - 1]}
        y={ROWS[1].y}
        r={NODE_R}
        tone="cyan"
        label="waits for nobody"
        reveal="always"
        id="unattended"
      />

      {/* The room light, over the top of everything and taking no pointer events, so the
          two labels stay reachable while it is still there. */}
      <rect
        data-beat="wash"
        x={0}
        y={0}
        width={FIGURE.width}
        height={FIGURE.height}
        fill={VIZ_INK}
        opacity={0}
        pointerEvents="none"
      />
    </FlowScene>
  );
}

export function SectionLightsOut() {
  return (
    <section id="dark" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="Where the name comes from"
          title="Nobody is on the floor"
          lead="FANUC runs its robot plants unlit because nothing inside them needs to see. A graph where no node waits for a person is called a dark factory, and a graph where one does is shelved beside it."
          align="center"
          className="mx-auto"
        />

        <Sheet
          className="mx-auto mt-10 max-w-xl"
          label="the same work, drawn twice"
          title="with a person, and without"
          note="both are blueprints"
        >
          <Drawing />
        </Sheet>
      </div>
    </section>
  );
}
