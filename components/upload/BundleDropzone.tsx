"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  formatForFilename,
  parseDocument,
  warning,
  type Bundle,
  type BundleManifest,
  type Diagnostic,
  type OntologyTerm,
} from "@/lib/core";
import { parseOntologyTerms } from "@/lib/content/ontology-file";
// The two names by their definitions rather than as literals here: this file recognises
// them if a reader drops one, and a second spelling of either would drift. Both are plain
// string constants, and `bundle-export` is isomorphic like the rest of what `/upload` runs
// in the tab. `BUNDLE_AGENTS` no longer names a file a fresh download contains (owner
// instruction, 2026-08-25) — kept here because an older download, or a folder a reader
// wrote by hand, may still carry one.
import { BUNDLE_AGENTS, BUNDLE_README } from "@/lib/content/bundle-export";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";

/* ------------------------------------------------------------------ */
/*  Files in, a Bundle out                                             */
/*                                                                     */
/*  Everything in THIS file is pure and browser-side, and the reason    */
/*  survives T263 even though its old phrasing did not. It used to say  */
/*  the wizard never sends a byte anywhere; the wizard now posts to     */
/*  /api/bundles at its last step. What is unchanged is that the        */
/*  classifier decides what a bundle is made of BEFORE anything is      */
/*  sent, in the tab, so the same knowledge the archive reader has      */
/*  still has to live on this side of the wire too.                     */
/* ------------------------------------------------------------------ */

/** One document the browser handed us — a picked file, a dropped file, or a paste. */
export interface UploadFile {
  /** The name as the browser reported it. Diagnostics are located against it. */
  name: string;
  text: string;
}

/** What a selected file is taken to be. */
export type FileRole = "topology" | "manifest" | "vocabulary" | "card" | "ignored";

/** One file with the role it was finally given, and why, when that needs saying. */
export interface RoledFile {
  file: UploadFile;
  role: FileRole;
  note?: string;
}

/** A selection split into the things a bundle is made of. */
export interface BundleParts {
  /** The `.dot` topology. Without it there is no bundle to resolve. */
  dot?: UploadFile;
  manifest?: UploadFile;
  /** The manifest document, when it parsed to a mapping. */
  manifestDoc?: Record<string, unknown>;
  /** Why the manifest could not be read, when it could not. */
  manifestProblem?: string;
  /**
   * Doc 3 §7's local vocabulary, when the selection carries one.
   *
   * A bundle downloaded from this site ships `ontology/extensions.yaml` whenever one of
   * its cards declares a local term, because without it those ids resolve against nothing.
   * Reading it back is what makes the folder DarkPrint hands out a folder DarkPrint
   * accepts.
   */
  vocabulary?: UploadFile;
  /** What that file declares. Empty when it declares nothing or could not be read. */
  terms: readonly OntologyTerm[];
  /** Why the vocabulary could not be read, when it could not. */
  vocabularyProblem?: string;
  cards: UploadFile[];
  /** Every selected file, in selection order, with its role. Drives the chip list. */
  roles: RoledFile[];
  /**
   * Problems the classifier itself raised, before `assembleBundle` ever builds a `Bundle`
   * for the engine to resolve. Empty on every ordinary drop.
   *
   * Exactly one case exists today: `blueprint.dot` (the topology's pre-rename name)
   * demoted in favour of `topology.dot` — see `legacyTopologyDiagnostics` below. Merged
   * into `result.diagnostics` by `UploadFlow`, the same way a vocabulary defect is.
   */
  diagnostics: readonly Diagnostic[];
}

/** The step-2 form, as the manifest sees it. */
export interface BundleDetails {
  title: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  /**
   * The release version this submission declares. **Optional, and the `?` is load-bearing
   * rather than tidy.**
   *
   * `BundleManifest` has no version field, so this is the one entry in this interface that
   * is not "as the manifest sees it": it is `PublishInput.version`, which `publish`
   * requires and which nothing in a dropped folder is obliged to supply. It is read here
   * anyway because `detailsFromManifest` is the only reader of a dropped `blueprint.yaml`
   * in this codebase, and a second one written beside it is how two opinions about a
   * document start.
   *
   * Optional because `dropzone.test.ts` builds a `BundleDetails` literal by hand and is a
   * must-pass-unchanged test under D-263-06 — a required member would red it at the type
   * level, which is a test failing for a reason that has nothing to do with what it checks.
   */
  version?: string;
}

