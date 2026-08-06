# `/build` — restructure as a workspace

*2026-08-06, on `feat/core-engine-ontology-v0.1`. No code changed yet. Every count in this
document was read off the source or measured against the running build at this commit.*

---

## 0. The correction this is built on

The author, 2026-08-06, on the lead:

> the "about one hour" push away a user

and, on what the reader is actually meant to leave with:

> I want to stress that the dot files along the cards can be provided to claude code, codex
> or other harness and use to solve tasks of the user for the user problem. Such blueprint
> should be transparent to the user in some sense. Indeed, we plan to include a MCP call to
> the registry of blueprint such that via claude code, it can query the registry via a RAG
> system the best fitting blueprint.

**The deliverable of `/build` is something an agent can act on.** Not a blueprint the reader
has studied — a folder they hand to Claude Code, Codex or another harness, which then does
*their* work. The page's job is to get them to that folder, and to keep the folder legible
enough to trust.

This is not a new idea in the codebase. `components/build/AgentHandoff.tsx` already carries
the author's own framing from 2026-08-04 —

> the build objective is to show to a user how to create a blueprint and therefore showing a
> breakdown such that the user can understand and use it but also give such indications to
> its claude code (or gemini or codex) and build a blueprint of them

— and `lib/content/bundle-export.ts` already writes an `AGENTS.md` into every download. The
handoff exists. It is buried as "the other half of the last step", eight steps in.

---

## 1. What is wrong, measured

### 1.1 The reader passes four steps before their first decision

`components/build/steps.tsx` defines eight steps. Only **three are choices**:

| step | id | what it is |
|---|---|---|
| 1 | `whole` | reading |
| 2 | `node` | reading |
| 3 | `vocabulary` | reading |
| 4 | `output` | **choice 1** — `python \| react \| data \| docs` |
| 5 | `switch` | a demo, not a choice |
| 6 | `approval` | **choice 2** — `tester \| human` |
| 7 | `loop` | **choice 3** — cap `1..10`, default `3` |
| 8 | `download` | the exit |

4 × 2 × 10 = the 80 combinations `app/build/page.tsx` resolves at build time.

Step 5 is not a choice by its own admission — `steps.tsx` says of the demo toggle: *"Turn it
back off. Nobody would ship this, which is why it is not one of the choices."*

### 1.2 The teaching steps are a third copy

| `/build` step | already taught, in the same words and the same order, by |
|---|---|
| 1 The blueprint | `/what-a-blueprint-is` → **01 The graph** |
| 2 One node | `/what-a-blueprint-is` → **02 The cards** |
| 3 The vocabulary | `/what-a-blueprint-is` → **03 The vocabulary** |
| 5 The absent edge | `/spec/topology` — the five roles and the absent edge |

`/what-a-blueprint-is` is the item directly above `/build` in the Learn menu.

### 1.3 The hour measures something this page does not do

`app/build/page.tsx` states it plainly in its own header comment: *"The deliverable of the
hour is a factory the reader owns and can run."* The hour is the wiring-up and the first
green run, on the reader's machine. **This page is three radio choices and a download.**

The claim is not false. It is attached to the wrong activity and placed in the first two
words a reader meets, where it reads as the price of admission.

### 1.4 The stage is too small for its own drawing

The graph pane renders at roughly 400×300 inside a three-column grid. At that size
`fitView` fights the `minZoom` floor and the drawing crops: node names cut at both edges
("…ot Factory", "GHTED)"), and the `acceptance criteria` edge label sits on top of a node's
kind eyebrow. Four surfaces — graph, three-files list, raw DOT, score rail — compete for
one screen, and the DOT is clipped horizontally on top of that.

### 1.5 The chip row describes a sequence that should not exist

Eight equal chips in one flat row, seven of them wearing a `✓` before the reader has done
anything, and a `step 1 of 8` counter below. With three simultaneous controls there is no
sequence to be partway through.

---

## 2. The design

### 2.1 Shape

```
BUILD
Build your own blueprint
Start from the five-node starter and change it with three choices.
Every choice rewrites the graph, the cards and the vocabulary together.

┌─ You leave with one of two things ───────────────────────────┐
│  This starter, as files          A brief for your own goal   │
│  Hand the folder to Claude       Your agent writes a         │
│  Code — AGENTS.md included.      blueprint for your work.    │
└───────────────────────────────────────────────────────────────┘

[ the workspace ]
[ both exits, in full ]
[ where to next ]
```

### 2.2 The workspace

```
┌─ YOUR BLUEPRINT ────────────── Closed-loop · Security 4 · ≤9 calls ─┐
│                                                                     │
│        one large graph — uncropped, labels legible                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [ Graph ]  [ DOT • ]  [ Cards • ]  [ Vocabulary ]  [ Score ]       │
└─────────────────────────────────────────────────────────────────────┘

┌─ What does it build? ───────────────────────────────────────────────┐
│  ( ) Python script  ( ) React app  ( ) Data pipeline  ( ) Docs      │
│  ▸ why this matters                                                 │
├─ Who ends a run? ───────────────────────────────────────────────────┤
│  ( ) The tester decides     ( ) A person approves                   │
│  ▸ why this matters                                                 │
├─ How many turns before it gives up? ────────────────────────────────┤
│  1 ──────●──────── 10        cap 3                                  │
└─────────────────────────────────────────────────────────────────────┘
```

Three properties carry the design:

