"use client";

import { useId } from "react";
import { cx } from "@/lib/format";
import { MAX_ITERATIONS, MIN_ITERATIONS, type RadioOption } from "./choices";

/* ============================================================
   The three controls the workspace is made of.
   ------------------------------------------------------------
   Two native radio groups and a native range input, each with a
   real label. The site's own styling is applied over them rather
   than instead of them: these controls decide what a reader
   downloads, and reimplementing a radio group out of divs would
   put that decision behind a keyboard interaction nobody
   specified.

   A fourth control used to live here, `DemoSwitch`: doc 2 §5.4's
   demonstration, mounted on the step that taught the absent edge.
   It went out with the steps (restructure spec §2.1). The
   demonstration itself did not go anywhere — `/what-it-isnt`
   builds the leaked graph and reads the same figures off the
   engine (`components/explain/starter-isolation.ts`) — but it is
   no longer a control sitting beside the three that do persist,
   which is what §5.3 asks for anyway: a demonstration and a
   decision must never be mixed.

   All three are rendered in one panel below the stage, so they
   stay put while the graph above them changes (spec §2.2).
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
 * can hear the value change. The figures under it are the point of this control — one of
 * the three the panel below the stage renders (spec §2.2) — where §5.6 wants the trade-off
 * delivered by the control itself rather than argued underneath it, so three consequences
 * of the cap sit against the slider and move together while it is dragged.
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
      <div className="flex justify-between font-mono text-[11px] text-dim">
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
              {/* `.label`, not a fourth hand-typed mono spelling: this is exactly the
                  job that class names — a meta label heading a value. It also lifts the
                  kind off 10px onto the site's 11px mono floor, which matters more here
                  than anywhere else on the page, because these three words are the only
                  thing saying what kind of cost each figure under the slider is. */}
              <dt className="label">{reading.kind}</dt>
              <dd className="flex flex-col gap-0.5">
                <span className="font-mono text-sm tabular-nums text-cyan">
                  {reading.value}
                </span>
                <span className="text-[11px] leading-snug text-dim">{reading.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {footnote !== undefined && (
        <p className="text-[11px] leading-relaxed text-dim">{footnote}</p>
      )}
    </div>
  );
}

