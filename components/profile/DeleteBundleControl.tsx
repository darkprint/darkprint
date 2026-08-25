"use client";

/* ============================================================
   The trash control on the owner's shelf (owner-instructed, 2026-08-25).

   GitHub's device, deliberately: the dialog names the blueprint in full and the confirm
   button stays dead until the owner types the name back. The typed name is a guard
   against a misclick, never authorization — the session and `deleteBundle`'s own owner
   check are what authorize, so a request forged around this dialog gains nothing.

   The server is the authority on WHICH bundles may go: a public bundle with a release
   answers 409 with the published-stays sentence, and this control renders that answer
   rather than pre-deciding it — the rule lives in one place.
   ============================================================ */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function DeleteBundleControl({
  ownerHandle,
  slug,
}: {
  ownerHandle: string;
  slug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const armed = typed === slug && !busy;

  async function destroy() {
    if (!armed) return;
    setBusy(true);
    setError(undefined);
    let response: Response;
    try {
      response = await fetch(
        `/api/bundles/${encodeURIComponent(ownerHandle)}/${encodeURIComponent(slug)}`,
        { method: "DELETE", credentials: "same-origin", headers: { accept: "application/json" } },
      );
    } catch {
      setError("The delete did not send. Check your connection and try again.");
      setBusy(false);
      return;
    }
    if (response.ok) {
      /* The row this control sits in is about to not exist; a refresh re-reads the shelf
         from the registry rather than hand-editing client state about a dead id. */
      router.refresh();
      return;
    }
    const problem = (await response.json().catch(() => undefined)) as
      | { detail?: string }
      | undefined;
    setError(problem?.detail ?? `The delete was refused (${response.status}).`);
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${slug}`}
        title={`Delete ${slug}`}
        className="rounded-md p-1.5 text-dim transition-colors hoverable:hover:bg-signal/10 hoverable:hover:text-signal"
      >
        {/* A trash glyph in the site's own line style; aria-hidden because the button's
            accessible name already says what it does. */}
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.25">
          <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.5h6.6L12 4M6.5 6.5v4.5M9.5 6.5v4.5" />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 rounded-md border border-signal/40 bg-signal/[0.04] p-3 text-left">
      <p className="text-xs leading-relaxed text-muted">
        This deletes{" "}
        <span className="font-mono text-fg">
          {ownerHandle}/{slug}
        </span>{" "}
        and everything only it carried: its releases, notes, stars, saves and ballots. There
        is no undo. Type <span className="font-mono text-fg">{slug}</span> to confirm.
      </p>
      <input
        type="text"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        placeholder={slug}
        autoFocus
        className="h-9 rounded-md border border-line bg-void px-2.5 font-mono text-sm text-fg transition-colors focus:border-signal focus:outline-none"
        aria-label={`Type ${slug} to confirm deletion`}
      />
      {error !== undefined && (
        <p role="alert" className="text-xs leading-relaxed text-signal">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={!armed} onClick={() => void destroy()}>
          {busy ? "Deleting…" : "Delete this blueprint"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(undefined);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