const TOPOLOGY_EXT = /\.(dot|gv)$/i;
const DOCUMENT_EXT = /\.(ya?ml|json)$/i;
const MANIFEST_NAME = /^blueprint\.(ya?ml|json)$/i;
/** What the exporter writes the local vocabulary to, and what the archive calls it. */
const VOCABULARY_NAME = /^extensions\.(ya?ml|json)$/i;
/** A paste that opens like a graph is the topology; anything else is a card document. */
const DOT_OPENING = /^\s*(strict\s+)?(di)?graph\b/i;

/** What the exporter writes the topology to today, and what the registry calls it. */
const TOPOLOGY_NAME = "topology.dot";
/**
 * COMPATIBILITY: the topology's name before the format rename. A folder the pre-rename
 * skill wrote carries only this — `roleFromName` matches any `.dot`, so that folder keeps
 * validating with no code path devoted to it. The one case this name is checked for
 * explicitly is a folder carrying BOTH: see `pickTopology` and `legacyTopologyDiagnostics`.
 */
const LEGACY_TOPOLOGY_NAME = "blueprint.dot";

/** Files are read into memory and hashed in this tab, so the cap is a courtesy to the tab. */
const MAX_KB = 512;

/* --------------------- classification --------------------- */

function baseName(name: string): string {
  const cut = name.lastIndexOf("/");
  return cut === -1 ? name : name.slice(cut + 1);
}

/** The role a file's name claims. Extension only — the contents get their say later. */
function roleFromName(name: string): FileRole {
  const base = baseName(name);
  if (TOPOLOGY_EXT.test(base)) return "topology";
  if (MANIFEST_NAME.test(base)) return "manifest";
  if (VOCABULARY_NAME.test(base)) return "vocabulary";
  if (DOCUMENT_EXT.test(base)) return "card";
  return "ignored";
}

/**
 * Which of several `.dot`/`.gv` candidates is the topology.
 *
 * `topology.dot` always wins when it is among them, regardless of arrival order —
 * otherwise whether a folder's own file-system iteration happens to read the current name
 * or the legacy one first would decide which is trusted, and that is not a question a
 * reader dropping a folder should be answering by accident. With no `topology.dot` present
 * the old rule stands: the first candidate wins (the ordinary case there is `factory.dot`
 * arriving alongside a single real topology, whatever it is named).
 */
function pickTopology(candidates: readonly UploadFile[]): UploadFile | undefined {
  if (candidates.length === 0) return undefined;
  const canonical = candidates.find((file) => baseName(file.name).toLowerCase() === TOPOLOGY_NAME);
  return canonical ?? candidates[0];
}

/**
 * COMPATIBILITY: the one diagnostic this format rename needs.
 *
 * A folder carrying only `blueprint.dot` needs nothing here — it is picked up as the
 * topology like any other lone `.dot`, silently, exactly as it validated before the
 * rename. This exists for the folder that carries BOTH: `pickTopology` has already made
 * `topology.dot` win, and the chip-list note on the demoted file is easy to miss (it is
 * UI-only and does not reach `result.diagnostics`, the one surface every state of this
 * wizard reads). A warning says so explicitly, naming the file that was not read.
 */
