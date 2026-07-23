import type { AnyContent, ContentKind } from "./types";

const SEGMENT: Record<ContentKind, string> = {
  blueprint: "blueprints",
  part: "parts",
  ontology: "ontologies",
};

/** Canonical detail-page href for any content item. */
export function contentHref(c: AnyContent): string {
  return `/${SEGMENT[c.kind]}/${c.slug}`;
}

export function kindHref(kind: ContentKind): string {
  return `/${SEGMENT[kind]}`;
}
