import { DeleteBundleControl } from "darkprint";

/**
 * The control is an icon button that arms a confirmation modal. The modal is
 * interaction-driven and cannot open in a static render, so the cards show the
 * trigger where an owner actually meets it: at the end of a row on their own
 * shelf, where it has to read as destructive without shouting.
 */
export const OnAShelfRow = () => (
  <div className="panel divide-y divide-line">
    {[
      { slug: "starter-software-factory", meta: "4 nodes · updated 2 days ago" },
      { slug: "docs-review-loop", meta: "3 nodes · updated last week" },
    ].map((row) => (
      <div key={row.slug} className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold text-fg">{row.slug}</div>
          <div className="mt-1 text-[11px] text-dim">{row.meta}</div>
        </div>
        <DeleteBundleControl ownerHandle="orin" slug={row.slug} />
      </div>
    ))}
  </div>
);

/** Alone, at the size and tone it actually renders. */
export const Trigger = () => (
  <div className="inline-flex rounded border border-line bg-surface-2 p-2">
    <DeleteBundleControl ownerHandle="orin" slug="starter-software-factory" />
  </div>
);
