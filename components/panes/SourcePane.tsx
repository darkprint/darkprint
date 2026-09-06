"use client";

import { useMemo, useState } from "react";
import { cx } from "@/lib/format";
import { useRovingListbox } from "./listbox";
import type { PaneGhost } from "./model";

/* ============================================================
   Panes 3 and 4: a source document you can point at.
   ------------------------------------------------------------
   The line numbers, the copy button, the scroll box and the type
   are `components/ui/SourcePanel`'s, and this deliberately reads
   the same: a reader who has seen the DOT panel elsewhere on the
   site should recognise this one. What it adds is the thing that
   panel has no way to express, and the reason it could not simply
   be reused — a line here is a target. Selecting one moves the
   other three panes, and the file can draw a line that is **not**
   in it.

   That last part is doc 2 §5.1's absent edge, on the
   representation where it is hardest to show: a file cannot omit
   something visibly. So the ghost row is drawn where the
   statement would have gone, in the gutter's own numbering, and
   marked as not written.
   ============================================================ */

type Tone = "primary" | "secondary" | "plain";

type Row =
  | {
      kind: "line";
      key: string;
      line: number;
      text: string;
      /** What the line is. A line that names nothing has none and cannot be selected. */
      meaning?: string;
      tone: Tone;
    }
  | { kind: "ghost"; key: string; ghost: PaneGhost };

const MARKER: Record<Tone, string> = { primary: "▸", secondary: "·", plain: " " };

