"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ContentKind } from "@/lib/types";
import {
  CORE_ONTOLOGY,
  hasErrors,
  loadBundle,
  ontologyView,
  sortDiagnostics,
  summarize,
  type LoadBundleResult,
  type OntologyTerm,
} from "@/lib/core";
import { autonomyStatement, cx, METRIC_SOURCE_META } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KindBadge } from "@/components/ui/Badge";
import { TagPill } from "@/components/ui/TagPill";
import { PhaseCoverageBadge } from "@/components/ui/PhaseCoverage";
import { locationLabel } from "@/components/ui/DiagnosticList";
import {
  BundleDropzone,
  assembleBundle,
  classifyBundle,
  detailsFromManifest,
  slugify,
  type BundleDetails,
  type UploadFile,
} from "./BundleDropzone";
import { requiredAgents, requiredTools } from "@/lib/graph-seed";
import { bundleProgress } from "./progress";
import { ValidationReport, verdictLine } from "./ValidationReport";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-26): PUT /api/bundles/{owner}/{slug}/agents-md
// TODO(SEAM-27) (cited at line 769): n/a — File API, then SEAM-30 for the server counterpart
// TODO(SEAM-28) (cited at line 606): GET /api/blueprints/{slug}/as-upload
// TODO(SEAM-30) (cited at line 555): POST /api/validate/bundle
// TODO(SEAM-31) (cited at line 130): folded into SEAM-30
// TODO(SEAM-32) (cited at line 1040): POST /api/validate/report
// TODO(SEAM-33) (cited at line 69): POST /api/validate/card, POST /api/validate/ontology
// TODO(SEAM-34) (cited at line 600): folded into SEAM-27
// TODO(SEAM-35) (cited at line 720): GET /api/slugs/available?slug=
// TODO(SEAM-69) (cited at line 1146): POST /api/bundles

/* ------------------------------------------------------------------ */
/*  Static config                                                      */
/* ------------------------------------------------------------------ */

type StepId = 1 | 2 | 3 | 4;

/**
 * The four steps, each with the word the rail prints and the sentence the step's own
 * heading uses.
 *
 * `heading` is new, and it is doing three jobs at once. Every step of this wizard is
 * between 1300 and 3000 pixels tall and the advance control is at the bottom of it, so
 * `setStep` alone swapped everything above the viewport and left the reader mid-form on
 * content they had never seen, with the rail a thousand pixels over their head. The
 * heading takes focus on a step change, which puts the scroll position at the top of the
 * new step, announces the step to a screen reader, and gives the panel body the
 * level-two heading its outline never had. `/build` was the sibling wizard and solved the
 * same problem the same way; it is one workspace now
 * (`components/build/BuildWorkspace.tsx`), so this is the last multi-step flow on the site
 * and the only place the pattern still has to hold.
 */
const STEPS: { id: StepId; label: string; heading: string }[] = [
  { id: 1, label: "Upload", heading: "Upload the bundle" },
  { id: 2, label: "Details", heading: "Describe it" },
  { id: 3, label: "Preview", heading: "What the validator found" },
  { id: 4, label: "Publish", heading: "The registry entry" },
];

/**
 * The three registry surfaces. Only the first has an upload path today: the wizard
 * runs `resolveBundle`, which joins a DOT to the cards it pins, and a lone card or a
 * vocabulary extension is a different validation entirely. Saying so beats a selector
 * that quietly does nothing.
 */
const KINDS: {
  key: ContentKind;
  label: string;
  hint: string;
  color: string;
  ready: boolean;
}[] = [
  {
    key: "blueprint",
    label: "Blueprint",
    hint: "Full blueprint graph",
    color: "var(--color-cyan)",
    ready: true,
  },
  {
    key: "node",
    label: "Node",
    hint: "One reusable node card",
    color: "var(--color-amber)",
    ready: false,
  },
  {
    key: "ontology",
    label: "Ontology",
    hint: "Typed vocabulary",
    color: "var(--color-violet)",
    ready: false,
  },
];

/** Lower-case noun for a content kind, used across the flow's copy. */
const KIND_NOUN: Record<ContentKind, string> = {
  blueprint: "blueprint",
  node: "node card",
  ontology: "ontology",
};

const inputCls =
  "w-full bg-surface-2 border border-line rounded-md px-3 py-2 text-sm text-fg placeholder:text-dim transition-colors focus:border-cyan focus:outline-none";

/* There is no `fieldLabelCls` here any more, and there must not be one again. It held
   `font-mono text-[11px] uppercase tracking-[0.14em] text-dim` — a fourth mono tier,
   identical to `.label` in size, weight and colour and differing only in 0.04em of
   tracking, which is the one difference a reader cannot name but can see when the two
   sit on the same screen. This wizard renders labels beside `.label` and `.label-lead`
   from `BundleDropzone`'s file manifest on step 1, so the fourth tier was visible as a
   wobble rather than as a rank. Every field label below is `.label`; a title that a
   reader is meant to start at is `.label-lead`. app/globals.css defines both. */

