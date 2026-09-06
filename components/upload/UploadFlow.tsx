"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ContentKind } from "@/lib/types";
import {
  CORE_ONTOLOGY,
  isReleasable,
  loadBundle,
  ontologyView,
  parseSemver,
  sortDiagnostics,
  summarize,
  type Diagnostic,
  type LoadBundleResult,
  type OntologyTerm,
} from "@/lib/core";
import { autonomyStatement, cx, METRIC_SOURCE_META } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KindBadge } from "@/components/ui/Badge";
import { TagPill } from "@/components/ui/TagPill";
import { PhaseCoverageBadge } from "@/components/ui/PhaseCoverage";
import { DiagnosticList, locationLabel } from "@/components/ui/DiagnosticList";
import {
  BundleDropzone,
  assembleBundle,
  classifyBundle,
  detailsFromManifest,
  slugify,
  type BundleDetails,
  type UploadFile,
} from "./BundleDropzone";
import { SingleDocDropzone, type SingleDoc } from "./SingleDocDropzone";
import { AttractorImported, AttractorOffer } from "./AttractorOffer";
import {
  detectAttractorPipeline,
  importSelection,
  recordApplies,
  type AttractorImportRecord,
} from "./attractor";
import { requiredAgents, requiredTools } from "@/lib/graph-seed";
import { bundleProgress, type BundleProgress } from "./progress";
import { ValidationReport, verdictLine } from "./ValidationReport";
import { SIGN_IN_HREF, useUploadSession } from "./session";
import { publishBundle, type PublishOutcome, type PublishRefusedKind } from "./publish-client";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-26): PUT /api/bundles/{owner}/{slug}/agents-md
// TODO(SEAM-27) (cited at line 769): n/a — File API, then SEAM-30 for the server counterpart
// TODO(SEAM-28) (cited at line 606): GET /api/blueprints/{slug}/as-upload
// TODO(SEAM-30) (cited at line 555): POST /api/validate/bundle
// TODO(SEAM-31) (cited at line 130): folded into SEAM-30
// TODO(SEAM-32) (cited at line 1040): POST /api/validate/report
// SEAM-33: POST /api/validate/card, POST /api/validate/ontology — **LIVE** since T280.
//   The effect near "SEAM-33, **LIVE**" below calls one or the other by `kind`. No TODO:
//   the seam is closed for these two kinds; Blueprint still resolves in this tab (SEAM-30).
// TODO(SEAM-34) (cited at line 600): folded into SEAM-27
// TODO(SEAM-35) (cited at line 720): GET /api/slugs/available?slug=
// SEAM-69: POST /api/bundles — **LIVE** since T263. `doPublish` calls it through
//   `./publish-client`. No TODO: the seam is closed.
// SEAM-42 (partial): GET /api/auth/session — **LIVE** for this route's read-only use,
//   in `./session`. The sign-in and sign-out halves are still the header's and unbuilt.
//   Reported to the orchestrator: `docs/architecture/seams.md` has no id for a session
//   READ, and inventing one in code would put a document's decision in a component.
// SEAM-30 stays PLANNED on purpose. `docs/ARCHITECTURE.md` §7 puts the server's
//   authoritative pass at PUBLISH time and keeps the client-side pass for latency, so the
//   preview is deliberately not a round trip. See the D-263-01 note in `reportMarkdown`.

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
 * same problem the same way, first as steps and then as one workspace; the owner deleted
 * that route and its component tree on 2026-09-06 ("it is not useful and make confusion"),
 * so this is now the only multi-step flow on the site and the only place the pattern has
 * to hold at all.
 */
const STEPS: { id: StepId; label: string; heading: string }[] = [
  { id: 1, label: "Upload", heading: "Upload the bundle" },
  { id: 2, label: "Details", heading: "Describe it" },
  { id: 3, label: "Preview", heading: "What the validator found" },
  { id: 4, label: "Publish", heading: "The registry entry" },
];

/**
 * The three registry surfaces, all three ready now — reading them ready is not the same
 * as reading them published. Blueprint joins a DOT to the cards it pins and its wizard
 * ends in a release; Node and Ontology check one document each against the curated core
 * alone (`POST /api/validate/card`, `POST /api/validate/ontology`) and end in a report,
 * never a release — the registry stores a lone card or vocabulary only pinned inside a
 * bundle that publishes, and that path is not built. Step 4 says so for those two kinds
 * rather than offering a Publish button the registry has nowhere to put.
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
    ready: true,
  },
  {
    key: "ontology",
    label: "Ontology",
    hint: "Typed vocabulary",
    color: "var(--color-violet)",
    ready: true,
  },
];

/** Lower-case noun for a content kind, used across the flow's copy. */
const KIND_NOUN: Record<ContentKind, string> = {
  blueprint: "blueprint",
  node: "node card",
  ontology: "ontology",
};

/** The endpoint a Node or Ontology `singleDoc` validates against. Never asked for `blueprint`
    — that kind resolves in this tab (see the SEAM-30 note near the top of this file). */
const VALIDATE_ENDPOINT: Partial<Record<ContentKind, string>> = {
  node: "/api/validate/card",
  ontology: "/api/validate/ontology",
};

/**
 * What the endpoint above answered about `singleDoc`, mirroring `UploadSession`'s own
 * shape in `./session.ts`: `checking` stays distinct from `idle` so a reader is never
 * shown a verdict for the frame before its own request has landed, and a transport
 * failure (`failed`) is a fact about the network rather than a diagnostic about the
 * document — printing it as one would claim the validator said something it never saw.
 */
type SingleValidation =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "done"; diagnostics: Diagnostic[]; ok: boolean }
  | { state: "failed"; detail: string };

/** Exported so `components/upload/CreateBundleForm.tsx` renders the same field, on `/new`
    — "match the site's cyanotype identity" by reusing the one definition rather than a
    second string that can drift from it. */
export const inputCls =
  "w-full bg-surface-2 border border-line rounded-md px-3 py-2 text-sm text-fg placeholder:text-dim transition-colors focus:border-cyan focus:outline-none";

/** What a first release is numbered, per D-263-09. Also what `reset` puts back. */
const FIRST_VERSION = "0.1.0";

/**
 * Whether the declared version reads as a semver, using `lib/core`'s OWN parser.
 *
 * `parseSemver` and never a regex written here: the grammar is `lib/core/version/semver.ts`'s
 * and it is isomorphic precisely so both sides can ask it. A second pattern beside it is the
 * duplicated-decision defect this run has charged more than any other.
 *
 * **It ADVISES and does not block, and that asymmetry is measured rather than cautious.**
 * `publish.ts:216` sorts an unparseable version "below every valid one rather than throwing",
 * so the registry ACCEPTS a version this check dislikes — as a first release it publishes
 * cleanly. A client gate stricter than the server would refuse a submission the registry
 * would have taken, which is a worse failure than a note, and it is the failure a validator
 * written on this side rather than read off that one always produces.
 */
