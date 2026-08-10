# The landing gains a beat: why a blueprint and not a prompt

*2026-08-10, on `codex`. No code changed yet. Every claim about the existing site in this
document was read off the source or measured against the running build at this commit.*

---

## 0. The consideration this is built on

The author, 2026-08-10:

> 🤔 Second problem: if you start from a prompt or a skill, your "experiment" is **not
> reproducible**. You see the #agents spawning, but the harness decides how to reach the
> goal. There is no blueprint.
>
> 🔬 And #reproducibility is exactly what lets you swap one part of the blueprint, rerun,
> and measure if the result got better. No blueprint, no eval.

and, on what to do with it:

> Can u include this consideration in the homepage? Not as it is but the concept behind to
> have the possibility to reproduce and define a what a given harness has to run exactly?

So the landing gains the argument, not the post. Two linked claims, and the author chose
the order in which they land:

- **A, the cause.** A prompt hands the harness a goal and the harness invents the route.
  A blueprint hands it the route. This is a claim about *control*, and it says nothing
  about measuring anything.
- **B, the consequence.** Because the route is pinned, two runs differ only where the
  blueprint changed, which is the precondition for swapping one node and attributing the
  difference to the swap.

**A leads, B is the payoff.** That order was chosen deliberately: B alone is the riskier
half (see §4) and it is unintelligible without A anyway.

---

## 1. What the site already says, and what it does not

This concept is not absent from the site. It is unclaimed. Three findings, each read off
the source:

1. **`components/explain/RunLayers.tsx`** already draws the four layers a run has —
   blueprint, harness, rubric, eval — and its `rubric` entry already carries half of B:

   > It is written down before the run, which is what makes two runs comparable, and kept
   > away from the harness.

   That figure renders on `/what-a-blueprint-is`, in the band anchored `#run`.

2. **`components/home/SectionLifecycle.tsx`** (beat 4 today) already calls the artifact

   > a reproducible, version-pinned specification you can inspect before your own harness
   > runs it

   which is claim B compressed into one adjective, inside a lead about something else.

3. **Nothing anywhere states the causal chain.** No blueprint → the harness improvises →
   runs are not comparable → a change cannot be attributed. That chain is the missing
   thing, and it is the strongest argument the project has for existing.

The gap is therefore on the landing, and it is an argument gap rather than a vocabulary
gap. The new beat states the chain and links to `RunLayers`, which already owns the
rigorous version. It does not restate the four layers.

---

## 2. Placement

A new **beat 2**, between `Hero` and `SectionBlueprint`.

```
1  Hero
2  NEW — the same run twice        ← this spec
3  This is a blueprint
4  Every node is a card
5  One registry, two loops
6  Two doors
```

The author was offered this position against three cheaper ones and picked it, with the
risk stated: at beat 2 the reader has not yet been shown a graph or a card, so the beat
argues about an artifact it has not displayed.

**Why it survives that risk.** The page's narrative becomes claim → objection → artifact →
contract → loops → doors. "Why not just a prompt?" is the objection a reader forms in the
second after the hero says "reusable blueprints for agent workflows", and answering it
where it is asked is worth more than answering it where the evidence sits. The figure was
then chosen (§3) specifically so that it requires no graph literacy, which is what makes
the position affordable.

This takes the landing from five beats to six. `app/page.tsx`'s header comment is a table
of where each of doc 2 §2.1's rungs went when the flat landing was rejected; that table
gets a row for this beat, so the next reader sees an addition that was argued rather than
one that crept in.

---

## 3. What the beat contains

Same shape as the two beats that follow it, so the three read as a sequence rather than as
three formats: `SectionHeading` (title and lead), one figure, then `BeatCaption` with a
single link.

### Copy

> ### The same run twice
>
> A prompt gives your harness a goal and lets it invent the route. A blueprint gives it the
> route: which agents run, what each one is handed, and what must never reach them.
>
> *[figure]*
>
> Pinned that way, two runs differ only where you changed the blueprint. That is what lets
> you swap one node, run it again in your own harness, and attribute the difference to the
> swap. Without a blueprint there is nothing held constant, so there is nothing to compare.
>
> `What surrounds a run →` → `/what-a-blueprint-is#run`

The lead is A. The caption is B, and its closing sentence is the author's "no blueprint, no
eval" said in the site's register and without the word `eval`, which `RunLayers` defines
precisely and this beat would be using loosely.

### Figure

