"use client";

import { useQueryState } from "@/components/ui/useQueryState";
import { CONTROL_CLASS } from "@/components/ui/RegistryFilterBar";

/* ============================================================
   The live sort control every profile shelf shares.

   `VisibilityFilter`'s mechanism, over a third key: `?sort=` narrows nothing, it reorders
   what `VisibilityFilter` and `FindBox` already narrowed. "Updated" first because that is
   what `OwnedBundleSummary.updatedAt` is for — the row that changed most recently is the
   one a reader who owns the shelf is likeliest to be looking for — and it is the default,
   so an unfiltered URL still sorts.

   It used to be `DeadControl`, one button reading "Sort: updated ▾" that did nothing and
   said so in its own `title`. `updatedAt` is a real column on every row this control now
   sorts, which is what makes the control real rather than the button.
   ============================================================ */

export type ShelfSort = "updated" | "az";

export function SortControl({ label }: { label: string }) {
  const { params, set } = useQueryState();
  const value = (params.get("sort") ?? "updated") as ShelfSort;

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => set("sort", e.target.value === "updated" ? null : e.target.value)}
        aria-label={label}
        className={CONTROL_CLASS}
      >
        <option value="updated">Sort: updated</option>
        <option value="az">Sort: A → Z</option>
      </select>
    </label>
  );
}
