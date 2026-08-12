import Link from "next/link";

import type { Lineage } from "@/lib/data/bundles";
import type { Author } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CloneMenu } from "@/components/blueprint/CloneMenu";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { MetaPill } from "@/components/ui/MetaPill";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-20): folded into SEAM-19

/* ============================================================
   The band a bundle opens with: who owns it, what it is called, where it came from.

   `owner / slug` in `font-display text-xl`, the way a repository names itself. The slug
   carries the weight (`font-semibold`) because the handle is context and the name is the
   subject, and the separator is `text-faint` — the one token on this site that may never
   be live text, which is exactly right for a slash nobody reads.

   ── The four actions, and which of them do anything ──
   `Get the folder` is the real one, and only for a published bundle: the files are under
   `public/bundles/<slug>/` and the command in `CloneMenu` fetches them. A private bundle
   has no folder anywhere, so the control is switched off rather than opening a menu whose
   command would 404 every line.

   `Save` is the existing `FavoriteStar`, which writes to `localStorage` and says so on the
   profile that lists saves. `Watch` and `Fork` have nowhere to write at all and are drawn
   switched off with their seeded counts beside them, because the design shows the shape
   and the shape is worth showing as long as nothing pretends to work.
   ============================================================ */

export function BundleHeader({
  owner,
  slug,
  visibility,
  summary,
  lineage,
  driftNote,
  watchers,
  forks,
  saveId,
  support,
  clone,
  breadcrumb,
  title,
  validator = false,
  below,
  note,
  children,
}: {
  owner: Author;
  slug: string;
  visibility: "public" | "private";
  summary: string;
  lineage?: Lineage;
  /** The clause after the lineage, when the upstream has moved. Amber where it renders. */
  driftNote?: string;
  watchers: number;
  forks: number;
  /** `FavoriteStar`'s compound key, so a bundle and a card can never collide. */
  saveId: string;
  /**
   * Seeded community support, when there is any.
   *
   * Present for a published bundle, where `/blueprints/<slug>` prints the same figure from
   * the same row. Absent for a private one, and absent rather than zero: a bundle nobody
   * can see has not been voted down to nothing, it has never been in front of a ballot —
   * and there is no ballot. `FavoriteStar` draws the plain bookmark in that case.
   */
  support?: number;
  /** Present only for a bundle whose folder is actually on disk. */
  clone?: { command: string; cliCommand: string };
  /* ---- the four slots the published view fills and the owner view does not ---- */
  /** The row above the identity line: where a reader came from. */
  breadcrumb?: React.ReactNode;
  /** The bundle's human name. A published blueprint has one; a private copy is its slug. */
  title?: string;
  /** The owner's `✦ validator` mark, beside the visibility pill. */
  validator?: boolean;
  /** Under the actions: the version line on the published view. */
  below?: React.ReactNode;
  /** Overrides the line under the actions. Defaults to the snapshot/no-folder statement. */
  note?: string;
  /** Under the summary: the kind badge, the autonomy reading, the tags. */
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="container-page flex flex-col gap-5 py-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {breadcrumb}
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2">
              <Avatar author={owner} size="sm" link />
              <Link
                href={`/u/${owner.username}`}
                className="font-display text-xl text-cyan transition-colors hoverable:hover:text-cyan-bright"
              >
                {owner.username}
              </Link>
            </span>
            <span aria-hidden className="font-display text-xl text-faint">
              /
            </span>
            <span className="font-display text-xl font-semibold text-fg">{slug}</span>
            <MetaPill tone="surface">
              {visibility === "private" ? "Private" : "Public"}
            </MetaPill>
            {lineage !== undefined && <MetaPill>forked</MetaPill>}
            {validator && (
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">
                ✦ validator
              </span>
            )}
          </div>

          {/* The name, under the identity line rather than instead of it. A slug is what a
              bundle is addressed by and a title is what it is called, and the published view
              needs both: the breadcrumb above and the download command below both name the
              slug, and the `h1` is what a reader arrives for. */}
          {title !== undefined && (
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
              {title}
            </h1>
          )}

          {lineage !== undefined && (
            <p className="font-mono text-[11px] text-dim">
              forked from{" "}
              <Link
                href={`/blueprints/${lineage.slug}`}
                className="text-muted transition-colors hoverable:hover:text-cyan"
              >
                {lineage.owner} / {lineage.slug}
              </Link>{" "}
              at {lineage.version}
              {driftNote !== undefined && (
                <>
                  {" · "}
                  <span className="text-amber">{driftNote}</span>
                </>
              )}
            </p>
          )}

          <p
            className={
              title === undefined
                ? "max-w-2xl text-sm leading-relaxed text-muted"
                : "max-w-2xl text-lg leading-relaxed text-muted"
            }
          >
            {summary}
          </p>

          {children}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled
              title="Nothing stores a watch yet: there are no accounts behind this page."
            >
              Watch <span className="font-mono text-[11px] text-dim">{watchers}</span>
            </Button>
            {support === undefined ? (
              <FavoriteStar id={saveId} />
            ) : (
              <FavoriteStar id={saveId} count={support} seeded />
            )}
            <Button
              variant="outline"
              disabled
              title="Nothing copies a bundle into an account yet. Take the folder instead."
            >
              Fork <span className="font-mono text-[11px] text-dim">{forks}</span>
            </Button>
            {clone === undefined ? (
              <Button
                disabled
                title="This bundle has never been published, so there is no folder to fetch."
              >
                Get the folder
              </Button>
            ) : (
              <CloneMenu
                kind="blueprint"
                command={clone.command}
                cliCommand={clone.cliCommand}
              />
            )}
          </div>
          {below}

          <span className="font-mono text-[11px] text-dim">
            {note ??
              (clone === undefined
                ? "nothing to fetch: this bundle is not published"
                : "a snapshot over HTTP, not a clone")}
          </span>
        </div>
      </div>
    </header>
  );
}