function looksLikeSemver(version: string): boolean {
  return parseSemver(version.trim()) !== undefined;
}

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
 * core alone loses that card to `card/unknown-term` and comes out with a different
 * reading, which would mean this page rejecting the folder the blueprint pages hand out.
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
  /* D-263-09's default. It is a real starting value rather than an empty field because
     every other field on step 2 can be left blank and this one cannot: `publish` requires
     `version` and refuses a submission without it at the transport layer. A blank that 400s
     is a worse first experience than a first release numbered the way first releases are. */
  version: FIRST_VERSION,
};

/**
 * `EMPTY_DETAILS`, prefilled from a pinned target's own stored fields.
 *
 * A dropped `blueprint.yaml` prefills the same way, through `detailsFromManifest` — this
 * is the second source that can fill Details before the reader types anything, and it
 * exists so a title and a summary given on `/new` are not retyped the moment the reader
 * reaches `/upload` to publish into what `/new` just reserved.
 */
function detailsWithTarget(target: PublishTarget | undefined): BundleDetails {
  if (target === undefined) return EMPTY_DETAILS;
  return {
    ...EMPTY_DETAILS,
    ...(target.title === undefined ? {} : { title: target.title }),
    ...(target.summary === undefined ? {} : { summary: target.summary }),
    ...(target.description === undefined ? {} : { description: target.description }),
    ...(target.category === undefined ? {} : { category: target.category }),
    ...(target.tags === undefined ? {} : { tags: [...target.tags] }),
  };
}

/* ------------------------------------------------------------------ */
/*  The report, as a file                                              */
/* ------------------------------------------------------------------ */

/**
 * One file as something a browser will save: a `data:` URL over the text, assembled in the
 * tab. There is no server to write a file on request and nothing here needs one.
 *
 * The construction was taken from `/build`'s download exit, which built all nine of its
 * files this way. That file went with the route on 2026-09-06, so this is the only copy of
 * the technique left in the tree and there is nothing to keep it in step with.
 */
function dataHref(text: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

/**
 * What became of these bytes, for the one sentence at the top of `REPORT.md`.
 *
 * A closed union rather than an optional release, because the file is now handed over on
 * both ends of a publish (AC4) and "no release" is a fact the report has to state, not an
 * absence it can leave to the reader.
 */
type StoredLine =
  | { published: true; ownerHandle: string; slug: string; version: string; digest: string }
  | { published: false };

/**
 * The report's opening claim about where these bytes went.
 *
 * Deliberately free of the words this route is no longer allowed to say (AC5): a refusal
 * means no release was created, which is a fact about ONE submission, and the sentence must
 * not be readable as the old blanket claim that nothing ever leaves the tab.
 */
function storedSentence(stored: StoredLine | undefined): string {
  if (stored === undefined) {
    return "This bundle has not been submitted to the registry. This file is a reading, not a record of a release.";
  }
  if (!stored.published) {
    return "The registry refused this submission, so no release was created and nothing here describes a stored bundle.";
  }
  return `Published to the registry as ${stored.ownerHandle}/${stored.slug}, release ${stored.version}, digest ${stored.digest}.`;
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
 * three-line notice and two buttons that both discarded the run. `/build` ended in nine
 * downloadable files and set the bar this had to clear; it was deleted on 2026-09-06, and
 * this still ends in one file, which is the only thing the route produces that did not
 * exist before the reader arrived.
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
  /**
   * What the registry did with these bytes, when it was asked. Absent while the reader is
   * still on the form.
   *
   * The report is handed over on BOTH ends of a publish now (AC4), so its opening sentence
   * cannot be a constant any more: after a refusal nothing was stored and after a release
   * something was, and one file claiming the wrong one of those is worse than either.
   */
  stored?: StoredLine;
}): string {
  const { result, title, slug, kindNoun, stored } = args;
  const { blueprint, analysis } = result;
  /* D-109, and it has to stay spelled the same as `ValidationReport`'s `usable` and
     `bundleProgress`'s `resolves`: the downloadable report opens on the verdict the page
     printed, so a third spelling of this predicate is a report that contradicts the screen
     it came from. */
  const resolved =
    blueprint !== undefined && analysis !== undefined && isReleasable(result.diagnostics);
  const progress = bundleProgress(result);

  const out: string[] = [];
  out.push(`# Validation report: ${title}`);
  out.push("");
  out.push(
    `Produced by DarkPrint over the bytes named below. ${storedSentence(stored)}`,
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
        ? `Not computed yet. ${progress.waiting} of the graph's ${progress.total} nodes have no card in the folder. A reading over nodes the engine could not open would have nothing behind it. Write the rest and run this again.`
        : "Not computed. DarkPrint will not put a number on a graph whose references it could not check. The diagnostics below are the whole of what this run produced.",
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
      "Which of the five lifecycle phases this graph acts in. This describes scope. Nothing is charged for a phase this graph leaves to somebody else.",
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
    "Everything above was read off the files, standing still. Nothing here was measured. Cost and time are reported by whoever runs the graph. The platform never sees the execution.",
  );
  out.push("");
  /* ── D-263-01, and this sentence is the second of the two the ruling rewrote ──
     It used to say the wizard resolves against the curated core alone while the archive
     adds its own namespaced terms. The cutover did not close that gap, it MOVED it, and
     saying the old thing now would be wrong in a new way.

     ── Rewritten again 2026-09-05, §11.0 Q32 ──
     The version half of it was false three ways at once: no manifest has named an ontology
     version since D-93, `openView` has taken no version argument since the same day, and
     D-131 deleted versioning outright. It was pointing a reader at a mechanism with no
     parts left.

     What the sentence is FOR survives all of that: there are two readings and the
     registry's decides. The overlay is what still makes them differ. This tab resolves
     against the shipped core plus the terms `BundleDropzone` could parse out of the
     folder's `ontology/extensions.yaml`; the registry resolves against the core plus the
     overlay it stores, which is that file's raw text as `doPublish` sent it, parsed on the
     server (`lib/server/publish/publish.ts`). So a vocabulary this tab could not read is a
     real divergence rather than a hypothetical one: `readVocabulary` answers no terms and
     the reading above falls back to the core alone, while the bytes still go to the
     registry, which may parse them. The client-side pass stays on purpose, it is the fast
     one, and the server's is the one that decides. */
  out.push(
    "This reading was taken in your browser, against the curated core vocabulary plus whatever terms this page could read out of the folder's `ontology/extensions.yaml`. The registry takes its own reading when you publish, against that same core plus the overlay it stores with the bundle, which it parses from the file itself. If this page could not read that file, the terms in it are missing here and may not be missing there. The registry's reading decides.",
  );
  out.push("");

  return out.join("\n");
}

