"use client";

import { useCallback, useState } from "react";
import { cx } from "@/lib/format";

/* ============================================================
   The visibility radiogroup, live: PATCH /api/bundles/[owner]/[slug]/visibility.
   Owner-only by construction — `VisibilitySwitch` only ever mounts this for the
   owner (see `Aside.tsx`) — and the route re-checks ownership itself (B-03), so a
   stray mount here is inert rather than a second authorization decision.
   ============================================================ */

export function VisibilityControl({
  api,
  visibility,
}: {
  /** `/api/bundles/{owner}/{slug}/visibility`. */
  api: string;
  visibility: "public" | "private";
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
        } catch {
          setCurrent(rollback);
          setError("That change did not send. Check your connection and try again.");
        } finally {
          setPending(false);
        }
      })();
    },
    [api, current, pending],
  );

  return (
    <div>
      {/* Toggle buttons, not role="radio": real buttons already carry the keyboard
          behaviour they announce, where a radiogroup announces arrow-key roving this
          markup never implemented. Same resolution CreateBundleForm's picker uses. */}
      <div
        role="group"
        aria-label="Visibility"
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
