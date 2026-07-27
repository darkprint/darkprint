"use client";

import { useCallback, useMemo, useState } from "react";
import type { ContentKind } from "@/lib/types";
import {
  CORE_ONTOLOGY,
  hasErrors,
  loadBundle,
  ontologyView,
  summarize,
  type LoadBundleResult,
} from "@/lib/core";
import { cx, METRIC_SOURCE_META } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KindBadge } from "@/components/ui/Badge";
import { TagPill } from "@/components/ui/TagPill";
import { PhaseCoverageBadge } from "@/components/ui/PhaseCoverage";
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
import { ValidationReport } from "./ValidationReport";

/* ------------------------------------------------------------------ */
/*  Static config                                                      */
/* ------------------------------------------------------------------ */

type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Details" },
  { id: 3, label: "Preview" },
  { id: 4, label: "Publish" },
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
    hint: "Full factory graph",
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

const fieldLabelCls =
  "font-mono text-[11px] uppercase tracking-[0.14em] text-dim";

/**
 * One vocabulary view for the tab. `isA` memoizes per instance, so sharing it across
 * every keystroke-triggered re-validation is both cheaper and the only way two runs of
 * the validator are provably against identical terms — the same reason `lib/content`
 * builds exactly one for the whole static build.
 */
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

const EMPTY_DETAILS: BundleDetails = {
  title: "",
  summary: "",
  description: "",
  category: "",
  tags: [],
};

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
      <label className={fieldLabelCls} htmlFor={id}>
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
              className="ml-0.5 text-dim transition-colors hover:text-signal"
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
      <span className={fieldLabelCls}>{label}</span>
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
                  ? `Step ${s.id} — ${s.label}. Not available yet: add a .dot topology on step 1 first.`
                  : `Step ${s.id} — ${s.label}`
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
                  !active && !done && !locked && "group-hover:border-line-bright",
                )}
              >
                {done ? "✓" : s.id}
              </span>
              <span
                className={cx(
                  "hidden font-mono text-xs uppercase tracking-[0.12em] transition-colors sm:block",
                  active ? "text-fg" : "text-dim",
                  !active && !locked && "group-hover:text-muted",
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
  const result: LoadBundleResult | undefined = useMemo(
    () => (bundle === undefined ? undefined : loadBundle(bundle, { ontology: ONTOLOGY })),
    [bundle],
  );

  const errorCount = result === undefined ? 0 : summarize(result.diagnostics).error;
  const blocked = result === undefined || hasErrors(result.diagnostics);
  const canAdvance = parts.dot !== undefined;

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

  function reset() {
    setSubmitted(false);
    setStep(1);
    setKind("blueprint");
    setFiles([]);
    setDetails(EMPTY_DETAILS);
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

  // The slug the registry would key on. A dropped manifest owns its own — §4 makes it
  // the blueprint's identity — so only a synthesised manifest gets one off the title.
  const slug =
    bundle?.manifest.slug ??
    (details.title.trim() === "" ? "untitled-blueprint" : slugify(details.title));

  return (
    <div className="panel overflow-hidden">
      {/* Header: step indicator */}
      <div className="border-b border-line bg-surface-2/40 px-5 py-4 sm:px-8">
        <StepIndicator step={step} canAdvance={canAdvance} onJump={jump} />
      </div>

      {/* Body */}
      <div className="px-5 py-8 sm:px-8">
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
              <span className={fieldLabelCls} id="content-type-label">
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
                          ? `${k.label} — ${k.hint}`
                          : `${k.label} — ${k.hint}. This flow does not accept one yet.`
                      }
                      className={cx(
                        "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-surface-3 text-fg shadow-[inset_0_0_0_1px_var(--color-line-bright)]"
                          : "text-muted hover:text-fg",
                        !k.ready && "cursor-not-allowed opacity-50 hover:text-muted",
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
              <label className={fieldLabelCls} htmlFor="bp-title">
                Title
              </label>
              <input
                id="bp-title"
                value={details.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Consensus line — multi-agent conflict resolution"
                className={inputCls}
              />
              <p className="font-mono text-[11px] text-dim">
                slug <span className="text-muted">{slug}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelCls} htmlFor="bp-summary">
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
              <label className={fieldLabelCls} htmlFor="bp-description">
                Description
              </label>
              <textarea
                id="bp-description"
                value={details.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={5}
                placeholder="What the factory does, its acceptance criteria, and where the closed loop makes its judgement calls."
                className={cx(inputCls, "resize-y")}
              />
            </div>

            <div className="flex flex-col gap-2 sm:max-w-xs">
              <label className={fieldLabelCls} htmlFor="bp-category">
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
                declare by hand — so the registry computes it instead of asking.
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
              <h3 className="font-display text-lg font-semibold text-fg">
                Nothing to validate
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                A bundle without a <span className="font-mono text-cyan">.dot</span> is
                not an incomplete bundle — it is not one at all. Go back to the first
                step and add the topology.
              </p>
            </div>
          ) : (
            <ValidationReport result={result} />
          ))}

        {step === 4 &&
          (submitted ? (
            <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-6 text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald/40 bg-emerald/10 text-2xl text-emerald"
                aria-hidden
              >
                ✓
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl font-semibold text-fg">
                  This is where it would be published
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  <span className="font-mono text-amber">demo</span> — nothing was sent
                  and nothing was saved. There is no registry backend yet. In the real
                  one your {KIND_NOUN[kind]} would now be live with the two
                  static-analysis scores you just saw attached, awaiting community votes.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink href="/blueprints">Browse the blueprints</ButtonLink>
                <Button variant="outline" onClick={reset}>
                  Upload another
                </Button>
              </div>
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
                  {details.summary || "No summary yet — add one on the Details step."}
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
                        <dd className="text-muted">
                          A{result.analysis.autonomy.level} ·{" "}
                          {result.analysis.autonomy.label} —{" "}
                          {result.analysis.autonomy.autonomousNodes} of{" "}
                          {result.analysis.autonomy.totalNodes} nodes unattended
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 font-mono text-dim">security</dt>
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
                  is reported by whoever runs it — the platform never sees the
                  execution — and arrives with its run count, its spread and the
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
                  {blocked ? (
                    <>
                      <span className="font-mono text-signal">blocked</span> —{" "}
                      {result === undefined
                        ? "there is no bundle to publish yet."
                        : `the validator reported ${errorCount} error${
                            errorCount === 1 ? "" : "s"
                          }. The registry does not accept a bundle it cannot resolve; fix them on the Preview step.`}
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-amber">not wired up</span> —
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

      {/* Footer nav */}
      {!(step === 4 && submitted) && (
        <div className="flex items-center justify-between border-t border-line bg-surface-2/40 px-5 py-4 sm:px-8">
          <Button variant="ghost" onClick={back} disabled={step === 1}>
            ← Back
          </Button>
          {step < 4 ? (
            <Button variant="outline" onClick={next} disabled={step === 1 && !canAdvance}>
              Next →
            </Button>
          ) : (
            <span className="font-mono text-[11px] text-dim">
              Step 4 of 4 ·{" "}
              {!blocked
                ? "ready to publish"
                : result === undefined
                  ? "no bundle yet"
                  : `blocked by ${errorCount} error${errorCount === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
