/* ============================================================
   DarkPrint frontend — the settings surface's shared fetch helper
   Every route this task wires answers B-03's envelope: a 2xx body
   this file returns as-is, or `problem+json` with a `title`/
   `detail` this file turns into an `Error`. Three call sites
   (`AccountForm`, `DangerZone`, `ApiKeys`) built this refusal
   independently before this file existed — `AccountForm.tsx`'s own
   `patch()` was the first copy — and a fourth copy is the drift
   this run is built to avoid, not a convenience.

   No `"use client"` here: this file holds no hook and no JSX, only
   functions, so it carries no boundary of its own and is bundled
   wherever its three "use client" callers pull it in.
   ============================================================ */

/** What a `problem+json` refusal answers with, read loosely: this file renders whichever of
    the two fields the route happened to set rather than assuming both are present. */
interface Problem {
  title?: string;
  detail?: string;
}

/** `response.json()` on the ok path; the route's own wording, passed through, on the refusal
    path. Every refusal on this surface already has an author (the module that raised it), and
    a second wording here would be the drift D-50-08 forbids, arriving through the client
    instead of through a barrel. */
async function unwrap<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const problem = (await response.json().catch(() => ({}))) as Problem;
  throw new Error(problem.detail ?? problem.title ?? `Request failed (${response.status}).`);
}

export async function getJson<T>(path: string): Promise<T> {
  return unwrap<T>(await fetch(path));
}

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return unwrap<T>(
    await fetch(path, {
      method: "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  return unwrap<T>(
    await fetch(path, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteJson<T>(path: string): Promise<T> {
  return unwrap<T>(await fetch(path, { method: "DELETE" }));
}

/** The shape every failed call in this module throws. Narrowed at the call site rather than
    exported as a class: every caller so far only ever wants the message. */
export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}