/**
 * What a refusal says to the author, chosen by `kind` (AC2).
 *
 * ── The `kind` is the whole reason this is a switch and not the server's `detail` ──
 * All five refusals are one class carrying a `kind` precisely because "the UI writes three
 * different sentences from them" (`lib/server/publish/errors.ts`), and two of the five —
 * `unfinished` and `in-error` — share a status code. Printing `detail` alone would collapse
 * them back into one voice, which is what the `kind` exists to prevent.
 *
 * ── AC2, literally ──
 * `unfinished` never mentions an error count. It has one — an unfinished folder is full of
 * errors, all of them the shadow of a card nobody has written yet, which `unfinished()`'s own
 * docblock says in as many words — and reporting that number as a fault is the reading doc 2
 * §1.1 and `progress.ts` both exist to prevent. The counts it does print are `placed` and
 * `total`, the same two the disabled note prints, from the same source.
 *
 * The server's `detail` is carried for every other kind rather than paraphrased: those
 * sentences have one author (D-50-08) and re-rendering them here would put a second one on
 * them. `conflict`, `not-owner` and `version-not-higher` all name values only the caller
 * already holds, so there is nothing in them this page has to withhold.
 */
function refusalSentence(
  kind: PublishRefusedKind,
  detail: string,
  progress: BundleProgress | undefined,
): ReactNode {
  if (kind === "unfinished") {
    return (
      <>
        <span className="font-mono text-warn">still being written</span>:{" "}
        {progress === undefined
          ? "the registry resolved this bundle against its own vocabulary and some node has no card yet."
          : `${progress.placed} of ${progress.total} nodes have their card.`}{" "}
        There is nothing to fix. Write the rest and publish again. The Preview step names
        the ones still waiting. The report below travels with you meanwhile.
      </>
    );
  }
  if (kind === "not-owner") {
    return (
      <>
        <span className="font-mono text-signal">not yours</span>: {detail} A slug belongs to
        one account, and this one is not on yours. Publish it under a slug you own.
      </>
    );
  }
  return (
    <>
      <span className="font-mono text-signal">{kind}</span>: {detail}
    </>
  );
}

/** A real bundle out of the archive, handed down by the server page (§5 step 1). */
export interface ExampleBundle {
  /** The blueprint's title, named on the "load an example" button. */
  title: string;
  /** Manifest, topology and every pinned card, named the way the archive names them. */
  files: UploadFile[];
}

/**
 * A bundle this release is pinned to, per `?owner=&slug=` — `app/upload/page.tsx` builds
 * one only once the session it read owns the addressed bundle (B-03: the check happens
 * server-side, before the wizard ever sees the pin).
 *
 * `visibility` travels with it rather than being re-asked: `publish` ignores a submitted
 * visibility on an append and keeps the bundle's own (`publish.ts`'s own comment — "not
 * an occasion to rewrite the bundle row's visibility"), so re-offering the control would
 * show a choice that cannot do anything. The four optional fields are what `POST
 * /api/bundles/draft` or an earlier release already stored; present, they fill Details
 * the same way a dropped `blueprint.yaml` does, so the reader is not retyping a title
 * they already gave the bundle on `/new`.
 */
export interface PublishTarget {
  owner: string;
  slug: string;
  visibility: "public" | "private";
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  tags?: readonly string[];
}

/* ------------------------------------------------------------------ */
/*  Chip field (tags)                                                  */
/* ------------------------------------------------------------------ */

