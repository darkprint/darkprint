"use client";

import { createContext, useContext } from "react";

import { cx } from "@/lib/format";

import { BLANK_BY_ID, type Blank as BlankSpec } from "./blanks";
import type { Fault } from "./state";

/**
 * A keyword the reader types over, sitting inside the file it belongs to.
 *
 * The whole page is one idea: you are not filling in a form that generates a file, you are
 * typing into the file. So the field has no label, no box of its own and no border around
 * a row: it inherits the `<pre>`'s type and sits on the line where the value goes. What it
 * keeps is colour, which is the only thing carrying its state.
 *
 * ── three states, and the third is the reason this is not an `<input>` with a class ──
 * Empty is cyan, which is this site's interactive colour and says the field is waiting.
 * Filled is emerald, a figure read off something real. Invalid is `--color-signal`, and it
 * appears only on a field whose vocabulary the ontology owns: a `type` the vocabulary has
 * never heard of is `card/unknown-term` at error severity, so the folder that field is
 * about would not resolve. Colour alone would not be enough for that third state, which is
 * why the page also lists every fault above the steps, in words, and refuses the download
 * while one stands.
 *
 * ── the focus ring is the browser's, deliberately ──
 * The design prototype set `outline: none` on every field. `app/globals.css` declares the
 * focus ring unlayered so that no component can outrank it, and an inline `outline: none`
 * beats a zero-specificity rule absolutely: every blank on the page would have had no
 * keyboard focus indicator at all, on a page whose entire interaction is moving between
 * forty-four fields. The border colour is a second cue and not the only one.
 */
export function BlankField({
  spec,
  value,
  invalid,
  listId,
  onChange,
}: {
  spec: BlankSpec;
  value: string;
  /** True only for a vocabulary field holding a term the ontology does not know. */
  invalid: boolean;
  /** The `<datalist>` of allowed terms, for a field the vocabulary owns. */
  listId?: string;
  onChange: (value: string) => void;
}) {
  const filled = value.trim() !== "";
  const tone = invalid
    ? "border-signal bg-signal/10 text-signal"
    : filled
      ? "border-emerald/55 bg-emerald/10 text-emerald"
      : "border-cyan/45 bg-cyan/10 text-cyan-bright";

  /* `font: inherit` in one class rather than a font stack: the field is inside a `<pre>`
     and has to be the same type as the line around it, whatever that line is. */
  const shared = cx(
    "rounded-sm border px-1.5 font-[inherit] text-[length:inherit] leading-[inherit] placeholder:text-dim",
    tone,
  );

  if (spec.rows !== undefined) {
    return (
      <textarea
        rows={spec.rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={spec.example}
        aria-label={spec.label}
        aria-invalid={invalid || undefined}
        className={cx(shared, "block w-full resize-y align-top")}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={spec.example}
      aria-label={spec.label}
      aria-invalid={invalid || undefined}
      list={listId}
      /* `ch` on the width so a field is about as wide as the value it expects, and
         `max-w-full` so the widest of them cannot push the panel into a horizontal scroll
         on a phone. */
      style={{ width: `${spec.width}ch` }}
      className={cx(shared, "max-w-full")}
    />
  );
}

/**
 * A value typed once, shown everywhere it is referenced.
 *
 * A node's name appears in its own line of the graph file, in four edges and in the graph
 * above; a card id appears in the file name, in the `card=` pin and in the dependencies of
 * two other cards. Typing any of them once and seeing the rest follow is what makes the
 * folder feel like one document rather than eight.
 *
 * The example shows through while the field is empty, in the same ink a placeholder uses,
 * so an unfilled panel still reads as a file rather than as a form with holes in it.
 */
export function Mirror({ value, example }: { value: string; example: string }) {
  const filled = value.trim() !== "";
  return <span className={filled ? "text-fg" : "text-dim"}>{filled ? value.trim() : example}</span>;
}

/* ============================================================
   The two components the step panels are written with

   ── they are HERE, at module scope, and that is load-bearing ──
   They were `useCallback`s inside `TutorialWizard`, which reads
   naturally and is a serious defect. React reconciles an element by
   the IDENTITY of its `type`, and a `useCallback` whose dependency
   list holds `values` returns a new function on every keystroke. So
   every `<B>` on the open step became a different component type on
   every character, React unmounted the old subtree and mounted a new
   one, and the `<input>` the reader was typing into was destroyed
   and rebuilt underneath them.

   Measured in the browser before the fix, by focusing a field,
   dispatching one `input` event and looking again:
   `sameDomNodeAfterKeystroke: false`, `stillFocusedAfterKeystroke:
   false`. A reader would have had to click the field again after
   every letter, on a page whose entire interaction is typing into
   forty-four of them.

   Nothing about the components themselves had to change. They take
   the values through a context instead of a closure, which is what
   keeps their identity stable across a render, and the call sites
   stay `<B id="c1_id" />` rather than growing four props each.
   `components/tutorial/wizard-shape.test.ts` holds the shape.
   ============================================================ */

interface FieldState {
  readonly values: Readonly<Record<string, string>>;
  readonly faults: readonly Fault[];
  readonly set: (id: string, value: string) => void;
}

const Fields = createContext<FieldState | undefined>(undefined);

export const FieldsProvider = Fields.Provider;

function useFields(): FieldState {
  const state = useContext(Fields);
  if (state === undefined) throw new Error("a blank outside FieldsProvider");
  return state;
}

/** One blank, wired to what the reader has typed and to its vocabulary. */
export function B({ id }: { id: string }) {
  const { values, faults, set } = useFields();
  const spec = BLANK_BY_ID.get(id);
  if (spec === undefined) throw new Error(`no blank \`${id}\``);
  return (
    <BlankField
      spec={spec}
      value={values[id] ?? ""}
      invalid={faults.some((fault) => fault.id === id)}
      listId={spec.vocab === undefined ? undefined : `dp-${spec.vocab}`}
      onChange={(next) => set(id, next)}
    />
  );
}

/** The same value, wherever the folder refers to it. */
export function M({ id }: { id: string }) {
  const { values } = useFields();
  return <Mirror value={values[id] ?? ""} example={BLANK_BY_ID.get(id)?.example ?? ""} />;
}
