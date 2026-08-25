"use client";

/* ============================================================
   One YAML document, on its own — the drop target for the wizard's Node and Ontology
   kinds. `components/upload/BundleDropzone.tsx` reads a whole folder because a bundle is
   made of several files playing different roles (§8); a lone card or a vocabulary
   extension is one file, so this is that dropzone with the roles taken back out rather
   than a second implementation of the same mechanics.
   ============================================================ */

import { useRef, useState, type DragEvent } from "react";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";

export interface SingleDoc {
  /** The name as the browser reported it, or a synthesised one for a paste. */
  name: string;
  text: string;
}

/** Files are read into memory in this tab, so the cap is a courtesy to the tab — the
    same reasoning `BundleDropzone.tsx`'s own `MAX_KB` records, at a lower number because
    a lone card or vocabulary document is never the size a whole bundle folder is. */
const MAX_KB = 256;

function baseName(name: string): string {
  const cut = name.lastIndexOf("/");
  return cut === -1 ? name : name.slice(cut + 1);
}

export function SingleDocDropzone({
  doc,
  onChange,
  kindLabel,
}: {
  doc: SingleDoc | undefined;
  onChange: (doc: SingleDoc | undefined) => void;
  /** "node card" or "ontology" — what the dropped document is read as, named in the copy. */
  kindLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function take(list: FileList | null): Promise<void> {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    // One document, not a merge: dropping a second file here replaces the first rather
    // than adding a second role nothing in this flow reads.
    const file = picked[0];
    if (file.size > MAX_KB * 1024) {
      setNotice(`${file.name} is over ${MAX_KB} KB.`);
      return;
    }
    try {
      onChange({ name: file.name, text: await file.text() });
      setNotice(null);
    } catch {
      setNotice(`${file.name} could not be read.`);
    }
  }

  function addPaste(): void {
    const trimmed = draft.trim();
    if (trimmed === "") return;
    onChange({ name: `pasted-${kindLabel.replace(/\s+/g, "-")}.yaml`, text: draft });
    setDraft("");
    setPasteOpen(false);
    setNotice(null);
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept=".yaml,.yml,.json"
      className="hidden"
      onChange={(e) => {
        const input = e.currentTarget;
        void take(input.files).then(() => {
          input.value = "";
        });
      }}
    />
  );

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

  return (
    <div className="flex flex-col gap-3">
      {doc === undefined ? (
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
              Drop a single <span className="font-mono text-cyan">.yaml</span> document — one{" "}
              {kindLabel}
            </p>
            <p className="text-xs text-dim">or click to browse, or paste the source below.</p>
          </div>
          {picker}
        </div>
      ) : (
        <div
          {...dropHandlers}
          className={cx(
            "flex h-14 items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 transition-colors",
            dragging ? "border-cyan bg-cyan/5" : "border-line",
          )}
        >
          <span className="inline-flex items-center gap-1.5 truncate font-mono text-xs text-fg">
            <span aria-hidden>▮</span>
            {baseName(doc.name)}
          </span>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-mono text-xs text-cyan underline-offset-4 transition-colors hoverable:hover:text-cyan-bright hoverable:hover:underline"
            >
              replace
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setNotice(null);
              }}
              className="font-mono text-xs text-dim underline-offset-4 transition-colors hoverable:hover:text-signal hoverable:hover:underline"
            >
              clear
            </button>
          </div>
          {picker}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {doc === undefined && <span className="font-mono text-xs text-dim">No file selected</span>}
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          aria-expanded={pasteOpen}
          className="font-mono text-xs text-muted underline-offset-4 transition-colors hoverable:hover:text-fg hoverable:hover:underline"
        >
          {pasteOpen ? "hide the paste box" : "paste source instead →"}
        </button>
      </div>

      {notice !== null && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <span className="font-mono text-warn" aria-hidden>
            ▲
          </span>
          <span>
            <span className="label text-warn">warning </span>
            {notice}
          </span>
        </p>
      )}

      {pasteOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/40 p-4">
          <label className="label" htmlFor="single-doc-paste">
            Paste source
          </label>
          <textarea
            id="single-doc-paste"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg placeholder:text-dim transition-colors focus:border-cyan focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
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
              Use this document
            </Button>
            <span className="font-mono text-[11px] text-dim">Replaces the dropped file, if any.</span>
          </div>
        </div>
      )}
    </div>
  );
}
