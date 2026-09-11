"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export type Visibility = "public" | "private";

const CHOICES: { value: Visibility; label: string; hint: string; color: string }[] = [
  {
    value: "private",
    label: "Private",
    hint: "Only you can read it",
    color: "var(--color-violet)",
  },
  {
    value: "public",
    label: "Public",
    hint: "Anyone can read it",
    color: "var(--color-cyan)",
  },
];

/**
 * Public or private, chosen rather than defaulted. One control for the blueprint's Details
 * step and the card's Publish step, so the two kinds cannot describe the same choice
 * differently.
 *
 * Same shape and the same gated hover as the kind selector on step one, for the reason that
 * one records: an ungated `hover:` latches on a phone and a two-way selector then reads as
 * both chosen.
 */
export function VisibilityChoice({
  value,
  onChange,
  note,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
  /** The sentence under the two buttons, written by the step that knows what it publishes. */
  note: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label mb-2">Visibility</legend>
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((choice) => {
          const active = value === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              onClick={() => onChange(choice.value)}
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
      <p className="max-w-xl text-[11px] leading-relaxed text-dim">{note}</p>
    </fieldset>
  );
}
