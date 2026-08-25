"use client";

/* ============================================================
   The `/new` form: title, slug, summary, description, category, tags, visibility.
   Submits `POST /api/bundles/draft` and, on success, hands the reader straight to the
   bundle it just reserved.

   ── No Required agents, no version ──
   Both describe a RELEASE, and this route creates a bundle with none yet — the same
   distinction `components/upload/UploadFlow.tsx` draws between the manifest's own fields
   and "the two things the registry needs that a manifest does not carry". Required
   agents is read off resolved cards, and there is no graph here to read it from.

   ── The slug field, and why it exists here and not on `/upload` ──
   `UploadFlow.tsx` derives a slug from the title or a dropped manifest and never asks for
   one directly, because the graph usually already names it. Here there is no graph yet,
   so the slug is the one identity decision this form makes — derived from the title
   the moment it changes, editable the moment the reader touches it directly, checked
   against `GET /api/names/slugs/{owner}/{slug}` the same debounced way
   `components/welcome/WelcomeForm.tsx` checks a handle.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ChipField, inputCls } from "./UploadFlow";
import { slugify } from "./BundleDropzone";

/** `Availability`, transcribed rather than imported: the barrel it lives on reaches `pg`. */
interface Availability {
  available: boolean;
  reason?: "taken" | "reserved" | "illegal";
  suggestion?: string;
}

interface Problem {
  detail?: string;
  title?: string;
}

/** Mirrors `WelcomeForm`'s `Check`: `checking` stays distinct from `idle` so a reader never
    reads a verdict for the frame before its own request has landed. */
type SlugCheck =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "free" }
  | { state: "taken"; reason: string; suggestion?: string };

function slugRefusal(reason: Availability["reason"]): string {
  if (reason === "reserved") return "That slug is reserved.";
  if (reason === "illegal") {
    return "Letters, digits and single hyphens, starting and ending with a letter or digit.";
  }
  return "You already have a blueprint at this slug.";
}

async function readProblem(response: Response): Promise<string> {
  const problem = (await response.json().catch(() => ({}))) as Problem;
  return problem.detail ?? problem.title ?? `Request failed (${response.status}).`;
}

