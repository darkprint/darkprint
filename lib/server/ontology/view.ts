/* ============================================================
   DarkPrint backend — opening a merged view
   The verb is `open`, not `get`, and the difference is AC5.

   `isA` memoizes per view instance (`resolve.ts:196`, the `chains`
   map), and two bundles' scores are only comparable when they were
   resolved against the *same* instance
   (`lib/content/read.ts:104-154`). So the caller opens one view and
   reuses it for a whole resolution batch; a function that built a
   fresh view per call could not satisfy AC5 however it was tested.

   **There is deliberately no module-scope cache keyed by version.**
   That would turn a per-batch guarantee into a process-lifetime
   one: an ontology released mid-batch would then serve two callers
   different vocabularies under one version, and the second caller
   would have no way to tell. Each `openView` reads the version as
   it stands now and hands back an instance the caller owns. If a
   cache is wanted it is T080's projection concern.
   ============================================================ */

import { ontologyView } from "@/lib/core";
import type { OntologyTerm, OntologyView } from "@/lib/core";
import type { Db } from "@/lib/db";

import { UnknownOntologyVersionError } from "./errors";
import { getOntologyVersion } from "./store";
import { asOntology } from "./vocabulary";

/**
 * Open one merged view over a published version, with a bundle's local overlay layered on.
 *
 * `extensions` is how an overlay reaches the merge — supplied by the caller per bundle, from
 * the release that declares it. It is never a global row: this module stores core terms only.
 *
 * The merged view keeps the **base** version (AC1), which is what lets a card still declare
 * `ontology_version: 0.1.0` while using local terms. An overlay term sharing an id replaces
 * the base term *in place*, keeping its position, and the shadowing is reported by
 * `validate()` (AC2) — both are `ontologyView`'s behaviour, consumed here rather than
 * reimplemented.
 */
export async function openView(
  db: Db,
  version: string,
  extensions?: readonly OntologyTerm[],
): Promise<OntologyView> {
  const record = await getOntologyVersion(db, version);
  if (record === undefined) {
    throw new UnknownOntologyVersionError(`Ontology version \`${version}\` is not published.`);
  }
  return ontologyView(asOntology(record.version, record.terms), extensions);
}
