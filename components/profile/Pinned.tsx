import Link from "next/link";

import type { Blueprint } from "@/lib/types";
import type { CardVersionRecord } from "@/lib/core";
import { Badge } from "@/components/ui/Badge";
import { MetaPill } from "@/components/ui/MetaPill";
import { TagPill } from "@/components/ui/TagPill";
import { nodeHref } from "@/lib/href";
import { SupportPill } from "./parts";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-55) (cited at line 64): PUT /api/authors/{handle}/pinned

/* ============================================================
   What a builder chose to put at the top of their page.

   Two cards, and both of them are `.panel-lead`, which is the one exception this site's
   own rule allows: `app/globals.css` says at most one lead panel per page, because two
   leads is no lead. These two are one block — the reader's entry into the profile — and
   they are the only lifted ground on the page, so the rule holds in spirit even though the
   count is two.

   ── Why there is no stretched link ──
   `ContentCard` wraps its whole tile in a transparent `<Link>` and layers the bookmark
   over it. That works because it has exactly one nested control. These carry tag pills,
   which are links themselves, and interactive content inside interactive content is
   invalid markup a screen reader cannot describe. So the title is the link and the card is
   an `<article>`: the same destination, one hit target smaller.

   The **selection** is seeded (`lib/data/profiles.ts` holds which two) and everything drawn
   is counted off the archive, which is why the section carries `✓ counted` rather than a
   seeded marker. The pin is a preference; the card is a fact.
   ============================================================ */

/** `owner / slug`, the identity line the accounts pass puts above a bundle's name. */
export function OwnerSlug({
  owner,
  slug,
  href,
}: {
  owner: string;
  slug: string;
  href?: string;
}) {
  const name = href === undefined ? (
    <span className="text-cyan">{slug}</span>
  ) : (
    <Link href={href} className="text-cyan transition-colors hoverable:hover:text-cyan-bright">
      {slug}
    </Link>
  );
  return (
    <span className="min-w-0 truncate font-mono text-[11px] text-muted">
      <Link href={`/u/${owner}`} className="transition-colors hoverable:hover:text-fg">
        {owner}
      </Link>
      <span className="mx-1 text-faint" aria-hidden>
        /
      </span>
      {name}
    </span>
  );
}

function PinnedBlueprint({ blueprint }: { blueprint: Blueprint }) {
  return (
    <article className="panel panel-lead flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <OwnerSlug
          owner={blueprint.author.username}
          slug={blueprint.slug}
          href={`/blueprints/${blueprint.slug}`}
        />
        <MetaPill tone="surface">Public</MetaPill>
      </div>
      <h3 className="font-display text-lg font-semibold leading-snug text-fg">
        <Link
          href={`/blueprints/${blueprint.slug}`}
          className="transition-colors hoverable:hover:text-cyan"
        >
          {blueprint.title}
        </Link>
      </h3>
      <p className="text-sm leading-snug text-muted">{blueprint.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {blueprint.tags.slice(0, 3).map((tag) => (
          <TagPill key={tag} label={tag} href={`/blueprints?tag=${encodeURIComponent(tag)}`} />
        ))}
      </div>
      {/* `AutonomyMeter` opened this footer row, on the left of the star. It came off with
          the scoring reading the owner removed from the blueprint page: a pinned card that
          classifies a bundle the bundle's own page no longer classifies would be the only
          place on the site still making that claim. */}
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <span className="ml-auto">
          <SupportPill count={blueprint.votes} seeded />
        </span>
      </div>
    </article>
  );
}

function PinnedNode({
  record,
  typeLabel,
  usedIn,
  support,
}: {
  record: CardVersionRecord;
  typeLabel: string;
  usedIn: number;
  support: number;
}) {
  return (
    <article className="panel panel-lead flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <Badge color="var(--color-amber)">{typeLabel}</Badge>
        <span className="font-mono text-[11px] text-dim">
          {record.id}@{record.version}
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold leading-snug text-fg">
        <Link
          href={nodeHref(record.id)}
          className="transition-colors hoverable:hover:text-cyan"
        >
          {record.card.name}
        </Link>
      </h3>
      <p className="text-sm leading-snug text-muted">{record.card.action}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-3 font-mono text-[11px] text-dim">
        <span>
          used in {usedIn} blueprint{usedIn === 1 ? "" : "s"}
        </span>
        <span className="ml-auto">
          <SupportPill count={support} />
        </span>
      </div>
    </article>
  );
}

/** One resolved pin, ready to draw. The caller does the archive lookups. */
export type PinnedItem =
  | { kind: "blueprint"; blueprint: Blueprint }
  | {
      kind: "node";
      record: CardVersionRecord;
      typeLabel: string;
      usedIn: number;
      support: number;
    };

export function Pinned({ items }: { items: readonly PinnedItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-5 lg:grid-cols-2">
        {items.map((item) =>
          item.kind === "blueprint" ? (
            <PinnedBlueprint key={item.blueprint.slug} blueprint={item.blueprint} />
          ) : (
            <PinnedNode
              key={item.record.ref}
              record={item.record}
              typeLabel={item.typeLabel}
              usedIn={item.usedIn}
              support={item.support}
            />
          ),
        )}
      </div>
      {/* The section head says `✓ counted`, and that is true of the tags, the summary, the
          usage figure and a card's star count. A blueprint's star is the one number here
          that is not counted, so the qualifier sits under them rather than being left to a
          glyph. */}
      <p className="font-mono text-[11px] text-dim">
        Read off the archive at build time. A card&apos;s star figure is its live count; a
        blueprint&apos;s is seeded community support. There is no ballot, and no scorecard
        reads either.
      </p>
    </div>
  );
}
