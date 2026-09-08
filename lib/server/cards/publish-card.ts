/* ============================================================
   DarkPrint backend — publishCard
   The public write path for one card on its own. Until now a
   `card_version` row arrived in two ways only: pinned inside a
   bundle that publishes, or copied by `forkCard`. This is the
   third, and it is written from the fork rather than beside it:
   the same read of the account, the same namespace rule, the same
   occupancy check, the same restamp of the document, and `addCard`
   for the write. Where it differs, a card an author wrote is not a
   card an author copied, and each difference is argued below.

   ── the id is `<handle>/<name>`, and the caller chooses `name` only ──
   `forkCard`'s header makes the case and it holds unchanged here:
   a freely chosen target id turns this door into a probe for
   private cards, since a taken id and a free one answer
   differently. A publisher who may only ever write inside their
   own handle can only ever learn about their own names. `name`
   defaults to the last segment of the id the card declares, so a
   card written as `planner` lands at `berti/planner` and one
   written as `lupo/planner` does too, because `CARD_ID` admits one
   namespace and never two.

   ── the document is restamped with the id and nothing else ──
   A stored `source` still declaring `id: planner` under the row
   `berti/planner@1.0.0` is a file that contradicts its own row, so
   the id is rewritten the way the fork rewrites it. `author` and
   `provenance` are left as written: the row's `owner_id` is what
   the registry answers for and the body's `author` is content the
   author typed, which is how every other reader in this tree
   already treats it. When the card already declares its
   namespaced id the bytes are stored verbatim.

   ── a version bump is allowed, a squat is refused ──
   The fork refuses any occupied id because a fork is never an
   append. A publish is: `berti/planner@1.1.0` after
   `berti/planner@1.0.0` is the ordinary second release, and
   `addCard` prices the bump against the stored predecessor. What
   is refused is an id holding a version owned by somebody else,
   which a bundle publish can create at any id it pins. The reader
   for that is owner- and visibility-blind for `cardIdInUse`'s
   reason.

   ── refusals are values, not a class ──
   Every refusal below is returned rather than thrown, and the
   route maps its `kind` to a status. `CardStoreError` from
   `addCard` still travels as itself, so a bump too small reaches
   the caller with the store's own sentence and one author.
   ============================================================ */

import { summarize, type Diagnostic } from "@/lib/core";
import type { Db } from "@/lib/db";
import { getAccount } from "@/lib/server/accounts";
import { validateCardSource } from "@/lib/server/engine";
import { MAX_NAME_LENGTH, validateCardId, validateNamespace } from "@/lib/server/naming";
import type { Actor } from "@/lib/server/policy";
import type { NodeCard } from "@/lib/server/types";
import { addCard } from "./add-card";
import { cardIdHeldByOther } from "./card-id-held-by-other";
import { cardVersionExists } from "./card-version-exists";
import { CardStoreError } from "./errors";
import { restampCardSource } from "./restamp-source";
import type { CardRecord } from "./types";

/** What a caller submits: the card's own YAML, and the two choices the document cannot make. */
export interface PublishCardInput {
  source: string;
  /** The un-namespaced half of the id. Absent means the last segment of the id the card declares. */
  name?: string;
  /** Absent means the publisher's own account default, never a constant here. */
  visibility?: "public" | "private";
}

/**
 * Why a publish was refused, as a closed union a route maps to a status.
 *
 * `not-signed-in` is unreachable through HTTP, where the guard answers 401 first; it exists
 * because an anonymous `Actor` reaches this function at the module boundary. `card-invalid`
 * carries the validator's own diagnostics, which are the whole of what the author can act on.
 */
export type CardPublishRefusedKind =
  | "not-signed-in"
  | "no-handle"
  | "card-invalid"
  | "card-unrewritable"
  | "card-id-invalid"
  | "card-id-taken"
  | "card-version-exists";

export interface CardPublishRefusal {
  kind: CardPublishRefusedKind;
  detail: string;
  diagnostics?: readonly Diagnostic[];
}

export type CardPublishResult =
  | { ok: true; card: CardRecord }
  | { ok: false; refusal: CardPublishRefusal };

/**
 * Store one card version under the actor's own handle, or say why not.
 *
 * Throws only what it does not decide: `LimitExceededError` from the validator for a
 * document too large to look at, and `CardStoreError` from `addCard` for a write the store
 * refused on its own terms. Everything this function decides comes back as a value.
 */