function legacyTopologyDiagnostics(
  candidates: readonly UploadFile[],
  kept: UploadFile | undefined,
): Diagnostic[] {
  if (kept === undefined || baseName(kept.name).toLowerCase() !== TOPOLOGY_NAME) return [];
  const legacy = candidates.find(
    (file) => file !== kept && baseName(file.name).toLowerCase() === LEGACY_TOPOLOGY_NAME,
  );
  if (legacy === undefined) return [];
  return [
    warning(
      "bundle/legacy-topology-file",
      `This folder carries both \`${legacy.name}\` and \`${kept.name}\`. \`${legacy.name}\` is the topology's name from before the format rename, and it was ignored.`,
      {
        hint: `Delete \`${legacy.name}\`; \`${TOPOLOGY_NAME}\` is the current name for the topology file.`,
        location: { file: legacy.name },
      },
    ),
  ];
}

/**
 * Split a selection into topology, manifest and cards.
 *
 * A bundle has exactly one of the first two (§8), so a second `.dot` or a second
 * `blueprint.yaml` is demoted rather than silently merged — the chip list then says
 * which file is actually being read, which is the only honest way to show it.
 */
export function classifyBundle(files: readonly UploadFile[]): BundleParts {
  const roles: RoledFile[] = [];
  const cards: UploadFile[] = [];
  const topologyCandidates = files.filter((file) => roleFromName(file.name) === "topology");
  const dot = pickTopology(topologyCandidates);
  let manifest: UploadFile | undefined;
  let vocabulary: UploadFile | undefined;

  for (const file of files) {
    const role = roleFromName(file.name);
    if (role === "topology") {
      if (file === dot) {
        roles.push({ file, role });
      } else {
        roles.push({
          file,
          role: "ignored",
          // A downloaded folder used to carry two: `topology.dot` is the topology the
          // registry stores and scores, `factory.dot` was that same graph prepared for a
          // runner, with `__start` and `__exit` synthesised into it. `factory.dot` no
          // longer ships in a published bundle (owner instruction, 2026-08-25), but a
          // reader may still have one — an older download, or their own harness's
          // compiled output — so dropping one here stays a recognised case.
          note:
            (dot === undefined ? undefined : derivedNote(file, dot)) ??
            "a bundle carries one topology, and the first .dot wins",
        });
      }
      continue;
    }
    if (role === "manifest") {
      if (manifest === undefined) {
        manifest = file;
        roles.push({ file, role });
      } else {
        roles.push({ file, role: "ignored", note: "the first blueprint.yaml wins" });
      }
      continue;
    }
    if (role === "vocabulary") {
      if (vocabulary === undefined) {
        vocabulary = file;
        roles.push({ file, role });
      } else {
        roles.push({ file, role: "ignored", note: "the first extensions.yaml wins" });
      }
      continue;
    }
    if (role === "card") {
      cards.push(file);
      roles.push({ file, role });
      continue;
    }
    roles.push({ file, role, note: prosePartNote(file) });
  }

  const parts: BundleParts = {
    cards,
    roles,
    terms: [],
    diagnostics: legacyTopologyDiagnostics(topologyCandidates, dot),
  };
  if (dot !== undefined) parts.dot = dot;
  if (manifest !== undefined) {
    parts.manifest = manifest;
    const read = readManifest(manifest);
    if (read.doc !== undefined) parts.manifestDoc = read.doc;
    if (read.problem !== undefined) parts.manifestProblem = read.problem;
  }
  if (vocabulary !== undefined) {
    parts.vocabulary = vocabulary;
    const read = readVocabulary(vocabulary);
    parts.terms = read.terms;
    if (read.problem !== undefined) parts.vocabularyProblem = read.problem;
  }
  return parts;
}

/**
 * Why a file the validator does not read is in the folder anyway.
 *
 * The ordinary case here is a reader dropping a whole downloaded bundle, which ships one
 * document addressed to a person rather than to the engine: `README.md`, for whoever is
 * deciding whether to run it. `AGENTS.md` shipped alongside it too until the owner
 * instructed it out of every published bundle (2026-08-25); this still recognises one if a
 * reader drops an older download or a folder they wrote by hand, the same reasoning that
 * keeps `factory.dot` recognised in `derivedNote` below. Neither is a defect and neither is
 * missing anything, so the chip says what the file is instead of what it is not. "Not a
 * .dot, .yaml, .yml or .json document" was true of both and told a reader nothing about
 * why their own download contains it.
 */
