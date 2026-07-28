/* ============================================================
   DarkPrint content — the local vocabulary file (doc 3 §7)
   `terms:` in, `OntologyTerm[]` out. One implementation, because
   the same document is read in three places and a second reader
   would be a second opinion about what a term is:

     - `lib/content/read.ts` reads `content/ontology/extensions.yaml`
       at build time and layers it over the curated core;
     - `lib/content/bundle-export.ts` puts it in the download, so a
       bundle whose cards use a local term ships the definitions
       that price it;
     - `/upload` reads the copy inside a folder somebody drops back
       in, which is the only way that folder resolves to the two
       numbers its own README quotes.

   PURE and client-safe: no filesystem, no YAML parser of its own.
   The caller parses the document (both the loader and the browser
   already have a parser) and hands the value over.
   ============================================================ */

import type { OntologyTerm, TermKind } from "@/lib/core";

/** Bundle-relative name of the vocabulary file, and the archive's own name for it. */
export const ONTOLOGY_EXTENSIONS_FILE = "ontology/extensions.yaml";

/** The five `TermKind`s, so a typo in `kind:` is rejected instead of silently ignored. */
const TERM_KINDS: ReadonlySet<string> = new Set<TermKind>([
  "phase",
  "node-type",
  "risk-marker",
  "data-type",
  "tool",
]);

/**
 * The `terms` of a parsed extensions document.
 *
 * An empty or absent `terms` is "this archive adds nothing to the core" and is not an
 * error: the extension channel is optional. A document that *is* present and ill-shaped
 * throws, like a malformed manifest — doc 3 §7's rules are checked by
 * `OntologyView.validate()`, and it cannot check terms this function silently dropped.
 *
 * `file` is the name diagnostics quote, so the caller decides whether that is a
 * repo-relative path or the name a browser reported for a dropped file.
 */
export function parseOntologyTerms(doc: unknown, file: string): OntologyTerm[] {
  if (doc === null || doc === undefined) return [];
  if (typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error(`${file} is not a YAML mapping.`);
  }
  const raw = (doc as Record<string, unknown>).terms;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`${file} has a \`terms\` that is not a list.`);
  }
  return raw.map((entry, i) => toTerm(entry, `${file} terms[${i}]`));
}

function toTerm(value: unknown, where: string): OntologyTerm {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where} is not a mapping.`);
  }
  const doc = value as Record<string, unknown>;
  const kind = requireString(doc, "kind", where);
  if (!TERM_KINDS.has(kind)) {
    throw new Error(
      `${where} declares kind \`${kind}\`, which is not one of ${[...TERM_KINDS].join(", ")}.`,
    );
  }

  const term: OntologyTerm = {
    id: requireString(doc, "id", where),
    kind: kind as TermKind,
    label: requireString(doc, "label", where),
    description: requireString(doc, "description", where),
    since: requireString(doc, "since", where),
  };
  const broader = optionalString(doc, "broader", where);
  if (broader !== undefined) term.broader = broader;

  const weight = doc.defaultWeight;
  if (weight !== undefined && weight !== null) {
    if (typeof weight !== "number" || !Number.isFinite(weight)) {
      throw new Error(`${where} has a \`defaultWeight\` that is not a finite number.`);
    }
    term.defaultWeight = weight;
  }

  const impliesHuman = doc.impliesHuman;
  if (impliesHuman !== undefined && impliesHuman !== null) {
    if (typeof impliesHuman !== "boolean") {
      throw new Error(`${where} has an \`impliesHuman\` that is not a boolean.`);
    }
    term.impliesHuman = impliesHuman;
  }

  return term;
}

function requireString(doc: Record<string, unknown>, key: string, file: string): string {
  const raw = doc[key];
  // YAML happily reads `since: 0.1.0` as a string but `0.1` as a number, and a version is
  // a string either way — coercing beats an error nobody expects.
  if (typeof raw === "number") return String(raw);
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${file} is missing a \`${key}\`, or it is not a non-empty string.`);
  }
  return raw;
}

function optionalString(
  doc: Record<string, unknown>,
  key: string,
  file: string,
): string | undefined {
  if (doc[key] === undefined || doc[key] === null) return undefined;
  return requireString(doc, key, file);
}
