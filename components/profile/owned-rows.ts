import type { OwnedBundleSummary } from "@/lib/server/registry";
import type { Blueprint } from "@/lib/types";
import type { OwnedRow } from "./OwnedBundles";

/**
 * The shelf rows for one account: each live bundle row, paired with the archive entry
 * that carries a drawing for it when there is one.
 *
 * Paired by slug against the whole archive, never by the archive's `author`. The registry
 * owner of every seeded blueprint is one handle while each blueprint credits the person who
 * wrote it, so filtering the archive by author left every row on that owner's profile with
 * no graph to draw. Kept a pure function, with no server import, so it can be held to that
 * case without a database.
 *
 * The paired record is stamped with the owner in the URL: an archive entry knows its author
 * and not its owner, and a row without `ownerHandle` links to the one-segment address, which
 * is a 404 for any slug two accounts hold.
 */
export function ownedRowsFor(
  ownerHandle: string,
  liveRows: readonly OwnedBundleSummary[],
  archive: readonly Blueprint[],
): OwnedRow[] {
  const bySlug = new Map(archive.map((b) => [b.slug, b]));
  return liveRows.map((summary) => {
    const blueprint = bySlug.get(summary.slug);
    return blueprint === undefined
      ? { summary }
      : { summary, blueprint: { ...blueprint, ownerHandle } };
  });
}
