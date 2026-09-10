/* ============================================================
   GET  /api/cards        -> { cards }
   POST /api/cards        -> 201 { card, path } | 400 401 403 409 413 422 429

   GET is the node library. `cards()` and not `latestCards()`:
   the published shape is every indexed version, and which of them
   a page shows is the page's decision.

   POST publishes one card on its own, under the caller's handle.
   It lives here rather than under `[...ref]` because that file's
   one POST is the fork and its header says why nothing else may
   join it; a card being published has no id in the URL yet, since
   the id is decided from the caller's handle and the document.

   ── who may call ──
   A session cookie or a write-scoped API key, resolved the way
   `POST /api/bundles` resolves its caller, so the two publish
   doors judge a caller alike. Anonymous is refused before the
   body is read.

   ── the rate bucket ──
   `upload`, spent after the caller is known and before the body
   is read, so a flood of malformed documents counts too. The
   caller is counted at the `account` tier by account id whether
   it arrived by cookie or by key: the guard hands the handler one
   shape for both, and the two `upload` ceilings are the same
   number, so nothing is lost by not telling them apart.

   ── the refusals ──
   A malformed BODY is 400. A well-formed body the registry
   declines is `publishCard`'s refusal, mapped by `kind`:

     card-id-invalid       -> 400   the name is the caller's own
     no-handle             -> 403   signed in, nothing to publish under
     card-id-taken         -> 409   somebody else holds the id
     card-version-exists   -> 409   a stored version never changes
     card-invalid          -> 422   with the validator's diagnostics
     card-unrewritable     -> 422   the document cannot take the id

   `CardStoreError` from the store is 422 with its own sentence,
   which is the bundles route's arm for the same class; a bump too
   small is a fact about the submission. `LimitExceededError` is
   413, the engine's one throw rather than a report.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { nodeHref } from "@/lib/href";
import { actorFrom as actorFromSession } from "@/lib/server/accounts";
import { withSessionOrWriteKey } from "@/lib/server/auth";
import { LimitExceededError } from "@/lib/server/engine";
import { PROBLEM_TYPE_BASE, badRequest, ok, problem } from "@/lib/server/http";
import { enforceLimit, withLimitsErrors, type LimitSubject } from "@/lib/server/limits";
import { CardStoreError, publishCard, type CardPublishRefusal, type CardPublishRefusedKind } from "@/lib/server/cards";
import { actorFrom, cards, withRegistryErrors } from "@/lib/server/registry";
import { isRefusal, readObjectBody, readOptionalString, readString, tooLarge } from "../validate/body";

/** The bucket a card publish spends from. */
const UPLOAD_BUCKET = "upload";

export async function GET(request: Request): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok({ cards: await cards(db, actorFrom(request)) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withLimitsErrors(request, () =>
    withSessionOrWriteKey(request, async (session) => {
      await enforceLimit(subjectFor(request, session.accountId), UPLOAD_BUCKET);

      const parsed = await readObjectBody(request);
      if ("refusal" in parsed) return parsed.refusal;
      const { body } = parsed;

      const source = readString(body, "source");
      if (isRefusal(source)) return badRequest(request, source.detail);
      const name = readOptionalString(body, "name");
      if (isRefusal(name)) return badRequest(request, name.detail);
      const visibility = readVisibility(body);
      if (isRefusal(visibility)) return badRequest(request, visibility.detail);

      const { db } = getSharedDbClient();
      try {
        const result = await publishCard(db, actorFromSession(session), {
          source: source.value,
          ...(name.value === undefined ? {} : { name: name.value }),
          ...(visibility.value === undefined ? {} : { visibility: visibility.value }),
        });
        if (!result.ok) return refused(request, result.refusal);
        return ok({ card: result.card, path: nodeHref(result.card.cardId) }, { status: 201 });
      } catch (thrown) {
        if (thrown instanceof LimitExceededError) return tooLarge(request, thrown);
        if (thrown instanceof CardStoreError) {
          return problem(request, {
            type: `${PROBLEM_TYPE_BASE}/card-refused`,
            title: "Card refused",
            status: 422,
            detail: thrown.message,
          });
        }
        throw thrown;
      }
    }),
  );
}

/* --------------------- the refusals this route maps --------------------- */

const STATUSES: Readonly<Record<CardPublishRefusedKind, number>> = {
  "not-signed-in": 401,
  "no-handle": 403,
  "card-invalid": 422,
  "card-unrewritable": 422,
  "card-id-invalid": 400,
  "card-id-taken": 409,
  "card-version-exists": 409,
};

/** `title` is a short label for the kind; the sentence a reader acts on is `detail`. */
const TITLES: Readonly<Record<CardPublishRefusedKind, string>> = {
  "not-signed-in": "Unauthorized",
  "no-handle": "Handle required",
  "card-invalid": "Card invalid",
  "card-unrewritable": "Card cannot be published",
  "card-id-invalid": "Bad request",
  "card-id-taken": "Card id taken",
  "card-version-exists": "Already published",
};

/**
 * `detail` is the refusal's own sentence, byte for byte, and `diagnostics` travels as an
 * extension member when the validator produced any: they are the author's own document read
 * back, which is what a refusal about the document has to hand over.
 */
function refused(request: Request, refusal: CardPublishRefusal): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/card-publish-${refusal.kind}`,
    title: TITLES[refusal.kind],
    status: STATUSES[refusal.kind],
    detail: refusal.detail,
    ...(refusal.diagnostics === undefined ? {} : { diagnostics: refusal.diagnostics }),
  });
}

/** `visibility`, when supplied. Absent means the publisher's account default, which `publishCard` applies. */
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

/** How this request is counted: the account behind the cookie or the key, by its id. */
function subjectFor(request: Request, accountId: string): LimitSubject {
  return { tier: "account", accountId, ip: addressOf(request) };
}

/**
 * The caller's address as the edge reports it, or `""` when no header carries one. Spoofable
 * by any client that sets the header, which is a property of every reverse-proxied
 * deployment; the mitigation is at the edge and a second opinion here would not be one.
 */
function addressOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded !== "") return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "";
}
