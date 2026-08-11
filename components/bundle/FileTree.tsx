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
}: {
  files: readonly BundleFile[];
  /** The strip above the listing. */
  lastChange: { message: string; digest: string; at: string };
  /** Who made it, so the strip can draw the avatar and link the profile. */
  author: Author;
  /** Where a file row points, when the file is really on disk. */
  hrefFor?: (file: BundleFile) => string | undefined;
  /** The one button on the panel, when there is a README to open. */
  readmeHref?: string;
  /** The line under the listing: how many entries, and how many cards inside `cards/`. */
  footnote: string;
}) {
  return (
    <section
      id="files"
      aria-labelledby="files-title"
      className="scroll-mt-24 overflow-hidden rounded-lg border border-line bg-surface"
    >
      <h2 id="files-title" className="sr-only">
        Files
      </h2>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-2 px-5 py-3.5">
        <Avatar author={author} size="sm" link />
        <Link
          href={`/u/${author.username}`}
          className="font-mono text-[11px] text-dim transition-colors hoverable:hover:text-cyan"
        >
          {author.username}
        </Link>
        <span className="min-w-0 flex-1 truncate text-sm text-fg">
          {lastChange.message}
        </span>
        <span className="font-mono text-[11px] text-dim">{lastChange.digest}</span>
        <span className="font-mono text-[11px] text-dim">
          {prettyDate(lastChange.at)}
        </span>
      </div>

      <ul>
        {files.map((file) => {
          const href = hrefFor?.(file);
          const name =
            href === undefined ? (
              <span className="font-mono text-[13px] text-fg">{file.path}</span>
            ) : (
              <Link
                href={href}
                className="font-mono text-[13px] text-fg transition-colors hoverable:hover:text-cyan"
              >
                {file.path}
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
