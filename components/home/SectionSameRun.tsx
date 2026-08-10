import { Fragment } from "react";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { FlowEdge, FlowNode, FlowScene, Sheet } from "@/components/viz";

import { BeatCaption } from "./BeatCaption";

/* ============================================================
   Beat 2: the same goal, run three times, with and without a specification.

   The author, 2026-08-10:

     "if you start from a prompt or a skill, your experiment is not reproducible. You see
      the agents spawning, but the harness decides how to reach the goal. There is no
      blueprint."

   Two claims, in the order the author picked. The lead is the cause: a prompt hands the
   harness a goal, a blueprint hands it the route. The caption is the consequence: pinned
   that way, a rerun differs only where you changed it.

   ── Why this beat is second, before either artifact ──
   It argues about a blueprint the page has not drawn yet, which was named as the risk when
   the position was chosen. It is worth it because "why not just a prompt?" is the objection
   a reader forms in the second after the hero says "reusable blueprints for agent
   workflows", and the figure below was chosen so that answering it needs no graph literacy:
   two panels of routes, no node the reader has to be able to read.

   ── What this beat does NOT restate ──
   `components/explain/RunLayers.tsx`, on `/what-a-blueprint-is#run`, already draws the four
   layers a run has and already says a rubric "is written down before the run, which is what
   makes two runs comparable". That is the rigorous version and the caption links to it. The
   thing missing from the site was never the vocabulary, it was the causal chain: no
   blueprint, so the harness improvises, so runs are not comparable, so a change cannot be
   attributed. This beat states the chain and hands the reader on.

   ── The honesty line this beat runs along ──
   `components/site/honesty.test.ts` pins, in the open, that nothing on this site measures a
   run. This beat therefore claims a property of the ARTIFACT and never a capability of the
   site: the running is the reader's ("in your own harness"), the verb is `attribute` rather
   than `measure`, and the word `eval` does not appear, because `RunLayers` defines it
   precisely and a landing beat would be using it loosely. `beats.test.ts` holds all three.
   Rewriting this copy into a promise about measurement needs a limit statement beside it and
   a ledger row, per the repository's own rule that a claim and its qualifier travel together.
   ============================================================ */

/** Scene units, which are viewBox units. Both panels are drawn on one grid. */
const SCENE = { width: 320, height: 250 } as const;

/**
 * Every position here is a `Point`, which this register spells `[x, y]` and not `{x, y}`.
 *
 * Worth stating because the two are interchangeable to read and not to run: `FlowEdge`
 * hands its endpoints to `flowRun`, which does arithmetic on the tuple, so an object goes
 * all the way through and comes out as `d="M NaN NaN Q NaN NaN NaN NaN"`. The edge still
 * renders, still carries its tone and its pulse, and draws nothing at all. `beats.test.ts`
 * greps this beat's markup for `NaN` for that reason.
 */
type Point = readonly [number, number];

/** Where every run starts, on both panels. The one thing the two sides share. */
const GOAL: Point = [160, 32];

interface Route {
  mid: Point;
  end: Point;
  bend: number;
}

/**
 * Three routes that share nothing but the goal.
 *
 * Deliberately irregular: three lanes at even spacing would read as a designed fan, which
 * is the opposite of the claim. The bends pull each run onto its own shape.
 */
const IMPROVISED: readonly Route[] = [
  { mid: [58, 126], end: [46, 212], bend: -24 },
  { mid: [158, 148], end: [170, 216], bend: 4 },
  { mid: [262, 114], end: [274, 204], bend: 26 },
];

/** One route. The three runs lie on it, which is what the panel's note says. */
const PINNED: Route = { mid: [160, 128], end: [160, 214], bend: 0 };

/**
 * One panel: a titled sheet with a scene on it.
 *
 * `title` and `note` are DOM text above the drawing rather than labels inside it. The
 * landing's figures have to be readable without a pointer, and a heading a screen reader
 * reaches in the normal flow is a stronger answer to that than a label the scene reveals.
 */
function Panel({
  title,
  note,
  label,
  description,
  children,
}: {
  title: string;
  note: string;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="label-lead">{title}</span>
        <span className="label">{note}</span>
      </figcaption>
      <Sheet>
        <FlowScene
          width={SCENE.width}
          height={SCENE.height}
          label={label}
          description={description}
        >
          {children}
        </FlowScene>
      </Sheet>
    </figure>
  );
}

export function SectionSameRun() {
  return (
    <section id="reproducible" className="scroll-mt-24 bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          /* No eyebrow. `.eyebrow` is rationed to one per page or per full-bleed band and
             the hero has spent it, which is the same reason beat 3 gave up its own.

             The title stays `text-fg` while beats 3 and 4 colour theirs. Each of those IS
             one of the two artifacts and names its pole; this beat is the argument about
             both, so it claims neither. The blueprint pole appears here in the right-hand
             panel instead, which is where beat 3 then picks it up. */
          title="The same run twice"
          lead="A prompt gives your harness a goal and lets it invent the route. A blueprint gives it the route: which agents run, what each one is handed, and what must never reach them."
          align="center"
          className="mx-auto"
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <Panel
            title="from a prompt"
            note="three runs, three routes"
            label="The same goal run three times from a prompt"
            description="One goal at the top, and three runs that each take a different route away from it to a different end."
          >
            {/* `dim` is the register's "present but subordinate", which is exactly what
                this panel is: it exists to be the thing the other panel is not. */}
            <FlowNode
              x={GOAL[0]}
              y={GOAL[1]}
              tone="dim"
              label="goal"
              reveal="always"
              mark="schematic"
            />
            {IMPROVISED.map((route) => (
              <Fragment key={`${route.mid[0]}-${route.end[0]}`}>
                {/* No pulse. The pulse says "something moves along here" and this side is
                    context for the claim rather than the claim. */}
                <FlowEdge
                  from={GOAL}
                  to={route.mid}
                  bend={route.bend}
                  tone="dim"
                  pulse={false}
                />
                <FlowEdge from={route.mid} to={route.end} tone="dim" pulse={false} />
                <FlowNode x={route.mid[0]} y={route.mid[1]} tone="dim" mark="schematic" />
                <FlowNode x={route.end[0]} y={route.end[1]} tone="dim" mark="schematic" />
              </Fragment>
            ))}
          </Panel>

          <Panel
            title="from a blueprint"
            note="three runs, one route"
            label="The same goal run three times from a blueprint"
            description="One goal at the top, and a single route away from it that every run follows."
          >
            {/* Default tone, which is `line`: the cyanotype pole the whole site draws a
                blueprint in, and the colour beat 3 opens on. */}
            <FlowNode x={GOAL[0]} y={GOAL[1]} label="goal" reveal="always" mark="schematic" />
            <FlowEdge from={GOAL} to={PINNED.mid} />
            <FlowEdge from={PINNED.mid} to={PINNED.end} />
            <FlowNode x={PINNED.mid[0]} y={PINNED.mid[1]} mark="schematic" />
            <FlowNode x={PINNED.end[0]} y={PINNED.end[1]} lit mark="schematic" />
          </Panel>
        </div>

        <BeatCaption href="/what-a-blueprint-is#run" cta="What surrounds a run">
          Pinned that way, two runs differ only where you changed the blueprint. That is
          what lets you swap one node, run it again in your own harness, and attribute the
          difference to the swap. Without a blueprint there is nothing held constant, so
          there is nothing to compare.
        </BeatCaption>
      </div>
    </section>
  );
}
