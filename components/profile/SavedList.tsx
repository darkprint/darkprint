"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import type { SavedRow } from "./load";

/* ============================================================
   Saved: a private bookmark list, and the one thing it is not.

   A save and a star are different things and this file exists partly to keep them apart.
   A save is a bookmark: private to whoever made it, never counted, never read by a
   scorecard. The star figure beside a blueprint is community support: seeded, public, and
   also never read by a scorecard. Merging the two would turn a reader's private list into
   a public number, which is the one mistake here that would be hard to undo.

   ── The marker moved, and only half of it (AC4, D-78) ──
   This panel used to say `◐ seeded` and explain that the list was five rows in
   `lib/data/bundles.ts` while `FavoriteStar` wrote to `localStorage` — *"a second set this
   page cannot see"*. That was the disjointness the route apologised for in three places,
   and AC4 is the criterion that closes it.

   **It is closed for cards and not for blueprints.** A card starred anywhere on the site
   is a row on the account and appears here. A blueprint star is still browser-local,
   because `save.target_id` holds a bundle id and the star control holds a slug, and
   nothing published maps one to the other (D-262-04). So the sentence narrows to the half
   that is still true rather than coming off: retiring a claim is not the same act as
   deleting it.
   ============================================================ */

/** One row, with a `Remove` that removes it. */
function Row({ save, onRemoved }: { save: SavedRow; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/account/saves", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(save.target),
      });
      if (response.ok) onRemoved();
    } finally {
      /* Cleared either way. A failed un-save leaves the row on screen, which is the honest
         outcome: the bookmark is still there, and a row that vanished on a failed request
         would be this page telling the reader something the account does not agree with. */
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5">
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
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{save.summary}</span>
      <span className="shrink-0 font-mono text-[11px] text-dim">{save.kind}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void remove()}
        aria-label={`Remove ${save.path} from your saved list`}
      >
        {busy ? "Removing…" : "Remove"}
      </Button>
    </div>
  );
}

export function SavedList({ saves }: { saves: readonly SavedRow[] }) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {saves.map((save) => (
        <Row
          key={`${save.target.kind}:${save.target.refId}`}
          save={save}
          onRemoved={() => router.refresh()}
        />
      ))}

      <p className="px-5 py-4 text-xs leading-relaxed text-dim">
        A save is a bookmark tied to your account. It follows you between machines, and
        nobody else can see it. It is not the star count beside a blueprint, which is
        seeded community support. No scorecard reads either the save or the star count.
        One gap remains: the bookmark control on a{" "}
        <span className="text-fg">blueprint</span> still writes to this browser&rsquo;s{" "}
        <span className="font-mono text-muted">localStorage</span> instead of to your
        account. A blueprint you saved will not appear here yet. Cards do.
      </p>
    </div>
  );
}
