/* ============================================================
   The check cell, and the table that carries it on `/spec/topology`.

   The page's claim is one claim repeated at every scale: some of
   what you write is resolved against something and the rest is
   shown to a reader. A reader can only see that it is one claim if
   every layer answers it in the same shape, so the cell that says
   what holds a construct is a component. `/spec/topology` draws it
   in this three-column table, and `/spec/card` draws the same cell
   beside each field of a stacked reference, where the curated values
   a field may take need room a table cell does not have.

   The third column carries a diagnostic code rather than a word
   like "validated". A code is greppable, it is what `/upload` and
   the build print, and it is the difference between a promise and
   a thing the reader can go and trip on purpose.

   Emerald for a check that refuses the bundle, amber for one that
   warns and lets it through: the same two tones the ontology page
   spends on "in this build" against "resolver only". `signal` is
   deliberately not used — a table of the rules is a reference, and
   the alarm colour belongs on a defect somebody actually has.
   ============================================================ */

import type { DiagnosticCode } from "@/lib/core";

import { Id } from "./parts";

export interface CheckRow {
  /** The field, attribute or construct, spelled as it appears in the file. */
  name: string;
  /**
   * What it holds, in a sentence or a few. Backticks mark an identifier, and every
   * renderer of a row prints it through `prose` so the mark reads the same on both pages.
   */
  what: string;
  /**
   * What the engine does about it, or `undefined` when the answer is nothing.
   *
   * `undefined` is a real answer here and never a gap: a field nobody checks is a field
   * the format left to the author on purpose, and a table that hid the empty rows would
   * be the site overstating what it can vouch for.
   */
  check?: {
    /* Typed to the validator's own union, so a code that is renamed or deleted in the
       engine fails the typecheck here instead of leaving a stale row on the page. */
    codes: readonly DiagnosticCode[];
    /** `error` refuses the bundle; `warning` is reported and the bundle still loads. */
    level: "error" | "warning";
  };
}

/* 11px, not 10px. These three are the only labels telling a reader what each column
   holds, and the third one names the diagnostic codes this component exists to publish.
   Uppercase at 10px with wide tracking is the least legible combination available. */
const TH =
  "pb-2 text-left font-normal uppercase tracking-[0.14em] text-[11px] text-dim";

/**
 * Backticked identifiers in a row's prose render as inline code. The rows are plain strings
 * so `rows.test.ts` and `honesty.test.ts` can read a sentence back, and the backtick is the
 * seam between a field name and the sentence around it. Exported because `/spec/card`
 * lays its rows out as a stacked reference rather than through `CheckTable`, and the two
 * renderers have to agree on what the mark means.
 */
export function prose(text: string): React.ReactNode[] {
  return text
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      part.startsWith("`") && part.endsWith("`") ? (
        <Id key={i}>{part.slice(1, -1)}</Id>
      ) : (
        part
      ),
    );
}

export function CheckTable({
  rows,
  caption,
}: {
  rows: readonly CheckRow[];
  /** Names the table for a screen reader and for anyone reading the page linearly. */
  caption: string;
}) {
  return (
    /* The three columns do not fold usefully on a phone: the point of a row is the pair
       of first and last cell read together. So the table keeps its shape and scrolls
       inside its own box rather than collapsing. */
    /* `tabIndex`, `role` and a name, because this scrolls. Measured at 378px the table
       is 608px inside a 319px box, so 48% of every row — including the diagnostic-code
       column, the whole point of the table — sits off the right edge. Touch reaches it;
       a keyboard could not, because the wrapper was `tabIndex -1` with nothing focusable
       inside it (WCAG 2.1.1). `SourcePanel` already solved this exact case in this repo,
       and this is the same three attributes. */
    <div
      tabIndex={0}
      role="group"
      aria-label={`${caption}, scrollable`}
      className="overflow-x-auto"
    >
      <table className="w-full min-w-[38rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {/* Not "field": four rows below name a construct rather than a key, and a
                column head that fitted eleven rows out of fifteen would read as a
                mistake on the other four. */}
            <th scope="col" className={TH}>
              in the file
            </th>
            <th scope="col" className={TH}>
              what it holds
            </th>
            <th scope="col" className={TH}>
              what holds it
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-line/60 align-top">
              <th
                scope="row"
                className="w-[11rem] py-3 pr-4 text-left font-mono text-[12px] font-normal text-fg"
              >
                {row.name}
              </th>
              <td className="py-3 pr-4 leading-relaxed text-muted">
                {prose(row.what)}
              </td>
              <td className="w-[15rem] py-3">
                <CheckCell check={row.check} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What holds one construct: the codes in the tone the legend keys, and the level in words,
 * or the free-text mark when the answer is nothing.
 */
export function CheckCell({ check }: { check: CheckRow["check"] }) {
  if (check === undefined) {
    return (
      <span className="font-mono text-[11px] text-dim">
        <span aria-hidden>◌ </span>
        free text
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-0.5">
      {check.codes.map((code) => (
        <code
          key={code}
          className={
            check.level === "error"
              ? "font-mono text-[11px] text-emerald"
              : "font-mono text-[11px] text-amber"
          }
        >
          {code}
        </code>
      ))}
      <span className="font-mono text-[11px] text-dim">
        {check.level === "error" ? "refuses the bundle" : "reported, still loads"}
      </span>
    </span>
  );
}

/** The key the check cells share, printed once above the first of them on a page. */
export function CheckLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-dim">
      <li className="flex items-center gap-2">
        <span aria-hidden className="text-emerald">
          ■
        </span>
        an error code refuses the bundle
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="text-amber">
          ■
        </span>
        a warning is reported and the bundle loads
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden>◌</span>
        free text is shown and checked by nothing
      </li>
    </ul>
  );
}
