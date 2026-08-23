"use client";

/* ============================================================
   `POST /api/bundles`, from the tab. SEAM-69's server counterpart.

   ── The seam is HTTP and NOT the barrel (D-263-08) ──
   T263's Published-signatures line says this task consumes
   `@/lib/server/publish`. It cannot: `publish.ts` reaches `pg` and
   drizzle through `@/lib/db`, and the Publish control is a client
   component, so importing that barrel would pull a database driver
   into the page bundle. Every type below is therefore transcribed
   from the wire rather than imported — the one case where a second
   declaration is not a second opinion, because the wire IS the
   contract and the server's own types are unreachable from here.

   ── The refusal `kind` travels in `type`, not in the body ──
   `PublishRefusedError` carries a `kind`, and `app/api/bundles/
   route.ts` maps it to a status and an RFC 9457 `type` of
   `<base>/publish-<kind>`. It does NOT put `kind` in the body.
   D-263-07 ratifies recovering it from that suffix, which is why
   `refusalKind` parses rather than reads a field: a caller looking
   for `body.kind` finds `undefined` against a correct route.

   AC2 is the whole reason this matters. `unfinished` and `in-error`
   are two different sentences, one of which must never mention an
   error count, and the status code cannot tell them apart — both
   are 422.
   ============================================================ */

/** The five refusals `publish` owns. Transcribed from `PublishRefusedKind`. */
export type PublishRefusedKind =
  | "unfinished"
  | "in-error"
  | "conflict"
  | "not-owner"
  | "version-not-higher";

/** `PublishResult`, as it arrives. `releaseId` is an id; the version is the one you sent. */
export interface PublishedRelease {
  bundleId: string;
  releaseId: string;
  digest: string;
  /** Whether this call CREATED the bundle, as against appending a release to one that existed. */
  created: boolean;
}

/** What the wizard sends. `ownerHandle` and `version` are required and SEAM-69 omits both. */
export interface PublishSubmission {
  ownerHandle: string;
  slug: string;
  version: string;
  manifest: unknown;
  dot: string;
  cardFiles: Record<string, string>;
  /** The dropped `ontology/extensions.yaml`, as SOURCE. The route parses it. */
  vocabulary?: string;
  visibility: "public" | "private";
}

/**
 * Everything the screen can be asked to render, as one closed union.
 *
 * `refused` is separated from `rejected` because the two are different things to say to an
 * author. A refusal is the registry's verdict on a bundle it understood; a rejection is
 * anything else — a session that expired, a submission over the size cap, a card the store
 * declined, a fault. Folding them together would put "your bundle is unfinished" and "you
 * are signed out" behind one sentence.
 */
export type PublishOutcome =
  | { state: "published"; release: PublishedRelease }
  | { state: "refused"; kind: PublishRefusedKind; detail: string }
  | { state: "rejected"; title: string; detail: string; status: number }
  | { state: "unreachable"; detail: string };

const REFUSAL_PREFIX = "https://darkprint.io/problems/publish-";

const REFUSAL_KINDS: readonly PublishRefusedKind[] = [
  "unfinished",
  "in-error",
  "conflict",
  "not-owner",
  "version-not-higher",
];

/**
 * The `kind` behind a problem `type`, or `undefined` when this is not a publish refusal.
 *
 * Checked against the closed set rather than trusted as a suffix: a type this page does not
 * know is a refusal shape somebody added after this file was written, and rendering it as a
 * `kind` the UI has no sentence for would print an empty branch. Unknown falls through to
 * `rejected`, which always has a sentence — the server's own `detail`.
 */
function refusalKind(type: unknown): PublishRefusedKind | undefined {
  if (typeof type !== "string" || !type.startsWith(REFUSAL_PREFIX)) return undefined;
  const suffix = type.slice(REFUSAL_PREFIX.length);
  return REFUSAL_KINDS.find((kind) => kind === suffix);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublishedRelease(value: unknown): value is PublishedRelease {
  if (!isRecord(value)) return false;
  return (
    typeof value.bundleId === "string" &&
    typeof value.releaseId === "string" &&
    typeof value.digest === "string" &&
    typeof value.created === "boolean"
  );
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/**
 * Publish, and turn every answer into something the screen can render.
 *
 * This function does not throw. A publish is the one action on this route the reader
 * committed to, and an exception escaping into an event handler would leave the wizard on
 * the form with no sentence at all — which reads exactly like a button that does nothing,
 * the failure this route's whole copy history is about.
 */
export async function publishBundle(
  submission: PublishSubmission,
  signal?: AbortSignal,
): Promise<PublishOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/bundles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(submission),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch {
    return {
      state: "unreachable",
      detail: "The registry could not be reached. Nothing was published; your bundle is still here.",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (response.ok) {
    if (!isPublishedRelease(body)) {
      /* A 200 whose body is not a release is not a success this page can describe. Saying
         so beats printing a screen full of blanks under a tick. */
      return {
        state: "unreachable",
        detail: "The registry answered something this page cannot read. Check the bundle before publishing again.",
      };
    }
    return { state: "published", release: body };
  }

  const problem = isRecord(body) ? body : {};
  const kind = refusalKind(problem.type);
  const detail = stringOr(problem.detail, "The registry declined this bundle and said nothing more.");
  if (kind !== undefined) return { state: "refused", kind, detail };

  return {
    state: "rejected",
    status: response.status,
    title: stringOr(problem.title, "The registry declined this bundle"),
    detail:
      response.status === 401
        ? "Your session has expired. Sign in again and publish; nothing was stored."
        : detail,
  };
}
