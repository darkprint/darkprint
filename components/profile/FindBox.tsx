"use client";

import { useQueryState } from "@/components/ui/useQueryState";

/* ============================================================
   The live find box every profile shelf shares.

   Same mechanism as `VisibilityFilter` and `SortControl`: `useQueryState` writes `?q=` to
   the address bar and the shelf that draws the rows reads the same key back independently
   — no prop between this control and the list it narrows, which is what lets one small
   client leaf sit in a server page's toolbar slot without the list itself needing to know
   a search box exists.

   It used to be `DeadSearch`, drawn and permanently disabled, with a caption explaining
   that nothing here was wired. `OwnedBundles` and `OwnedCards` are client components
   already — the filtering they need is over rows the page already loaded, not a server
   round trip — so there was nothing left stopping this control from working except that
   nobody had written the four lines that make it.
   ============================================================ */

export function FindBox({ placeholder, label }: { placeholder: string; label: string }) {
  const { params, set } = useQueryState();
  const value = params.get("q") ?? "";

  return (
    <span className="flex h-10 min-w-[16rem] flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 transition-colors focus-within:border-cyan/50">
      <span aria-hidden className="text-[13px] text-dim">
        ⌕
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => set("q", e.target.value === "" ? null : e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-dim focus:outline-none"
      />
    </span>
  );
}
