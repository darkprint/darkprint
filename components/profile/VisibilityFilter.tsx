"use client";

import { useQueryState } from "@/components/ui/useQueryState";
import { CONTROL_CLASS } from "@/components/ui/RegistryFilterBar";

/* ============================================================
   The one live control on an owner's shelf, where every other one is `DeadControl`.

   It writes `?visibility=` to the address bar the same way `GalleryBrowser` and
   `NodeBrowser` write their own filters — `useQueryState`, `history.replaceState`, no
   prop back to the list. `OwnedBundles` and `OwnedCards` read the same key independently
   through the same hook, so this component and the list it narrows share no props at all;
   the URL is the only thing connecting them, which is what lets one small client leaf sit
   in the page's toolbar slot instead of the list itself growing a select.

   Owner-only by convention rather than by a prop this file enforces: a visitor's list has
   no private row, so every option here would return the same rows, and `app/u/[username]/
   blueprints/page.tsx` / `.../cards/page.tsx` simply do not mount this component on the
   branch a visitor renders.
   ============================================================ */

export function VisibilityFilter({ label }: { label: string }) {
  const { params, set } = useQueryState();
  const value = params.get("visibility") ?? "";

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => set("visibility", e.target.value || null)}
        aria-label={label}
        className={CONTROL_CLASS}
      >
        <option value="">Visibility: all</option>
        <option value="public">Visibility: public</option>
        <option value="private">Visibility: private</option>
      </select>
    </label>
  );
}
