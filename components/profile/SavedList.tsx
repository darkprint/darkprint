import Link from "next/link";

import type { Save } from "@/lib/data/bundles";
import { Button } from "@/components/ui/Button";

/* ============================================================
   Saved: a private bookmark list, and the one thing it is not.

   A save and a star are different things and this file exists partly to keep them apart.
   A save is a bookmark: private to whoever made it, never counted, never read by a
   scorecard. The star figure beside a blueprint is community support: seeded, public, and
   also never read by a scorecard. Merging the two would turn a reader's private list into
   a public number, which is the one mistake here that would be hard to undo.

   ── Why the marker is `◐ seeded` where the design says `✓ on your account` ──
   Because there is no account. The design was drawn for a build where saves persist; in
   this one the list is five rows in `lib/data/bundles.ts`, and `FavoriteStar` — the
   bookmark actually wired up on the tiles and detail pages — still writes to
   `localStorage`, which is a different set that this page cannot read. Printing
   `✓ on your account` over a fixture would be the exact claim the marker exists to
   prevent, so the panel says what is true and names the two stores.
   ============================================================ */

export function SavedList({ saves }: { saves: readonly Save[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {saves.map((save) => (
        <div
          key={save.href}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5"
        >
          <span className="shrink-0 text-amber" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinejoin="round"
            >
              <path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7a1.75 1.75 0 0 1 1.75 1.75V21L12 17.65 6.75 21V4.75z" />
            </svg>
          </span>
          <Link
            href={save.href}
            className="shrink-0 font-mono text-[13px] text-cyan transition-colors hoverable:hover:text-cyan-bright"
          >
            {save.path}
          </Link>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
            {save.summary}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-dim">{save.kind}</span>
          <Button
            size="sm"
            variant="outline"
            disabled
            title="Nothing is stored yet, so there is nothing to remove."
          >
            Remove
          </Button>
        </div>
      ))}

      <p className="px-5 py-4 text-xs leading-relaxed text-dim">
        A save is a bookmark and it is yours: in the design it follows your account between
        machines and nobody else can see it. It is not the star count beside a blueprint,
        which is seeded community support, and no scorecard reads either of them. In this
        build the list above is a fixture, and the bookmark control on the tiles and detail
        pages still writes to this browser&rsquo;s{" "}
        <span className="font-mono text-muted">localStorage</span>, which is a second set
        this page cannot see.
      </p>
    </div>
  );
}