export function SourcePane({
  paneNumber,
  showNumber = true,
  title,
  language,
  meta,
  downloadName,
  source,
  meanings,
  primary,
  secondary,
  activeLine,
  ghosts,
  selectedAbsence,
  listLabel,
  emptyNote,
  onSelectLine,
  onSelectGhost,
  className,
}: {
  /** Which of the four this is, so the panes can be referred to by number. */
  paneNumber: number;
  /**
   * Draw the pane's ordinal beside its title.
   *
   * True for the archive's four-pane view, where the numbers are the view's own vocabulary
   * and nothing competes with them. No caller passes `false` today.
   *
   * The one that did was `/build`'s workspace stage, whose outer tablist already named this
   * pane in the open tab's own label — "DOT" or "Cards" — the same word this pane's own
   * `title` prop repeats a line down, and only three of that stage's five tab bodies carried
   * a `paneNumber` at all. A number beside a title the open tab already named would repeat
   * what is on screen and imply a numbering two of the five tabs did not share. The owner
   * deleted the route and its whole component tree on 2026-09-06, so the stage, its tablist
   * and the two panes named in that argument are all gone; the prop is kept because the next
   * caller to draw this pane behind a tablist needs somewhere to say so. The id stays either
   * way, because `aria-labelledby` points at it.
   */
  showNumber?: boolean;
  title: string;
  /** "DOT" or "YAML" — used in the copy button's accessible name. */
  language: string;
  meta?: string;
  downloadName?: string;
  source: string;
  /** What each line is, indexed from line 1 at position 0. */
  meanings: readonly (string | undefined)[];
  /** Lines the current selection is anchored on. */
  primary: readonly number[];
  /** Lines in scope but not the anchor: the node's edges, the rest of a field's block. */
  secondary: readonly number[];
  /** The line the tab stop sits on. The selection carries it, so this pane holds no state. */
  activeLine?: number;
  ghosts: readonly PaneGhost[];
  selectedAbsence?: string;
  /** Accessible name of the listbox, e.g. "Lines of topology.dot". */
  listLabel: string;
  /** Shown instead of the document when there is none. */
  emptyNote?: string;
  onSelectLine: (line: number) => void;
  onSelectGhost: (absenceId: string) => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const rows = useMemo<Row[]>(() => {
    if (source === "") return [];
    const primarySet = new Set(primary);
    const secondarySet = new Set(secondary);
    const ghostsAfter = new Map<number, PaneGhost[]>();
    for (const ghost of ghosts) {
      const held = ghostsAfter.get(ghost.afterLine);
      if (held === undefined) ghostsAfter.set(ghost.afterLine, [ghost]);
      else held.push(ghost);
    }

    const out: Row[] = [];
    const lines = source.split("\n");
    // A file ending in a newline is not a file with a blank last line: `split` yields a
    // trailing empty string that no editor numbers, and numbering it here would put pane
    // 3 one line out of step with the diagnostics the engine reports against the file.
    const count = lines.length > 1 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;

    for (let i = 0; i < count; i += 1) {
      const line = i + 1;
      const tone: Tone = primarySet.has(line)
        ? "primary"
        : secondarySet.has(line)
          ? "secondary"
          : "plain";
      const row: Row = { kind: "line", key: `l${line}`, line, text: lines[i], tone };
      const meaning = meanings[i];
      if (meaning !== undefined) row.meaning = meaning;
      out.push(row);
      for (const ghost of ghostsAfter.get(line) ?? []) {
        out.push({ kind: "ghost", key: `g${ghost.absenceId}`, ghost });
      }
    }
    return out;
  }, [source, meanings, primary, secondary, ghosts]);

  const selectable = useMemo(
    () => rows.map((row) => (row.kind === "ghost" ? true : row.meaning !== undefined)),
    [rows],
  );

  const activeIndex = useMemo(() => {
    if (selectedAbsence !== undefined) {
      const at = rows.findIndex(
        (row) => row.kind === "ghost" && row.ghost.absenceId === selectedAbsence,
      );
      if (at >= 0) return at;
    }
    if (activeLine !== undefined) {
      const at = rows.findIndex((row) => row.kind === "line" && row.line === activeLine);
      if (at >= 0 && selectable[at]) return at;
    }
    return rows.findIndex(
      (row, i) => row.kind === "line" && row.tone === "primary" && selectable[i],
    );
  }, [rows, selectable, activeLine, selectedAbsence]);

  const list = useRovingListbox({
    selectable,
    activeIndex,
    onActivate: (index) => {
      const row = rows[index];
      if (row === undefined) return;
      if (row.kind === "ghost") onSelectGhost(row.ghost.absenceId);
      else onSelectLine(row.line);
    },
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  const href = `data:text/plain;charset=utf-8,${encodeURIComponent(source)}`;

  return (
    <section
      className={cx(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface",
        className,
      )}
      aria-labelledby={`pane-${paneNumber}-heading`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3
          id={`pane-${paneNumber}-heading`}
          className="flex items-center gap-2 font-mono text-xs text-muted"
        >
          <span className="text-cyan" aria-hidden>
            ▤
          </span>
          {showNumber && <span className="text-dim">{paneNumber}</span>} {title}
        </h3>
        <div className="flex items-center gap-2">
          {meta !== undefined && meta !== "" && (
            <span className="font-mono text-[11px] text-dim">{meta}</span>
          )}
          {downloadName !== undefined && source !== "" && (
            <a
              href={href}
              download={downloadName}
              aria-label={`Download ${downloadName}`}
              className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
            >
              download
            </a>
          )}
          {source !== "" && (
            <button
              type="button"
              onClick={copy}
              aria-label={
                copied
                  ? `${language} source copied to the clipboard`
                  : `Copy the ${language} source`
              }
              className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
            >
              {copied ? "copied ✓" : "copy"}
            </button>
          )}
        </div>
      </div>

      {source === "" ? (
        <p className="px-4 py-6 text-sm leading-relaxed text-muted">
          {emptyNote ?? "There is no document behind this pane."}
        </p>
      ) : (
        <div className="max-h-[22rem] min-h-[12rem] flex-1 overflow-auto bg-void/60">
          <div
            role="listbox"
            aria-label={listLabel}
            onKeyDown={list.onKeyDown}
            className="w-max min-w-full py-2 text-xs leading-relaxed"
          >
            {rows.map((row, index) => {
              // Single-select: exactly one option carries `aria-selected`, and it is the
              // one the tab stop is on. The tone below can light more than one line —
              // the picked line and the statement that declares the node it names — but
              // only one of them is the selection.
              if (row.kind === "ghost") {
                const chosen = index === activeIndex;
                return (
                  <div
                    key={row.key}
                    role="option"
                    aria-selected={chosen}
                    tabIndex={list.tabIndexFor(index)}
                    ref={list.setRef(index)}
                    onClick={() => list.onClickIndex(index)}
                    className={cx(
                      "flex cursor-pointer border-y border-dashed",
                      chosen
                        ? "border-signal bg-signal/10"
                        : "border-line-bright bg-transparent hover:bg-surface-2",
                    )}
                  >
                    <span
                      className="w-12 shrink-0 select-none pr-3 text-right font-mono text-signal"
                      aria-hidden
                    >
                      ◌
                    </span>
                    <span className="whitespace-pre pr-4 font-mono text-dim line-through decoration-line-bright">
                      {row.ghost.text ?? row.ghost.label}
                    </span>
                    <span className="sr-only">
                      Not written: {row.ghost.label}. {row.ghost.detail}
                    </span>
                  </div>
                );
              }

              const chosen = index === activeIndex;
              return (
                <div
                  key={row.key}
                  role="option"
                  aria-selected={chosen}
                  aria-disabled={row.meaning === undefined ? true : undefined}
                  tabIndex={list.tabIndexFor(index)}
                  ref={list.setRef(index)}
                  onClick={
                    row.meaning === undefined ? undefined : () => list.onClickIndex(index)
                  }
                  className={cx(
                    "flex border-l-2",
                    row.meaning === undefined
                      ? "cursor-default border-transparent"
                      : "cursor-pointer",
                    row.tone === "primary"
                      ? "border-cyan bg-cyan/10"
                      : row.tone === "secondary"
                        ? "border-line-bright bg-surface-2/70"
                        : "border-transparent hover:bg-surface-2/50",
                  )}
                >
                  <span
                    className={cx(
                      "w-4 shrink-0 select-none text-center font-mono",
                      row.tone === "primary" ? "text-cyan" : "text-dim",
                    )}
                    aria-hidden
                  >
                    {MARKER[row.tone]}
                  </span>
                  <span
                    className="w-8 shrink-0 select-none pr-3 text-right font-mono text-dim"
                    aria-hidden
                  >
                    {row.line}
                  </span>
                  <span
                    className={cx(
                      "whitespace-pre pr-4 font-mono",
                      row.tone === "plain" ? "text-blueprint-ink" : "text-fg",
                    )}
                  >
                    {row.text === "" ? " " : row.text}
                  </span>
                  {row.meaning !== undefined && (
                    <span className="sr-only">
                      Line {row.line}, {row.meaning}.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
