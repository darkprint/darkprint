"use client";

/* ============================================================
   Who the browser is, read once from the server.

   **This is the first client of the backend in this repository.**
   Before T263 there was no `fetch` to any `/api/**` route anywhere
   in `components/**` or `app/**` — the only one in non-test source
   was `lib/server/auth/github.ts`, server to server. So the shape
   here is not a local convenience: D-263-09 asks for the session
   read to sit in ONE file under `components/upload/**` precisely so
   a later task can lift it whole rather than write a second opinion
   about what a session is.

   ── Why a state machine and not `handle: string | null` ──
   `SessionPayload` is `{ accountId, handle: string | null }`, and
   the route answers 401 with `problem+json` when there is no cookie
   at all. That is THREE reachable answers, not two, and T050 AC1
   makes the middle one real rather than theoretical: sign-in cannot
   *complete* until a handle is chosen, so the session exists before
   the handle does. A caller holding `handle: string | null` cannot
   tell "signed out" from "signed in, no handle yet" without also
   carrying the status code, and those two need different sentences
   on screen — one is a door, the other is a dead end.

   `unreachable` is the fourth and it is deliberately not folded into
   `anonymous`. A network fault is not a statement about who you are,
   and showing "sign in to publish" to somebody who IS signed in
   because their connection dropped is the wrong sentence with a
   working link under it.

   ── No `@/lib/server/**` import, and D-263-08 is why ──
   The Published-signatures line names `@/lib/server/publish`, but
   that barrel reaches `pg` through `@/lib/db` and cannot be in a
   client bundle. `SessionPayload` is therefore re-stated here as the
   two fields this file reads rather than imported. It is a
   transcription of an over-the-wire shape, which is the one case
   where a second declaration is not a second opinion: the wire is
   the contract, and importing the server's type would drag drizzle
   into the page.
   ============================================================ */

import { useEffect, useState } from "react";

/** Where a reader who is not signed in goes. B-02's GitHub dance, started server-side. */
export const SIGN_IN_HREF = "/api/auth/github/login";

/**
 * What `GET /api/auth/session` said, as four states the UI writes four different
 * sentences for.
 *
 * `loading` is the mount state and is distinct from every answer: a Publish button that
 * renders "sign in to publish" for the frame before the fetch lands is telling a signed-in
 * reader something false, briefly, which is the whole failure `/settings` documents at
 * length.
 */
export type UploadSession =
  | { state: "loading" }
  /** 401: no session cookie. The only state with a way forward the reader can take. */
  | { state: "anonymous" }
  /** 200 with `handle: null` — signed in, sign-up unfinished (T050 AC1). */
  | { state: "no-handle"; accountId: string }
  | { state: "ready"; accountId: string; handle: string }
  /** The request itself failed, or answered something this file cannot read. */
  | { state: "unreachable"; detail: string };

/** The two fields of `SessionPayload` this page reads. Transcribed, not imported — see header. */
interface SessionBody {
  accountId: string;
  handle: string | null;
}

function isSessionBody(value: unknown): value is SessionBody {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accountId === "string" &&
    (typeof candidate.handle === "string" || candidate.handle === null)
  );
}

/**
 * One read of `GET /api/auth/session`, with every failure turned into a state rather than
 * a throw.
 *
 * `signal` rather than a `cancelled` flag: the flag leaves the request in flight and only
 * drops the answer, which on a route a reader can leave mid-flight means holding a socket
 * open for a component that is gone.
 */
export async function readSession(signal?: AbortSignal): Promise<UploadSession> {
  let response: Response;
  try {
    response = await fetch("/api/auth/session", {
      /* The cookie is the whole point of the call. `same-origin` is the default in every
         browser that ships this API, and it is written out because a reader of this file
         should not have to know that to know the cookie travels. */
      credentials: "same-origin",
      headers: { accept: "application/json" },
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (thrown) {
    return { state: "unreachable", detail: detailOf(thrown) };
  }

  if (response.status === 401) return { state: "anonymous" };
  if (!response.ok) {
    return { state: "unreachable", detail: `the session endpoint answered ${response.status}.` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "unreachable", detail: "the session endpoint answered with something that is not JSON." };
  }
  if (!isSessionBody(body)) {
    return { state: "unreachable", detail: "the session endpoint answered a shape this page cannot read." };
  }

  return body.handle === null
    ? { state: "no-handle", accountId: body.accountId }
    : { state: "ready", accountId: body.accountId, handle: body.handle };
}

/**
 * The session, read once on mount.
 *
 * Not revalidated on focus and not polled. A session that expires mid-wizard surfaces as
 * the publish's own 401, which is where the reader is actually doing something about it —
 * a background poll that greyed the button out under a reader mid-form would be the same
 * interruption with none of the context.
 */
export function useUploadSession(): UploadSession {
  const [session, setSession] = useState<UploadSession>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void readSession(controller.signal).then((next) => {
      /* An abort resolves this promise too, and setting state from it would warn about an
         unmounted component while overwriting nothing that matters. */
      if (!controller.signal.aborted) setSession(next);
    });
    return () => controller.abort();
  }, []);

  return session;
}

function detailOf(thrown: unknown): string {
  if (thrown instanceof DOMException && thrown.name === "AbortError") return "the request was cancelled.";
  return "the session endpoint could not be reached.";
}
