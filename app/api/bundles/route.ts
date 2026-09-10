/* ============================================================
   POST /api/bundles
   The one publish endpoint, serving the wizard, the bundle page,
   the CLI and any terminal or agent holding a write-scoped API
   key. Create if the slug is free for that owner, append a release
   if it is not; the caller does not say which, `created` in the
   answer reports which it was.

   ── the two refusals are different objects ──
   A malformed BODY is 400 problem+json: there is nothing to run a
   publish on. A well-formed body the registry declines to publish
   is a `PublishRefusedError` and maps by `kind`:

     conflict           -> 409
     not-owner          -> 404   existence must not leak
     unfinished         -> 422
     in-error           -> 422
     version-not-higher -> 422

   404 for `not-owner` is the one that looks wrong and is not. A
   403 would confirm that `<handle>/<slug>` exists to somebody who
   may not publish to it, which is exactly the leak the status code
   closes everywhere else in this tree.

   ── nothing here re-reads the body ──
   The four submitted halves are read by `../validate/body`'s
   readers, which are the tree's existing readers for these exact
   four fields. A second copy would be a second opinion about what
   `cardFiles` is, at the one door that WRITES what it decides.
   ============================================================ */

import type { BundleManifest } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { withSessionOrWriteKey } from "@/lib/server/auth";
import { LimitExceededError, validateVocabularySource } from "@/lib/server/engine";
import { badRequest, methodNotAllowed, ok, problem } from "@/lib/server/http";
import { ArchiveConflictError, MalformedVocabularyError } from "@/lib/server/archive";
import { ExportError } from "@/lib/server/export";
import { CardStoreError } from "@/lib/server/cards";
import { PublishRefusedError, publish, type PublishInput } from "@/lib/server/publish";
import {
  isRefusal,
  readCardFiles,
  readManifest,
  readObjectBody,
  readOptionalString,
  readString,
  tooLarge,
} from "../validate/body";

export async function POST(request: Request): Promise<Response> {
  /* A session cookie or a write-scoped API key. The handler receives the same
     `{ accountId, handle }` either way, so `publish` and `can` judge both callers alike. */
  return withSessionOrWriteKey(request, async (session) => {
    const parsed = await readObjectBody(request);
    if ("refusal" in parsed) return parsed.refusal;
    const { body } = parsed;

    const ownerHandle = readString(body, "ownerHandle");
    if (isRefusal(ownerHandle)) return badRequest(request, ownerHandle.detail);
    const slug = readString(body, "slug");
    if (isRefusal(slug)) return badRequest(request, slug.detail);
    const version = readString(body, "version");
    if (isRefusal(version)) return badRequest(request, version.detail);
    const dot = readString(body, "dot");
    if (isRefusal(dot)) return badRequest(request, dot.detail);
    const cardFiles = readCardFiles(body);
    if (isRefusal(cardFiles)) return badRequest(request, cardFiles.detail);
    const manifest = readManifest(body);
    if (isRefusal(manifest)) return badRequest(request, manifest.detail);
    const vocabulary = readOptionalString(body, "vocabulary");
    if (isRefusal(vocabulary)) return badRequest(request, vocabulary.detail);
    const visibility = readVisibility(body);
    if (isRefusal(visibility)) return badRequest(request, visibility.detail);
    const lineage = readLineage(body);
    if (isRefusal(lineage)) return badRequest(request, lineage.detail);

    const input: PublishInput = {
      ownerHandle: ownerHandle.value,
      slug: slug.value,
      version: version.value,
      /* The engine's own cast, for the engine's own reason: no manifest field is required at
         the transport layer, because `resolveBundle` reports every one of them as a
         diagnostic in the caller's vocabulary and a bare 400 would say less. */
      manifest: manifest.value as unknown as BundleManifest,
      dot: dot.value,
      cardFiles: cardFiles.value,
      ...vocabularyOf(vocabulary.value),
      ...(visibility.value === undefined ? {} : { visibility: visibility.value }),
      ...(lineage.value === undefined ? {} : { lineage: lineage.value }),
    };

    /* One `catch`, and NOT `../validate/body`'s `withLimits`: that helper takes a synchronous
       `() => Response`, and every throw on this path arrives as a rejected promise because
       `publish` is async. Reusing it would compile against a signature it cannot serve and
       silently catch nothing. `tooLarge` — the 413 itself — is still that module's. */
    const { db } = getSharedDbClient();
    try {
      return ok(await publish(db, actorFrom(session), input));
    } catch (thrown) {
      const refusal = statusFor(request, thrown);
      if (refusal !== undefined) return refusal;
      throw thrown;
    }
  });
}

