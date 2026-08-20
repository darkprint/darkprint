/* ============================================================
   POST /api/validate/bundle
   The full parse-resolve-analyze pass over a submitted bundle,
   returning `LoadBundleResult` at 200 (B-03): a bundle that
   resolves with errors is an answer, and a bundle that resolves
   only partly is an answer with an analysis over what resolved.

   Nothing is persisted. This endpoint exists so a publish does
   not have to trust the numbers a browser tab computed, and it
   runs the same `loadBundle` the tab runs.
   ============================================================ */

import type { BundleManifest } from "@/lib/core";
import { ok } from "@/lib/server/http";
import { badRequest } from "@/lib/server/http";
import { validateBundle, validateVocabularySource } from "@/lib/server/engine";
import {
  isRefusal,
  readCardFiles,
  readManifest,
  readObjectBody,
  readOptionalString,
  readString,
  withLimits,
} from "../body";

export async function POST(request: Request): Promise<Response> {
  const parsed = await readObjectBody(request);
  if ("refusal" in parsed) return parsed.refusal;
  const { body } = parsed;

  const dot = readString(body, "dot");
  if (isRefusal(dot)) return badRequest(request, dot.detail);
  const cardFiles = readCardFiles(body);
  if (isRefusal(cardFiles)) return badRequest(request, cardFiles.detail);
  const manifest = readManifest(body);
  if (isRefusal(manifest)) return badRequest(request, manifest.detail);
  const vocabulary = readOptionalString(body, "vocabulary");
  if (isRefusal(vocabulary)) return badRequest(request, vocabulary.detail);

  return withLimits(request, () =>
    ok(
      validateBundle({
        manifest: manifest.value as unknown as BundleManifest,
        dot: dot.value,
        cardFiles: cardFiles.value,
        extensions: extensionsFrom(vocabulary.value),
      }),
    ),
  );
}

/**
 * `vocabulary` arrives as YAML source and the module takes parsed terms, so the route is
 * where the two are joined — which is the ruling, and the reason the seam register's shape
 * could not be used as published.
 *
 * **A broken vocabulary is silent here, and that is the recorded gap rather than an
 * oversight.** `loadBundle` deliberately does not fold vocabulary defects into a bundle's
 * diagnostics, and `LoadBundleResult` has no field that could carry them, so a submission
 * whose overlay does not parse is scored against the curated core alone and the caller is
 * told nothing about why its local terms went unknown. `lib/content/read.ts` fails the whole
 * build over exactly this state. The endpoint that returns both halves is owed to whoever
 * builds the upload cutover (T263); until then `/api/validate/ontology` is where a caller
 * finds out, and it has to ask.
 */
function extensionsFrom(vocabulary: string | undefined) {
  if (vocabulary === undefined) return undefined;
  return validateVocabularySource(vocabulary).terms;
}
