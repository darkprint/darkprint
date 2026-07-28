"use client";

import { useId } from "react";
import { cx } from "@/lib/format";
import { MAX_ITERATIONS, MIN_ITERATIONS, type RadioOption } from "./choices";

/* ============================================================
   The three controls the path is made of.
   ------------------------------------------------------------
   Native radios, a native range input and a native checkbox, each
   with a real label. The site's own styling is applied over them
   rather than instead of them: these controls decide what a reader
   downloads, and reimplementing a radio group out of divs would
   put that decision behind a keyboard interaction nobody
   specified.

   All three are rendered inside pane 1, on the node the choice is
   about (doc 2 §5.7).
   ============================================================ */

export function RadioChoice<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = 1,
}: {
  /** The question, read out before the options. */
  legend: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (next: T) => void;
  columns?: 1 | 2;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className={cx("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {options.map((option) => {
          const active = option.id === value;
          return (
            <label
              key={option.id}
              className={cx(
                "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors",
                active
                  ? "border-cyan bg-cyan/10"
                  : "border-line bg-surface hover:border-line-bright",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={active}
                onChange={() => onChange(option.id)}
                className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--color-cyan)]"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={cx("text-[13px] leading-snug", active ? "text-cyan" : "text-fg")}
                >
                  {option.label}
                </span>
                <span className="text-[11px] leading-snug text-dim">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One consequence of the cap, at the position the slider is in right now. */
export interface CapReading {
  /** What the figure counts. */
  label: string;
  value: number;
  /** Which kind of cost it is. One word, so three of them read as one row. */
  kind: string;
}

/**
 * Doc 2 §5.3's third choice, and §5.6's teaching instrument.
 *
 * A range input, so the keyboard gets arrow keys, Home and End for free and the reader
 * can hear the value change. The figures under it are the point of the step: §5.6 wants
 * the trade-off delivered by the control rather than argued underneath it, so three
 * consequences of the cap sit against the slider and move together while it is dragged.
 *
 * They are handed in rather than derived here, because each is arithmetic over the
 * topology and the declared cap (`starterRunBudget`) and this component knows about
 * neither. Doc 1 §8 is what keeps them counts rather than estimates: what a run costs in
 * money and in wall clock is reported by whoever runs it, so the honest figures are the
 * ceilings that can be read off the graph.
 *
 * `aria-describedby` ties them to the input, so a reader who lands on the slider is told
 * what it moves before moving it.
 */
export function CapSlider({
  value,
  onChange,
  readings = [],
  footnote,
}: {
  value: number;
  onChange: (next: number) => void;
  readings?: readonly CapReading[];
  /** One line under the figures, when the caller has something to say about them. */
  footnote?: string;
}) {
  const id = useId();
  const readingsId = `${id}-readings`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12px] leading-snug text-muted">
          Turns of the loop a run may take
        </label>
        <output htmlFor={id} className="font-mono text-sm tabular-nums text-cyan">
          {value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_ITERATIONS}
        max={MAX_ITERATIONS}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby={readings.length === 0 ? undefined : readingsId}
        className="w-full accent-[var(--color-cyan)]"
      />
      <div className="flex justify-between font-mono text-[10px] text-dim">
        <span>{MIN_ITERATIONS}</span>
        <span>{MAX_ITERATIONS}</span>
      </div>
      {readings.length > 0 && (
        <dl
          id={readingsId}
          className="grid grid-cols-3 gap-2 rounded-md border border-line bg-surface px-2.5 py-2"
        >
          {readings.map((reading) => (
            <div key={reading.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
                {reading.kind}
              </dt>
              <dd className="flex flex-col gap-0.5">
                <span className="font-mono text-sm tabular-nums text-cyan">
                  {reading.value}
                </span>
                <span className="text-[10px] leading-snug text-dim">{reading.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {footnote !== undefined && (
        <p className="text-[10px] leading-relaxed text-dim">{footnote}</p>
      )}
    </div>
  );
}

/**
 * Doc 2 §5.4's switch, and the one control on the page that is not a choice.
 *
 * It is drawn apart from the three radios and the slider, and it says on itself that it
 * does not persist. §5.3's rule is that a demonstration and a decision must never be
 * mixed; the code enforces it (the export is taken from the bundle without the edge, and
 * the switch resets when the step changes), and the label states it so the reader does not
 * have to take the code's word for it.
 */
export function DemoSwitch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div
      className={cx(
        "flex flex-col gap-1.5 rounded-md border border-dashed px-3 py-2.5 transition-colors",
        on ? "border-signal bg-signal/10" : "border-line-bright bg-surface",
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={on}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-signal)]"
        />
        <span className={cx("text-[13px] leading-snug", on ? "text-signal" : "text-fg")}>
          {label}
        </span>
      </label>
      <p className="pl-[1.625rem] text-[11px] leading-snug text-dim">
        A demonstration. It goes back off when you leave this step, and no file you download
        carries the edge.
      </p>
    </div>
  );
}
