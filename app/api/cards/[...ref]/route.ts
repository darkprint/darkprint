/* ============================================================
   GET  /api/cards/[...ref]        -> { card }      | 404
   GET  /api/cards/[id]/versions   -> { versions }
   GET  /api/cards/[id]/users      -> { users }
   POST /api/cards/[id]/fork       -> { card }      | 400 401 403 404 409 500

   Three published paths, one catch-all, because a card id may be
   namespaced — `CARD_ID` (`lib/core/card/schema.ts:167`) admits
   one `owner/name` segment pair, so `berti/solver-a` spans two
   URL segments and `[id]/versions` as a literal folder could not
   express it. The frontend's own `/nodes/[...id]` is a catch-all
   for that same reason. The URLs served are exactly the
   ones published; only the file that serves them is shared.

   The dispatch is total rather than heuristic: a pinned ref always
   ends in a segment containing `@` (`parseCardRef` rejects
   anything else) and a card id never contains one, so "is the last
   segment `versions`/`users`" and "is this a ref" cannot both be
   true of one path.

   ── the fork POST lives here and could not live anywhere else ──
   `app/api/cards/[...ref]/fork/route.ts` is not a route Next can
   serve: a catch-all consumes every remaining segment, so no
   directory may sit under one. `app/api/cards/[id]/fork/route.ts`
   would serve `planner` and never `lupo/planner`, which is half
   the ids `CARD_ID` admits — the same reason this file exists for
   the two GET sub-resources. So `fork` joins them as a third
   keyword, on the same total dispatch, and the URL published is
   `POST /api/cards/<id>/fork` for both id shapes.

   ── the shape of the request, mirroring the bundle fork ──
   The URL names the upstream CARD and the body carries the one
   thing the URL has no room for: `version`, the version actually
   taken. That refusal to fork "whatever is latest" is
   `forkBundle`'s (D-110-11) and the reason travels unchanged — a
   fallback to the newest version writes a true provenance about
   the wrong bytes. `name` and `visibility` are the two optional
   target fields; there is no `id`, because the namespace a fork
   lands in is the forker's handle and is not the caller's to
   choose (`fork-card.ts`'s header says why that is a security
   decision rather than a naming one).

   ── why `{ card }` and not the record bare ──
   The bundle fork answers `ok(fork)` unwrapped. This one wraps,
   because every other answer this FILE gives is wrapped —
   `{ card }`, `{ versions }`, `{ users }` — and a caller reading
   two shapes off one path is the drift worth avoiding here.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom as actorFromSession } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import { badRequest, notFound, ok } from "@/lib/server/http";
import { forkCard, withLineageErrors, type CardForkTarget } from "@/lib/server/lineage";
import { actorFrom, card, usersOf, versionsOf, withRegistryErrors } from "@/lib/server/registry";
import { isRefusal, readObjectBody, readOptionalString, readString } from "../../validate/body";

const NO_SUCH_CARD = "card: no such card.";

/** The one POST path this file publishes. Anything else under `/api/cards` is not an endpoint. */
const FORK = "fork";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string[] }> },
): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { ref } = await params;
    const { db } = getSharedDbClient();
    const actor = actorFrom(request);

    const last = ref[ref.length - 1];
    // `ref.length > 1` is what keeps `/api/cards/versions` — a one-segment path naming no
    // card — out of the sub-resource branches; it falls through and 404s as the malformed
    // ref it is, rather than answering `[]` for the empty id.
    if (ref.length > 1 && (last === "versions" || last === "users")) {
      const id = ref.slice(0, -1).join("/");
      return last === "versions"
        ? ok({ versions: await versionsOf(db, actor, id) })
        : ok({ users: await usersOf(db, actor, id) });
    }

    // One answer for three states — no such ref, a ref that is not a pinned reference, and a
    // card private to somebody else — for the reason the blueprint route states (B-03).
    const record = await card(db, actor, ref.join("/"));
    return record === undefined ? notFound(request, NO_SUCH_CARD) : ok({ card: record });
  });
}

/** `visibility`, when supplied. Absent means the forker's own account default (D-110-09). */
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
 * Fork one card version into the caller's own namespace.
 *
 * Session required: `withSession` answers 401 before the handler runs, which is why
 * `forkCard`'s own `not-signed-in` kind is unreachable from here and is a module-boundary
 * refusal only (D-110-10's reasoning, unchanged for the card verb). Everything else is
 * `forkCard`'s refusal vocabulary, mapped by `withLineageErrors` — which is where the
 * kind-to-status table lives, so this handler decides no status of its own.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ref: string[] }> },
): Promise<Response> {
  return withLineageErrors(request, async () =>
    withSession(request, async (session) => {
      const { ref } = await params;

      /* 404 rather than 405, and the choice is forced rather than preferred: a 405 owes an
         `Allow` header (RFC 9110 §15.5.6) and `problem()` sets only its content type, so the
         choice was between a malformed 405 and a 404 that says what the one POST path is.
         `ref.length > 1` keeps `POST /api/cards/fork` — a path naming no card — out of the
         fork branch, the same guard the GET sub-resources use one function up. */
      if (ref.length < 2 || ref[ref.length - 1] !== FORK) {
        return notFound(request, "card: the only POST endpoint here is `/api/cards/<id>/fork`.");
      }
      const cardId = ref.slice(0, -1).join("/");

      const parsed = await readObjectBody(request);
      if ("refusal" in parsed) return parsed.refusal;
      const { body } = parsed;

      const version = readString(body, "version");
      if (isRefusal(version)) return badRequest(request, version.detail);
      const name = readOptionalString(body, "name");
      if (isRefusal(name)) return badRequest(request, name.detail);
      const visibility = readVisibility(body);
      if (isRefusal(visibility)) return badRequest(request, visibility.detail);

      /* Both optional fields are passed through as ABSENT rather than as a resolved default:
         `forkCard` reads the upstream's own name for one and the forker's account default for
         the other, and a constant here — `"private"` included — is exactly the module constant
         D-110-09 was written to refuse. */
      const to: CardForkTarget = {
        ...(name.value === undefined ? {} : { name: name.value }),
        ...(visibility.value === undefined ? {} : { visibility: visibility.value }),
      };

      const { db } = getSharedDbClient();
      const fork = await forkCard(db, actorFromSession(session), { cardId, version: version.value }, to);
      return ok({ card: fork });
    }),
  );
}
