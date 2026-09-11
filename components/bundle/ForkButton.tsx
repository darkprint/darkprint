"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { blueprintHref } from "@/lib/href";
import { ActionPill } from "@/components/ui/ActionPill";

/* ============================================================
   The header's Fork control, live: POST /api/bundles/[owner]/[slug]/fork
   (T110, wired T280). One click, no slug picker — the header has no
   room for one and the route already has an answer for "where does
   it land": the caller's own handle, same slug as the upstream unless
   it collides, private-or-public by the caller's OWN account default
   (D-110-09) rather than a constant this button could name. A slug
   collision is the one outcome worth a retry rather than a redirect,
   so it surfaces inline instead of failing silently.
   ============================================================ */

export function ForkButton({
  api,
  sourceVersion,
  signedIn,
  viewerHandle,
  forks,
}: {
  /** `/api/bundles/{owner}/{slug}/fork`. */
  api: string;
  /** The release actually taken — the addressed bundle's current version, forked by default. */
  sourceVersion: string;
  signedIn: boolean;
  /** The signed-in caller's own handle: forkBundle always lands in the caller's account. */
  viewerHandle?: string;
  forks: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState<string | undefined>(undefined);

  const fork = useCallback(() => {
    if (!signedIn || pending) return;
    setPending(true);
    setError(undefined);
    void (async () => {
      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: sourceVersion }),
        });
        if (!response.ok) {
          const problem = (await response.json().catch(() => undefined)) as
            | { detail?: string }
            | undefined;
          setError(problem?.detail ?? "That fork was not accepted.");
          setPending(false);
          return;
        }
        const bundle = (await response.json()) as { slug: string };
        if (viewerHandle !== undefined) {
          router.push(blueprintHref(viewerHandle, bundle.slug));
          return;
        }
        /* A handle-less account (T050 AC1) CAN fork — the fork just has no public URL to
           land on. Saying so beats resetting to the pre-click state as if nothing
           happened. `done` reuses the error slot's row so the layout does not shift. */
        setDone(`Forked as "${bundle.slug}". Set a handle in Settings to open it.`);
        setPending(false);
      } catch {
        setError("That fork did not send. Check your connection and try again.");
        setPending(false);
      }
    })();
  }, [api, sourceVersion, signedIn, pending, router, viewerHandle]);

  return (
    <div className="flex flex-col items-end gap-1">
      {/* No `pressed`: forking is an act, not a state this button can toggle back. The
          count is the upstream's, so it does not move on a click either — the reader is
          redirected to their own copy, and the number they left behind is refreshed by
          the page they come back to rather than guessed at here. */}
      <ActionPill
        glyph="fork"
        label={pending ? "Forking…" : "Fork"}
        count={forks}
        onClick={fork}
        disabled={!signedIn || pending}
        title={signedIn ? undefined : "Sign in to fork this blueprint."}
      />
      {error !== undefined && <span className="text-right text-[11px] text-signal">{error}</span>}
      {done !== undefined && (
        <span role="status" className="text-right text-[11px] text-cyan">
          {done}
        </span>
      )}
    </div>
  );
}
