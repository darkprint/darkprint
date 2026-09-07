/* ============================================================
   DarkPrint backend — lib/server/cards typed errors
   The error-hygiene clause, not restated in full here:
   `Object.keys(err)` empty and
   `JSON.stringify(err)` exactly `"{}"`; `cause` present but
   non-enumerable (the ES2022 Error-cause option makes it so by
   spec — nothing here has to force it); `stack` retained, not
   deleted, since deleting it was the earlier wording's mistake,
   not a requirement. Whitelist, not blacklist: every rendering
   (`message`, `String(err)`, `JSON.stringify(err)`,
   `JSON.stringify({ detail: err.message })`, own-property
   enumeration) may carry only a fixed message naming the
   operation, identifiers the caller itself supplied, and this
   module's own schema-derived constraint name — nothing read off
   a driver error ever reaches an enumerable output; `cause`
   carries all of that and is exactly what non-enumerable hides.
   ============================================================ */

export class CardStoreError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
  }
}

// Set on the prototype, not as an instance field: a `readonly name = "..."`
// class field would itself be an own instance property, which the
// `Object.keys`/`JSON.stringify` invariants above don't allow.
Object.defineProperty(CardStoreError.prototype, "name", {
  value: "CardStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});

export function identityMismatchError(cardId: string, version: string): CardStoreError {
  return new CardStoreError(
    `addCard: \`${cardId}@${version}\`'s top-level cardId/version do not match body.id/body.version.`,
  );
}

export function invalidVersionError(cardId: string, version: string): CardStoreError {
  return new CardStoreError(`addCard: \`${cardId}@${version}\` — "${version}" is not a valid semver.`);
}

export function notWellFormedError(cardId: string, version: string, path: string): CardStoreError {
  return new CardStoreError(
    `addCard: \`${cardId}@${version}\` — the string at ${path} cannot round-trip through storage (unpaired surrogate).`,
  );
}

export function bumpTooSmallError(cardId: string, version: string, reasons: readonly string[]): CardStoreError {
  const detail = reasons.length > 0 ? ` ${reasons.join("; ")}.` : "";
  return new CardStoreError(
    `addCard: \`${cardId}@${version}\`'s declared bump is smaller than the change requires.${detail}`,
  );
}

/**
 * `constraintName` is this module's own identifier, read off the schema through
 * `getTableConfig` (`constraint.ts`) rather than the driver's — naming it is not a
 * leak, it is the "typed conflict names the constraint it matched" clause.
 */
export function duplicateVersionError(cardId: string, version: string, constraintName: string, cause?: unknown): CardStoreError {
  return new CardStoreError(`addCard: \`${cardId}@${version}\` already exists (${constraintName}).`, cause);
}

export function storageFailureError(cardId: string, version: string, cause?: unknown): CardStoreError {
  return new CardStoreError(`addCard: storing \`${cardId}@${version}\` failed.`, cause);
}
