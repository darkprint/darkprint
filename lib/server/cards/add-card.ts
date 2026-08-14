/* ============================================================
   DarkPrint backend — addCard
   One immutable row per `(cardId, version)`. Order of guards
   matches the order they're cheapest to check and safest to
   check first: identity consistency, version grammar,
   well-formedness, the bump against whatever chain already
   exists, then the write itself — each one refuses with a typed
   error built only from the caller's own identifiers before any
   database round trip happens, except the last two, which need
   one to know what "the chain" or "a duplicate" even is.

   T020 has no code dependency on T025 (published-signature note):
   `inferBump`/`checkVersionChain` are consumed directly from
   `lib/core`, never through `lib/server/versioning/**`, which is
   Forbidden here.
   ============================================================ */

import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { cardDigest, checkVersionChain, parseSemver } from "@/lib/core";
import type { NodeCard } from "@/lib/server/types";
import type { CardRecord } from "./types";
import { toCardRecord } from "./to-card-record";
import { findWellFormednessIssue } from "./well-formed";
import { CARD_ID_VERSION_UNIQUE_CONSTRAINT } from "./constraint";
import { pgErrorCode, pgErrorConstraint } from "./pg-error";
import {
  bumpTooSmallError,
  duplicateVersionError,
  identityMismatchError,
  invalidVersionError,
  notWellFormedError,
  storageFailureError,
} from "./errors";

export interface AddCardInput {
  cardId: string;
  version: string;
  ownerId: string;
  visibility?: "public" | "private";
  body: NodeCard;
  source: string;
}

/** Stores one new card version. Digest is computed here, never accepted from the caller. */
export async function addCard(db: Db, input: AddCardInput): Promise<CardRecord> {
  const { cardId, version, ownerId, body, source } = input;
  const visibility = input.visibility ?? "public";

  // The row's indexed identity has to match the identity the stored content
  // itself declares — otherwise a caller could index one card's row under
  // another's (cardId, version), which "one immutable document per (id,
  // version)" does not allow even by accident.
  if (body.id !== cardId || body.version !== version) {
    throw identityMismatchError(cardId, version);
  }

  // AC3: a private card failing the version grammar is refused exactly as a
  // public one is — this check runs before `visibility` is even consulted.
  if (parseSemver(version) === undefined) {
    throw invalidVersionError(cardId, version);
  }

  const issue = findWellFormednessIssue(source, body);
  if (issue !== undefined) {
    throw notWellFormedError(cardId, version, issue.path);
  }

  let digest: string;
  try {
    digest = cardDigest(body);
  } catch (cause) {
    throw storageFailureError(cardId, version, cause);
  }

  // AC6: check the declared bump against the whole existing chain, not just
  // whatever happens to be "latest" — checkVersionChain sorts by version and
  // checks every adjacent pair, so a version inserted into the middle of an
  // existing chain is held to the same rule a version appended at the end is.
  const existing = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.cardId, cardId));
  if (existing.length > 0) {
    const chain = [...existing.map((row) => ({ card: row.body as NodeCard })), { card: body }];
    const bumpDiagnostics = checkVersionChain(chain).filter((d) => d.code === "card/version-bump-too-small");
    if (bumpDiagnostics.length > 0) {
      // `message` is the summary sentence ("only a patch bump... requires a major
      // bump"); the itemized per-field reasons ("required input `extra` was
      // added") are in `hint`. AC6 asks for the engine's reasons, which means both.
      throw bumpTooSmallError(
        cardId,
        version,
        bumpDiagnostics.flatMap((d) => (d.hint !== undefined ? [d.message, d.hint] : [d.message])),
      );
    }
  }

  try {
    const [row] = await db
      .insert(schema.cardVersion)
      .values({ cardId, version, digest, ownerId, visibility, body, source })
      .returning();
    return toCardRecord(row);
  } catch (cause) {
    // AC1: storing x@1.0.0 twice — with the same bytes or different ones —
    // is refused, not overwritten. The unique index doesn't distinguish by
    // content, so any second insert for one (cardId, version) lands here.
    if (pgErrorCode(cause) === "23505" && pgErrorConstraint(cause) === CARD_ID_VERSION_UNIQUE_CONSTRAINT) {
      throw duplicateVersionError(cardId, version, CARD_ID_VERSION_UNIQUE_CONSTRAINT, cause);
    }
    throw storageFailureError(cardId, version, cause);
  }
}
