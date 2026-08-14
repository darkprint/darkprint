/* ============================================================
   DarkPrint backend — lib/server/cards typed errors
   Every error leaving this module has own properties exactly
   ["message", "cause"]: `cause` is non-enumerable (the ES2022
   Error-cause option makes it so by spec) and `.stack`, which
   the base `Error` constructor adds as a third own property this
   contract does not allow, is stripped. `message` is built only
   from the caller's own identifiers (cardId, version, owner) —
   never a raw driver message, which for a `DrizzleQueryError`
   opens with the whole INSERT and every bound parameter, here
   the caller's entire card source (T020 contract; T010 paid two
   rounds for the same lesson).
   ============================================================ */

export class CardStoreError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    // `cause` above is already a non-enumerable own property by spec
    // (ES2022 `InstallErrorCause`); `.stack` is the one own property the
    // base constructor adds that this contract does not allow.
    delete (this as { stack?: unknown }).stack;
  }
}

// Set on the prototype, not as an instance field: a `readonly name = "..."`
// class field would itself be a third own instance property.
Object.defineProperty(CardStoreError.prototype, "name", {
  value: "CardStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});

export function identityMismatchError(cardId: string, version: string): CardStoreError {
  return new CardStoreError(
    `Card ${cardId}@${version}: the top-level cardId/version do not match body.id/body.version.`,
  );
}

export function invalidVersionError(cardId: string, version: string): CardStoreError {
  return new CardStoreError(`Card ${cardId}@${version}: "${version}" is not a valid semver.`);
}

export function notWellFormedError(cardId: string, version: string, path: string): CardStoreError {
  return new CardStoreError(
    `Card ${cardId}@${version}: the string at ${path} cannot round-trip through storage (unpaired surrogate).`,
  );
}

export function bumpTooSmallError(cardId: string, version: string, reasons: readonly string[]): CardStoreError {
  const detail = reasons.length > 0 ? ` ${reasons.join("; ")}.` : "";
  return new CardStoreError(
    `Card ${cardId}@${version}: the declared bump is smaller than the change requires.${detail}`,
  );
}

export function duplicateVersionError(cardId: string, version: string, cause?: unknown): CardStoreError {
  return new CardStoreError(`Card ${cardId}@${version} already exists.`, cause);
}

export function storageFailureError(cardId: string, version: string, cause?: unknown): CardStoreError {
  return new CardStoreError(`Storing card ${cardId}@${version} failed.`, cause);
}