/** Exported for the same reason `inputCls` is: `/new`'s Tags field is this field. */
export function ChipField({
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
export function UploadFlow({
  example,
  target,
}: {
  example: ExampleBundle;
  /** `?owner=&slug=`, resolved and ownership-checked by `app/upload/page.tsx`. Absent for
      the ordinary case — a reader arriving with no bundle already in mind. */
  target?: PublishTarget;
}) {
  const [step, setStep] = useState<StepId>(1);
  const [kind, setKind] = useState<ContentKind>("blueprint");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [details, setDetails] = useState<BundleDetails>(() => detailsWithTarget(target));
  /** One document — a lone node card or vocabulary — for the Node and Ontology kinds.
      `files` above stays empty for those kinds, which is what keeps `canAdvance` and the
      Blueprint-only derived state below correctly inert rather than needing a second
      guard on every one of them. */
  const [singleDoc, setSingleDoc] = useState<SingleDoc | undefined>(undefined);
  /**
   * What `POST /api/validate/card` or `POST /api/validate/ontology` answered about
   * `singleDoc`, kept apart from `result` above because the two ask different servers:
   * the blueprint pass runs `loadBundle` in this tab (SEAM-30 stays client-side, by
   * design — see the header), while a lone document is checked over HTTP, and a network
   * call has a `checking` and a `failed` state a synchronous call never needs.
   */
  const [singleValidationFetch, setSingleValidationFetch] = useState<SingleValidation>({
    state: "idle",
  });
  /**
   * What the registry said, once it has been asked. Absent while the reader is on the form.
   *
   * This replaces the `submitted` boolean, and the widening is the whole of AC2 and AC4: a
   * flag can only say the wizard ended, and there are now four ways it can end — a release,
   * a refusal the author can act on, a rejection about something other than the bundle, and
   * an unreachable registry. Each needs a different sentence, and a boolean was how the old
   * screen came to state one outcome unconditionally.
   */
  const [outcome, setOutcome] = useState<PublishOutcome | undefined>(undefined);
  /** In flight. The button says so and cannot be pressed twice into two releases. */
  const [publishing, setPublishing] = useState(false);
  /**
   * Public or private, chosen rather than defaulted (D-263-09).
   *
   * `PublishInput.visibility` is optional and absence takes the account default, so this
   * could have been left off the wire entirely. It is sent explicitly because the ledger row
   * it retires promises "each blueprint public or private the way a repository is" — a
   * promise a hidden default does not keep — and because a reader who can see the choice on
   * screen knows what will happen without knowing what their account default is.
   *
   * `private` is the starting value — UNLESS a `target` is pinned, in which case it is the
   * bundle's OWN visibility and the choice is not offered again (`publish.ts`'s own rule:
   * an append ignores a submitted visibility and keeps the bundle's). Publishing somebody's
   * first upload to the world because they did not notice a control is the failure that
   * cannot be undone by editing a setting.
   */
  const [visibility, setVisibility] = useState<"public" | "private">(
    () => target?.visibility ?? "private",
  );
  /**
   * The last Attractor import, if this reader made one (Q20 c).
   *
   * Held rather than folded into `files` because an import produces two things and only one
   * of them is a file: the folder, which goes into the selection and is read from there like
   * any other drop, and what the import COST — the nodes that arrived with an empty `spec`
   * and the attributes no card field holds. The second is a fact about a file that is no
   * longer in the selection, so nothing downstream could re-derive it.
   *
   * `recordApplies` decides whether it still describes what is on screen. See `applied`.
   */
  const [attractorImport, setAttractorImport] = useState<AttractorImportRecord | undefined>(
    undefined,
  );
  const session = useUploadSession();

  /* ---------- the whole pipeline, derived ---------- */

  const parts = useMemo(() => classifyBundle(files), [files]);
  const bundle = useMemo(() => assembleBundle(parts, details), [parts, details]);
  const ontology = useMemo(() => viewFor(parts.terms), [parts.terms]);

  /* ---------- Q20 (c): an Attractor pipeline, read in this tab ---------- */

  /**
   * The dropped topology, when it is somebody else's pipeline rather than a DarkPrint
   * bundle. `undefined` on every ordinary drop, which is what keeps the existing path
   * untouched — see `detectAttractorPipeline` for the boundary and why `card=` vetoes.
   *
   * Asked of `parts.dot` and not of every `.dot` in the selection: `pickTopology` has
   * already decided which file this wizard is reading, and offering to convert one it is
   * not reading would be an offer about a chip marked `ignored`.
   */
  const attractorCandidate = useMemo(
    () => (parts.dot === undefined ? undefined : detectAttractorPipeline(parts.dot)),
    [parts.dot],
  );

  /**
   * The import record, but only while it still describes the selection on screen.
   *
   * A record whose synthesised topology has been replaced is about a graph nobody is
   * looking at, and its diagnostics would name nodes that are not in the bundle. The two
   * panels and the diagnostic merge below all read this rather than the raw state, so
   * there is one answer to "does this still apply" instead of three.
   */
  const applied = useMemo(
    () => (recordApplies(attractorImport, files) ? attractorImport : undefined),
    [attractorImport, files],
  );
  const result: LoadBundleResult | undefined = useMemo(() => {
    if (bundle === undefined) return undefined;
    const loaded = loadBundle(bundle, { ontology });
    // Doc 3 §7: a local term the core does not subsume is "ignorata silenziosamente, che è
    // il peggior esito possibile" — every card using it validates and the reading taken
    // over it is quietly wrong. `loadBundle` deliberately leaves defects in the vocabulary to
    // whoever built the view, so the caller that built it reports them, exactly as the
    // build-time loader does with the archive's own.
    const vocabulary = parts.vocabulary === undefined ? [] : ontology.validate();
    // `parts.diagnostics`: problems the classifier itself raised — today, only a legacy
    // `blueprint.dot` demoted in favour of `topology.dot` — merged the same way, since
    // `result.diagnostics` is the one list every surface of this wizard reads.
    /* `applied.diagnostics`: what the Attractor import had to say about the file it read.
       They belong here and nowhere else. Every one of them is about a source file that is
       no longer in the selection — the node that carried no `prompt`, the `timeout` no card
       field holds — so `loadBundle` cannot rediscover them from the folder it was handed,
       and a reader who reaches the Preview step without them is looking at four errors with
       no account of where the cards came from. Merged rather than shown only on step 1 so
       they reach the report the reader downloads, which reads `result.diagnostics`. */
    const extra = [...vocabulary, ...parts.diagnostics, ...(applied?.diagnostics ?? [])];
    if (extra.length === 0) return loaded;
    return {
      ...loaded,
      diagnostics: sortDiagnostics([...loaded.diagnostics, ...extra]),
    };
  }, [bundle, ontology, parts.vocabulary, parts.diagnostics, applied]);

  const errorCount = result === undefined ? 0 : summarize(result.diagnostics).error;
  /* The publish gate. D-109 makes it `isReleasable` rather than "carries any error": a
     reading DarkPrint drew about somebody else's graph may be printed beside a release and
     may not refuse one, and the wizard is the surface where that refusal was felt. */
  const blocked = result === undefined || !isReleasable(result.diagnostics);
  /* Blueprint gates on a topology; Node and Ontology gate on the one document they check —
     neither carries a `.dot`, so `parts.dot` alone would lock the wizard on step 1 for both
     kinds forever. */
  const canAdvance = kind === "blueprint" ? parts.dot !== undefined : singleDoc !== undefined;

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

  /**
   * SEAM-33, **LIVE**: a lone Node or Ontology document, checked over HTTP the moment it
   * lands rather than on an explicit "check" press — the same automatic-on-drop behaviour
   * the Blueprint kind already has via the synchronous `result` above, so a reader does
   * not have to learn two different rhythms for three kinds of one wizard.
   *
   * `AbortController` per request (`WelcomeForm.tsx`'s own device, for the same race): a
   * slow answer for the first paste landing after a fast one for the second would label
   * the second document with the first's verdict.
   */
  useEffect(() => {
    const endpoint = VALIDATE_ENDPOINT[kind];
    // No setState on this branch — `singleValidation` below derives "idle" for exactly
    // this condition, so there is nothing for the effect to synchronise. Writing it here
    // too would be the same state expressed twice, decided by whichever assignment runs
    // last on a given render.
    if (endpoint === undefined || singleDoc === undefined) return;
    const controller = new AbortController();
    // Inside the async body rather than as the effect's first statement: a setState
    // called directly in an effect's top-level statements is flagged by
    // `react-hooks/set-state-in-effect` even when — as here — it is genuinely reporting
    // that an async operation this effect owns has started, rather than deriving a value
    // render already had.
    void (async () => {
      setSingleValidationFetch({ state: "checking" });
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ source: singleDoc.text }),
          signal: controller.signal,
        });
      } catch {
        if (controller.signal.aborted) return;
        setSingleValidationFetch({ state: "failed", detail: "The validator could not be reached." });
        return;
      }
      if (!response.ok) {
        const problem = (await response.json().catch(() => ({}))) as { detail?: string };
        setSingleValidationFetch({
          state: "failed",
          detail: problem.detail ?? `The validator answered ${response.status}.`,
        });
        return;
      }
      const body = (await response.json()) as { card?: unknown; terms?: unknown; diagnostics?: unknown };
      const diagnostics = Array.isArray(body.diagnostics) ? (body.diagnostics as Diagnostic[]) : [];
      // `ValidateCardResult`/`ValidateVocabularyResult` both carry their success field only
      // when nothing of error severity was reported — the same rule `hasErrors` checks over
      // a blueprint's diagnostics, read here off the field's presence instead of re-summing
      // severities the response already resolved.
      const ok = kind === "node" ? body.card !== undefined : body.terms !== undefined;
      setSingleValidationFetch({ state: "done", diagnostics, ok });
    })();
    return () => controller.abort();
  }, [kind, singleDoc]);

  /**
   * What the UI actually shows. `singleValidationFetch` only ever holds what a fetch
   * found — "idle" is never written to it — so a stale "done" or "failed" cannot outlive
   * the document or the kind it was about: clearing `singleDoc`, or switching to
   * Blueprint, reads as idle here on the very next render rather than waiting for the
   * effect above to notice and write it back.
   */
  const singleValidation: SingleValidation =
    VALIDATE_ENDPOINT[kind] === undefined || singleDoc === undefined
      ? { state: "idle" }
      : singleValidationFetch;

  /* ---------- editing ---------- */

  /* A dropped `blueprint.yaml` answers most of step 2, so the form is filled from it
     the moment it lands — after which the form is the source of truth and wins. */
  const takeFiles = useCallback((next: UploadFile[]) => {
    setFiles(next);
    const doc = classifyBundle(next).manifestDoc;
    if (doc !== undefined) setDetails((d) => ({ ...d, ...detailsFromManifest(doc) }));
  }, []);

  /**
   * Q20 (c): read the dropped pipeline, and put what it wrote into the selection.
   *
   * Goes through `takeFiles`, which is the same call the drop zone makes, so the manifest
   * the import synthesised prefills the Details step exactly as a dropped `blueprint.yaml`
   * would and there is one path into this wizard rather than two.
   *
   * `author` comes from the caller because the panel is the surface that read the session
   * and refused when it had no handle. Passed rather than read again here, so the name the
   * reader was shown on the button is the name written into the cards.
   */
  const runAttractorImport = useCallback(
    (author: string) => {
      if (attractorCandidate === undefined) return;
      const record = importSelection(attractorCandidate, author, files);
      takeFiles(record.files);
      setAttractorImport(record);
    },
    [attractorCandidate, files, takeFiles],
  );

  /** The selection as it was before the import, and the record gone with it. */
  const undoAttractorImport = useCallback(() => {
    if (applied === undefined) return;
    takeFiles([...applied.restore]);
    setAttractorImport(undefined);
  }, [applied, takeFiles]);

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

  /** Everything gone: a different project, typed from scratch.

      `detailsWithTarget(target)` and not the bare `EMPTY_DETAILS`, and `target?.visibility`
      and not the bare `"private"`: a pinned bundle's own fields and its own visibility are
      not part of what "empty" means here — they describe the ADDRESS this release still
      goes to, which a reader typing a fresh title has not changed their mind about. */
  function reset() {
    setOutcome(undefined);
    setStep(1);
    setKind("blueprint");
    setFiles([]);
    setSingleDoc(undefined);
    setDetails(detailsWithTarget(target));
    setVisibility(target?.visibility ?? "private");
    setAttractorImport(undefined);
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
    setOutcome(undefined);
    setStep(1);
    setFiles([]);
    setSingleDoc(undefined);
    /* `recordApplies` would already answer false against an empty selection, so this is
       the state and not the behaviour: a record about a folder nobody can see is a leak
       waiting for the next drop to accidentally match it. */
    setAttractorImport(undefined);
  }

  /* ---------- navigation ---------- */

  /* Parameter named `to`, not `target`: this component also takes a `target` PROP (the
     pinned bundle), and a local binding of the same name would shadow it for the rest of
     this function — harmless here since the body never reads the prop, but one keystroke
     away from a bug the next edit introduces silently. */
  function jump(to: StepId) {
    // Can always step back; can only go forward once there is something to read.
    if (to > step && !canAdvance) return;
    setStep(to);
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

  // The slug the registry would key on. A pinned target wins outright — the release has
  // to land on the bundle the URL named, whatever a dropped manifest's own `slug` field
  // says (`publish`'s addressing is the body's top-level `slug`, never `manifest.slug`,
  // which travels only as descriptive metadata). Absent a pin, a dropped manifest owns
  // its own — §4 makes it the blueprint's identity — so only a synthesised manifest gets
  // one off the title.
  const slug =
    target?.slug ??
    bundle?.manifest.slug ??
    (details.title.trim() === "" ? "untitled-blueprint" : slugify(details.title));

  /** What the reader is looking at, named the way the report and the card both name it. */
  const reportTitle =
    details.title.trim() || bundle?.manifest.title || `Untitled ${KIND_NOUN[kind]}`;

  /* ---------- what the registry needs that the bundle does not carry ---------- */

  /** The declared release version. Trimmed here so every reader below sees one value. */
  const declaredVersion = (details.version ?? "").trim();
  /** Empty is the one version state that blocks: the route reads it with `readString` and 400s. */
  const versionMissing = declaredVersion === "";
  /** Present but not a semver. A note, never a gate — see `looksLikeSemver`. */
  const versionOdd = !versionMissing && !looksLikeSemver(declaredVersion);

  /**
   * Everything that has to be true before the button can do what it says.
   *
   * `session.state === "ready"` and not merely "not anonymous": a session with no handle
   * cannot name an owner, and `publish` resolves the owner FROM the handle. Sending a
   * submission without one would earn a 400 the reader cannot act on.
   */
  const canPublish =
    !blocked && !versionMissing && session.state === "ready" && !publishing && bundle !== undefined;

  /**
   * What the report should say became of these bytes.
   *
   * Derived from the outcome rather than passed at the call site, so the file and the screen
   * cannot disagree about whether a release exists.
   */
  const stored: StoredLine | undefined = useMemo(() => {
    if (outcome === undefined) return undefined;
    if (outcome.state !== "published") return { published: false };
    return {
      published: true,
      ownerHandle: session.state === "ready" ? session.handle : "",
      slug,
      version: declaredVersion,
      digest: outcome.release.digest,
    };
  }, [outcome, session, slug, declaredVersion]);

  /**
   * The report, built once there is a reading to hand over.
   *
   * **AC4: this is no longer gated on the bundle being publishable.** It used to be reachable
   * only from the success screen, which sat behind a Publish button `blocked` kept disabled —
   * so the population that most needed the file was the one population that could never get
   * it (`reportMarkdown`'s own docblock: "Nobody has read that file"). Every ending renders
   * this control now, refusals included.
   */
  const reportHref = useMemo(() => {
    if (result === undefined) return undefined;
    return dataHref(
      reportMarkdown({
        result,
        title: reportTitle,
        slug,
        kindNoun: KIND_NOUN[kind],
        ...(stored === undefined ? {} : { stored }),
      }),
    );
  }, [result, reportTitle, slug, kind, stored]);

  /**
   * Ask the registry, and record whatever it says.
   *
   * Every failure is a state rather than a throw (`publishBundle` does not reject), so there
   * is no `catch` here and no path on which the reader is left looking at a form that did
   * nothing. `publishing` is cleared in both directions for the same reason.
   */
  async function doPublish() {
    if (!canPublish || bundle === undefined || session.state !== "ready") return;
    setPublishing(true);
    const answer = await publishBundle({
      ownerHandle: session.handle,
      slug,
      version: declaredVersion,
      manifest: bundle.manifest,
      dot: bundle.dot,
      cardFiles: { ...bundle.cardFiles },
      ...(parts.vocabulary === undefined ? {} : { vocabulary: parts.vocabulary.text }),
      visibility,
    });
    setPublishing(false);
    setOutcome(answer);
  }

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
            {/* Content kind selector, ABOVE the drop target now: which one renders below
                it depends on the answer, so a reader picks the kind before meeting a
                target sized for it rather than after. */}
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
                      aria-label={`${k.label}: ${k.hint}`}
                      /* Both hovers gated: this selector is a tap target on the first
                         step, and an ungated `hover:` latches on a phone — the pressed
                         kind keeps the lit state right up to the route change, which on
                         a three-way selector reads as two things being chosen at once. */
                      className={cx(
                        "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-surface-3 text-fg shadow-[inset_0_0_0_1px_var(--color-line-bright)]"
                          : "text-muted hoverable:hover:text-fg",
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
              <p className="max-w-xl text-xs leading-relaxed text-dim">
                {kind === "blueprint" ? (
                  <>
                    The validator joins a DOT to the cards it pins, so it reads a whole
                    bundle.
                  </>
                ) : (
                  <>
                    A {KIND_NOUN[kind]} on its own checks against the curated core
                    vocabulary alone, the same reading a bundle&rsquo;s own cards get
                    before any local overlay is layered on. Publishing one by itself is
                    not built. The registry stores a {KIND_NOUN[kind]} today only when
                    pinned inside a blueprint bundle that publishes. The last step here
                    says so.
                  </>
                )}
              </p>
            </div>

            {kind === "blueprint" ? (
              <BundleDropzone
                files={files}
                parts={parts}
                onChange={takeFiles}
                onLoadExample={loadExample}
                exampleLabel={example.title}
              />
            ) : (
              <SingleDocDropzone doc={singleDoc} onChange={setSingleDoc} kindLabel={KIND_NOUN[kind]} />
            )}

            {/* ── Q20 (c): the reader dropped an Attractor pipeline ──
                Under the drop target and above nothing, because it is about the file that
                is already in the manifest above it and the reader has to see the two
                together to know which chip it means.

                The two are mutually exclusive by construction rather than by an `else`:
                the topology the import synthesises pins every node at `card=`, which is
                `detectAttractorPipeline`'s own veto, so a candidate cannot survive its own
                import. Written as two independent conditions anyway, so that if that ever
                stops being true the page shows both facts rather than hiding one. */}
            {kind === "blueprint" && attractorCandidate !== undefined && (
              <AttractorOffer
                candidate={attractorCandidate}
                session={session}
                onImport={runAttractorImport}
              />
            )}
            {kind === "blueprint" && applied !== undefined && (
              <AttractorImported record={applied} onUndo={undoAttractorImport} />
            )}
          </div>
        )}

        {step === 2 &&
          (kind !== "blueprint" ? (
            /* Node and Ontology check one document each; neither has a release, a
               visibility or cards to read agents and tools off, so the whole of the
               blueprint-only form below does not apply. Title is the one field a report
               can use, and it is offered rather than asked for. */
            <div className="grid max-w-3xl gap-5">
              <p className="max-w-xl text-sm leading-relaxed text-muted">
                A {KIND_NOUN[kind]} is checked on its own. No release, no visibility, no
                derived agents or tools. Give it a title for the report, if you want one.
              </p>
              <div className="flex flex-col gap-2 sm:max-w-md">
                <label className="label" htmlFor="single-title">
                  Title
                </label>
                <input
                  id="single-title"
                  value={details.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder={`Untitled ${KIND_NOUN[kind]}`}
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
          <div className="grid max-w-3xl gap-5">
            {target !== undefined && (
              /* The pin from `?owner=&slug=`. Placed first: everything below it — the
                 slug caption, the visibility fieldset — reads differently once a reader
                 knows this release already has an address, and the notice is what makes
                 that legible before either one is reached. */
              <p className="rounded-md border border-cyan/30 bg-cyan/5 px-4 py-3 text-sm leading-relaxed text-fg">
                This release publishes into{" "}
                <span className="font-mono text-cyan">
                  {target.owner}/{target.slug}
                </span>
                . The slug and the visibility below are its own and are not asked again
                here.
              </p>
            )}

            <p className="max-w-xl text-sm leading-relaxed text-muted">
              These fields become the bundle&rsquo;s manifest. A{" "}
              <span className="font-mono text-cyan">blueprint.yaml</span> in the
              selection fills them in for you.{" "}
              {parts.manifest === undefined
                ? "There is none here, so a minimal one is synthesised from what you type."
                : `They were read from ${parts.manifest.name}.`}
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
                {target !== undefined && " (fixed: publishing into this bundle)"}
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

            {/* ── The two things the registry needs that a manifest does not carry ──
                Neither is a manifest field: `BundleManifest` has no version and no
                visibility, so a dropped `blueprint.yaml` answers neither. They sit under
                their own rule because they describe the RELEASE rather than the blueprint,
                and because both are questions a reader has to have answered before the
                Publish button two steps on can mean anything. */}
            <div className="flex flex-col gap-5 border-t border-line pt-5">
              <p className="max-w-xl text-sm leading-relaxed text-muted">
                <span className="text-fg">The release.</span> A bundle is published as a
                numbered release you own, and each later release of the same slug has to
                be numbered above the last.
              </p>

              <div className="flex flex-col gap-2 sm:max-w-xs">
                <label className="label" htmlFor="bp-version">
                  Version
                </label>
                <input
                  id="bp-version"
                  value={details.version ?? ""}
                  onChange={(e) => setField("version", e.target.value)}
                  placeholder={FIRST_VERSION}
                  className={cx(inputCls, "font-mono")}
                  aria-describedby="bp-version-note"
                />
                {/* Two different sentences, and neither is a rejection. An empty field is
                    the only one that stops a publish, because the registry reads the field
                    as required; a version that does not look like a semver is passed on
                    with a note, because the registry accepts it and sorts it below every
                    numbered release. Saying "invalid" about a value the server takes would
                    be this page inventing a rule. */}
                <p id="bp-version-note" className="text-[11px] leading-relaxed text-dim">
                  {versionMissing ? (
                    <>
                      A release needs a number. {FIRST_VERSION} is the usual first one.
                    </>
                  ) : versionOdd ? (
                    <>
                      <span className="font-mono text-warn">{declaredVersion}</span> is not
                      a semantic version. The registry will take it and sort it below every
                      numbered release, so the next release of this slug cannot be numbered
                      against it.
                    </>
                  ) : (
                    <>Semantic version. The next release of this slug must be above it.</>
                  )}
                </p>
              </div>

              {target !== undefined ? (
                /* Inherited, not re-asked: `publish.ts` ignores a submitted visibility on
                   an append and keeps the bundle's own, so offering the choice again
                   would show a control that cannot do anything. */
                <div className="flex flex-col gap-2">
                  <span className="label">Visibility</span>
                  <p className="max-w-xl text-sm leading-relaxed text-muted">
                    Inherited from{" "}
                    <span className="font-mono text-cyan">
                      {target.owner}/{target.slug}
                    </span>
                    : this release is{" "}
                    <span className="text-fg">{visibility === "public" ? "public" : "private"}</span>.
                    Change it from the blueprint&rsquo;s own page, not here.
                  </p>
                </div>
              ) : (
                <fieldset className="flex flex-col gap-2">
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
                          /* Same shape and the same gated hover as the kind selector on
                             step one, for the reason that one records: an ungated
                             `hover:` latches on a phone and a two-way selector then reads
                             as both chosen. */
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
                    Private is the starting choice. You can publish a private release and
                    keep working. A reader of the archive sees only what you make public.
                  </p>
                </fieldset>
              )}
            </div>

            <div className="flex flex-col gap-5 border-t border-line pt-5">
              <p className="max-w-xl text-sm leading-relaxed text-muted">
                <span className="text-fg">Read off your cards.</span> The graph needs a
                property of the nodes it instantiates. You do not declare it by hand. The
                registry computes it.
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
          ))}

        {step === 3 &&
          (kind !== "blueprint" ? (
            singleDoc === undefined ? (
              <div className="rounded-lg border border-line bg-surface-2/40 p-5">
                <h3 className="font-display text-xl font-semibold text-fg">
                  Nothing to validate
                </h3>
                <p className="prose-lane mt-4 text-sm leading-relaxed text-muted">
                  Drop a single <span className="font-mono text-cyan">.yaml</span>{" "}
                  document, a {KIND_NOUN[kind]}, on the first step. It validates here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* The same verdict strip shape `ValidationReport` draws for a blueprint,
                    over the two-state answer a lone document gets instead of three:
                    there is no "unfinished" here, since one document is not a graph a
                    reader fills in a card at a time. */}
                <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface-2/40 px-4 py-3">
                  {singleValidation.state === "checking" && (
                    <span className="font-mono text-xs text-dim">Checking…</span>
                  )}
                  {singleValidation.state === "failed" && (
                    <span className="font-mono text-xs text-signal">{singleValidation.detail}</span>
                  )}
                  {singleValidation.state === "done" && (
                    <>
                      <span
                        className="font-mono text-sm"
                        style={{
                          color: singleValidation.ok
                            ? "var(--color-emerald)"
                            : "var(--color-signal)",
                        }}
                        aria-hidden
                      >
                        {singleValidation.ok ? "✓" : "✕"}
                      </span>
                      <span className="font-mono text-xs uppercase tracking-[0.14em] text-fg">
                        {singleValidation.ok
                          ? `${KIND_NOUN[kind]} resolves`
                          : `${KIND_NOUN[kind]} rejected`}
                      </span>
                    </>
                  )}
                </div>
                {singleValidation.state === "done" && (
                  <DiagnosticList diagnostics={singleValidation.diagnostics} title="Validator report" />
                )}
              </div>
            )
          ) : result === undefined ? (
            <div className="rounded-lg border border-line bg-surface-2/40 p-5">
              <h3 className="font-display text-xl font-semibold text-fg">
                Nothing to validate
              </h3>
              <p className="prose-lane mt-4 text-sm leading-relaxed text-muted">
                A bundle without a <span className="font-mono text-cyan">.dot</span> is
                not incomplete. It is not a bundle. Go back to the first step and add the
                topology.
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
          (outcome !== undefined ? (
            /* ── The handover ──
               This screen used to replace the entire step with a three-line notice and
               two buttons, both of which threw the run away: one left the route and the
               other called `reset`, which wiped the files, the kind, the manifest and the
               step. So the route with the highest effort cost on the site ended with the
               lowest payload, while `/build` — where the reader typed nothing — ended in
               nine downloadable files. That route was deleted on 2026-09-06. The comparison
               is what forced this screen, so it stays here as the reason; there is no
               longer a page to go and look at.

               What the engine computed stays mounted, and it leaves with the reader as
               `REPORT.md`.

               ── AC3, AC4 and what the cutover changed here ──
               The screen used to have ONE ending, because there was one: the button set a
               flag and the flag meant "the wizard is over". There are four now, and the
               heading, the glyph and the sentence under it are all read off the outcome.
               `REPORT.md` is offered on every one of them — that is AC4, and it is a
               CHANGE rather than a non-regression: `hasErrors` is the plain count
               (`lib/core/diagnostics.ts:220-222`), both non-publishable states carry
               error-severity diagnostics, and the only control offering the file sat
               behind a button `blocked` kept disabled. The population that most needed the
               report was precisely the population that could never reach it. */
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-start gap-4 sm:flex-row">
                <span
                  className={cx(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-2xl",
                    outcome.state === "published"
                      ? "border-emerald/40 bg-emerald/10 text-emerald"
                      : outcome.state === "refused"
                        ? "border-warn/40 bg-warn/10 text-warn"
                        : "border-signal/40 bg-signal/10 text-signal",
                  )}
                  aria-hidden
                >
                  {outcome.state === "published" ? "✓" : "!"}
                </span>
                <div className="flex min-w-0 flex-col gap-3">
                  <h3 className="font-display text-xl font-semibold text-fg">
                    {outcome.state === "published"
                      ? outcome.release.created
                        ? "Published. The registry holds it."
                        : "Released. The registry holds the new version."
                      : outcome.state === "refused"
                        ? "Not published. The registry declined it."
                        : "Not published."}
                  </h3>
                  {/* AC3. The success sentence states what was STORED — the owner, the
                      slug, the release and the digest — rather than what was not sent.
                      Owner, slug and release are rendered from what this tab submitted and
                      only the digest comes back, which is D-263-07's ratified reading:
                      `PublishResult` is `{bundleId, releaseId, digest, created}` and names
                      neither an owner nor a slug, so a screen waiting for them from the
                      body would render blanks against a correct route. */}
                  <p className="prose-lane text-sm leading-relaxed text-muted">
                    {outcome.state === "published" ? (
                      <>
                        Stored as{" "}
                        <span className="font-mono text-cyan">
                          {session.state === "ready" ? session.handle : "you"}/{slug}
                        </span>
                        , release{" "}
                        <span className="font-mono text-cyan">{declaredVersion}</span>,{" "}
                        {visibility === "public" ? "public" : "private"}. The registry
                        recomputed the digest from the bytes it received and recorded{" "}
                        <span className="break-all font-mono text-[11px] text-muted">
                          {outcome.release.digest}
                        </span>
                        . The report below is the same reading in a file you keep.
                      </>
                    ) : outcome.state === "refused" ? (
                      refusalSentence(outcome.kind, outcome.detail, progress)
                    ) : (
                      <>
                        {outcome.state === "rejected" ? outcome.title : "The registry could not be reached"}
                        : {outcome.detail} Your bundle is still here and the report below
                        carries the whole reading.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* The result, still on the card. It was unmounted here — the digest, the
                  autonomy class and the security level all vanished the moment the
                  reader pressed the button that produced them.

                  ── `!blocked` is new, and it is the gate `reportMarkdown` already keeps ──
                  This screen used to be reachable only with a clean bundle, so `analysis`
                  being present was the same question as the bundle resolving. It is not any
                  more: AC4 lands a REFUSED bundle here, resolution degrades, and a folder
                  three cards into eight arrives WITH an `analysis` computed over the two
                  fifths that resolved. Printing an autonomy class off that is the exact
                  failure `reportMarkdown`'s own header describes — the number this page
                  refuses to put on screen, put on screen. Both sides withhold together. */}
              {!blocked && result?.analysis !== undefined && (
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

              {/* AC4. The download is offered on EVERY ending, refusals included, and the
                  order changes with the ending: after a release the report is the souvenir,
                  after a refusal it is the thing the author works from next. */}
              <div className="flex flex-wrap items-center gap-3">
                {reportHref !== undefined && (
                  <ButtonLink
                    href={reportHref}
                    download="REPORT.md"
                    prefetch={false}
                    variant={outcome.state === "published" ? "primary" : "outline"}
                  >
                    Download the report
                  </ButtonLink>
                )}
                {/* A refusal is not the end of a run. `version-not-higher` and `conflict`
                    are both answered by editing one field two steps back, and a reader sent
                    to "Validate another bundle" would lose the whole selection to fix a
                    number. This keeps every file, the manifest and the form. */}
                {outcome.state !== "published" && (
                  <Button onClick={() => setOutcome(undefined)}>Back to the bundle</Button>
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
          ) : kind !== "blueprint" ? (
            /* Node and Ontology validate, they do not publish: the registry stores a
               lone card or vocabulary only pinned inside a blueprint bundle that
               publishes, and that path is not built. Saying so plainly here beats a
               Publish button wired to nowhere. */
            <div className="flex flex-col gap-6">
              <div className="panel flex flex-col gap-4 bg-surface-2/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <KindBadge kind={kind} />
                </div>
                <h3 className="font-display text-xl font-semibold leading-snug text-fg">
                  {details.title || `Untitled ${KIND_NOUN[kind]}`}
                </h3>
                {singleValidation.state === "done" && (
                  <p className="text-sm leading-relaxed text-muted">
                    {singleValidation.ok
                      ? `This ${KIND_NOUN[kind]} resolves.`
                      : `The validator reported ${
                          summarize(singleValidation.diagnostics).error
                        } error${summarize(singleValidation.diagnostics).error === 1 ? "" : "s"}.`}
                  </p>
                )}
                {singleValidation.state === "checking" && (
                  <p className="text-sm leading-relaxed text-muted">Checking…</p>
                )}
                {singleValidation.state === "idle" && (
                  <p className="text-sm leading-relaxed text-muted">
                    Nothing dropped yet. Go back to the first step.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-line bg-surface-2/40 p-4">
                <p className="text-xs leading-relaxed text-muted">
                  <span className="text-fg">Not built:</span> publishing a lone{" "}
                  {KIND_NOUN[kind]} on its own. Today the registry only stores one pinned
                  inside a blueprint bundle that publishes. Pick Blueprint on the first
                  step to publish one.
                </p>
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
                {/* Q14 reordered this block and cut its first claim. It used to open on the
                    three community axes coming "from weighted community & validator votes",
                    which stopped being true when the ballot came off the blueprint page on
                    2026-09-04 and is now unbuildable: the votes route and the write path
                    behind it are deleted, so there is no door left for a reader to go and
                    find. Cost / time leads instead because it is the half that IS still
                    filled in, by `POST /api/blueprints/{owner}/{slug}/runs`.

                    §11.0 Q28 then took the rest of it (2026-09-05). What was left read
                    "Efficacy, Reliability and Transparency are filled in by nothing. The
                    ballot that scored them is gone and no page collects a vote." Naming
                    three axes of a scorecard no route draws any more sends a reader looking
                    for a figure that is not on the site, which is the same defect Q14 cut
                    the first claim for. Cost / time is now the whole paragraph because it
                    is the whole of what is still filled in later.

                    The execution sentence is load-bearing beyond this paragraph. Q13 removes
                    the only other place the site says the platform never watches a run, so
                    after today this is where that promise is made and it stays whole. */}
                <p className="text-xs leading-relaxed text-muted">
                  <span className="text-fg">Filled in later:</span>{" "}
                  <span style={{ color: METRIC_SOURCE_META.reported.color }}>
                    Cost / time
                  </span>{" "}
                  is reported by whoever runs it. The platform never sees the execution.
                  It arrives with its run count, its spread and the model it was obtained
                  on.
                </p>
              </div>

              <div>
                <Button
                  size="lg"
                  onClick={() => void doPublish()}
                  disabled={!canPublish}
                  aria-describedby="publish-note"
                >
                  {publishing ? "Publishing\u2026" : `Publish ${KIND_NOUN[kind]}`}
                </Button>
                <p
                  id="publish-note"
                  className="mt-2 max-w-xl text-xs leading-relaxed text-muted"
                >
                  {/* ── The three reasons became two, and the third was DELETED ──
                      `still being written` and `blocked` with an error count both survive
                      unchanged: a blueprint mid-draft cannot be published either, but
                      "blocked by 5 errors" in signal red is the wrong reason to give
                      somebody who has three cards of eight down — it names a fault where
                      there is only a middle. `not wired up` is gone rather than reworded,
                      because it said publishing has no backend and that sentence is now
                      false; rewording it would leave an explanation of a limitation that no
                      longer exists, which is the failure D-78 is about.

                      ── What is NOT a rewording of it ──
                      The two sentences below about a session are new facts, not the old one
                      in new clothes. Being signed out is a true reason this button cannot
                      publish, `publish` resolves the owner FROM the handle so an account
                      without one cannot name a bundle's owner, and both states are reachable
                      (T050 AC1). A button disabled with nothing said is the failure this
                      route's whole copy history is about.

                      The bundle's own state is asked FIRST. An author whose graph is half
                      written should read that before being asked to sign in — the sign-in is
                      answerable in a click and the folder is the real work. */}
                  {blocked ? (
                    unfinished && progress !== undefined ? (
                      <>
                        <span className="font-mono text-warn">still being written</span>:{" "}
                        {progress.placed} of {progress.total} nodes have their card. There
                        is nothing to fix. Write the rest and drop the folder again. The
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
                  ) : versionMissing ? (
                    <>
                      <span className="font-mono text-warn">no version</span>: a release is
                      published under a number. Give it one on the Details step;{" "}
                      <span className="font-mono">{FIRST_VERSION}</span> is the usual first.
                    </>
                  ) : session.state === "loading" ? (
                    <>Checking whether you are signed in&hellip;</>
                  ) : session.state === "anonymous" ? (
                    <>
                      <span className="font-mono text-amber">sign in to publish</span>: a
                      release belongs to an account.{" "}
                      <a
                        href={SIGN_IN_HREF}
                        className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
                      >
                        Sign in with GitHub
                      </a>{" "}
                      and come back. The bundle and everything you have typed stay where
                      they are.
                    </>
                  ) : session.state === "no-handle" ? (
                    <>
                      <span className="font-mono text-amber">no handle yet</span>: your
                      account has not chosen the name a blueprint is published under, and a
                      release is stored beneath it. Nothing on this page can set one.
                    </>
                  ) : session.state === "unreachable" ? (
                    <>
                      <span className="font-mono text-signal">cannot tell</span>:{" "}
                      {session.detail} Reload the page before publishing, so this does not
                      fail halfway.
                    </>
                  ) : publishing ? (
                    <>Sending the bundle to the registry. This can take a moment.</>
                  ) : (
                    <>
                      This sends the bundle to the registry and creates{" "}
                      <span className="font-mono text-cyan">
                        {session.handle}/{slug}
                      </span>{" "}
                      release <span className="font-mono text-cyan">{declaredVersion}</span>,{" "}
                      {visibility === "public" ? "public" : "private"}. The registry
                      resolves it again on its side, and its reading is the one that decides.
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
      {!(step === 4 && outcome !== undefined) && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-5 py-4 sm:px-8">
          <Button variant="ghost" onClick={back} disabled={step === 1}>
            ← Back
          </Button>
          <span className="min-w-0 text-center font-mono text-[11px] leading-relaxed text-dim">
            step {step} of {STEPS.length}
            {step === 4 &&
              ` · ${
                kind !== "blueprint"
                  ? singleDoc === undefined
                    ? "no document yet"
                    : singleValidation.state === "checking"
                      ? "checking…"
                      : singleValidation.state === "failed"
                        ? "could not be checked"
                        : singleValidation.state === "done" && singleValidation.ok
                          ? "resolves"
                          : singleValidation.state === "done"
                            ? "rejected"
                            : "no document yet"
                  : !blocked
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
