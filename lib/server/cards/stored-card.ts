/* ============================================================
   DarkPrint backend — reading a stored card body as a card
   `card_version.body` is `jsonb`. Seven call sites turned it into a
   `NodeCard` with `row.body as NodeCard`, which is a cast and not a
   parse: the compiler was told the answer rather than asked to
   check it, and nothing at run time looked.

   ── the defect this ends, measured rather than imagined ──
   D-92 and D-93 changed the card schema; D-101 split `cannot` and
   added `willNot`. The `content/` archive was migrated. The rows in
   the registry were not, and on 2026-08-31 every one of the 58
   stored bodies still carried `requiresHuman` and none carried
   `willNot`. `NodeCard` declares `willNot: string[]` as REQUIRED,
   so the cast produced a value the type says cannot exist, and
   `app/nodes/[...id]/page.tsx:297` read `.length` off `undefined`
   and threw. Every registry-backed page was a 500 or an empty
   shelf, with a green test suite and a clean build, because nothing
   in either exercises a row written under an older schema.

   Re-seeding would have cleared that and left the mechanism intact:
   the next field anyone adds reproduces it exactly.

   ── why this checks SHAPE and not vocabulary ──
   The obvious implementation is `validateCard`, and it is wrong
   here. That function resolves every term against an `OntologyView`,
   and a card may legitimately use a namespaced term its BUNDLE
   declares in `ontology/extensions.yaml` — `content/cards/
   reply-qa-check@1.0.0.yaml` and `reply-dispatch@1.0.0.yaml` both
   use `lupo/pii-handling` today. This reader has a card id and no
   bundle, so it has no way to obtain the right overlay, and
   validating against the curated core alone would REFUSE two cards
   that are perfectly valid. Term resolution belongs where the
   extensions are known, which is `resolveBundle`, and it still
   happens there.

   So the question asked here is the narrow one the cast was lying
   about: does this object have the fields `NodeCard` declares, of
   the kinds it declares them. Nothing more is claimed, and the name
   says `storedCard` rather than `validStoredCard` for that reason.

   ── why a Record over `keyof NodeCard` ──
   A hand-written guard is a second spelling of the interface and
   drifts from it silently, which is the same class of defect as the
   cast. `Record<keyof NodeCard, FieldCheck>` fails to COMPILE when
   a field joins or leaves the interface, so the guard cannot fall
   behind the type it guards. `lib/core/gate.ts`'s `DIAGNOSTIC_GATE`
   and `diagnostics.test.ts`'s `EMITTED_BY` are the same device over
   their own closed sets.
   ============================================================ */

import type { NodeCard } from "@/lib/core";

/** Whether a field must be present, and what an acceptable value looks like. */
interface FieldCheck {
  /** `false` for the interface's `?` members, which a stored body may legitimately omit. */
  readonly required: boolean;
  readonly ok: (value: unknown) => boolean;
}

const isString = (v: unknown): boolean => typeof v === "string";
const isStringArray = (v: unknown): boolean => Array.isArray(v) && v.every(isString);
const isObject = (v: unknown): boolean => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A `Port`, checked to the depth this reader can honestly claim.
 *
 * `name` and `type` are the two members every consumer dereferences; a description is prose
 * and its absence breaks nothing. Deliberately not a full `Port` validation, because the
 * point of this module is the fields whose ABSENCE throws, not a second schema.
 */
const isPortArray = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.every((port) => isObject(port) && isString((port as { name?: unknown }).name) && isString((port as { type?: unknown }).type));

/**
 * Every field `NodeCard` declares, and what makes a stored value acceptable for it.
 *
 * Adding a member to `NodeCard` without adding it here is a compile error, which is the
 * whole reason this is a `Record` and not an array of checks.
 */
const FIELDS: Readonly<Record<keyof NodeCard, FieldCheck>> = Object.freeze({
  id: { required: true, ok: isString },
  name: { required: true, ok: isString },
  type: { required: true, ok: isString },
  phases: { required: true, ok: isStringArray },
  action: { required: true, ok: isString },
  spec: { required: true, ok: isString },
  model: { required: false, ok: isString },
  agent: { required: false, ok: isString },
  tools: { required: true, ok: isStringArray },
  mcp: { required: true, ok: isStringArray },
  skill: { required: false, ok: isString },
  params: { required: true, ok: isObject },
  inputs: { required: true, ok: isPortArray },
  outputs: { required: true, ok: isPortArray },
  dependencies: { required: true, ok: isStringArray },
  cannot: { required: true, ok: isStringArray },
  willNot: { required: true, ok: isStringArray },
  riskMarkers: { required: true, ok: isStringArray },
  notes: { required: false, ok: isString },
  version: { required: true, ok: isString },
  author: { required: false, ok: isString },
  provenance: { required: false, ok: isString },
});

const FIELD_NAMES = Object.keys(FIELDS) as (keyof NodeCard)[];

/** Which of `NodeCard`'s fields this body cannot supply, in interface order. */
export function storedCardGaps(body: unknown): readonly string[] {
  if (!isObject(body)) return ["the body is not an object"];
  const row = body as Record<string, unknown>;
  const gaps: string[] = [];
  for (const field of FIELD_NAMES) {
    const check = FIELDS[field];
    const present = Object.hasOwn(row, field) && row[field] !== undefined;
    if (!present) {
      if (check.required) gaps.push(`\`${field}\` is missing`);
      continue;
    }
    if (!check.ok(row[field])) gaps.push(`\`${field}\` is the wrong kind`);
  }
  return gaps;
}

/**
 * A stored body as a `NodeCard`, or `undefined` when it is not one.
 *
 * `undefined` rather than a throw, and rather than a partial card. A row written under an
 * older schema is not an exception to be raised at a renderer three layers up, and it is not
 * something to paper over with defaults either: filling `willNot` with `[]` here would make
 * a card claim it undertakes nothing when the truth is that nobody asked it yet. The caller
 * decides what an unreadable row means for its own surface, and `storedCardGaps` tells it
 * why so the answer can say something better than "not found".
 *
 * The cast below is the one place it is honest: it follows an exhaustive check over every
 * field the interface declares, so the compiler is being told something that was just
 * verified rather than something asserted. That is the whole difference from the seven call
 * sites this module replaces.
 */
export function storedCard(body: unknown): NodeCard | undefined {
  return storedCardGaps(body).length === 0 ? (body as NodeCard) : undefined;
}