function prosePartNote(file: UploadFile): string {
  const base = baseName(file.name).toLowerCase();
  if (base === BUNDLE_README.toLowerCase()) {
    return "the bundle's readme, written for a person. The validator reads the graph and the cards.";
  }
  if (base === BUNDLE_AGENTS.toLowerCase()) {
    return "the bundle's notes for an agent adapting it, generated from the cards. Nothing here is read back.";
  }
  return "not a .dot, .yaml, .yml or .json document";
}

/**
 * The note for a second `.dot` that is a known counterpart of the kept one: either the
 * Attractor-runnable copy, or the pre-rename name for the same file.
 *
 * `undefined` when the two files are not one of those pairs, so an author who dropped two
 * unrelated graphs still gets the general answer rather than a guess about which is which.
 */
function derivedNote(ignored: UploadFile, kept: UploadFile): string | undefined {
  const a = baseName(ignored.name).toLowerCase();
  const b = baseName(kept.name).toLowerCase();
  if (b !== TOPOLOGY_NAME) return undefined;
  if (a === "factory.dot") {
    return "factory.dot is the same graph prepared for a runner, with __start and __exit in it. The registry reads topology.dot, which is the one being validated here.";
  }
  if (a === LEGACY_TOPOLOGY_NAME) {
    // COMPATIBILITY: paired with the warning `legacyTopologyDiagnostics` raises for the
    // same file — this is the note a reader sees on the chip itself, before ever opening
    // the diagnostics list.
    return "blueprint.dot is the topology's name from before the format rename. topology.dot is the current name and was read instead.";
  }
  return undefined;
}

/**
 * The manifest document. Parsed with the engine's own reader so a broken
 * `blueprint.yaml` fails here exactly the way a broken card fails in the validator.
 */
function readManifest(file: UploadFile): {
  doc?: Record<string, unknown>;
  problem?: string;
} {
  const parsed = parseDocument(file.text, formatForFilename(file.name), file.name);
  if (parsed.value === undefined) {
    const first = parsed.diagnostics.length > 0 ? parsed.diagnostics[0].message : undefined;
    return { problem: first ?? `${file.name} could not be parsed.` };
  }
  const value = parsed.value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { problem: `${file.name} is not a mapping of fields, so it is not a manifest.` };
  }
  return { doc: value as Record<string, unknown> };
}

/**
 * The local terms a dropped `extensions.yaml` declares (doc 3 §7).
 *
 * Parsed with the loader's own reader, so a vocabulary read here and the same file read at
 * build time produce the same terms and the same complaint about a bad one. A file that
 * cannot be read yields no terms and a note: the bundle then resolves against the core
 * alone, which is a worse answer than refusing, so the reader is told.
 */
function readVocabulary(file: UploadFile): {
  terms: readonly OntologyTerm[];
  problem?: string;
} {
  const parsed = parseDocument(file.text, formatForFilename(file.name), file.name);
  if (parsed.value === undefined) {
    const first = parsed.diagnostics.length > 0 ? parsed.diagnostics[0].message : undefined;
    return { terms: [], problem: first ?? `${file.name} could not be parsed.` };
  }
  try {
    return { terms: parseOntologyTerms(parsed.value, file.name) };
  } catch (e) {
    return { terms: [], problem: e instanceof Error ? e.message : String(e) };
  }
}

