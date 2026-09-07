"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";

/* ============================================================
   The copy button, once.

   Four hand-rolled versions of this existed — `components/ui/SourcePanel.tsx`,
   `components/panes/SourcePane.tsx` and two blueprint-page panels that have since been
   deleted — all with the same three moving parts: a
   `try`/`catch` around `navigator.clipboard.writeText`, a `copied` flag, and a 1400ms
   timer putting the label back. `CloneMenu` would have been the fifth, and the download
   command is the longest string on the site a reader is meant to run, so it is the worst
   one to have a subtly different failure behaviour from its neighbours.

   This is that block, extracted verbatim in behaviour — same 1400ms, same silent
   catch — and the download panel migrated onto it in the same pass so the two buttons that
   sat in one panel were one component. The other three are left where they are: each is
   wrapped in different chrome, and a component that is used by two call sites and copied
   by three is still better than five copies. They move the day one of them is open for
   another reason.

   ── Why the timer is cleared ──
   The original inline blocks left the `setTimeout` running. A reader who copies and then
   navigates away unmounts the button with a pending `setState`, and a reader who copies
   twice inside 1400ms gets the first timer resetting the label while the second copy is
   still fresh. Both are one `useRef` away from being right.

   ── Why the label, not an icon ──
   `copied ✓` is a word a screen reader announces and a word a reader recognises without
   learning a glyph. `aria-live` is deliberately absent: the label sits inside the button
   the reader just pressed, so focus is already on the thing that changed.
   ============================================================ */

export function CopyButton({
  text,
  label = "copy",
  copiedLabel = "copied ✓",
  ariaLabel,
  className,
}: {
  /** Exactly what lands on the clipboard. Quotes and all — see `CloneMenu`. */
  text: string;
  label?: string;
  copiedLabel?: string;
  /** What the button is copying, said in words: "Copy the download command". */
  ariaLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable (no permission, or an insecure origin) — no-op. The
         command stays selectable in the page, which is the fallback that always works. */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${ariaLabel} — copied to the clipboard` : ariaLabel}
      className={cx(
        "shrink-0 rounded border border-line px-2 py-1 font-mono text-[11px] text-muted transition-colors hoverable:hover:border-cyan hoverable:hover:text-cyan",
        className,
      )}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
