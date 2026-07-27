"use client";

import { useRef, useState } from "react";
import {
  CORE_ONTOLOGY,
  formatForFilename,
  parseDocument,
  type Bundle,
  type BundleManifest,
} from "@/lib/core";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";

/* ------------------------------------------------------------------ */
/*  Files in, a Bundle out                                             */
/*                                                                     */
/*  Everything here is pure and browser-side: the wizard never sends a  */
/*  byte anywhere, so the same knowledge the archive reader has about   */
/*  what a bundle is made of has to live on this side of the wire too.  */
/* ------------------------------------------------------------------ */

/** One document the browser handed us — a picked file, a dropped file, or a paste. */
export interface UploadFile {
  /** The name as the browser reported it. Diagnostics are located against it. */
  name: string;
  text: string;
}

/** What a selected file is taken to be. */
export type FileRole = "topology" | "manifest" | "card" | "ignored";

/** One file with the role it was finally given, and why, when that needs saying. */
export interface RoledFile {
  file: UploadFile;
  role: FileRole;
  note?: string;
}

/** A selection split into the three things a bundle is made of. */
export interface BundleParts {
  /** The `.dot` topology. Without it there is no bundle to resolve. */
  dot?: UploadFile;
  manifest?: UploadFile;
  /** The manifest document, when it parsed to a mapping. */
  manifestDoc?: Record<string, unknown>;
  /** Why the manifest could not be read, when it could not. */
  manifestProblem?: string;
  cards: UploadFile[];
  /** Every selected file, in selection order, with its role. Drives the chip list. */
  roles: RoledFile[];
}

/** The step-2 form, as the manifest sees it. */
export interface BundleDetails {
  title: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
}

const TOPOLOGY_EXT = /\.(dot|gv)$/i;
const DOCUMENT_EXT = /\.(ya?ml|json)$/i;
const MANIFEST_NAME = /^blueprint\.(ya?ml|json)$/i;
/** A paste that opens like a graph is the topology; anything else is a card document. */
const DOT_OPENING = /^\s*(strict\s+)?(di)?graph\b/i;

/** Files are read into memory and hashed in this tab, so the cap is a courtesy to the tab. */
const MAX_KB = 512;

const fieldLabelCls = "font-mono text-[11px] uppercase tracking-[0.14em] text-dim";

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
  if (DOCUMENT_EXT.test(base)) return "card";
  return "ignored";
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
  let dot: UploadFile | undefined;
  let manifest: UploadFile | undefined;

  for (const file of files) {
    const role = roleFromName(file.name);
    if (role === "topology") {
      if (dot === undefined) {
        dot = file;
        roles.push({ file, role });
      } else {
        roles.push({
          file,
          role: "ignored",
          note: "a bundle carries one topology — the first .dot wins",
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
    if (role === "card") {
      cards.push(file);
      roles.push({ file, role });
      continue;
    }
    roles.push({ file, role, note: "not a .dot, .yaml, .yml or .json document" });
  }

  const parts: BundleParts = { cards, roles };
  if (dot !== undefined) parts.dot = dot;
  if (manifest !== undefined) {
    parts.manifest = manifest;
    const read = readManifest(manifest);
    if (read.doc !== undefined) parts.manifestDoc = read.doc;
    if (read.problem !== undefined) parts.manifestProblem = read.problem;
  }
  return parts;
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
  return out;
}

/** "Frontline Triage" → "frontline-triage". The slug a manifest never supplied. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
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
    // No manifest means the bundle is being read against the vocabulary it is about
    // to be validated with, which is exactly what the core version says.
    ontologyVersion: (doc && field(doc.ontologyVersion)) ?? CORE_ONTOLOGY.version,
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
  card: { glyph: "▮", label: "card", color: "var(--color-amber)" },
  ignored: { glyph: "·", label: "ignored", color: "var(--color-dim)" },
};

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
 * Step 1: choose the files, drop them, or paste the source. Nothing leaves the tab —
 * the files are read with `File.text()` and handed straight to the validator.
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

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
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
          void take(e.dataTransfer.files);
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
            Drop the whole bundle here — the{" "}
            <span className="font-mono text-cyan">.dot</span> graph and the{" "}
            <span className="font-mono text-cyan">.yaml</span> cards it pins
          </p>
          <p className="text-xs text-dim">
            or click to browse — the files are read in this tab and nothing is uploaded
          </p>
        </div>
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
      </div>

      {/* Selection summary + shortcuts */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-xs text-dim">
          {files.length === 0
            ? "No files selected"
            : `${plural(files.length, "file")} · ${
                parts.dot === undefined ? "no topology" : parts.dot.name
              } · ${plural(parts.cards.length, "card")}`}
        </span>
        <button
          type="button"
          onClick={onLoadExample}
          className="font-mono text-xs text-cyan underline-offset-4 transition-colors hover:text-cyan-bright hover:underline"
        >
          load the {exampleLabel} example →
        </button>
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          aria-expanded={pasteOpen}
          className="font-mono text-xs text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
        >
          {pasteOpen ? "hide the paste box" : "paste source instead →"}
        </button>
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setNotice(null);
            }}
            className="ml-auto font-mono text-xs text-dim underline-offset-4 transition-colors hover:text-signal hover:underline"
          >
            clear all
          </button>
        )}
      </div>

      {/* The files themselves */}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {parts.roles.map(({ file, role, note }) => {
            const meta = ROLE_META[role];
            return (
              <li
                key={file.name}
                className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg"
                title={note}
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ background: meta.color }}
                  aria-hidden
                />
                {file.name}
                <span className="text-dim">{meta.label}</span>
                <button
                  type="button"
                  onClick={() => onChange(files.filter((f) => f.name !== file.name))}
                  aria-label={`Remove ${file.name}`}
                  className="ml-0.5 text-dim transition-colors hover:text-signal"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

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
        {notes.map((note) => (
          <li key={note} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <span className="font-mono text-amber" aria-hidden>
              ▲
            </span>
            <span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
                warning{" "}
              </span>
              {note}
            </span>
          </li>
        ))}
      </ul>

      {/* Paste */}
      {pasteOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/40 p-4">
          <label className={fieldLabelCls} htmlFor="paste-source">
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
            <Button
              size="sm"
              variant="outline"
              onClick={addPaste}
              disabled={draft.trim() === ""}
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