1. **The graph gets the width it needs.** It is the stage, not a column.
2. **The `•` markers make the page's own claim visible.** "Every choice changes all three"
   is currently a sentence taken on faith; here, changing the output kind lights up DOT,
   Cards and Vocabulary at once.

   *Marker semantics, stated so they cannot be guessed at:* a marker appears on every tab
   whose content differs from what it was immediately before the reader's last choice, and
   clears when that tab is opened. It reports the effect of one choice, not cumulative
   drift from the default — otherwise every tab would be marked forever after the first
   change and the signal would mean nothing.
3. **The controls stay put while the stage changes.** Today each choice sits on its own
   screen, so the reader never sees the before and after of their own decision.

The chip row, the `step N of 8` counter and the Back/Next pair are **deleted**.

The four non-choice steps become one line each, linking to the pages that own them. *Where
they live:* a single `.route-box` — the site's existing "this box leaves the page" primitive
— placed directly under the header band and above the workspace, holding both links
(`/what-a-blueprint-is` for the three parts, `/spec/topology` for the absent edge). One box,
two links, before the reader starts, so a reader who wants the theory meets it first and
everyone else scrolls past it once.

### 2.3 The two exits

**Take this starter** — `DownloadStep`, largely as-is, plus one sentence it does not
currently say plainly: the folder already contains an `AGENTS.md`, so it is already a thing
you hand to a coding agent.

**Have your agent write one** — `AgentHandoff`, promoted from footnote to co-equal. It keeps
its closing move: tell the agent to state what it left out, then point at `/upload`, which
runs the real validator in the reader's own tab. Nothing on this site can check what a model
returns, and the page must not imply otherwise.

Under both, one signpost for the planned registry-over-MCP retrieval, wearing
`ComingSoonBadge`. **Stated as coming, never as available** — no MCP server exists.

### 2.4 The lead

The hour moves to the download exit, where it is true:

> You now have the folder. Wiring it to your own agent runner and getting a first green run
> takes about an hour.

The lead promises the artefact and names the three choices' subject instead.

---

## 3. Disposition of every file

| file | disposition |
|---|---|
| `lib/starter/*` | **untouched** — the model, the 80 variants, the bundle writer |
| `components/build/choices.ts` | keep; drop the demo-switch entry |
| `components/build/state.ts` | keep — `buildState` already derives everything from the three choices |
| `components/build/controls.tsx` | keep `RadioChoice`, `CapSlider`, `CapReading`; delete `DemoSwitch` |
| `components/build/ChoiceGraphPane.tsx` | becomes the stage — full width, no crop |
| `components/build/BuildPanes.tsx` | becomes the DOT / Cards tab bodies |
| `components/build/VocabularyPane.tsx` | becomes the Vocabulary tab |
| `components/build/ScorePanel.tsx` | `ScoreStrip` → stage header; panel → Score tab |
| `components/build/DownloadStep.tsx` | exit 1 |
| `components/build/AgentHandoff.tsx` | exit 2, promoted |
| `components/build/GuidedPath.tsx` | **replaced** by `BuildWorkspace.tsx` |
| `components/build/steps.tsx` | **deleted** — teaching steps become links, choice intros become `▸ why this matters` |
| `components/build/path-state.ts` | **deleted** — no path, so no move rules, levels or markers |
| `components/build/LifecycleStrip.tsx` | **deleted** — only `steps.tsx` mounts it |

**Blast radius is contained to `components/build/` and `app/build/page.tsx`.** Verified: the
only imports of `components/build/*` from outside that directory are `ALL_COMBINATIONS` and
`GuidedPath`, both in `app/build/page.tsx`. Every other apparent use is a comment reference.

Six such comments — in `components/upload/UploadFlow.tsx` (×3),
`components/install/InstallTabs.tsx` (×2) and `components/panes/SkeletonPane.tsx` (×1) —
name files this spec deletes or renames, and **must be updated in the same commit**. Stale
route and file references have survived three passes in this repo.

---

## 4. Testing

The load-bearing guarantee is not the steps. It is: **every one of the 80 combinations
resolves through the real engine, and one error-severity diagnostic fails the build.** That
lives in `app/build/page.tsx` and is unchanged by this work.

| test | disposition |
|---|---|
| `path.test.ts` | → `workspace.test.ts`. Keeps every assertion walking `ALL_COMBINATIONS` through `loadBundle`. Drops only assertions about step order, move rules and chip markers — they will be asserting about deleted concepts. |
| `path-state.test.ts` | deleted with its subject |
| `agent-brief.test.ts` | unchanged — the brief's vocabulary guarantee is independent of layout |
| **new** | the change markers are honest: changing `output` must mark DOT, Cards **and** Vocabulary. This is the page's central claim and would otherwise rot silently. |
| **new** | the graph stage renders every node label uncropped at 1440 and 390 — the defect in §1.4, guarded so it cannot return |

**Equivalence check before the work is called done:** for a fixed set of choices, the bundle
produced after the restructure must be **byte-identical** to the bundle produced before it.
The presentation changes; the artefact must not.

---

## 5. Risks

- **~60KB of tested code is deleted.** Mitigated by the equivalence check above: everything
  deleted is presentation, and the engine, variants, bundle writer and 80-combination proof
  are untouched.
- **A reader can now reach the choices without meeting "what a node is".** Accepted. The
  choices are legible without the theory (`python | react | data | docs` needs none), and the
  `▸ why this matters` disclosures catch anyone who wants depth.
- **`ChoiceGraphPane` at full width is real geometry work**, not a container swap. The
  current crop comes from a `minZoom` floor fighting a 400px pane; both need re-tuning
  together, and the new label-crop guard is what holds it.

---

## 6. Out of scope

- The MCP registry server and its RAG retrieval. Signposted as coming; not built, not
  promised.
- `/upload` and `/install`, except for the six stale comments in §3.
- The engine, the ontology, and the six-metric analysis.
