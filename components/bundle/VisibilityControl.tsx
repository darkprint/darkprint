"use client";

import { useCallback, useState } from "react";
import { cx } from "@/lib/format";

/* ============================================================
   The visibility radiogroup, live: PATCH /api/bundles/[owner]/[slug]/visibility.
   Owner-only by construction — its one caller, `RowVisibility` in
   `components/profile/OwnedBundles.tsx`, mounts it for the owner alone — and the route
   re-checks ownership itself, so a stray mount here is inert rather than a second
   authorization decision.

   ── The two optional props, and what asked for each ──
   Both arrived with the owner's shelf mount (2026-09-06), where this control is drawn
   once PER ROW instead of once on a page, and neither changes anything for a caller
   that omits it.

   `label` because the accessible name was the constant `Visibility`. One per page is a
   name; one per row is a list of identically named groups, and a screen reader user
   moving between them hears no difference at all. `DeleteBundleControl` had already
   settled the shape for a per-row control on that shelf: name it for its own slug.

   `onSaved` because the shelf states visibility in places this component cannot reach —
   the row's violet border, its `Private` pill, the `n public · n private` count in the
   heading, and, on an archived row, a `ContentRow` this file has no handle on. Those all
   render the value the page was LOADED with, so after a successful change they are
   stale, and the pill is stale in words. A caller that draws visibility elsewhere needs
   to hear that the server agreed.
   ============================================================ */

export function VisibilityControl({
  api,
  visibility,
  label = "Visibility",
  onSaved,
}: {
  /** `/api/bundles/{owner}/{slug}/visibility`. */
  api: string;
  visibility: "public" | "private";
  /** The group's accessible name. Name it for the bundle wherever more than one mounts. */
  label?: string;
  /** Fired with the value the SERVER answered, never with the optimistic guess. */
  onSaved?: (visibility: "public" | "private") => void;
}) {
  const [current, setCurrent] = useState(visibility);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const choose = useCallback(
    (next: "public" | "private") => {
      if (next === current || pending) return;
      const rollback = current;
      setCurrent(next);
      setPending(true);
      setError(undefined);
      void (async () => {
        try {
          const response = await fetch(api, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ visibility: next }),
          });
          if (!response.ok) {
            setCurrent(rollback);
            setError("That change was not accepted.");
            return;
          }
          const { bundle } = (await response.json()) as { bundle: { visibility: "public" | "private" } };
          setCurrent(bundle.visibility);
          /* After the answer and not beside `setCurrent(next)` above: a caller that
             re-reads the page on this call would otherwise re-read it on a value the
             server has not accepted yet, and a rollback would leave the reload holding
             the wrong one. */
          onSaved?.(bundle.visibility);
        } catch {
          setCurrent(rollback);
          setError("That change did not send. Check your connection and try again.");
        } finally {
          setPending(false);
        }
      })();
    },
    [api, current, onSaved, pending],
  );

  return (
    <div>
      {/* Toggle buttons, not role="radio": real buttons already carry the keyboard
          behaviour they announce, where a radiogroup announces arrow-key roving this
          markup never implemented. Same resolution CreateBundleForm's picker uses. */}
      <div
        role="group"
        aria-label={label}
        className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-line bg-void p-1"
      >
        {(["public", "private"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={current === option}
            disabled={pending}
            onClick={() => choose(option)}
            className={cx(
              "rounded-sm px-3 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.12em] transition-colors disabled:cursor-wait",
              current === option
                ? "border border-cyan/50 bg-cyan/10 text-cyan"
                : "border border-transparent text-dim hoverable:hover:text-fg",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {error !== undefined && <p className="mt-2 text-[11px] text-signal">{error}</p>}
    </div>
  );
}
