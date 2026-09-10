import Link from "next/link";

import type { BundleFile } from "@/lib/data/bundles";
import type { Author } from "@/lib/types";
import { cx, prettyDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";

/* ============================================================
   The folder, listed.

   Every name in it is one `lib/content/bundle-export.ts` really generates, or one of the
   two files a working copy carries that a published folder never does.
   `components/bundle/files.test.ts` holds the listing against `bundleFilePaths`, because a
   file tree that names files the download does not contain is worse than no file tree: a
   reader takes the folder and finds it does not match the page they took it from.

   ── The date column is absolute, and the design's was not ──
   The mock reads "2 days ago". Every page on this site is prerendered, so a relative time
   is baked at build and starts lying the day after: "2 days ago" on a page built in August
   still says "2 days ago" in December. `lib/core` bans `Date.now` for the same class of
   reason. Absolute dates through `prettyDate`, which is pure.
   ============================================================ */

/** The kind glyph. Text characters the site already uses; no icon set. */
const GLYPH: Record<BundleFile["kind"], string> = {
  dot: "◈",
  dir: "▤",
  yaml: "▤",
  doc: "≡",
};

/**
 * The state word, and the one that is amber.
 *
 * `changed` is the only one that says something has moved since the last release, which is
 * the one thing a reader scanning this list is looking for. The rest are descriptions of
 * what a file is, and they stay `text-dim` so the changed rows are the ones that read.
 */
const STATE_TONE: Record<BundleFile["state"], string> = {
  changed: "text-amber",
  generated: "text-dim",
  verbatim: "text-dim",
  local: "text-dim",
  source: "text-dim",
  pinned: "text-dim",
};

export function FileTree({
  files,
  lastChange,
  author,
  hrefFor,
  readmeHref,
  footnote,
  actions,
  upHref,
  crumb,
}: {
  files: readonly BundleFile[];
  /** The strip above the listing. */
  lastChange: { message: string; digest: string; at: string };
  /**
   * Who made it, so the strip can draw the avatar and name the handle.
   *
   * Named, not linked: an author handle holds no account (D-250-11), so there is no profile
   * to reach. See the strip below for why both of the old click targets had to go.
   */
  author: Author;
  /** Where a file row points, when the file is really on disk. */
  hrefFor?: (file: BundleFile) => string | undefined;
  /** The one button on the panel, when there is a README to open. */
  readmeHref?: string;
  /** The line under the listing: how many entries, and how many cards inside `cards/`. */
  footnote: string;
  /**
   * The controls that belong to the folder, at the right of the strip above it.
   *
   * **Nothing passes this today.** It held `components/bundle/CodeMenu.tsx` for one pass,
   * GitHub's shape, and the owner moved that control into the header band on 2026-09-06
   * ("remove the Code button and move on top right on the side right of the Star"). The slot
   * stays because it is generic and free: absent means absent, byte for byte, which
   * `components/bundle/file-tree-actions.test.ts` holds as a difference cell rather than as
   * a pair of `contains`. A caller that later has a control belonging to the folder itself
   * has somewhere to put it without re-deriving the row.
   *
   * A `ReactNode` rather than a component's props, for the reason that outlived its first
   * caller: a private bundle and a published one do not offer the same thing, and deciding
   * which is the page's job.
   */
  actions?: React.ReactNode;
  /**
   * Where the `..` row points, when the listing is showing a folder rather than the root.
   *
   * Absent at the root, which is what makes the row conditional rather than disabled: there
   * is nowhere above the bundle to go, and a dead `..` would be a control that never works.
   * The navigation is a real URL and not component state, so the browser's own Back button
   * walks out of the folder and a link into it can be pasted to somebody. That is the half
   * of GitHub's behaviour a disclosure widget cannot give.
   */
  upHref?: string;
  /** The path above the listing, when there is one to draw. Root shows none. */
  crumb?: React.ReactNode;
}) {
  return (
    <section
      id="files"
      aria-labelledby="files-title"
      className="scroll-mt-24 rounded-lg border border-line bg-surface"
    >
      <h2 id="files-title" className="sr-only">
        Files
      </h2>

      {/* `overflow-hidden` was on the section and had exactly one job: clipping the strip
          below to the border's radius, since it is the only child that paints a ground. It
          also clipped anything a child positioned outside the box, which is what
          `CodeMenu`'s dropdown is: its panel is roughly as tall as a three-row listing, so
          on a short folder the bottom of it was cut off at the section's edge and there was
          no way to reach the files it was listing. So the clip moves onto the element that
          needs it. 11px is the section's 12px radius less its 1px border, which is where
          the inside of the corner actually is. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-[11px] border-b border-line bg-surface-2 px-5 py-3.5">
        {/* The AUTHOR, and it is rendered as text on purpose (D-261-06, D-260-25's end
            state (d)). This reads a stored manifest, and a manifest can name a handle
            nothing resolves: the archive's six author handles hold no accounts, D-250-11
            rules that the import creates none, and any release published before an account
            was renamed keeps the handle its bytes were written with. So a link to
            `/u/<handle>` was a rendered promise of a page that 404s. A handle as text is
            the manifest telling the truth; the OWNER, who does hold an account, keeps both
            of its click targets in `BundleHeader`.

            Two things had to go, not one. `Avatar` builds its own `/u/{handle}` link when
            it is passed `link` (`components/ui/Avatar.tsx:66-69`), so dropping the visible
            `<Link>` alone left the avatar still linking: one `href=` in this file and two
            click targets on the screen. The `link` prop comes off with it. */}
        <Avatar author={author} size="sm" />
        <span className="font-mono text-[11px] text-dim">{author.username}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-fg">
          {lastChange.message}
        </span>
        <span className="font-mono text-[11px] text-dim">{lastChange.digest}</span>
        <span className="font-mono text-[11px] text-dim">
          {prettyDate(lastChange.at)}
        </span>
        {/* `ml-auto` is not redundant with the message's `flex-1`. The strip wraps, and on
            a narrow screen this lands alone on the second line, where nothing else is left
            to push it over. */}
        {actions !== undefined && <span className="ml-auto shrink-0">{actions}</span>}
      </div>

      {crumb !== undefined && (
        <div className="border-b border-line px-5 py-2.5 font-mono text-[12px] text-dim">
          {crumb}
        </div>
      )}

      <ul>
        {upHref !== undefined && (
          <li className="flex items-center gap-4 border-b border-line px-5 py-2.5">
            <span aria-hidden className="w-4 shrink-0 text-center text-dim">
              ↰
            </span>
            {/* The label is `..` because that is what the thing IS, and a reader who has
                ever used a file listing knows it without being told. `aria-label` carries
                the sentence instead, so a screen reader is not handed two characters of
                punctuation. */}
            <Link
              href={upHref}
              aria-label="Up to the bundle's own folder"
              className="font-mono text-[13px] text-fg transition-colors hoverable:hover:text-cyan"
            >
              ..
            </Link>
          </li>
        )}
        {files.map((file) => {
          const href = hrefFor?.(file);
          /* Inside a folder a row is named RELATIVE to the folder, which is the rule every
             file listing follows and the one GitHub follows here. The breadcrumb above
             already says where the reader is, so repeating `cards/` on all seven rows spends
             the widest column on the one word they share. `file.path` stays the whole path
             because that is what it IS and what `hrefFor` resolves; only the label is
             relative. `upHref` is the test for being inside something rather than a second
             flag, so the two cannot disagree about which view is drawn. */
          const label =
            upHref === undefined ? file.path : file.path.replace(/^.*\//, "");
          const name =
            href === undefined ? (
              <span className="font-mono text-[13px] text-fg">{label}</span>
            ) : (
              <Link
                href={href}
                className="font-mono text-[13px] text-fg transition-colors hoverable:hover:text-cyan"
              >
                {label}
              </Link>
            );
          return (
            <li
              key={file.path}
              className="flex items-center gap-4 border-b border-line px-5 py-2.5 last:border-b-0"
            >
              <span aria-hidden className="w-4 shrink-0 text-center text-dim">
                {GLYPH[file.kind]}
              </span>
              <span className="w-[15rem] shrink-0 truncate">{name}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-dim">
                {file.change}
              </span>
              <span
                className={cx(
                  "hidden shrink-0 font-mono text-[11px] sm:inline",
                  STATE_TONE[file.state],
                )}
              >
                {file.state}
              </span>
              <span className="hidden shrink-0 font-mono text-[11px] text-dim md:inline">
                {prettyDate(file.at)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <span className="font-mono text-[11px] text-dim">{footnote}</span>
        {readmeHref !== undefined && (
          <ButtonLink href={readmeHref} variant="outline" size="sm">
            Open README
          </ButtonLink>
        )}
      </div>
    </section>
  );
}
