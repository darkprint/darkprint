"use client";

import { useState, useSyncExternalStore } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { isLiveToken, type LiveOpened } from "@/lib/core/tutorial/live";

import {
  DESIGN_PROMPT,
  ENRICH_PROMPT,
  LIVE_STORAGE_KEY,
  livePagePath,
  withLiveUrl,
} from "./prompts";

/* ============================================================
   The two client islands on `/tutorial`: the door to a live page, and
   the prompts with that page's address filled in.

   Everything else on the page is server-rendered. What has to happen
   in the browser is small: ask `POST /api/tutorial/live` for a token,
   remember it in `localStorage`, and print the reader's own address
   into the prompts they paste. The token is the one thing this page
   keeps, and it keeps it in the reader's browser only.

   ── One store, two islands ──
   The button lives in one section and the prompts in two others, so
   they cannot share React state. They share a module-level store read
   through `useSyncExternalStore`: the server snapshot is always `null`,
   which is what makes the prerendered page and the first client render
   agree, and the browser snapshot is whatever storage holds.

   ── Every component is declared at module scope ──
   A component built inside a render, with `useCallback` or `useMemo`,
   changes identity when its dependencies do and React remounts every
   element of that type. On the wizard this page replaced, that
   destroyed the input a reader was typing into once per keystroke.
   `tutorial-page.test.ts` holds the shape.
   ============================================================ */

/* ---------- the token store ---------- */

const listeners = new Set<() => void>();

/** The stored token, or `null` when there is none or storage is unreadable. */
function readStoredToken(): string | null {
  try {
    const value = window.localStorage.getItem(LIVE_STORAGE_KEY);
    return isLiveToken(value) ? value : null;
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    window.localStorage.setItem(LIVE_STORAGE_KEY, token);
  } catch {
    /* A private window or blocked storage. The reader still reaches their page; they come
       back to the tutorial without a resume link, which is the button again. */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function noToken(): null {
  return null;
}

/** `null` on the server and during hydration; the stored token once the browser has read it. */
function useStoredToken(): string | null {
  return useSyncExternalStore(subscribe, readStoredToken, noToken);
}

/** The absolute address the reader's agent posts to. Only the browser knows the origin. */
function liveUrlFor(token: string | null): string | undefined {
  if (token === null || typeof window === "undefined") return undefined;
  return `${window.location.origin}${livePagePath(token)}`;
}

/* ---------- the door ---------- */

export interface StartLiveViewProps {
  token: string | null;
  pending: boolean;
  error?: string;
  onStart: () => void;
}

/**
 * The resting states, with no state of their own: no page yet, a page to resume, and a
 * refusal under either. Exported so a test can render each without a browser.
 */
export function StartLiveView({ token, pending, error, onStart }: StartLiveViewProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface-2 px-6 py-6">
      {token === null ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button type="button" size="lg" onClick={onStart} disabled={pending}>
            {pending ? "Opening your page" : "Open my live page"}
          </Button>
          <p className="text-sm leading-relaxed text-muted">
            One page with a token in its address, kept for 24 hours and refreshed every time
            your agent posts to it.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <ButtonLink href={livePagePath(token)} size="lg">
            Resume your live page
          </ButtonLink>
          <button
            type="button"
            onClick={onStart}
            disabled={pending}
            className="text-sm text-muted underline decoration-line underline-offset-4 transition-colors hoverable:hover:text-cyan disabled:opacity-60"
          >
            {pending ? "opening a new one" : "start a new one"}
          </button>
        </div>
      )}
      {error !== undefined && (
        <p role="alert" className="text-[13px] leading-relaxed text-signal">
          {error}
        </p>
      )}
    </div>
  );
}

/** The path of the page the route opened, or the route's own shape if the URL will not parse. */
function pagePath(opened: LiveOpened): string {
  try {
    return new URL(opened.url, window.location.origin).pathname;
  } catch {
    return livePagePath(opened.token);
  }
}

export function StartLive() {
  const token = useStoredToken();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function start(): Promise<void> {
    setPending(true);
    setError(undefined);
    let response: Response;
    try {
      response = await fetch("/api/tutorial/live", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: "{}",
      });
    } catch {
      setError("This site could not be reached, so no live page was opened.");
      setPending(false);
      return;
    }
    if (!response.ok) {
      setError(
        `This site answered ${response.status} instead of opening a live page; try again in a moment.`,
      );
      setPending(false);
      return;
    }
    let opened: LiveOpened | undefined;
    try {
      opened = (await response.json()) as LiveOpened;
    } catch {
      opened = undefined;
    }
    if (opened === undefined || !isLiveToken(opened.token)) {
      setError("This site answered without a usable token, so no live page was opened.");
      setPending(false);
      return;
    }
    storeToken(opened.token);
    window.location.assign(pagePath(opened));
  }

  return (
    <StartLiveView
      token={token}
      pending={pending}
      error={error}
      onStart={() => {
        void start();
      }}
    />
  );
}

/* ---------- the prompts ---------- */

export type PromptName = "design" | "enrich";

const PROMPTS: Readonly<Record<PromptName, { text: string; ariaLabel: string }>> = {
  design: {
    text: DESIGN_PROMPT,
    ariaLabel: "Copy the prompt that asks your agent to write the blueprint",
  },
  enrich: {
    text: ENRICH_PROMPT,
    ariaLabel: "Copy the prompt that asks your agent to enrich the blueprint over MCP",
  },
};

/**
 * One prompt, readable and selectable as text, with the button beside it. `filled` says
 * whether the address is in; without it the line under the block says what to do first.
 */
export function LivePromptView({
  name,
  prompt,
  filled,
}: {
  name: PromptName;
  prompt: string;
  filled: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-start gap-2">
        <pre
          data-prompt={name}
          className="min-w-0 flex-1 whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 px-3.5 py-3 font-sans text-[15px] leading-relaxed text-fg"
        >
          <code className="font-sans">{prompt}</code>
        </pre>
        <CopyButton text={prompt} ariaLabel={PROMPTS[name].ariaLabel} />
      </div>
      {!filled && (
        <p className="text-sm leading-relaxed text-dim">
          Open your live page in step 2 and its address fills in here.
        </p>
      )}
    </div>
  );
}

export function LivePrompt({ name }: { name: PromptName }) {
  const liveUrl = liveUrlFor(useStoredToken());
  return (
    <LivePromptView
      name={name}
      prompt={withLiveUrl(PROMPTS[name].text, liveUrl)}
      filled={liveUrl !== undefined}
    />
  );
}
