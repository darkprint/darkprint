import type { ContentKind } from "./types";

/** The route segment each surface lives under. Singular for the ontology: there is one. */
const SEGMENT: Record<ContentKind, string> = {
  blueprint: "blueprints",
  node: "nodes",
  ontology: "ontology",
};

/** Canonical detail-page href for any content item. */
export function contentHref(c: { kind: ContentKind; slug: string }): string {
  return `/${SEGMENT[c.kind]}/${c.slug}`;
}

export function kindHref(kind: ContentKind): string {
  return `/${SEGMENT[kind]}`;
}

/**
 * An id (a card's or a term's) as a path, keeping its namespace separator a separator.
 *
 * Both vocabularies allow a namespaced id (doc 3 §7: `berti/solver-a`,
 * `lupo/pii-handling`) and both routes are catch-alls, so a `/` in an id is one more
 * path segment rather than a character to escape. Percent-encoding the whole id instead
 * produced `/ontology/lupo%2Fpii-handling`, which Next decodes back to two segments
 * before matching and which therefore matched nothing at all. Each segment is still
 * encoded — an id is author-supplied, and a `?` or a `#` in one would otherwise end the
 * path early.
 */
function idPath(id: string): string {
  return id.split("/").map(encodeURIComponent).join("/");
}

/** A node card's page — `/nodes/[...id]`. */
export function nodeHref(id: string): string {
  return `/nodes/${idPath(id)}`;
}

/** An ontology term's page — `/ontology/[...term]`. */
export function termHref(id: string): string {
  return `/ontology/${idPath(id)}`;
}
