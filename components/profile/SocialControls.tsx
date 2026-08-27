"use client";

import { useState } from "react";

import { compact } from "@/lib/format";
import { Button } from "@/components/ui/Button";

/* ============================================================
   Watch and Support, live (T280): POST/DELETE /api/authors/[handle]/watch|support.

   ── The one thing this file cannot know, stated rather than faked ──
   Neither route publishes a way to ask "does this caller already follow/endorse this
   handle" before a write — `lib/server/profiles/write.ts`'s own header says so in full:
   nothing in the module answers that BEFORE a flip, which is why the module ships
   `setFollow`/`setSupport` (idempotent, POST reaches "following", DELETE reaches "not")
   rather than only the toggle. There is no `GET` this component could call first, and
   inventing a raw read against `follow`/`account_support` here would reach past
   `lib/server/profiles`'s own boundary for a query that module has deliberately not
   published — the disclosed cost stays disclosed rather than worked around.

   So both controls start in the unpressed state on every load, whatever the true state is,
   and become accurate the moment THIS session clicks one: `following`/`supporting` on the
   response is the state that write just reached, and every write after that keeps it in
   step (POST is idempotent when clicked twice, DELETE the same). A viewer who already
   watches this handle from an earlier visit sees "Watch", not "Watching", until they act —
   the same false-negative the two backend routes' own header names as the price of an
   idempotent PUT with no read in front of it.
   ============================================================ */

async function setFollow(handle: string, following: boolean): Promise<{ watchers: number } | undefined> {
  const response = await fetch(`/api/authors/${encodeURIComponent(handle)}/watch`, {
    method: following ? "POST" : "DELETE",
  });
  if (!response.ok) return undefined;
  return (await response.json()) as { watching: boolean; watchers: number };
}

async function setSupport(handle: string, supporting: boolean): Promise<{ support: number } | undefined> {
  const response = await fetch(`/api/authors/${encodeURIComponent(handle)}/support`, {
    method: supporting ? "POST" : "DELETE",
  });
  if (!response.ok) return undefined;
  return (await response.json()) as { supported: boolean; support: number };
}

export function WatchButton({
  handle,
  watchers,
  signedIn,
}: {
  handle: string;
  watchers: number;
  signedIn: boolean;
}) {
  const [state, setState] = useState({ watching: false, watchers });
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!signedIn || busy) return;
    const next = !state.watching;
    setBusy(true);
    setState({ watching: next, watchers: state.watchers + (next ? 1 : -1) });
    const answer = await setFollow(handle, next);
    setState(
      answer === undefined
        ? { watching: !next, watchers: state.watchers } // revert on a failed write
        : { watching: next, watchers: answer.watchers },
    );
    setBusy(false);
  };

  return (
    <Button
      variant="outline"
      disabled={!signedIn || busy}
      aria-pressed={state.watching}
      title={signedIn ? undefined : "Sign in to watch this account."}
      onClick={() => void toggle()}
    >
      {state.watching ? "Watching" : "Watch"}{" "}
      <span className="font-mono text-[11px] text-dim">{compact(state.watchers)}</span>
    </Button>
  );
}

/**
 * The same pill `FavoriteStar` draws for its own `count`/`seeded` branch, made live: a
 * toggle button rather than a static figure, at the one place on the site where the
 * subject is a person rather than a bundle.
 */
export function SupportButton({
  handle,
  support,
  signedIn,
}: {
  handle: string;
  support: number;
  signedIn: boolean;
}) {
  const [state, setState] = useState({ supporting: false, support });
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!signedIn || busy) return;
    const next = !state.supporting;
    setBusy(true);
    setState({ supporting: next, support: state.support + (next ? 1 : -1) });
    const answer = await setSupport(handle, next);
    setState(
      answer === undefined
        ? { supporting: !next, support: state.support }
        : { supporting: next, support: answer.support },
    );
    setBusy(false);
  };

  return (
    <button
      type="button"
      disabled={!signedIn || busy}
      aria-pressed={state.supporting}
      aria-label={`${state.supporting ? "Withdraw support from" : "Support"} @${handle}, ${state.support} community stars`}
      title={signedIn ? undefined : "Sign in to support this account."}
      onClick={() => void toggle()}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-muted transition-colors hoverable:hover:border-cyan/40 hoverable:hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill={state.supporting ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
        className={state.supporting ? "text-cyan" : undefined}
      >
        <path d="M12 3.5l2.47 5.006 5.53.804-4 3.9.944 5.507L12 16.9l-4.944 2.6.944-5.507-4-3.9 5.53-.804L12 3.5z" />
      </svg>
      {compact(state.support)}
    </button>
  );
}