export function CreateBundleForm({
  ownerHandle,
  defaultVisibility,
}: {
  ownerHandle: string;
  defaultVisibility: "public" | "private";
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  /** What the reader has typed directly into the slug field. Read only once `slugTouched`
      is true — until then the slug is DERIVED from the title during render (below), never
      synced to it through an effect: two pieces of state that have to agree drift the
      first time a render is skipped, where a derived value cannot. */
  const [slugDraft, setSlugDraft] = useState("");
  /** Once true, the title no longer overwrites the slug — the reader has taken it over. */
  const [slugTouched, setSlugTouched] = useState(false);
  const slug = slugTouched ? slugDraft : slugify(title);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">(defaultVisibility);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  /* The verdict AND the slug it was computed for, as one value — `WelcomeForm`'s own
     device for the same reason: a verdict can only be shown for the exact string it was
     asked about, so anything else in the field reads as still-checking rather than as
     whatever the last answer happened to be. */
  const [answer, setAnswer] = useState<{ for: string; check: SlugCheck }>({
    for: "",
    check: { state: "idle" },
  });
  const inFlight = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const trimmed = slug.trim();
    if (trimmed === "") return;
    // Debounced for the same reason WelcomeForm debounces a handle: this fires per
    // keystroke and each one is a database read on the other end.
    const timer = setTimeout(() => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      void (async () => {
        try {
          const response = await fetch(
            `/api/names/slugs/${encodeURIComponent(ownerHandle)}/${encodeURIComponent(trimmed)}`,
            { signal: controller.signal },
          );
          if (!response.ok) {
            // A failed availability read is not a verdict about the name; the submit
            // below asks the server again anyway, and that answer is the one that decides.
            setAnswer({ for: trimmed, check: { state: "idle" } });
            return;
          }
          const body = (await response.json()) as Availability;
          setAnswer({
            for: trimmed,
            check: body.available
              ? { state: "free" }
              : {
                  state: "taken",
                  reason: slugRefusal(body.reason),
                  ...(body.suggestion === undefined ? {} : { suggestion: body.suggestion }),
                },
          });
        } catch {
          // Aborted by the next keystroke, or the network failed — either way this
          // answer is not about the slug in the field now.
        }
      })();
    }, 350);
    return () => clearTimeout(timer);
  }, [slug, ownerHandle]);

  const trimmedSlug = slug.trim();
  const check: SlugCheck =
    trimmedSlug === ""
      ? { state: "idle" }
      : answer.for === trimmedSlug
        ? answer.check
        : { state: "checking" };

  const blocked =
    trimmedSlug === "" || title.trim() === "" || submitting || check.state === "taken";

  async function submit() {
    if (blocked) return;
    setSubmitting(true);
    setSubmitError(undefined);
    let response: Response;
    try {
      response = await fetch("/api/bundles/draft", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          slug: trimmedSlug,
          title: title.trim(),
          ...(summary.trim() === "" ? {} : { summary: summary.trim() }),
          ...(description.trim() === "" ? {} : { description: description.trim() }),
          ...(category.trim() === "" ? {} : { category: category.trim() }),
          ...(tags.length === 0 ? {} : { tags }),
          visibility,
        }),
      });
    } catch {
      setSubmitError("The registry could not be reached. Nothing was created.");
      setSubmitting(false);
      return;
    }

    if (response.status === 200) {
      const body = (await response.json()) as { bundle: { owner: string; slug: string } };
      router.push(`/blueprints/${body.bundle.owner}/${body.bundle.slug}`);
      return;
    }

    if (response.status === 409) {
      // The 409 IS the authoritative slug answer (the route's own TOCTOU note), so it
      // replaces the debounced check's verdict rather than sitting beside it as a second
      // error a reader has to reconcile with the field above.
      const detail = await readProblem(response);
      setAnswer({ for: trimmedSlug, check: { state: "taken", reason: detail } });
      setSubmitting(false);
      return;
    }

    setSubmitError(await readProblem(response));
    setSubmitting(false);
  }

  return (
    <form
      className="grid max-w-3xl gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col gap-2">
        <label className="label" htmlFor="new-title">
          Title
        </label>
        <input
          id="new-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Consensus line, multi-agent conflict resolution"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-2 sm:max-w-md">
        <label className="label" htmlFor="new-slug">
          Slug
        </label>
        <input
          id="new-slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlugDraft(e.target.value);
          }}
          placeholder="consensus-line"
          className={cx(inputCls, "font-mono")}
          aria-describedby="new-slug-note"
        />
        <p
          id="new-slug-note"
          aria-live="polite"
          className="min-h-[1.25rem] font-mono text-[11px] leading-relaxed"
        >
          <span className="text-dim">
            darkprint.io/blueprints/{ownerHandle}/{trimmedSlug === "" ? "…" : trimmedSlug}
          </span>
          {trimmedSlug !== "" && (
            <>
              {" · "}
              {check.state === "checking" && <span className="text-dim">checking…</span>}
              {check.state === "free" && <span className="text-emerald">available</span>}
              {check.state === "taken" && (
                <span className="text-amber">
                  {check.reason}
                  {check.suggestion !== undefined && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => {
                          setSlugTouched(true);
                          setSlugDraft(check.suggestion!);
                        }}
                        className="underline decoration-amber/40 underline-offset-4 transition-colors hover:decoration-amber"
                      >
                        Use {check.suggestion}
                      </button>
                    </>
                  )}
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="label" htmlFor="new-summary">
          Summary
        </label>
        <textarea
          id="new-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="One sentence a reviewer sees in the gallery card."
          className={cx(inputCls, "resize-y")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="label" htmlFor="new-description">
          Description
        </label>
        <textarea
          id="new-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="What the blueprint does, its acceptance criteria, and where the closed loop makes its judgement calls."
          className={cx(inputCls, "resize-y")}
        />
      </div>

      <div className="flex flex-col gap-2 sm:max-w-xs">
        <label className="label" htmlFor="new-category">
          Category
        </label>
        <input
          id="new-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Coordination"
          className={inputCls}
        />
      </div>

      <ChipField
        id="new-tags"
        label="Tags"
        placeholder="Type a tag, press Enter"
        values={tags}
        onAdd={(value) => setTags((t) => (t.includes(value) ? t : [...t, value]))}
        onRemove={(index) => setTags((t) => t.filter((_, i) => i !== index))}
        accent="var(--color-cyan)"
      />

      {/* Same two choices, the same hint text, as the upload wizard's Details step —
          D-100-01's default read here rather than a route-level constant, so the option
          this reader started on is their own account's, not a page's opinion. */}
      <fieldset className="flex flex-col gap-2 border-t border-line pt-5">
        <legend className="label mb-2">Visibility</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              {
                value: "private" as const,
                label: "Private",
                hint: "Only you can read it",
                color: "var(--color-violet)",
              },
              {
                value: "public" as const,
                label: "Public",
                hint: "Anyone can read it",
                color: "var(--color-cyan)",
              },
            ] satisfies { value: "public" | "private"; label: string; hint: string; color: string }[]
          ).map((choice) => {
            const active = visibility === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => setVisibility(choice.value)}
                aria-pressed={active}
                aria-label={`${choice.label}: ${choice.hint}`}
                className={cx(
                  "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-surface-3 text-fg shadow-[inset_0_0_0_1px_var(--color-line-bright)]"
                    : "text-muted hoverable:hover:text-fg",
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? choice.color : "var(--color-line-bright)" }}
                  aria-hidden
                />
                <span className="flex flex-col items-start leading-tight">
                  <span className="font-medium">{choice.label}</span>
                  <span className="text-[11px] text-dim">{choice.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="max-w-xl text-[11px] leading-relaxed text-dim">
          Started from your account&rsquo;s own default. Change it any time from the
          blueprint&rsquo;s own page once it exists.
        </p>
      </fieldset>

      {submitError !== undefined && (
        <p role="alert" className="text-[13px] leading-relaxed text-signal">
          {submitError}
        </p>
      )}

      <div>
        <Button type="submit" size="lg" disabled={blocked}>
          {submitting ? "Creating…" : "Create blueprint"}
        </Button>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
          This reserves{" "}
          <span className="font-mono text-cyan">
            {ownerHandle}/{trimmedSlug === "" ? "…" : trimmedSlug}
          </span>{" "}
          with no release yet. Bring the graph and its cards on the upload step next.
        </p>
      </div>
    </form>
  );
}
