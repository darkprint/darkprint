"use client";

import { useCallback, useState } from "react";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";

/* ============================================================
   The header's Watch control, live: SEAM-57's two set-verbs
   (`/api/authors/[handle]/watch`), the same route `/u/<owner>`
   reaches for the identical button (T131, D-131-07).

   ── the one thing this button cannot know on first paint ──
   `lib/server/profiles`'s own header states it: nothing published
   answers "does this caller already follow?" before a write —
   `getProfile`/`ProfileRecord` carry a real `watchers` COUNT and no
   `followedByCaller`, and the module's write half explains why nothing
   fills that gap (`toggleFollow`'s docblock, `write.ts:24-39`). So this
   button opens assuming "not yet watching", which is wrong for a
   returning watcher until their first click — a disclosed limitation
   of the surface it wires to, not a bug in the wiring. `setFollow`
   (POST/DELETE) is idempotent either way: a POST from an account that
   already watches changes nothing and the response still carries the
   true `watching`/`watchers`, which is what the first click corrects.
   ============================================================ */

export function WatchButton({
  api,
  watchers,
  signedIn,
}: {
  /** `/api/authors/{handle}/watch` — POST to watch, DELETE to unwatch. */
  api: string;
  watchers: number;
  signedIn: boolean;
}) {
  const [state, setState] = useState({ watching: false, watchers });
  const [pending, setPending] = useState(false);

  const toggle = useCallback(() => {
    if (!signedIn || pending) return;
    const wanted = !state.watching;
    const rollback = state;
    setState({ watching: wanted, watchers: state.watchers + (wanted ? 1 : -1) });
    setPending(true);
    void (async () => {
      try {
        const response = await fetch(api, { method: wanted ? "POST" : "DELETE" });
        if (!response.ok) throw new Error(String(response.status));
        const json = (await response.json()) as { watching: boolean; watchers: number };
        setState(json);
      } catch {
        setState(rollback);
      } finally {
        setPending(false);
      }
    })();
  }, [api, signedIn, pending, state]);

  return (
    <Button
      variant="outline"
      onClick={toggle}
      disabled={!signedIn}
      aria-pressed={state.watching}
      title={signedIn ? undefined : "Sign in to watch this blueprint's author."}
      className={cx(state.watching && "border-cyan/50 text-cyan")}
    >
      {state.watching ? "Watching" : "Watch"}{" "}
      <span className="font-mono text-[11px] text-dim">{state.watchers}</span>
    </Button>
  );
}