/* --------------------- the refusals this route maps --------------------- */

/**
 * The typed rejections a publish can raise, each with its message UNALTERED.
 *
 * D-50-08's rule, which is why this is a translation of STATUS and never of wording: one
 * sentence keeps one author. `MalformedVocabularyError` is T010's, `CardStoreError` is
 * T020's, and re-rendering either of them as a publish refusal would put a second author on
 * a sentence that already has one.
 *
 * `undefined` rather than a 500 for anything else, so the caller rethrows: a fault in this
 * service belongs in the framework's 500 where it will be seen, and swallowing it here would
 * report a bug as a bad request.
 */
function statusFor(request: Request, thrown: unknown): Response | undefined {
  /* 413, and it is the engine's one throw rather than a report: a submission too large to
     look at got no answer at all, so it is transport rather than content (D-40-02). */
  if (thrown instanceof LimitExceededError) return tooLarge(request, thrown);
  if (thrown instanceof PublishRefusedError) {
    return problem(request, {
      type: `https://darkprint.io/problems/publish-${thrown.kind}`,
      title: TITLES[thrown.kind],
      status: STATUSES[thrown.kind],
      detail: thrown.message,
    });
  }
  /* 400: the caller sent a `vocabulary` that is not the shape the column holds. A refusal
     about the request's own shape, not about whether the bundle may be published. */
  if (thrown instanceof MalformedVocabularyError) return badRequest(request, thrown.message);
  /* 409, and it is reachable only under CONCURRENCY. `publish` reads the bundle and the
     release versions before it opens its transaction, so two publishes racing on one free
     slug can both pass those reads and the unique index arbitrates — which is where it
     should be arbitrated, since a check in the reader could not be atomic anyway. Without
     this arm the loser gets a 500 for a condition that is a plain conflict.

     **The loser is NOT silently retried as an append, and that was ruled rather than
     overlooked (D-100-01).** Converting a lost create into an append would make
     `PublishResult.created` a claim about who won a race instead of about what happened to
     the bundle, which is the whole meaning of the field; and a retry the caller issues is
     observable where one the server performs is not. It stays a 409 the caller retries. */
  if (thrown instanceof ArchiveConflictError) {
    return problem(request, {
      type: `https://darkprint.io/problems/archive-${thrown.kind}`,
      title: "Already published",
      status: 409,
      detail: thrown.message,
    });
  }
  /* There is no arm for an unknown ontology version. A manifest used to declare one, the
     publish resolved it against a table of published vocabulary versions, and a version
     nobody had published was a 422 here. There is one vocabulary and a manifest names none,
     so no request can be refused for that reason and an arm for it would be unreachable. */
  /* 422: a pinned card was refused by its own store — a bump smaller than the change
     requires (AC5), an identity mismatch, a version that is not semver. Every one is a fact
     about the submission rather than about this service. */
  if (thrown instanceof CardStoreError) {
    return problem(request, {
      type: "https://darkprint.io/problems/card-refused",
      title: "Card refused",
      status: 422,
      detail: thrown.message,
    });
  }
  /* 422: the freeze could not be built from what was just written. In practice this is
     `checkFactoryDot` — the emitted `factory.dot` failing the two checks Attractor runs
     before it will execute a pipeline — and it is a fact about the submitted graph, so the
     caller can act on it. `ExportError` only; `ExportReadError` is T090's driver-failure
     sibling and is deliberately NOT caught here, because the split is load-bearing (D-90-A):
     an infrastructure fault must reach the caller as a 500 rather than as a verdict on
     their bundle. Falling through returns `undefined` and the handler rethrows. */
  if (thrown instanceof ExportError) {
    return problem(request, {
      type: "https://darkprint.io/problems/export-refused",
      title: "Release does not export",
      status: 422,
      detail: thrown.message,
    });
  }
  return undefined;
}

