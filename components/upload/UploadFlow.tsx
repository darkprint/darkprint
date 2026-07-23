"use client";

import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import type { ContentKind, AutonomyInfo } from "@/lib/types";
import { cx, AUTONOMY_LABELS, METRIC_SOURCE_META } from "@/lib/format";
import { BLUEPRINTS } from "@/lib/data";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KindBadge, SourceBadge } from "@/components/ui/Badge";
import { TagPill } from "@/components/ui/TagPill";
import { AutonomyMeter } from "@/components/ui/AutonomyMeter";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { DotSource } from "@/components/graph/DotSource";

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

const KINDS: {
  key: ContentKind;
  label: string;
  hint: string;
  color: string;
}[] = [
  { key: "blueprint", label: "Blueprint", hint: "Full factory graph", color: "var(--color-cyan)" },
  { key: "part", label: "Part", hint: "Reusable sub-graph", color: "var(--color-amber)" },
  { key: "ontology", label: "Ontology", hint: "Typed vocabulary", color: "var(--color-violet)" },
];

/** Lower-case noun for a content kind, used across the flow's copy. */
const KIND_NOUN: Record<ContentKind, string> = {
  blueprint: "blueprint",
  part: "part",
  ontology: "ontology",
};

const inputCls =
  "w-full bg-surface-2 border border-line rounded-md px-3 py-2 text-sm text-fg placeholder:text-dim transition-colors focus:border-cyan focus:outline-none";

const fieldLabelCls =
  "font-mono text-[11px] uppercase tracking-[0.14em] text-dim";

/** Stand-in "parsed" graph — the platform would produce this from the .dot. */
const PARSED_GRAPH = BLUEPRINTS[0].graph;

/** Fake but plausible static-analysis output for the Publish step. */
const AUTO_AUTONOMY: AutonomyInfo = {
  level: 4,
  label: AUTONOMY_LABELS[4],
  blurb: "No human-approval gates found on any control path.",
};

/* ------------------------------------------------------------------ */
/*  Chip field (tags / agents / tools)                                 */
/* ------------------------------------------------------------------ */

