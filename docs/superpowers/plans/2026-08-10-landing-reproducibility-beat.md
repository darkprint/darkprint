# Landing reproducibility beat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a beat to the landing, between the wordmark and the blueprint walk, that argues why a blueprint beats a prompt: the harness is handed the route rather than the goal, so two runs differ only where the blueprint changed.

**Architecture:** One new server component, `components/home/SectionSameRun.tsx`, holding the copy and a two-panel figure drawn in the site's existing luminous-flow register. It reuses `SectionHeading` and the `BeatCaption` component the two following beats already close on, so the three read as one sequence. No new primitives, no client JavaScript, no new dependencies.

**Tech Stack:** Next 16 App Router (server component), React 19, Tailwind v4, `components/viz` (`FlowScene`, `FlowNode`, `FlowEdge`, `Sheet`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-10-landing-reproducibility-beat-design.md`

## Global Constraints

Every task's requirements implicitly include these. Each is enforced by a test that fails the build.

- **Em dash rule.** `components/home` is a guarded copy tree (`components/build/path.test.ts`). New copy must not use an em dash as a pause. Use a colon, a full stop, or a comma.
- **Nothing on the landing may be a document.** `components/home/beats.test.ts` forbids `<table>`, `<pre>`, and YAML-shaped `key:` runs on every beat.
- **The finished state is what a reader without JS gets.** No `opacity-0` may appear in the prerendered HTML of any beat.
- **Figure labels are always on.** `data-viz-labels="always"`, never `"hover"`, for anything carrying the figure's argument.
- **Tone discipline** (`components/viz/tokens.ts`, `app/globals.css`): `cyan` means "you can act on this"; `human` violet means "where a person acts"; `amber` means "not built yet"; `signal` means "a defect". This figure may use only `line` (the blueprint pole, and the default) and `dim` ("present but subordinate").
- **No ledger edits.** Do not add, remove, or reword any entry in `components/site/honesty.test.ts`. Spec §4 records why this beat needs none.
- **Copy is verbatim from the spec.** The wording in §3 of the spec was approved as written. Do not improve it.

---

### Task 1: The beat and its figure

**Files:**
- Create: `components/home/SectionSameRun.tsx`
- Modify: `components/home/index.ts`
- Modify: `components/viz/scene-labels.test.ts` (ROSTER entry + import)
- Test: `components/home/beats.test.ts`

**Interfaces:**
- Consumes: `BeatCaption({ children, href, cta })` from `components/home/BeatCaption.tsx`; `SectionHeading({ title, lead, align, className })` from `components/ui/SectionHeading`; `FlowScene`, `FlowNode`, `FlowEdge`, `Sheet` from `@/components/viz`.
- Produces: `SectionSameRun()` — a server component taking no props, exported from `components/home/index.ts`. Task 2 mounts it.

- [ ] **Step 1: Write the failing tests**

Append to the `describe("the blueprint-first landing", …)` block in `components/home/beats.test.ts`, and add `SectionSameRun` to that file's imports:

```ts
import { SectionSameRun } from "@/components/home/SectionSameRun";
```

```ts
  /* Beat 2, and the only beat on the landing that argues rather than shows. Both claims
     are pinned because the beat is worthless without either half: claim A on its own is a
     statement about control that nobody asked for, and claim B on its own is unintelligible
     and, worse, reads as a promise that this site measures something. */
  it("argues the blueprint against the prompt, in that order", () => {
    const html = render(SectionSameRun);
    const text = plainText(html);
    expect(text).toContain("The same run twice");
    // Claim A: the harness is handed a route, not a goal.
    expect(text).toContain(
      "A prompt gives your harness a goal and lets it invent the route.",
    );
    // Claim B, the payoff.
    expect(text).toContain("two runs differ only where you changed the blueprint");
    expect(html).toContain('href="/what-a-blueprint-is#run"');
  });

  it("names both panels as text a reader gets without a pointer", () => {
    const html = render(SectionSameRun);
    const text = plainText(html);
    expect(text).toContain("from a prompt");
    expect(text).toContain("from a blueprint");
    expect(html).toContain('data-viz-labels="always"');
    expect(html).not.toContain('data-viz-labels="hover"');
  });

  /* The honesty position, held as a test rather than as a comment.

     `components/site/honesty.test.ts` pins, in the open, that nothing on this site measures
     a run, and `/reading-the-radar` says there is no runner and no endpoint. This beat comes
     nearer that line than anything else on the landing, and it stays on the right side of it
     by three specific choices recorded in the spec: the running is the reader's, the verb is
     `attribute`, and the word `eval` never appears. A rewrite that promises a measurement
     fails here, which is the point at which it also needs a limit statement and a ledger row. */
  it("claims no measurement of its own", () => {
    const text = plainText(render(SectionSameRun)).toLowerCase();
    expect(text).toContain("run it again in your own harness");
    expect(text).toContain("attribute the difference to the swap");
    for (const promise of ["eval", "we measure", "we score", "measure if"]) {
      expect(text, `the beat promises \`${promise}\``).not.toContain(promise);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/home/beats.test.ts`

Expected: FAIL. The import cannot resolve — `Failed to resolve import "@/components/home/SectionSameRun"`.

- [ ] **Step 3: Create the component**

Create `components/home/SectionSameRun.tsx`:

```tsx
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

   ── The honesty line this beat runs along ──
   `components/site/honesty.test.ts` pins, in the open, that nothing on this site measures a
   run. This beat therefore claims a property of the ARTIFACT and never a capability of the
   site: the running is the reader's ("in your own harness"), the verb is `attribute` rather
   than `measure`, and the word `eval` does not appear, because `components/explain/
   RunLayers.tsx` defines it precisely and a landing beat would be using it loosely.
   `beats.test.ts` holds all three. Rewriting this copy into a promise about measurement
   needs a limit statement beside it and a ledger row, per the repository's own rule that a
   claim and its qualifier travel together.
   ============================================================ */

/** Scene units, which are viewBox units. Both panels are drawn on one grid. */
const SCENE = { width: 320, height: 250 } as const;

/** Where every run starts, on both panels. The one thing the two sides share. */
const GOAL = { x: 160, y: 32 } as const;

interface Route {
  mid: { x: number; y: number };
  end: { x: number; y: number };
  bend: number;
}

/**
 * Three routes that share nothing but the goal.
 *
 * Deliberately irregular: three lanes at even spacing would read as a designed fan, which
 * is the opposite of the claim. The bends pull each run onto its own shape.
 */
const IMPROVISED: readonly Route[] = [
  { mid: { x: 58, y: 126 }, end: { x: 46, y: 212 }, bend: -24 },
  { mid: { x: 158, y: 148 }, end: { x: 170, y: 216 }, bend: 4 },
  { mid: { x: 262, y: 114 }, end: { x: 274, y: 204 }, bend: 26 },
];

/** One route. The three runs lie on it, which is what the panel's note says. */
const PINNED: Route = { mid: { x: 160, y: 128 }, end: { x: 160, y: 214 }, bend: 0 };

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
              x={GOAL.x}
              y={GOAL.y}
              tone="dim"
              label="goal"
              reveal="always"
              mark="schematic"
            />
            {IMPROVISED.map((route) => (
              <Fragment key={`${route.mid.x}-${route.end.x}`}>
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
                <FlowNode x={route.mid.x} y={route.mid.y} tone="dim" mark="schematic" />
                <FlowNode x={route.end.x} y={route.end.y} tone="dim" mark="schematic" />
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
            <FlowNode x={GOAL.x} y={GOAL.y} label="goal" reveal="always" mark="schematic" />
            <FlowEdge from={GOAL} to={PINNED.mid} />
            <FlowEdge from={PINNED.mid} to={PINNED.end} />
            <FlowNode x={PINNED.mid.x} y={PINNED.mid.y} mark="schematic" />
            <FlowNode x={PINNED.end.x} y={PINNED.end.y} lit mark="schematic" />
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
```

- [ ] **Step 4: Export it from the barrel**

In `components/home/index.ts`, add the export beside the other beats, keeping the file's existing ordering and comment style:

```ts
export { SectionSameRun } from "./SectionSameRun";
```

- [ ] **Step 5: Run the beats tests**

Run: `npx vitest run components/home/beats.test.ts`

Expected: PASS, all cases.

If `claims no measurement of its own` fails on the substring `eval`, read the reported text before changing anything: the copy above contains no such word, so a hit means something else on the beat introduced it, and the copy is not what should move.

- [ ] **Step 6: Run the scene roster test to see it fail**

Run: `npx vitest run components/viz/scene-labels.test.ts`

Expected: FAIL on `measures each of them`, reporting:

```
a new scene was drawn; add it to ROSTER: [ "components/home/SectionSameRun.tsx" ]
```

This is the guard working. That file walks the tree for `<FlowScene` and requires an entry for every file that draws one.

- [ ] **Step 7: Add the ROSTER entry**

In `components/viz/scene-labels.test.ts`, add the import beside the other scene imports:

```ts
import { SectionSameRun } from "@/components/home/SectionSameRun";
```

and add the entry to `ROSTER`:

```ts
  /* Beat 2's two panels. `frames: 2` is the claim that both are still drawn: the argument
     is a comparison, so a panel that stopped rendering would leave a figure that reads as a
     statement about prompts, or one about blueprints, and not as the contrast either one is
     only meaningful inside. */
  {
    files: ["components/home/SectionSameRun.tsx"],
    frames: 2,
    render: () => framesOf(createElement(SectionSameRun)),
  },
```

- [ ] **Step 8: Run the roster test again**

Run: `npx vitest run components/viz/scene-labels.test.ts`

Expected: PASS. If it reports a frame-count mismatch, the number it received is the number of `<svg>` scenes the beat renders; correct `frames` to that, do not change the component to match the guess.

- [ ] **Step 9: Run the whole suite and the typechecker**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`

Expected: all green. The suite was 3507 passing before this task; it should now be higher and nothing should have gone red.

- [ ] **Step 10: Commit**

```bash
git add components/home/SectionSameRun.tsx components/home/index.ts \
        components/home/beats.test.ts components/viz/scene-labels.test.ts
git commit -m "Add the landing beat that argues a blueprint against a prompt"
```

---

### Task 2: Mount it, and record why the landing grew

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `SectionSameRun` from `@/components/home` (Task 1).
- Produces: nothing further depends on this task.

- [ ] **Step 1: Mount the beat**

In `app/page.tsx`, add `SectionSameRun` to the import from `@/components/home` and render it directly after `<Hero />`:

```tsx
import { Hero } from "@/components/hero/Hero";
import {
  SectionSameRun,
  SectionBlueprint,
  SectionNodeIsCard,
  SectionLifecycle,
  SectionDoors,
} from "@/components/home";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionSameRun />
      <SectionBlueprint />
      <SectionNodeIsCard />
      <SectionLifecycle />
      <SectionDoors />
    </>
  );
}
```

- [ ] **Step 2: Record the addition in the page's own table**

`app/page.tsx` opens with a long comment whose subject is where each of doc 2 §2.1's rungs went when the flat landing was rejected, and which ends with a section headed `── What the five beats are ──`. That heading is now wrong and the table needs the new row.

Change the heading to `── What the six beats are ──`, and add this paragraph immediately under it, before the existing sentence beginning "One illustration and roughly one sentence each":

```
   Beat 2 is the newest and the only one that argues rather than
   shows. The author asked for it on 2026-08-10, out of their own
   note on reproducibility: a prompt hands the harness a goal and
   the harness invents the route, so nothing about the run can be
   held constant and nothing about a change can be attributed. It
   sits before either artifact deliberately, because "why not just
   a prompt?" is the objection a reader forms in the second after
   the hero, and its figure was chosen so that answering it needs
   no graph literacy. `docs/superpowers/specs/2026-08-10-landing-
   reproducibility-beat-design.md` carries the argument and the
   honesty position; `SectionSameRun` carries the reasoning for
   the drawing.
```

Then renumber the references to the beats in the paragraph that follows it, which currently reads "Beats 2 and 3 carry one concept apiece", "Beat 4 is three short panels" and "Beat 5 is the two doors". They become beats 3 and 4, beat 5, and beat 6. Do not reword anything else in that paragraph.

- [ ] **Step 3: Verify the landing renders six beats**

Run the dev server if it is not already up:

```bash
npm run dev -- --port 3100
```

Then:

```bash
curl -s http://localhost:3100/ \
  | perl -0777 -pe 's/<script.*?<\/script>//gs; s/<svg.*?<\/svg>//gs; s/<[^>]+>/\n/g' \
  | sed '/^[[:space:]]*$/d' \
  | grep -n "The same run twice\|from a prompt\|from a blueprint\|This is a blueprint\|Every node is a card\|One registry, two loops"
```

Expected: `The same run twice` and both panel titles appear, and they appear **before** `This is a blueprint`.

- [ ] **Step 4: Look at it**

Open `http://localhost:3100/` at 1440x900 and scroll the hero out of view one viewport at a time. Do not take a `fullPage` screenshot: this site's `100vh` bands balloon under one and the capture shows a layout no reader ever sees.

Check three things by eye, because no test covers any of them:
1. the two panels read as a contrast at a glance, before the captions are read;
2. the right panel's route is the brighter of the two;
3. on a narrow window the panels stack without either scene overflowing its sheet.

- [ ] **Step 5: Run the full gate**

The dev server holds `.next`, so stop it before building:

```bash
lsof -ti tcp:3100 | xargs -r kill
npm run build && npx vitest run && npx tsc --noEmit && npm run lint
```

Expected: build completes, all tests pass, typecheck exits 0, lint is silent.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "Put the reproducibility beat on the landing, second"
```

---

## Self-review

**Spec coverage.** §2 placement → Task 2 Step 1. §3 copy → Task 1 Step 3, verbatim. §3 figure and colour reasoning → Task 1 Step 3. §4 honesty position → Task 1 Step 1, third test, and the component's header comment. §5 guards → Task 1 Steps 5 to 8 (beats, roster, labels) and the Global Constraints block (em dash, no document shapes, no ledger edits). §6 files → all five appear across the two tasks. §7 done means → Task 2 Steps 3 to 5.

**Placeholders.** None. Every code step carries the code.

**Type consistency.** `SectionSameRun` is the export name in the component, the barrel, the beats test, the roster test and `app/page.tsx`. `Route`, `SCENE`, `GOAL`, `IMPROVISED` and `PINNED` are defined once and used only inside the component. `BeatCaption`'s three props match the component as it exists today.

**One thing deliberately not planned.** The figure's exact geometry is a first draft. If the panels do not read as a contrast at Task 2 Step 4, the numbers in `IMPROVISED` and `PINNED` are the thing to move, and moving them breaks no test: the roster checks that two scenes are drawn and the beats test checks the words, neither of which is coupled to a coordinate.