/**
 * 404 for `not-owner`, and it is the whole of B-03 in one row.
 *
 * The other four are 422 rather than 400: the body was well formed and the registry
 * understood it. Only `conflict` is 409, because it is the one refusal that names a state
 * the caller could reach by retrying differently.
 */
const STATUSES: Readonly<Record<PublishRefusedError["kind"], number>> = {
  unfinished: 422,
  "in-error": 422,
  conflict: 409,
  "not-owner": 404,
  "version-not-higher": 422,
};

/** `title` is a short label for the KIND; the sentence the UI reads is `detail`. */
const TITLES: Readonly<Record<PublishRefusedError["kind"], string>> = {
  unfinished: "Bundle unfinished",
  "in-error": "Bundle in error",
  conflict: "Already published",
  "not-owner": "Not found",
  "version-not-higher": "Version not higher",
};

/* --------------------- the two fields only this route reads --------------------- */

/**
 * `vocabulary` arrives as YAML SOURCE and the column stores `{ text, terms }`, so the route
 * is where the two are joined — the same place and the same reader `/api/validate/bundle`
 * uses, so a bundle validated and then published reads its overlay identically.
 *
 * `text` is the caller's bytes unaltered, which is the whole of D-90-03: `exportBundle` has
 * to be able to write `ontology/extensions.yaml` back out with its comments, key order and
 * formatting intact, and a re-emission from parsed terms loses all three.
 *
 * **A vocabulary that does not parse currently publishes as "no local terms", and that is a
 * recorded gap rather than a decision.** `validateVocabularySource` withholds `terms` when it
 * reported anything of error severity, and `LoadBundleResult` has no field that could carry a
 * vocabulary's own diagnostics — the same silence `/api/validate/bundle` records. Here it
 * persists rather than merely being unreported, though it does not pass unnoticed: any card
 * relying on those terms then resolves as `card/unknown-term` and the publish is refused
 * in-error, so the release is never stored. Reported to the orchestrator.
 */
function vocabularyOf(source: string | undefined): Pick<PublishInput, "vocabulary"> {
  if (source === undefined) return {};
  const terms = validateVocabularySource(source).terms;
  return { vocabulary: terms === undefined ? { text: source } : { text: source, terms } };
}

/** `visibility`, when supplied. Absent means the owner's account default, which T100 applies. */
function readVisibility(
  body: Record<string, unknown>,
): { value?: "public" | "private" } | { detail: string } {
  const raw = body.visibility;
  if (raw === undefined || raw === null) return {};
  if (raw !== "public" && raw !== "private") {
    return { detail: '`visibility` must be "public" or "private" when present.' };
  }
  return { value: raw };
}

/**
 * `lineage`, when supplied — the upstream a fork points back at.
 *
 * All three fields are required together. A partial lineage is refused rather than filled
 * in: the line renders as one sentence naming an owner, a slug and a version, and two of
 * the three would render a pointer to nothing.
 */
function readLineage(
  body: Record<string, unknown>,
): { value?: { ownerHandle: string; slug: string; version: string } } | { detail: string } {
  const raw = body.lineage;
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { detail: "`lineage` must be a JSON object when present." };
  }
  const { ownerHandle, slug, version } = raw as Record<string, unknown>;
  if (typeof ownerHandle !== "string" || typeof slug !== "string" || typeof version !== "string") {
    return { detail: "`lineage` must carry string `ownerHandle`, `slug` and `version`." };
  }
  return { value: { ownerHandle, slug, version } };
}

/* --------------------- the verbs this address refuses --------------------- */

/**
 * GET is exported only so the refusal can carry an `Allow` header: the 405 Next synthesises
 * for an unexported method has no header and no body, which is what left a caller guessing.
 * OPTIONS is exported for the other half of that, because the one Next synthesises lists
 * every method the file exports and would advertise GET as if it published something.
 */
const ALLOW = "POST";

export function GET(request: Request): Response {
  return methodNotAllowed(
    request,
    ALLOW,
    "This address publishes a release and takes POST only. The first publish for a slug " +
      "creates the bundle; every one after appends to it.",
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: { allow: ALLOW } });
}