function ChipField({
  label,
  placeholder,
  values,
  onAdd,
  onRemove,
  accent = "var(--color-cyan)",
}: {
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
      <label className={fieldLabelCls}>{label}</label>
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
          aria-label={label}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-fg placeholder:text-dim focus:outline-none"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */

function StepIndicator({
  step,
  onJump,
}: {
  step: StepId;
  onJump: (id: StepId) => void;
}) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = s.id < step;
        const active = s.id === step;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onJump(s.id)}
              aria-label={s.label}
              className="group flex items-center gap-2.5 text-left"
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors",
                  active && "border-cyan bg-cyan/10 text-cyan",
                  done && "border-emerald/50 bg-emerald/10 text-emerald",
                  !active && !done && "border-line bg-surface-2 text-dim group-hover:border-line-bright",
                )}
              >
                {done ? "✓" : s.id}
              </span>
              <span
                className={cx(
                  "hidden font-mono text-xs uppercase tracking-[0.12em] transition-colors sm:block",
                  active ? "text-fg" : "text-dim group-hover:text-muted",
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

export function UploadFlow() {
  const [step, setStep] = useState<StepId>(1);
  const [kind, setKind] = useState<ContentKind>("blueprint");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);

  const [submitted, setSubmitted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const canAdvance = fileName !== null;

  function addUnique(
    setter: Dispatch<SetStateAction<string[]>>,
    value: string,
  ) {
    setter((prev) => (prev.includes(value) ? prev : [...prev, value]));
  }
  function removeAt(
    setter: Dispatch<SetStateAction<string[]>>,
    index: number,
  ) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function takeFiles(files: FileList | null) {
    const f = files?.[0];
    if (f) setFileName(f.name);
  }

  function jump(target: StepId) {
    // Can always step back; can only go forward once a file exists.
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

  return (
    <div className="panel overflow-hidden">
      {/* Header: step indicator */}
      <div className="border-b border-line bg-surface-2/40 px-5 py-4 sm:px-8">
        <StepIndicator step={step} onJump={jump} />
      </div>

      {/* Body */}
      <div className="px-5 py-8 sm:px-8">
        {step === 1 && (
          <StepUpload
            kind={kind}
            setKind={setKind}
            fileName={fileName}
            setFileName={setFileName}
            dragging={dragging}
            setDragging={setDragging}
            inputRef={inputRef}
            takeFiles={takeFiles}
          />
        )}

        {step === 2 && (
          <div className="grid max-w-3xl gap-5">
            <div className="flex flex-col gap-2">
              <label className={fieldLabelCls} htmlFor="bp-title">
                Title
              </label>
              <input
                id="bp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Consensus line — multi-agent conflict resolution"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelCls} htmlFor="bp-summary">
                Summary
              </label>
              <textarea
                id="bp-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Coordination"
                className={inputCls}
              />
            </div>

            <ChipField
              label="Tags"
              placeholder="Type a tag, press Enter"
              values={tags}
              onAdd={(v) => addUnique(setTags, v)}
              onRemove={(i) => removeAt(setTags, i)}
              accent="var(--color-cyan)"
            />

            <ChipField
              label="Required agents"
              placeholder="e.g. planner, negotiator — Enter to add"
              values={agents}
              onAdd={(v) => addUnique(setAgents, v)}
              onRemove={(i) => removeAt(setAgents, i)}
              accent="var(--color-violet)"
            />

            <ChipField
              label="Required tools"
              placeholder="e.g. http.fetch, sql.query — Enter to add"
              values={tools}
              onAdd={(v) => addUnique(setTools, v)}
              onRemove={(i) => removeAt(setTools, i)}
              accent="var(--color-amber)"
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
              {/* Live summary card */}
              <div className="panel flex flex-col gap-4 self-start bg-surface-2/40 p-5">
                <div className="flex items-center justify-between gap-2">
                  <KindBadge kind={kind} />
                  {fileName && (
                    <span className="font-mono text-[11px] text-dim">{fileName}</span>
                  )}
                </div>
                <h3 className="font-display text-xl font-semibold leading-snug text-fg">
                  {title || `Untitled ${KIND_NOUN[kind]}`}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {summary || "No summary yet — add one on the Details step."}
                </p>
                {category && (
                  <p className="font-mono text-xs text-dim">
                    Category: <span className="text-muted">{category}</span>
                  </p>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <TagPill key={t} label={t} />
                    ))}
                  </div>
                )}
                {(agents.length > 0 || tools.length > 0) && (
                  <dl className="grid gap-2 border-t border-line pt-4 text-xs">
                    {agents.length > 0 && (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 font-mono text-dim">agents</dt>
                        <dd className="text-muted">{agents.join(", ")}</dd>
                      </div>
                    )}
                    {tools.length > 0 && (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 font-mono text-dim">tools</dt>
                        <dd className="text-muted">{tools.join(", ")}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>

              {/* Interactive parsed graph */}
              <div className="flex flex-col gap-2">
                <BlueprintGraph graph={PARSED_GRAPH} height={360} />
                <p className="font-mono text-[11px] text-dim">
                  Parsed from your .dot — 8 nodes, 9 edges. Drag to inspect.
                </p>
              </div>
            </div>

            <DotSource dot={PARSED_GRAPH.dot} defaultOpen />
          </div>
        )}

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
                  Published to the registry
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  <span className="font-mono text-amber">demo</span> — nothing was
                  saved. In the real registry your {KIND_NOUN[kind]} would now be
                  live with its static-analysis scores attached, awaiting community
                  votes.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink href="/gallery">Browse the gallery</ButtonLink>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmitted(false);
                    setStep(1);
                    setKind("blueprint");
                    setFileName(null);
                    setTitle("");
                    setSummary("");
                    setDescription("");
                    setCategory("");
                    setTags([]);
                    setAgents([]);
                    setTools([]);
                  }}
                >
                  Upload another
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="font-display text-lg font-semibold text-fg">
                  Auto-computed from your graph
                </h3>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                  Two of the six scores are produced by static analysis of the
                  schematic the moment you upload — no run required.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Autonomy */}
                <div className="panel flex flex-col gap-3 bg-surface-2/40 p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-dim">
                      Autonomy
                    </span>
                    <SourceBadge source="auto" />
                  </div>
                  <AutonomyMeter autonomy={AUTO_AUTONOMY} />
                  <p className="text-xs leading-relaxed text-muted">
                    No human-approval gate nodes on any control path — the loop
                    closes end to end.
                  </p>
                </div>

                {/* Security */}
                <div className="panel flex flex-col gap-3 bg-surface-2/40 p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-dim">
                      Security
                    </span>
                    <SourceBadge source="auto" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-semibold text-cyan">
                      74
                    </span>
                    <span className="font-mono text-xs text-dim">/ 100</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Scored from the tool scopes the graph requests. Narrower
                    permissions score higher.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-line bg-surface-2/40 p-4">
                <p className="text-xs leading-relaxed text-muted">
                  <span className="text-fg">Filled in later:</span>{" "}
                  <span style={{ color: METRIC_SOURCE_META.community.color }}>
                    Efficacy, Reliability and Transparency
                  </span>{" "}
                  come from weighted community &amp; validator votes;{" "}
                  <span style={{ color: METRIC_SOURCE_META.measured.color }}>
                    Cost / time
                  </span>{" "}
                  is measured objectively on the first real run with telemetry
                  opted in.
                </p>
              </div>

              <div>
                <Button size="lg" onClick={() => setSubmitted(true)}>
                  Publish {KIND_NOUN[kind]}
                </Button>
                <p className="mt-2 font-mono text-[11px] text-dim">
                  No backend — this is a UI demo, nothing is uploaded.
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
              Step 4 of 4 · ready to publish
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1 body                                                        */
/* ------------------------------------------------------------------ */

function StepUpload({
  kind,
  setKind,
  fileName,
  setFileName,
  dragging,
  setDragging,
  inputRef,
  takeFiles,
}: {
  kind: ContentKind;
  setKind: (k: ContentKind) => void;
  fileName: string | null;
  setFileName: (name: string | null) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  takeFiles: (files: FileList | null) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* Drop zone */}
      <div className="flex flex-col gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            takeFiles(e.dataTransfer.files);
          }}
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors",
            dragging
              ? "border-cyan bg-cyan/5"
              : "border-line-bright hover:border-cyan/60 hover:bg-surface-2/40",
          )}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-surface-2 text-xl text-cyan"
            aria-hidden
          >
            ⇪
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-fg">
              Drop your{" "}
              <span className="font-mono text-cyan">.dot</span> /{" "}
              <span className="font-mono text-cyan">.gv</span> graph here
            </p>
            <p className="text-xs text-dim">
              or click to browse — the schematic of your dark factory
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".dot,.gv"
            className="hidden"
            onChange={(e) => takeFiles(e.target.files)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {fileName ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1 font-mono text-xs text-cyan-bright">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan" aria-hidden />
              {fileName}
              <button
                type="button"
                onClick={() => setFileName(null)}
                aria-label="Remove file"
                className="ml-0.5 text-cyan/70 transition-colors hover:text-signal"
              >
                ×
              </button>
            </span>
          ) : (
            <span className="font-mono text-xs text-dim">No file selected</span>
          )}
          <button
            type="button"
            onClick={() => setFileName("consensus-line.dot")}
            className="font-mono text-xs text-cyan underline-offset-4 transition-colors hover:text-cyan-bright hover:underline"
          >
            use a sample →
          </button>
        </div>
      </div>

      {/* Content kind selector */}
      <div className="flex flex-col gap-3">
        <span className={fieldLabelCls}>Content type</span>
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1">
          {KINDS.map((k) => {
            const active = kind === k.key;
            return (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                aria-pressed={active}
                className={cx(
                  "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-surface-3 text-fg shadow-[inset_0_0_0_1px_var(--color-line-bright)]"
                    : "text-muted hover:text-fg",
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
                  <span className="text-[11px] text-dim">{k.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
