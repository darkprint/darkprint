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

   ── A NATIVE `<dialog>`, opened with `showModal()` (owner-instructed, 2026-08-26) ──
   The confirmation was an inline panel that grew inside the row, which put a destructive
   question in the corner of a shelf the reader was scanning. It is a modal now, and the
   platform element is used rather than a div with a high z-index because `showModal()`
   brings what this particular dialog needs and hand-rolling gets wrong: focus moves into
   the dialog and is TRAPPED there, everything behind it goes inert so the shelf cannot be
   clicked past the question, Escape closes it, and the top layer means no ancestor's
   `overflow` or stacking context can clip it — the row this mounts in is inside two.

   Escape closes and the backdrop does NOT. A stray click beside a delete dialog should
   not dismiss it silently; `cancel` is the deliberate way out and the Cancel button says
   so. Opening resets the typed name, so a reopened dialog is never armed by what somebody
   typed a minute ago — see `open` below for why that reset cannot live on `close`.
   ============================================================ */

import { useCallback, useId, useRef, useState } from "react";
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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const titleId = useId();
  const descriptionId = useId();

  const armed = typed === slug && !busy;

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  /* Reset on OPEN, not on close, and the difference is not stylistic. The invariant that
     matters is that a dialog a reader has just opened is never already armed — and a
     `close` listener cannot promise that: measured in Chrome on this page, `close()` takes
     the dialog from open to closed WITHOUT firing `close`, so a reopened dialog came back
     still holding the name and with the confirm button live. Clearing here is true however
     the last one went away: Escape, Cancel, a finished delete, or a path that fires no
     event at all. */
  const open = useCallback(() => {
    setTyped("");
    setError(undefined);
    setBusy(false);
    dialogRef.current?.showModal();
  }, []);

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
      /* Close BEFORE the refresh: the row this dialog is mounted in is about to stop
         existing, and a modal unmounted while still open leaves the document inert with
         nothing on top of it. The refresh re-reads the shelf from the registry rather
         than hand-editing client state about a dead id. */
      close();
      router.refresh();
      return;
    }
    const problem = (await response.json().catch(() => undefined)) as
      | { detail?: string }
      | undefined;
    setError(problem?.detail ?? `The delete was refused (${response.status}).`);
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
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

      {/* `onCancel` is left to its default, which closes on Escape. The backdrop is styled
          rather than wired: clicking beside a delete dialog dismisses nothing. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="panel m-auto w-[min(28rem,calc(100vw-2rem))] border-signal/40! p-0 text-left backdrop:bg-void/70 backdrop:backdrop-blur-[2px]"
      >
        <form method="dialog" className="flex flex-col gap-3 p-5">
          <h2 id={titleId} className="font-display text-lg font-semibold text-fg">
            Delete this blueprint
          </h2>
          <p id={descriptionId} className="text-[13px] leading-relaxed text-muted">
            This deletes{" "}
            <span className="font-mono text-fg">
              {ownerHandle}/{slug}
            </span>{" "}
            and everything only it carried: its releases, notes, stars, saves and ballots.
            There is no undo. Type <span className="font-mono text-fg">{slug}</span> to
            confirm.
          </p>
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={slug}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="h-9 rounded-md border border-line bg-void px-2.5 font-mono text-sm text-fg transition-colors focus:border-signal focus:outline-none"
            aria-label={`Type ${slug} to confirm deletion`}
          />
          {error !== undefined && (
            <p role="alert" className="text-[13px] leading-relaxed text-signal">
              {error}
            </p>
          )}
          <div className="mt-1 flex items-center justify-end gap-2">
            {/* Cancel is `type="submit"` inside `method="dialog"`, which is the platform's
                own close and needs no handler. Delete is `type="button"` so it cannot
                close the dialog by submitting before the request has answered. */}
            <Button type="submit" size="sm" variant="ghost" disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!armed}
              onClick={() => void destroy()}
            >
              {busy ? "Deleting…" : "Delete this blueprint"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
