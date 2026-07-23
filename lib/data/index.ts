import type { AnyContent, Blueprint } from "@/lib/types";
import { BLUEPRINTS, getBlueprint } from "./blueprints";
import { PARTS, getPart } from "./parts";
import { ONTOLOGIES, getOntology } from "./ontologies";
import { AUTHOR_LIST, getAuthor } from "./users";

export { BLUEPRINTS, PARTS, ONTOLOGIES, AUTHOR_LIST };
export { getBlueprint, getPart, getOntology, getAuthor };

/** All content, any kind. */
export const ALL_CONTENT: AnyContent[] = [...BLUEPRINTS, ...PARTS, ...ONTOLOGIES];

/** Featured blueprints for the gallery hero strip. */
export const FEATURED_BLUEPRINTS: Blueprint[] = BLUEPRINTS.filter((b) => b.featured);

/** The two seed examples highlighted on the homepage. */
export const SEED_BLUEPRINTS: Blueprint[] = BLUEPRINTS.filter((b) => b.seed);

/** Distinct, sorted blueprint categories. */
export const BLUEPRINT_CATEGORIES: string[] = Array.from(
  new Set(BLUEPRINTS.map((b) => b.category)),
).sort();

/** Distinct, sorted tags across blueprints. */
export const BLUEPRINT_TAGS: string[] = Array.from(
  new Set(BLUEPRINTS.flatMap((b) => b.tags)),
).sort();

/** Blueprints sorted by autonomy level (desc) then downloads. */
export function blueprintsByAutonomy(): Blueprint[] {
  return [...BLUEPRINTS].sort(
    (a, b) => b.autonomy.level - a.autonomy.level || b.downloads - a.downloads,
  );
}

/** Everything a given author has published. */
export function contentByAuthor(username: string): AnyContent[] {
  return ALL_CONTENT.filter((c) => c.author.username === username);
}

/** Aggregate platform stats for the homepage counters. */
export const PLATFORM_STATS = {
  blueprints: BLUEPRINTS.length,
  parts: PARTS.length,
  ontologies: ONTOLOGIES.length,
  builders: AUTHOR_LIST.length,
  downloads: ALL_CONTENT.reduce((n, c) => n + c.downloads, 0),
};