/**
 * One vocabulary view per selection. `isA` memoizes per instance, so keeping the same view
 * across every keystroke-triggered re-validation is both cheaper and the only way two runs
 * of the validator are provably against identical terms — the same reason `lib/content`
 * builds exactly one for the whole static build.
 *
 * It is rebuilt only when the dropped `extensions.yaml` changes. Doc 3 §7's local terms
 * have to be layered over the core here for the same reason the loader layers them at
 * build time: a bundle whose card declares `lupo/pii-handling` and is read against the
 * core alone loses that card to `card/unknown-term` and comes out at different scores,
 * which would mean this page rejecting the folder the blueprint pages hand out.
 */
function viewFor(terms: readonly OntologyTerm[]) {
  return ontologyView(CORE_ONTOLOGY, terms);
}

const EMPTY_DETAILS: BundleDetails = {
  title: "",
  summary: "",
  description: "",
  category: "",
  tags: [],
};

/* ------------------------------------------------------------------ */
/*  The report, as a file                                              */
/* ------------------------------------------------------------------ */

/**
 * One file as something a browser will save, the way `components/build/DownloadStep.tsx`
 * builds every one of its nine: a `data:` URL over the text, assembled in the tab. There
 * is no server to write a file on request and nothing here needs one.
 */
function dataHref(text: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

/**
 * "planning, testing", or a phrase for the empty side.
 *
 * Both empty cases are stated as facts about the graph rather than as a blank, for the
 * reason `components/ui/PhaseCoverage.tsx` sets out at length: coverage describes what a
 * factory does, and a phase with no node in it is scope, never a shortfall.
 */
function phaseList(ids: readonly string[], none: string): string {
  return ids.length === 0 ? none : ids.join(", ");
}

/**
 * `REPORT.md`: what the engine said about these exact bytes, in a file the reader keeps.
 *
 * The route with the highest effort cost used to end with the lowest payload — a
 * three-line notice and two buttons that both discarded the run. `/build` ends in nine
 * downloadable files; this ends in one, and the one is the only thing this route
 * produces that did not exist before the reader arrived.
 *
 * Every figure below is quoted from `result`, never recomputed and never rounded into a
 * claim the validator did not make. A bundle that did not resolve has no reading to
 * report, and the report says that in as many words rather than leaving the two headings
 * out and letting the omission read as a pass.
 *
 * ── The gate is `resolved`, and it used to be `analysis === undefined` ──
 * `resolveBundle` degrades: a bundle whose DOT parsed comes back WITH an `analysis`
 * whatever else went wrong with it, computed over the nodes that resolved. So a folder
 * three cards into eight built a file headed "## Autonomy" carrying a fraction over
 * two-fifths of the graph — the number this very page refuses to put on screen, written
 * into the one artefact a reader keeps and quotes.
 *
 * Nobody has read that file: the only control that offers it sits behind a Publish button
 * `blocked` keeps disabled, so an unresolved bundle never reaches the screen the download
 * is on. A gate in another component is not a reason for this one to compute the wrong
 * thing — that is exactly the arrangement that ships the moment either side moves. Both
 * now withhold on the same condition, the one `ValidationReport` calls `usable`.
 */
function reportMarkdown(args: {
  result: LoadBundleResult;
  title: string;
  slug: string;
  kindNoun: string;
}): string {
  const { result, title, slug, kindNoun } = args;
  const { blueprint, analysis } = result;
  const resolved = blueprint !== undefined && analysis !== undefined && !hasErrors(result.diagnostics);
  const progress = bundleProgress(result);

  const out: string[] = [];
  out.push(`# Validation report: ${title}`);
  out.push("");
  out.push(
    "Produced by DarkPrint inside a browser tab, over the bytes named below. Nothing was uploaded and nothing was saved, so this file is the whole of the record.",
  );
  out.push("");

  out.push("## The bundle");
  out.push("");
  out.push(`- kind: ${kindNoun}`);
  out.push(`- slug: ${slug}`);
  out.push(
    `- digest: ${blueprint === undefined ? "not computed, the bundle did not resolve" : blueprint.digest}`,
  );
  if (blueprint !== undefined) {
    out.push(`- graph: ${blueprint.nodes.length} nodes, ${blueprint.edges.length} edges`);
  }
  if (progress.state === "unfinished") {
    out.push(`- nodes carded: ${progress.placed} of ${progress.total}`);
  }
  out.push(
    `- verdict: ${
      progress.state === "resolves"
        ? "bundle resolves"
        : progress.state === "unfinished"
          ? "bundle unfinished, still being written"
          : "bundle rejected"
    }, ${verdictLine(result)}`,
  );
  out.push("");

  if (!resolved || analysis === undefined) {
    out.push("## Autonomy and static risk");
    out.push("");
    out.push(
      progress.state === "unfinished"
        ? `Not computed yet. ${progress.waiting} of the graph's ${progress.total} nodes have no card in the folder, and a reading taken over nodes the engine could not open would have nothing behind it. Write the rest and run this again.`
        : "Not computed. DarkPrint will not put a number on a graph whose references it could not check, so the diagnostics below are the whole of what this run produced.",
    );
    out.push("");
  } else {
    out.push("## Autonomy");
    out.push("");
    out.push(
      `${analysis.autonomy.label}. ${analysis.autonomy.autonomousNodes} of ${analysis.autonomy.totalNodes} nodes run unattended.`,
    );
    out.push("");
    out.push(autonomyStatement(analysis.autonomy.rationale));
    out.push("");

    out.push("## Static risk exposure");
    out.push("");
    out.push(
      `Level ${analysis.security.level}, ${analysis.security.raw.toFixed(2)} of 4 points kept.`,
    );
    out.push("");
    out.push(analysis.security.rationale);
    out.push("");

    out.push("## Phase coverage");
    out.push("");
    out.push(
      "Which of the five lifecycle phases this graph acts in. A description of scope, not a score.",
    );
    out.push("");
    out.push(
      `- has nodes in: ${phaseList(analysis.phaseCoverage.covered, "none of the five")}`,
    );
    out.push(
      `- no node in: ${phaseList(analysis.phaseCoverage.missing, "none, this graph acts in all five")}`,
    );
    out.push("");
  }

  out.push("## What the validator reported");
  out.push("");
  if (result.diagnostics.length === 0) {
    out.push("Nothing. No error, no warning, no note.");
    out.push("");
  } else {
    for (const diagnostic of result.diagnostics) {
      const where = locationLabel(diagnostic.location);
      out.push(`- **${diagnostic.severity}** \`${diagnostic.code}\` ${diagnostic.message}`);
      if (where !== undefined) out.push(`  - at: ${where}`);
      if (diagnostic.hint !== undefined) out.push(`  - hint: ${diagnostic.hint}`);
    }
    out.push("");
  }

  out.push("## What is not in here");
  out.push("");
  out.push(
    "Two of the six axes are read off the graph and both are above. Efficacy, reliability and transparency come from weighted community and validator votes; cost and time are reported by whoever runs the graph, and the platform never sees the execution.",
  );
  out.push("");
  out.push(
    "This bundle was resolved against the curated core vocabulary only. A blueprint in the archive is resolved against the core plus the terms its release adds in its own namespace, so a graph using one of those comes back here with the term unknown and a static risk reading computed without it.",
  );
  out.push("");

  return out.join("\n");
}

/** A real bundle out of the archive, handed down by the server page (§5 step 1). */
export interface ExampleBundle {
  /** The blueprint's title, named on the "load an example" button. */
  title: string;
  /** Manifest, topology and every pinned card, named the way the archive names them. */
  files: UploadFile[];
}

/* ------------------------------------------------------------------ */
/*  Chip field (tags)                                                  */
/* ------------------------------------------------------------------ */

function ChipField({
  id,
  label,
  placeholder,
  values,
  onAdd,
  onRemove,
  accent = "var(--color-cyan)",
}: {
  /** The input's id. The `<label>` sits outside the box the input lives in, so the
      association has to be explicit — clicking the label focuses the field. */
  id: string;
  label: string;
  placeholder: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  accent?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim().replace(/,$/, "").trim();
    if (v) onAdd(v);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-2 focus-within:border-cyan">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-fg"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: accent }}
              aria-hidden
            />
            {v}
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${v}`}
              className="ml-0.5 text-dim transition-colors hoverable:hover:text-signal"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
              onRemove(values.length - 1);
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit();
          }}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-fg placeholder:text-dim focus:outline-none"
        />
      </div>
    </div>
  );
}

/**
 * The same chip row, read-only. What the graph needs is a property of the cards it
 * pins, not something an author types in — so it is shown, not asked for.
 */
function DerivedChips({
  label,
  values,
  empty,
  accent,
}: {
  label: string;
  values: readonly string[];
  empty: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label">{label}</span>
      <div className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-md border border-dashed border-line bg-surface-2/40 px-2 py-2">
        {values.length === 0 ? (
          <span className="px-1 text-sm text-dim">{empty}</span>
        ) : (
          values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-fg"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: accent }}
                aria-hidden
              />
              {v}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */

/**
 * The four steps as a jump bar. A step ahead of the current one is unreachable until
 * there is a topology to read, and it says so the same way the footer's Next button
 * does — `disabled`, plus the reason in the accessible name. Two controls gating on
 * one predicate must not disagree about how they express it.
 */
function StepIndicator({
  step,
  canAdvance,
  onJump,
}: {
  step: StepId;
  /** Whether the selection carries a `.dot`; without one nothing downstream exists. */
  canAdvance: boolean;
  onJump: (id: StepId) => void;
}) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = s.id < step;
        const active = s.id === step;
        const locked = s.id > step && !canAdvance;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onJump(s.id)}
              disabled={locked}
              aria-label={
                locked
                  ? `Step ${s.id}: ${s.label}. Not available yet: add a .dot topology on step 1 first.`
                  : `Step ${s.id}: ${s.label}`
              }
              className={cx(
                "group flex items-center gap-2.5 text-left",
                locked && "cursor-not-allowed opacity-50",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors",
                  active && "border-cyan bg-cyan/10 text-cyan",
                  done && "border-emerald/50 bg-emerald/10 text-emerald",
                  !active && !done && "border-line bg-surface-2 text-dim",
                  !active &&
                    !done &&
                    !locked &&
                    "hoverable:group-hover:border-line-bright",
                )}
              >
                {done ? "✓" : s.id}
              </span>
              {/* The ACTIVE step keeps its word at every width; only the other three
                  drop below `sm`. The label used to be `hidden sm:block` outright, so at
                  390px the rail was four unlabelled circles: the reader could not read
                  which step they were on, and the reason steps 2 to 4 were locked lived
                  only in an `aria-label` nobody sees. It reads `1 ● UPLOAD 2 3 4` now,
                  which names where you are and still fits the phone.

                  `.label`, not the 12px/0.12em string that was here: a step name in a
                  rail is a meta label, which is the tier's own job, and the fourth and
                  fifth mono spellings on this route were both in this file. `.label`
                  carries `--color-dim`, and `text-fg` still wins on the active step —
                  the primitives live in `@layer components` and a utility outranks a
                  layered rule, which is the whole point of wave 1's layering. */}
              <span
                className={cx(
                  "label transition-colors",
                  active ? "text-fg" : "hidden sm:block",
                  !active && !locked && "hoverable:group-hover:text-muted",
                )}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={cx(
                  "h-px flex-1",
                  s.id < step ? "bg-emerald/40" : "bg-line",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Main flow                                                          */
/* ------------------------------------------------------------------ */

/**
 * Four steps, and after the first one everything on screen is the engine's own answer:
 * the files are read in this tab, `loadBundle` runs in this tab, and the schematic and
 * the two computed scores are the ones the registry would store. Nothing is uploaded —
 * step 4 says so in as many words.
 */
export function UploadFlow({ example }: { example: ExampleBundle }) {
  const [step, setStep] = useState<StepId>(1);
  const [kind, setKind] = useState<ContentKind>("blueprint");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [details, setDetails] = useState<BundleDetails>(EMPTY_DETAILS);
  const [submitted, setSubmitted] = useState(false);

  /* ---------- the whole pipeline, derived ---------- */

  const parts = useMemo(() => classifyBundle(files), [files]);
  const bundle = useMemo(() => assembleBundle(parts, details), [parts, details]);
  const ontology = useMemo(() => viewFor(parts.terms), [parts.terms]);
  const result: LoadBundleResult | undefined = useMemo(() => {
    if (bundle === undefined) return undefined;
    const loaded = loadBundle(bundle, { ontology });
    // Doc 3 §7: a local term the core does not subsume is "ignorata silenziosamente, che è
    // il peggior esito possibile" — every card using it validates and every score is
    // quietly wrong. `loadBundle` deliberately leaves defects in the vocabulary to
    // whoever built the view, so the caller that built it reports them, exactly as the
    // build-time loader does with the archive's own.
    const vocabulary = parts.vocabulary === undefined ? [] : ontology.validate();
    if (vocabulary.length === 0) return loaded;
    return {
      ...loaded,
      diagnostics: sortDiagnostics([...loaded.diagnostics, ...vocabulary]),
    };
  }, [bundle, ontology, parts.vocabulary]);

  const errorCount = result === undefined ? 0 : summarize(result.diagnostics).error;
  const blocked = result === undefined || hasErrors(result.diagnostics);
  const canAdvance = parts.dot !== undefined;

  /* The same three-state reading `ValidationReport` prints on the Preview step, so the
     Publish step and the footer counter cannot describe the bundle differently from the
     panel two clicks back. `components/upload/progress.ts` holds the predicate; both
     files were writing "blocked by 5 errors" at authors who were mid-draft. */
  const progress = useMemo(
    () => (result === undefined ? undefined : bundleProgress(result)),
    [result],
  );
  const unfinished = progress?.state === "unfinished";

  // Resolution degrades rather than stopping (§8), so these are readable even while the
  // bundle still carries errors — they just describe the part that did resolve.
  const agents = useMemo(
    () => (result?.blueprint === undefined ? [] : requiredAgents(result.blueprint)),
    [result],
  );
  const tools = useMemo(
    () => (result?.blueprint === undefined ? [] : requiredTools(result.blueprint)),
    [result],
  );

  /* ---------- editing ---------- */

  /* A dropped `blueprint.yaml` answers most of step 2, so the form is filled from it
     the moment it lands — after which the form is the source of truth and wins. */
  const takeFiles = useCallback((next: UploadFile[]) => {
    setFiles(next);
    const doc = classifyBundle(next).manifestDoc;
    if (doc !== undefined) setDetails((d) => ({ ...d, ...detailsFromManifest(doc) }));
  }, []);

  const loadExample = useCallback(() => {
    // Replaces rather than merges: an example dropped on top of a half-made selection
    // is two bundles in a trench coat, and the validator would be right to say so.
    setDetails(EMPTY_DETAILS);
    takeFiles([...example.files]);
  }, [example, takeFiles]);

  function setField<K extends keyof BundleDetails>(key: K, value: BundleDetails[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  function addTag(value: string) {
    setDetails((d) => (d.tags.includes(value) ? d : { ...d, tags: [...d.tags, value] }));
  }
  function removeTag(index: number) {
    setDetails((d) => ({ ...d, tags: d.tags.filter((_, i) => i !== index) }));
  }

  /** Everything gone: a different project, typed from scratch. */
  function reset() {
    setSubmitted(false);
    setStep(1);
    setKind("blueprint");
    setFiles([]);
    setDetails(EMPTY_DETAILS);
  }

  /**
   * The files go, the manifest stays.
   *
   * The success screen's only way back used to be `reset`, which wiped the title, the
   * summary, the description, the category and every tag along with the bundle — so a
   * second bundle out of the same project meant retyping the manifest that the first one
   * had already filled in. A dropped `blueprint.yaml` overwrites these fields the moment
   * it lands (see `takeFiles`), so keeping them costs nothing and is never stale.
   */
  function validateAnother() {
    setSubmitted(false);
    setStep(1);
    setFiles([]);
  }

  /* ---------- navigation ---------- */

  function jump(target: StepId) {
    // Can always step back; can only go forward once there is a topology to read.
    if (target > step && !canAdvance) return;
    setStep(target);
  }

  function next() {
    if (step < 4 && (step !== 1 || canAdvance)) {
      setStep((s) => (s + 1) as StepId);
    }
  }
  function back() {
    if (step > 1) setStep((s) => (s - 1) as StepId);
  }

  /* ---------- the step heading takes the reader with it ----------
     Each step here is between 1300 and 3000 pixels tall and both advance controls sit at
     the bottom of it, so a bare `setStep` swapped the whole panel above the viewport and
     left the reader looking at the middle of a form they had never seen, with the rail
     out of sight overhead. Focus moves to the new step's heading, which announces the
     step and gives the panel the heading level its outline was missing.

     The scroll is done by hand rather than left to the focus, and that is not belt and
     braces — measured on this page, `focus()`'s own scroll-into-view lands the heading
     431px down the viewport on one step and does not move at all on the next two. It has
     to walk every scrollable ancestor, and `body { overflow-x: hidden }` in
     `app/globals.css` makes the body one of them, so the amount it scrolls depends on
     which box it decided to move. One `window.scrollTo` against the heading's own
     position is exact on every step. `behavior` is deliberately left out so the CSS
     decides: `html` is `scroll-behavior: smooth`, and the reduced-motion block turns it
     to `auto` — the reader who asked for less motion is not overruled from script.

     Skipped while the step has not changed: nobody navigated to arrive.

     ── Why this is keyed on the step and not on "have I mounted yet" ──
     It was a `mounted` ref that flipped false to true on the first run and returned, and
     that guard does not survive a second mount of the same component instance. React
     StrictMode runs every effect twice on mount — setup, cleanup, setup — against the same
     instance, so the refs persist: run one consumed the guard, run two sailed past it and
     scrolled. `reactStrictMode` defaults to on, so `next dev` did this on every arrival at
     `/upload` and a reader who clicked "Publish" landed 664px down the page, looking at
     "Upload the bundle" with the header and the page's own lead scrolled off. Measured, in
     both modes: dev put `window.scrollY` at 664 and focus on the step heading; the
     production build put it at 0. It was invisible in the built site and wrong every time
     locally, which is the worst version of this bug to own.

     Keying on the step value fixes it by making the effect idempotent, which is what
     StrictMode is checking for: re-running it with a step that has already been scrolled to
     is a no-op, however many times React chooses to run it. It is also the more direct
     statement of the intent — the scroll belongs to a step CHANGE, and "first mount" was
     only ever a proxy for "the step is still the one we started on".

     Initialised to the starting step rather than to null, so mount needs no special case at
     all. */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrolledFor = useRef<StepId>(step);
  useEffect(() => {
    if (scrolledFor.current === step) return;
    scrolledFor.current = step;
    const heading = headingRef.current;
    if (heading === null) return;
    heading.focus({ preventScroll: true });
    // 80px is the site's one "clear of the sticky header" constant — the same number
    // every `lg:sticky lg:top-20` on the site uses.
    const y = heading.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y < 0 ? 0 : y });
  }, [step]);

  // The slug the registry would key on. A dropped manifest owns its own — §4 makes it
  // the blueprint's identity — so only a synthesised manifest gets one off the title.
  const slug =
    bundle?.manifest.slug ??
    (details.title.trim() === "" ? "untitled-blueprint" : slugify(details.title));

  /** What the reader is looking at, named the way the report and the card both name it. */
  const reportTitle =
    details.title.trim() || bundle?.manifest.title || `Untitled ${KIND_NOUN[kind]}`;

  /** The report the success screen hands over, built only once there is one to hand. */
  const reportHref = useMemo(() => {
    if (result === undefined) return undefined;
    return dataHref(
      reportMarkdown({ result, title: reportTitle, slug, kindNoun: KIND_NOUN[kind] }),
    );
  }, [result, reportTitle, slug, kind]);

  return (
    <div className="panel overflow-hidden">
      {/* Header: step indicator */}
      <div className="border-b border-line bg-surface-2/40 px-5 py-4 sm:px-8">
        <StepIndicator step={step} canAdvance={canAdvance} onJump={jump} />
      </div>

      {/* Body */}
      <div className="px-5 py-8 sm:px-8">
        {/* The step, named. `tabIndex={-1}` so the effect above can move focus here on
            every step change.

            `w-fit` rather than `outline-none`, and the difference is worth writing down.
            The focus ring is unlayered in `app/globals.css` on purpose — a keyboard ring
            a component's own utilities can outrank is not a guarantee — so `outline-none`
            in the utilities layer does not actually suppress it, it only looks like it
            does. Which is the right outcome anyway: a reader who arrived here by pressing
            Next on the keyboard should be shown where focus went. What `w-fit` fixes is
            the shape of that answer. A block-level heading takes the panel's full width,
            so the ring drew a 1100px cyan rectangle that read as an input; hugging the
            words it reads as a position. A pointer never sees it at all, because a
            programmatic focus after a mouse click does not match `:focus-visible`. */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="w-fit font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]"
        >
          {STEPS[step - 1].heading}
        </h2>

        <div className="mt-10">
        {step === 1 && (
          <div className="flex flex-col gap-8">
            <BundleDropzone
              files={files}
              parts={parts}
              onChange={takeFiles}
              onLoadExample={loadExample}
              exampleLabel={example.title}
            />

            {/* Content kind selector */}
            <div className="flex flex-col gap-3">
              <span className="label" id="content-type-label">
                Content type
              </span>
              <div
                role="group"
                aria-labelledby="content-type-label"
                className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1"
              >
                {KINDS.map((k) => {
                  const active = kind === k.key;
                  return (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setKind(k.key)}
                      disabled={!k.ready}
                      aria-pressed={active}
                      aria-label={
                        k.ready
                          ? `${k.label}: ${k.hint}`
                          : `${k.label}: ${k.hint}. This flow does not accept one yet.`
                      }
                      /* Both hovers gated: this selector is a tap target on the first
                         step, and an ungated `hover:` latches on a phone — the pressed
                         kind keeps the lit state right up to the route change, which on
                         a three-way selector reads as two things being chosen at once. */
                      className={cx(
                        "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-surface-3 text-fg shadow-[inset_0_0_0_1px_var(--color-line-bright)]"
                          : "text-muted hoverable:hover:text-fg",
                        !k.ready &&
                          "cursor-not-allowed opacity-50 hoverable:hover:text-muted",
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: active ? k.color : "var(--color-line-bright)",
                        }}
                        aria-hidden
                      />
                      <span className="flex flex-col items-start leading-tight">
                        <span className="font-medium">{k.label}</span>
                        <span className="text-[11px] text-dim">
                          {k.ready ? k.hint : `${k.hint} · not yet`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="max-w-xl text-xs leading-relaxed text-dim">
                The validator joins a DOT to the cards it pins, so a whole bundle is what
                it knows how to read. A card on its own and a vocabulary extension each
                need their own check, and neither is wired up yet.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid max-w-3xl gap-5">
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              These fields become the bundle&rsquo;s manifest. A{" "}
              <span className="font-mono text-cyan">blueprint.yaml</span> in the
              selection fills them in for you;{" "}
              {parts.manifest === undefined
                ? "there is none here, so a minimal one is synthesised from what you type."
                : `they were read from ${parts.manifest.name}.`}
            </p>

            <div className="flex flex-col gap-2">
              <label className="label" htmlFor="bp-title">
                Title
              </label>
              <input
                id="bp-title"
                value={details.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Consensus line, multi-agent conflict resolution"
                className={inputCls}
              />
              <p className="font-mono text-[11px] text-dim">
                slug <span className="text-muted">{slug}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="label" htmlFor="bp-summary">
                Summary
              </label>
              <textarea
                id="bp-summary"
                value={details.summary}
                onChange={(e) => setField("summary", e.target.value)}
                rows={2}
                placeholder="One sentence a reviewer sees in the gallery card."
                className={cx(inputCls, "resize-y")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="label" htmlFor="bp-description">
                Description
              </label>
              <textarea
                id="bp-description"
                value={details.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={5}
                placeholder="What the blueprint does, its acceptance criteria, and where the closed loop makes its judgement calls."
                className={cx(inputCls, "resize-y")}
              />
            </div>

            <div className="flex flex-col gap-2 sm:max-w-xs">
              <label className="label" htmlFor="bp-category">
                Category
              </label>
              <input
                id="bp-category"
                value={details.category}
                onChange={(e) => setField("category", e.target.value)}
                placeholder="Coordination"
                className={inputCls}
              />
            </div>

            <ChipField
              id="bp-tags"
              label="Tags"
              placeholder="Type a tag, press Enter"
              values={details.tags}
              onAdd={addTag}
              onRemove={removeTag}
              accent="var(--color-cyan)"
            />

            <div className="flex flex-col gap-5 border-t border-line pt-5">
              <p className="max-w-xl text-sm leading-relaxed text-muted">
                <span className="text-fg">Read off your cards.</span> What the graph
                needs is a property of the nodes it instantiates, not something to
                declare by hand, so the registry computes it instead of asking.
              </p>

              <DerivedChips
                label="Required agents"
                values={agents}
                empty={
                  canAdvance
                    ? "No card in this bundle names a model or an agent."
                    : "Select a bundle on the first step."
                }
                accent="var(--color-violet)"
              />

              <DerivedChips
                label="Required tools"
                values={tools}
                empty={
                  canAdvance
                    ? "No card in this bundle asks for a tool."
                    : "Select a bundle on the first step."
                }
                accent="var(--color-amber)"
              />
            </div>
          </div>
        )}

        {step === 3 &&
          (result === undefined ? (
            <div className="rounded-lg border border-line bg-surface-2/40 p-5">
              <h3 className="font-display text-xl font-semibold text-fg">
                Nothing to validate
              </h3>
              <p className="prose-lane mt-4 text-sm leading-relaxed text-muted">
                A bundle without a <span className="font-mono text-cyan">.dot</span> is
                not an incomplete bundle, it is not one at all. Go back to the first
                step and add the topology.
              </p>
            </div>
          ) : (
            /* `dot` is the reader's own bytes, and it is only read when the parse failed
               outright: `result.blueprint` is absent in exactly that case and it is the
               only other place the source lives, so without this the one rejection whose
               whole complaint is a character position had no file to point at. */
            <ValidationReport
              result={result}
              {...(parts.dot === undefined ? {} : { dot: parts.dot.text })}
            />
          ))}

        {step === 4 &&
          (submitted ? (
            /* ── The handover ──
               This screen used to replace the entire step with a three-line notice and
               two buttons, both of which threw the run away: one left the route and the
               other called `reset`, which wiped the files, the kind, the manifest and the
               step. So the route with the highest effort cost on the site ended with the
               lowest payload, while `/build` — where the reader typed nothing — ends in
               nine downloadable files.

               What the engine computed stays mounted, and it leaves with the reader as
               `REPORT.md`. The demo disclosure below is unchanged in fact and changed in
               framing: nothing was sent and nothing was saved is still the first thing it
               says, but it is now the sentence that explains why the file matters rather
               than an apology for the button. */
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-start gap-4 sm:flex-row">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald/40 bg-emerald/10 text-2xl text-emerald"
                  aria-hidden
                >
                  ✓
                </span>
                <div className="flex min-w-0 flex-col gap-3">
                  <h3 className="font-display text-xl font-semibold text-fg">
                    Validated. Take it with you.
                  </h3>
                  <p className="prose-lane text-sm leading-relaxed text-muted">
                    <span className="font-mono text-amber">demo</span>: nothing was sent
                    and nothing was saved, because there is no registry backend yet. That
                    is exactly why the report downloads instead: it carries the digest,
                    both computed readings in the engine&rsquo;s own words and every
                    diagnostic, so the run survives this tab.
                  </p>
                </div>
              </div>

              {/* The result, still on the card. It was unmounted here — the digest, the
                  autonomy class and the security level all vanished the moment the
                  reader pressed the button that produced them. */}
              {result?.analysis !== undefined && (
                <dl className="grid gap-3 rounded-lg border border-line bg-surface-2/40 p-5 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-5">
                  <dt className="label self-center">Digest</dt>
                  <dd className="break-all font-mono text-xs text-muted">
                    {result.blueprint?.digest ?? "not computed"}
                  </dd>
                  <dt className="label self-center">Autonomy</dt>
                  {/* The class, not the band: "A4" is the same ordinal wearing a prefix,
                      and doc 2 §1.1 keeps it off every surface. */}
                  <dd className="text-muted">
                    {result.analysis.autonomy.label}:{" "}
                    {result.analysis.autonomy.autonomousNodes} of{" "}
                    {result.analysis.autonomy.totalNodes} nodes unattended
                  </dd>
                  <dt className="label self-center">Static risk exposure</dt>
                  <dd className="text-muted">
                    level {result.analysis.security.level} ·{" "}
                    {result.analysis.security.findings.length} finding
                    {result.analysis.security.findings.length === 1 ? "" : "s"}
                  </dd>
                  <dt className="label self-center">Verdict</dt>
                  <dd className="font-mono text-xs text-muted">{verdictLine(result)}</dd>
                </dl>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {reportHref !== undefined && (
                  <ButtonLink href={reportHref} download="REPORT.md" prefetch={false}>
                    Download the report
                  </ButtonLink>
                )}
                <Button variant="outline" onClick={validateAnother}>
                  Validate another bundle
                </Button>
              </div>

              {/* Both ways out that throw something away, demoted to links so neither can
                  be pressed by reflex. `Validate another bundle` above keeps the manifest
                  on purpose; this one is the deliberate blank sheet. */}
              <p className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-dim">
                <button
                  type="button"
                  onClick={reset}
                  className="underline-offset-4 transition-colors hoverable:hover:text-fg hoverable:hover:underline"
                >
                  start over with an empty form
                </button>
                <Link
                  href="/blueprints"
                  className="underline-offset-4 transition-colors hoverable:hover:text-cyan hoverable:hover:underline"
                >
                  browse the blueprints →
                </Link>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* What the registry entry would say */}
              <div className="panel flex flex-col gap-4 bg-surface-2/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <KindBadge kind={kind} />
                  <span className="font-mono text-[11px] text-dim">{slug}</span>
                </div>
                <h3 className="font-display text-xl font-semibold leading-snug text-fg">
                  {details.title || `Untitled ${KIND_NOUN[kind]}`}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {details.summary || "No summary yet, add one on the Details step."}
                </p>
                {details.category && (
                  <p className="font-mono text-xs text-dim">
                    Category: <span className="text-muted">{details.category}</span>
                  </p>
                )}
                {details.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {details.tags.map((t) => (
                      <TagPill key={t} label={t} />
                    ))}
                  </div>
                )}
                {result?.analysis !== undefined && !blocked && (
                  <div className="flex flex-col gap-3 border-t border-line pt-4">
                    <dl className="grid gap-2 text-xs">
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 font-mono text-dim">autonomy</dt>
                        {/* The class, not the band: "A4" is the same ordinal wearing a
                            prefix, and doc 2 §1.1 keeps it off every surface. */}
                        <dd className="text-muted">
                          {result.analysis.autonomy.label}:{" "}
                          {result.analysis.autonomy.autonomousNodes} of{" "}
                          {result.analysis.autonomy.totalNodes} nodes unattended
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 font-mono text-dim">static risk</dt>
                        <dd className="text-muted">
                          level {result.analysis.security.level} ·{" "}
                          {result.analysis.security.findings.length} finding
                          {result.analysis.security.findings.length === 1 ? "" : "s"}
                        </dd>
                      </div>
                    </dl>
                    {/* The third thing the engine computes off a bundle (doc 2 §8), and
                        the one an author most wants to see before publishing: which
                        phases their factory acts in. Outside the `dl` because the strip
                        carries its own label, and because it is not a metric — nothing
                        here is scored, and a phase with no node is scope, not a gap. */}
                    <PhaseCoverageBadge
                      covered={result.analysis.phaseCoverage.covered}
                      missing={result.analysis.phaseCoverage.missing}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-line bg-surface-2/40 p-4">
                <p className="text-xs leading-relaxed text-muted">
                  <span className="text-fg">Filled in later:</span>{" "}
                  <span style={{ color: METRIC_SOURCE_META.community.color }}>
                    Efficacy, Reliability and Transparency
                  </span>{" "}
                  come from weighted community &amp; validator votes;{" "}
                  <span style={{ color: METRIC_SOURCE_META.reported.color }}>
                    Cost / time
                  </span>{" "}
                  is reported by whoever runs it, the platform never sees the
                  execution, and arrives with its run count, its spread and the
                  model it was obtained on.
                </p>
              </div>

              <div>
                <Button
                  size="lg"
                  onClick={() => setSubmitted(true)}
                  disabled={blocked}
                  aria-describedby="publish-note"
                >
                  Publish {KIND_NOUN[kind]}
                </Button>
                <p
                  id="publish-note"
                  className="mt-2 max-w-xl text-xs leading-relaxed text-muted"
                >
                  {/* Three sentences behind one disabled button. A blueprint still being
                      written cannot be published either, but "blocked by 5 errors" in
                      signal red is the wrong reason to give somebody who has three cards
                      of eight down — it names a fault where there is only a middle. The
                      button stays disabled; what changes is what the page says it is
                      waiting for. */}
                  {blocked ? (
                    unfinished && progress !== undefined ? (
                      <>
                        <span className="font-mono text-warn">still being written</span>:{" "}
                        {progress.placed} of {progress.total} nodes have their card. There
                        is nothing to fix — write the rest and drop the folder again. The
                        Preview step names the ones still waiting.
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-signal">blocked</span>:{" "}
                        {result === undefined
                          ? "there is no bundle to publish yet."
                          : `the validator reported ${errorCount} error${
                              errorCount === 1 ? "" : "s"
                            }. The registry does not accept a bundle it cannot resolve; fix them on the Preview step.`}
                      </>
                    )
                  ) : (
                    <>
                      <span className="font-mono text-amber">not wired up</span>:
                      publishing has no backend. This button ends the wizard and shows
                      you what the registry entry would look like. Nothing leaves this
                      tab.
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer nav.
          The counter used to exist on step 4 alone, where it told a reader who had
          already arrived that they had arrived; everywhere else the position was
          readable only by counting the rail at the top of a panel three viewports up.
          It prints on every step now, between the two controls. `/build` printed the same
          counter until its steps were deleted, and this flow keeps it because it still has
          steps: four panels, in order, with an advance control at the bottom of each.
          `STEPS.length` rather than a typed 4, so the two can never disagree. */}
      {!(step === 4 && submitted) && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-5 py-4 sm:px-8">
          <Button variant="ghost" onClick={back} disabled={step === 1}>
            ← Back
          </Button>
          <span className="min-w-0 text-center font-mono text-[11px] leading-relaxed text-dim">
            step {step} of {STEPS.length}
            {step === 4 &&
              ` · ${
                !blocked
                  ? "ready to publish"
                  : result === undefined
                    ? "no bundle yet"
                    : unfinished && progress !== undefined
                      ? `${progress.waiting} node${progress.waiting === 1 ? "" : "s"} still to card`
                      : `blocked by ${errorCount} error${errorCount === 1 ? "" : "s"}`
              }`}
          </span>
          {step < 4 ? (
            <Button variant="outline" onClick={next} disabled={step === 1 && !canAdvance}>
              Next →
            </Button>
          ) : (
            /* Nothing to advance to, and no placeholder pretending there is: the span
               keeps the counter centred between the two ends of the row. */
            <span aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}