A `FlowScene` (`components/viz/FlowGlyphs.tsx`), two panels, one goal each:

| panel | what it draws | colour |
|---|---|---|
| **from a prompt** | three traces diverging through different intermediate nodes | unlit greys, `--color-dim` / `--color-line-bright` |
| **from a blueprint** | three traces exactly coincident, reading as one bright path | `--color-blueprint-line` |

The whole figure is one claim: same goal, three runs, and the only difference is whether
the route was specified. It needs no graph literacy, which is the property that makes beat
2 a viable position for it.

**Colour reasoning.** The blueprint pole introduces itself here and beat 3 then owns it, so
a reader meets the cyanotype blue on the argument and again on the artifact. Cyan is
excluded because `app/globals.css` spends it on "you can act on this"; violet is reserved
for where a person acts (`HUMAN_PRESENCE_MARK`, guarded by
`components/ui/autonomy-surfaces.test.ts`); amber is "not built yet"; emerald is "resolved
against the engine". None of those is what this figure means.

The `h2` stays plain `text-fg`. Beats 3 and 4 colour their titles because each *is* one of
the two artifacts. This beat is the argument about both, so it claims neither pole.

---

## 4. The honesty position

The ledger in `components/site/honesty.test.ts` holds, `where: "open"`:

> nothing on this site measures a run, so these two filters describe a design rather than a
> behaviour

and `/reading-the-radar` adds, in the open: *"There is no runner and no endpoint."*

Claim B is the half that comes near this. The wording keeps it on the right side of the
line in three ways, and all three are load-bearing rather than stylistic:

1. **The running is explicitly the reader's**: "run it again in *your own harness*".
2. **The verb is `attribute`, not `measure` or `score`.** The beat claims the difference
   can be assigned to a cause, which is a property of holding the specification constant.
   It does not claim a number comes back.
3. **The word `eval` does not appear.** `RunLayers` defines it as running the blueprint
   through a harness and grading the result across a distribution. A landing beat using it
   loosely would blur a definition the site is careful about, and would imply the site
   performs one.

**Decision, confirmed with the author: no new limit statement, and no new ledger entry.**
The beat describes a property of the artifact rather than advertising a capability, so
there is nothing here that needs qualifying. The site-wide refusal is already carried by
the footer on every page — *"The registry publishes files. Your machine runs them."*

This is recorded so that a later pass changing this copy knows which sentence is doing the
honesty work. **If the caption is ever rewritten to promise a measurement, a comparison, or
a score, it needs a limit statement beside it and a ledger row**, per the repository's own
rule that a claim and its qualifier travel together.

---

## 5. Guards

Nothing here relaxes a guard. Two are extended because the site gained a drawing.

| Guard | What it requires | How this satisfies it |
|---|---|---|
| `components/home/beats.test.ts` | no `<table>`, no `<pre>`, no YAML-shaped `key:` runs on any beat | the beat renders prose and one SVG |
| `components/home/beats.test.ts` | no `opacity-0` in the prerendered HTML, so the finished state is what a reader without JS gets | figure is static; `phase="static"` covers the server, JS-off and reduced-motion readers alike |
| `components/viz/scene-labels.test.ts` | every file containing `<FlowScene` has a ROSTER entry | **adds one entry** |
| landing a11y case | `data-viz-labels="always"`, never `hover` | both panel labels are real DOM text |
| em-dash rule (`components/build/path.test.ts`) | `components/home` is a guarded tree; no em dash as a pause in new copy | the copy in §3 uses none |
| `components/site/anchors.test.ts` | a linked fragment must be rendered by its destination | `/what-a-blueprint-is#run` exists today and is already in the Learn rail |

---

## 6. Files

| File | Change |
|---|---|
| `components/home/SectionSameRun.tsx` | new: the beat and its figure |
| `components/home/index.ts` | export `SectionSameRun` |
| `app/page.tsx` | mount after `Hero`; add a row to the header comment's table recording why the landing went to six beats |
| `components/viz/scene-labels.test.ts` | ROSTER entry for the new `<FlowScene` |
| `components/home/beats.test.ts` | a case pinning claim A, claim B and both panel labels |

---

## 7. Done means

- `npm run build && npm test && npx tsc --noEmit && npm run lint` all green.
- The landing renders six beats, with the new one between the wordmark and the blueprint
  walk, verified in a browser at 1440px rather than only in the markup.
- Both claims and both panel labels are present in the prerendered HTML with no script.
- No ledger row added, removed or edited.
