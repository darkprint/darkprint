"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import type { SavedRow } from "./load";

/** The row's kind, in the one word the rest of the tab uses for each. */
const KIND_LABEL: Record<SavedRow["kind"], string> = {
  blueprint: "blueprint",
  "node card": "card",
  "vocabulary term": "term",
};
import { removeSavedRow } from "./remove-save";

/* ============================================================
   Saved: what this reader has starred, and what is still public about it.

   ── The claim this file used to make, and why it is retired (owner, 2026-09-05) ──
   It read: *"a save and a star are different things and this file exists partly to keep
   them apart ... merging the two would turn a reader's private list into a public number,
   which is the one mistake here that would be hard to undo."*

   The owner merged them anyway, with that cost stated: Save folded into Star, one control,
   and this shelf lists what the star wrote. So the warning is retired rather than deleted,
   and the half of it that survived the ruling is now stated on screen instead of in a
   comment: **the list stays private and the star on it does not.** Nobody else can read
   this page. The count beside the card can be read by anyone.

   ── What actually fills it ──
   `save` rows, still: `listSaves` is a per-account query and `lib/server/counters` has no
   per-account reader, so `components/ui/FavoriteStar.tsx` writes the save alongside the
   star for a card and this list is the index of those.

   ── `Remove` clears both stores (§11.0 Q24, 2026-09-05) ──
   It used to delete the save alone, so a card left the shelf while its public star stood
   and the count beside it never moved. Save and Star are ONE gesture since D-132, and a
   removal that undoes half of it is the fold left unfinished on the way out. Both writes
   now go through `./remove-save`, which orders them and holds the failure arms: the star
   goes down first, and a star write that fails leaves the save alone rather than
   reproducing the same divergence on an error path.

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
  /* Where the star stands, carried in state rather than read off the prop on every click:
     a first attempt that cleared the star and then failed to delete the save must not
     press the toggle a second time on a retry, which would put the star back up. */
  const [star, setStar] = useState(save.star);

  const remove = async () => {
    setBusy(true);
    try {
      const result = await removeSavedRow({ target: save.target, star });
      if (result.star === "cleared" && star !== undefined) setStar({ ...star, starred: false });
      if (result.removed) onRemoved();
    } finally {
      /* Cleared either way. A failed removal leaves the row on screen, which is the honest
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
      <span className="shrink-0 font-mono text-[11px] text-dim">{KIND_LABEL[save.kind]}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void remove()}
        aria-label={
          /* Only a row whose star is actually up promises to take one down. A card
             starred before the fold has a save and no star, and a label that offered to
             remove one would be describing a request this click does not make. */
          star?.starred
            ? `Remove ${save.path} from your saved list and remove your star`
            : `Remove ${save.path} from your saved list`
        }
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

      <div className="flex flex-col gap-2 px-5 py-4 text-xs leading-relaxed text-dim">
        <p>
          This list is private to your account and follows you between devices. Starring a
          card saves it here and raises the card&rsquo;s public star count; removing a card
          here removes your star as well.
        </p>
        <p>Three limits today:</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Starring a blueprint changes its public count but does not add it to this list.</li>
          <li>Saving a blueprint from its tile keeps the save in this browser only.</li>
          <li>
            A card you starred before starring and saving became one action joins the list
            the next time you star it.
          </li>
        </ul>
      </div>
    </div>
  );
}