export async function publishCard(db: Db, actor: Actor, input: PublishCardInput): Promise<CardPublishResult> {
  const accountId = candidateAccountId(actor);
  if (accountId === undefined) return refuse("not-signed-in", "publishCard: not signed in.");
  const account = await getAccount(db, actor, accountId);
  if (account === undefined) return refuse("not-signed-in", "publishCard: not signed in.");

  /* Read off the account row rather than the session, because a renamed handle leaves the
     cookie stale and the namespace has to be the one the registry answers for today. */
  const handle = account.author.handle;
  if (handle === null) return refuse("no-handle", "publishCard: this account has no handle yet.");

  const validation = validateCardSource(input.source);
  if (validation.card === undefined) {
    const errors = summarize(validation.diagnostics).error;
    return {
      ok: false,
      refusal: {
        kind: "card-invalid",
        detail: `publishCard: the card was refused with ${errors} error${errors === 1 ? "" : "s"}.`,
        diagnostics: validation.diagnostics,
      },
    };
  }
  const declared = validation.card;

  const name = input.name ?? lastSegment(declared.id);
  const cardId = `${handle}/${name}`;
  const naming = nameProblem(handle, name, cardId);
  if (naming !== undefined) return refuse("card-id-invalid", `publishCard: ${naming}`);

  if (await cardIdHeldByOther(db, cardId, accountId)) {
    return refuse("card-id-taken", `publishCard: \`${cardId}\` is already taken.`);
  }
  if (await cardVersionExists(db, cardId, declared.version)) {
    return refuse("card-version-exists", versionExists(cardId, declared.version));
  }

  const body: NodeCard = { ...declared, id: cardId };
  const source = declared.id === cardId ? input.source : restampCardSource(input.source, { id: cardId });
  if (source === undefined) {
    return refuse(
      "card-unrewritable",
      `publishCard: the document cannot carry \`${cardId}\` as its id without changing what it says.`,
    );
  }

  const visibility = input.visibility ?? account.defaultVisibility;

  try {
    const card = await addCard(db, {
      cardId,
      version: declared.version,
      ownerId: accountId,
      visibility,
      body,
      source,
    });
    return { ok: true, card };
  } catch (cause) {
    /* The race the check above cannot close: if the version is there NOW, somebody got
       there between the read and the insert and the caller is owed the same sentence a
       moment earlier would have given them. Anything else is the store's own refusal. */
    if (cause instanceof CardStoreError && (await cardVersionExists(db, cardId, declared.version))) {
      return refuse("card-version-exists", versionExists(cardId, declared.version));
    }
    throw cause;
  }
}

function refuse(kind: CardPublishRefusedKind, detail: string): CardPublishResult {
  return { ok: false, refusal: { kind, detail } };
}

function versionExists(cardId: string, version: string): string {
  return `publishCard: \`${cardId}@${version}\` is already published. A stored version never changes, so publish the next one.`;
}

/** The un-namespaced half of a card id. `CARD_ID` admits one separator, so this is total. */
function lastSegment(cardId: string): string {
  const slash = cardId.lastIndexOf("/");
  return slash === -1 ? cardId : cardId.slice(slash + 1);
}

/**
 * The sentence refusing a target id no DOT node could pin, or `undefined` when it is legal.
 *
 * Both grammars are `lib/server/naming`'s, derived from the engine's own `CARD_ID`. The
 * name is checked as a namespace-shaped segment because that predicate is exactly one legal
 * segment with no `/`; the length bound is the btree ceiling `MAX_NAME_LENGTH` records. The
 * one sentence written here rather than passed through is the name's, because
 * `validateNamespace` says "Namespace" and that is the wrong word for the half submitted.
 */
function nameProblem(handle: string, name: string, cardId: string): string | undefined {
  if (name.length > MAX_NAME_LENGTH) {
    return `\`${name.slice(0, 32)}…\` is longer than ${MAX_NAME_LENGTH} characters.`;
  }
  if (validateNamespace(name).length > 0) return `\`${name}\` is not a legal card name.`;
  const handleIssue = validateNamespace(handle)[0];
  if (handleIssue !== undefined) return handleIssue.message;
  const idIssue = validateCardId(cardId)[0];
  return idIssue?.message;
}

/**
 * The account id an actor offers, read as an own property and never inherited, so a
 * malformed actor is a refusal rather than a `TypeError`.
 */
function candidateAccountId(actor: Actor): string | undefined {
  if (typeof actor !== "object" || actor === null || !Object.hasOwn(actor, "accountId")) return undefined;
  const offered = (actor as { accountId?: unknown }).accountId;
  return typeof offered === "string" && offered.length > 0 ? offered : undefined;
}
