/* ============================================================
   DarkPrint backend — refusing input whose *shape* is wrong
   Distinct from `well-formed.ts`, which asks whether a value can
   survive storage. This asks whether it is the thing the published
   signature says it is, at runtime, where TypeScript is not.

   It exists because the caller that gets this wrong is not
   hostile, it is a file. YAML parses `version: 1.0` as the number
   `1`, and T250's seed import is that caller — the number reaches
   `text` storage, Postgres renders it `"1"`, and the digest was
   taken over the number, so the stored row hashes to something the
   stored digest does not match. The same break D-15 found in the
   version string, arriving through a type rather than a character.

   Six further shapes used to escape as an untyped `TypeError`,
   which contradicts `errors.ts`'s opening claim that every error
   leaving this module is typed. They are refused here instead.

   The `kind` set is read off `lib/db/schema.ts`'s own column
   through `getTableConfig`, never restated: a kind this module
   accepted and the column rejected would fail at the driver with
   the statement attached, which is the leak the error clause
   exists to prevent.
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";

import { schema } from "@/lib/db";

/** The kinds the column will actually accept, from the column itself. */
const STORABLE_KINDS: ReadonlySet<string> = new Set(
  (
    getTableConfig(schema.ontologyTerm).columns.find((column) => column.name === "kind") as {
      enumValues?: readonly string[];
    }
  ).enumValues ?? [],
);

/** What is wrong, and where. The path is field names and indices, never a value. */
export interface Malformed {
  path: string;
  reason: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function bad(path: string, reason: string): Malformed {
  return { path, reason };
}

/** Optional field that must be a string when present. `undefined` is absence, and legal. */
function optionalString(value: unknown, path: string): Malformed | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? undefined : bad(path, "must be a string when present");
}

function checkDeprecation(value: unknown, path: string): Malformed | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return bad(path, "must be an object when present");
  }
  const deprecation = value as Record<string, unknown>;
  if (!isNonEmptyString(deprecation.since)) return bad(`${path}.since`, "must be a non-empty string");
  return (
    optionalString(deprecation.replacedBy, `${path}.replacedBy`) ??
    optionalString(deprecation.note, `${path}.note`)
  );
}

function checkTerm(value: unknown, path: string): Malformed | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return bad(path, "must be an object");
  }
  const term = value as Record<string, unknown>;

  if (!isNonEmptyString(term.id)) return bad(`${path}.id`, "must be a non-empty string");
  if (typeof term.kind !== "string" || !STORABLE_KINDS.has(term.kind)) {
    return bad(`${path}.kind`, `must be one of ${[...STORABLE_KINDS].join(", ")}`);
  }
  if (typeof term.label !== "string") return bad(`${path}.label`, "must be a string");
  if (typeof term.description !== "string") return bad(`${path}.description`, "must be a string");
  if (!isNonEmptyString(term.since)) return bad(`${path}.since`, "must be a non-empty string");

  const broader = optionalString(term.broader, `${path}.broader`);
  if (broader !== undefined) return broader;

  const deprecated = checkDeprecation(term.deprecated, `${path}.deprecated`);
  if (deprecated !== undefined) return deprecated;

  if (term.defaultWeight !== undefined && typeof term.defaultWeight !== "number") {
    return bad(`${path}.defaultWeight`, "must be a number when present");
  }
  if (term.impliesHuman !== undefined && typeof term.impliesHuman !== "boolean") {
    return bad(`${path}.impliesHuman`, "must be a boolean when present");
  }
  return undefined;
}

/**
 * The first shape problem in what `addOntologyVersion` was handed, or `undefined`.
 *
 * `version` is checked as strictly as any term field: it is stored in a `text` column and
 * rendered into every rejection, and a number reaching either is the D-15 break by another
 * route.
 */
export function findMalformedInput(input: {
  version: unknown;
  terms: unknown;
}): Malformed | undefined {
  if (!isNonEmptyString(input.version)) {
    return bad("version", "must be a non-empty string");
  }
  if (!Array.isArray(input.terms)) {
    return bad("terms", "must be an array");
  }
  for (let i = 0; i < input.terms.length; i += 1) {
    const problem = checkTerm(input.terms[i], `terms[${i}]`);
    if (problem !== undefined) return problem;
  }
  return undefined;
}