/** A non-empty string field. YAML reads `1.0` as a number, and a version is a string. */
function field(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function tagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

/** The step-2 fields a `blueprint.yaml` already answers, so the form starts filled in. */
export function detailsFromManifest(doc: Record<string, unknown>): Partial<BundleDetails> {
  const out: Partial<BundleDetails> = {};
  const title = field(doc.title);
  if (title !== undefined) out.title = title;
  const summary = field(doc.summary);
  if (summary !== undefined) out.summary = summary;
  const description = field(doc.description);
  if (description !== undefined) out.description = description;
  const category = field(doc.category);
  if (category !== undefined) out.category = category;
  const tags = tagList(doc.tags);
  if (tags.length > 0) out.tags = tags;
  /* `version` is read although `BundleManifest` does not declare it, and that is D-263-09's
     wording taken literally: prefill "from `doc.version` when a dropped manifest carries the
     key even though the type does not name it". The archive's own `blueprint.yaml` does not
     write one today, so this is nearly always absent — it is here so a folder that DOES
     carry one does not make the author retype it, and never as a claim that the field is
     part of the manifest format. */
  const version = field(doc.version);
  if (version !== undefined) out.version = version;
  return out;
}

/** "Frontline Triage" → "frontline-triage". The slug a manifest never supplied. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    // Escaped rather than literal: the class is combining marks, which render as
    // nothing in an editor and are silently mangled by any tool that reads this file
    // as anything but UTF-8. Mis-decoded, the range inverts and the regex throws.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The selection as the engine wants it. `undefined` when there is no topology:
 * a bundle without a `.dot` is not an incomplete bundle, it is not one at all.
 *
 * The form wins over the manifest file field by field. That is not a preference —
 * the form is *prefilled* from the manifest the moment one is dropped, so whatever
 * is in it is either the manifest's own value or the edit the author just made.
 */
export function assembleBundle(
  parts: BundleParts,
  details: BundleDetails,
): Bundle | undefined {
  if (parts.dot === undefined) return undefined;
  const doc = parts.manifestDoc;

  const title = details.title.trim() || (doc && field(doc.title)) || "Untitled blueprint";
  const summary = details.summary.trim() || (doc && field(doc.summary)) || "";
  const tags = details.tags.length > 0 ? details.tags : doc ? tagList(doc.tags) : [];

  const manifest: BundleManifest = {
    slug: (doc && field(doc.slug)) ?? slugify(title),
    title,
    summary,
    tags,
  };
  if (manifest.slug === "") manifest.slug = "untitled-blueprint";

  const description = details.description.trim() || (doc && field(doc.description));
  if (description) manifest.description = description;
  const category = details.category.trim() || (doc && field(doc.category));
  if (category) manifest.category = category;
  const author = doc && field(doc.author);
  if (author) manifest.author = author;

  const cardFiles: Record<string, string> = {};
  for (const card of parts.cards) cardFiles[card.name] = card.text;

  return { manifest, dot: parts.dot.text, cardFiles };
}

/* --------------------- the picker --------------------- */

const ROLE_META: Record<FileRole, { glyph: string; label: string; color: string }> = {
  topology: { glyph: "◆", label: "topology", color: "var(--color-cyan)" },
  manifest: { glyph: "▤", label: "manifest", color: "var(--color-violet)" },
  vocabulary: { glyph: "◇", label: "vocabulary", color: "var(--color-emerald)" },
  card: { glyph: "▮", label: "card", color: "var(--color-amber)" },
  ignored: { glyph: "·", label: "ignored", color: "var(--color-dim)" },
};

/**
 * The four things a bundle is made of, in the order the validator reads them, plus the
 * files it does not read at all.
 *
 * This is the manifest that replaces the flat chip list once anything is staged. Ten
 * files used to arrive as ten visually uniform chips under an 11px summary line, so the
 * one question a reader actually has at that moment — is the `.dot` the whole flow gates
 * on in there? — could only be answered by reading every chip. Grouped by role it is
 * answered by looking at the first row, which is why that row is drawn whether or not it
 * has anything in it.
 */
const MANIFEST_ROWS: readonly { role: FileRole; label: string }[] = [
  { role: "topology", label: "topology" },
  { role: "manifest", label: "manifest" },
  { role: "card", label: "cards" },
  { role: "vocabulary", label: "vocabulary" },
  { role: "ignored", label: "not read" },
];

/**
 * Later files of the same name replace earlier ones — re-picking a file is an edit.
 * Names are the selection's key, so a single drop carrying two `solver.yaml` from two
 * directories collapses to the last of them rather than leaving an unaddressable twin.
 */
function merge(
  current: readonly UploadFile[],
  added: readonly UploadFile[],
): UploadFile[] {
  const fresh: UploadFile[] = [];
  for (const file of added) {
    const at = fresh.findIndex((f) => f.name === file.name);
    if (at === -1) fresh.push(file);
    else fresh[at] = file;
  }
  const kept = current.filter((file) => !fresh.some((a) => a.name === file.name));
  return [...kept, ...fresh];
}

/** What a paste is called, so the classifier can read it like any other file. */
function pasteName(text: string, current: readonly UploadFile[]): string {
  if (DOT_OPENING.test(text)) return "pasted.dot";
  const n = current.filter((f) => f.name.startsWith("pasted-")).length + 1;
  return text.trimStart().startsWith("{") ? `pasted-${n}.json` : `pasted-${n}.yaml`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Step 1: choose the files, drop them, or paste the source.
 *
 * Nothing leaves the tab AT THIS STEP — the files are read with `File.text()` and handed
 * straight to the validator, which is compiled into the page. Since T263 the wizard's last
 * step does send the bundle, to `POST /api/bundles`, so the old unqualified version of this
 * sentence became false: selection and validation are still local, publishing is not.
 */
export function BundleDropzone({
  files,
  parts,
  onChange,
  onLoadExample,
  exampleLabel,
}: {
  files: readonly UploadFile[];
  parts: BundleParts;
  onChange: (files: UploadFile[]) => void;
  onLoadExample: () => void;
  /** Title of the example bundle the server handed down, e.g. "Frontline Triage". */
  exampleLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const notes: string[] = [];
  if (notice !== null) notes.push(notice);
  if (parts.manifestProblem !== undefined) {
    notes.push(
      `${parts.manifestProblem} The details you fill in on the next step are used instead.`,
    );
  }
  if (parts.vocabularyProblem !== undefined) {
    notes.push(
      `${parts.vocabularyProblem} The bundle is read against the curated core alone, so a card declaring a local term will come back as an unknown one.`,
    );
  }

  async function take(list: FileList | null): Promise<void> {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;

    const read: UploadFile[] = [];
    const skipped: string[] = [];
    for (const file of picked) {
      if (file.size > MAX_KB * 1024) {
        skipped.push(`${file.name} is over ${MAX_KB} KB`);
        continue;
      }
      try {
        read.push({ name: file.name, text: await file.text() });
      } catch {
        skipped.push(`${file.name} could not be read`);
      }
    }
    setNotice(skipped.length === 0 ? null : `Skipped ${skipped.join(", ")}.`);
    if (read.length > 0) onChange(merge(files, read));
  }

  function addPaste(): void {
    const trimmed = draft.trim();
    if (trimmed === "") return;
    onChange(merge(files, [{ name: pasteName(trimmed, files), text: draft }]));
    setDraft("");
    setPasteOpen(false);
    setNotice(null);
  }

  /** The picker, shared by the empty target and the loaded strip. */
  const picker = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept=".dot,.gv,.yaml,.yml,.json"
      className="hidden"
      onChange={(e) => {
        const input = e.currentTarget;
        void take(input.files).then(() => {
          // Cleared so re-picking the same file after an edit still fires a change.
          input.value = "";
        });
      }}
    />
  );

  /** Drag handlers, identical on both states: the strip is still a drop target. */
  const dropHandlers = {
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      void take(e.dataTransfer.files);
    },
  };

  const loaded = files.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ── The target, in two states ──
          Empty, it is the largest thing on the step and says what a bundle is made of.
          Loaded, it collapses to a strip: with ten files staged the 240px dashed box was
          still about a third of the first viewport and still read "Drop the whole bundle
          here", describing a state the reader had already left, while the confirmation
          they actually needed was an 11px line under it. The manifest below takes its
          place, and `clear all` moves to this strip's right edge where the thing it
          clears now is. */}
      {!loaded ? (
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
          {...dropHandlers}
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors",
            dragging
              ? "border-cyan bg-cyan/5"
              : "border-line-bright hoverable:hover:border-cyan/60 hoverable:hover:bg-surface-2/40",
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
              Drop the whole folder here, the{" "}
              <span className="font-mono text-cyan">.dot</span> graph and the{" "}
              <span className="font-mono text-cyan">.yaml</span> cards it names
            </p>
            {/* ── D-263-12: this line said "nothing is uploaded" and it had to go ──
                It was unconditional rendered copy on the upload control itself, and after
                T263 this route publishes, so it was false about the very gesture it
                describes. What is still true is the SEQUENCE — dropping a folder reads it
                and nothing more — so the sentence keeps that and names where publishing
                actually happens instead of denying that it does.

                Not the same case as the vocabulary note further down this file, which
                D-263-01 kept: that one's subject is an unreadable overlay, which is not
                sent anywhere after any cutover, so its claim stayed true. Subject decides
                it, not which file the sentence lives in. */}
            <p className="text-xs text-dim">
              or click to browse. Selecting a folder reads it here; the last step is where
              you publish it.
            </p>
            {/* Both folders a reader can arrive with, named at the target itself rather
                than only in the page header three paragraphs up: this is where somebody
                stands with a directory open in the other window, deciding whether to drag
                it. The skill's output is the registry shape — the same `topology.dot`
                and `cards/` the download carries — so "as it stands" is true of both, and
                a half-written one is expected here (`components/upload/progress.ts`). */}
            <p className="text-xs text-dim">
              A folder downloaded from a blueprint page works as it stands, and so does one
              the DarkPrint skill wrote, finished or not. Bring{" "}
              <span className="font-mono">extensions.yaml</span> along with it when it has
              one: it defines the local terms its cards declare.
            </p>
            {/* Named at the target, because a person holding an Attractor pipeline has no
                reason to guess that this box takes one. Until now it did not: a dropped
                pipeline pins no cards, so the validator answered with one
                `bundle/missing-card` per node and advice about DarkPrint's own authoring
                format. `components/upload/attractor.ts` is what changed, and the sentence
                stops at what the reader can check here — the offer appears, and it names
                what an import costs before anything is converted. */}
            <p className="text-xs text-dim">
              An Attractor pipeline works too. Drop the{" "}
              <span className="font-mono">.dot</span> on its own and this page offers to
              read it into a draft bundle, in this tab, saying first what the import cannot
              carry across.
            </p>
          </div>
          {picker}
        </div>
      ) : (
        /* Not `role="button"` this time: the strip holds two real controls, and a
           clickable box wrapped round them would take the click meant for either. */
        <div
          {...dropHandlers}
          className={cx(
            "flex h-14 items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 transition-colors",
            dragging ? "border-cyan bg-cyan/5" : "border-line",
          )}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 font-mono text-xs text-cyan underline-offset-4 transition-colors hoverable:hover:text-cyan-bright hoverable:hover:underline"
          >
            <span aria-hidden>⇪</span>
            add more files
          </button>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] text-dim">
              {plural(files.length, "file")}
            </span>
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setNotice(null);
              }}
              className="font-mono text-xs text-dim underline-offset-4 transition-colors hoverable:hover:text-signal hoverable:hover:underline"
            >
              clear all
            </button>
          </div>
          {picker}
        </div>
      )}

      {/* ── The manifest ──
          Grouped by the role each file was given, in the order the validator reads them.
          The topology row is drawn even when it is empty and carries the `.label-lead`
          tier rather than `.label`, because `canAdvance` gates on that one file: it is
          the row a reader has to be able to check without reading any of the others. */}
      {loaded && (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-2/40">
          {MANIFEST_ROWS.map(({ role, label }) => {
            const entries = parts.roles.filter((entry) => entry.role === role);
            if (entries.length === 0 && role !== "topology") return null;
            const meta = ROLE_META[role];
            const lead = role === "topology";
            const missing = entries.length === 0;
            return (
              <li
                key={role}
                className={cx(
                  "flex flex-wrap items-baseline gap-x-4 gap-y-2 px-4 py-3",
                  lead && "bg-surface-2",
                )}
              >
                <span className="flex w-full shrink-0 items-center gap-2 sm:w-32">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: missing ? "var(--color-warn)" : meta.color }}
                    aria-hidden
                  />
                  <span className={lead ? "label-lead" : "label"}>
                    {role === "card" ? plural(entries.length, "card") : label}
                  </span>
                </span>

                {missing ? (
                  <span className="min-w-0 flex-1 text-xs leading-relaxed text-warn">
                    Nothing here is a <span className="font-mono">.dot</span>. Without a
                    topology there is nothing to resolve, and the next step stays locked.
                  </span>
                ) : (
                  <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {entries.map(({ file, note }) => (
                      <li
                        key={file.name}
                        className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg"
                        title={note}
                      >
                        {file.name}
                        <button
                          type="button"
                          onClick={() =>
                            onChange(files.filter((f) => f.name !== file.name))
                          }
                          aria-label={`Remove ${file.name}`}
                          className="ml-0.5 text-dim transition-colors hoverable:hover:text-signal"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Shortcuts. `clear all` used to sit here and now lives on the strip above, beside
          the selection it clears. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!loaded && <span className="font-mono text-xs text-dim">No files selected</span>}
        <button
          type="button"
          onClick={onLoadExample}
          className="font-mono text-xs text-cyan underline-offset-4 transition-colors hoverable:hover:text-cyan-bright hoverable:hover:underline"
        >
          load the {exampleLabel} example →
        </button>
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          aria-expanded={pasteOpen}
          className="font-mono text-xs text-muted underline-offset-4 transition-colors hoverable:hover:text-fg hoverable:hover:underline"
        >
          {pasteOpen ? "hide the paste box" : "paste source instead →"}
        </button>
      </div>

      {/* Both notes can be true at once — a skipped file and an unreadable manifest are
          separate facts, and collapsing them would hide whichever came second.

          Mounted whether or not there is anything to say: a live region inserted into
          the page together with its first message is a region screen readers miss, the
          same rule the blueprint canvas follows. Empty it takes no space. */}
      <ul
        className="flex flex-col gap-1.5 empty:hidden"
        role="status"
        aria-label="Selection warnings"
      >
        {/* `--color-warn`, not `--color-amber`. Amber carries exactly two jobs on this
            site — "not built yet" and "this box leaves the page" — and the content-kind
            selector on this same step spends it on the first of them. A warning wearing
            the same hue said the two were the same signal. */}
        {notes.map((note) => (
          <li key={note} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <span className="font-mono text-warn" aria-hidden>
              ▲
            </span>
            <span>
              <span className="label text-warn">warning </span>
              {note}
            </span>
          </li>
        ))}
      </ul>

      {/* Paste */}
      {pasteOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/40 p-4">
          <label className="label" htmlFor="paste-source">
            Paste source
          </label>
          <textarea
            id="paste-source"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={'digraph my_factory {\n  intake [card="event-intake@1.0.0"];\n}'}
            className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg placeholder:text-dim transition-colors focus:border-cyan focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            {/* The `title` is the disabled state finally saying why. `Button` drops
                `pointer-events-none` from its disabled treatment precisely so this
                tooltip can be reached (the `disabled` attribute still blocks the
                click), and `cursor-not-allowed` without it was a control that
                announced it was off and refused to say what would turn it on. It is
                conditional: an enabled button with a tooltip repeating its own label
                is noise. The sentence names the empty box and the gesture that fills
                it, and stops there — what a paste is then taken to be is already the
                line sitting next to this button, and saying it twice in two registers
                is worse than saying it once. */}
            <Button
              size="sm"
              variant="outline"
              onClick={addPaste}
              disabled={draft.trim() === ""}
              {...(draft.trim() === ""
                ? {
                    title:
                      "Nothing to add: the box above is empty. Type or paste the source into it and this turns on.",
                  }
                : {})}
            >
              Add to the selection
            </Button>
            <span className="font-mono text-[11px] text-dim">
              A graph becomes the topology; a YAML or JSON mapping becomes a card.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
