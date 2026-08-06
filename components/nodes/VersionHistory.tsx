import Link from "next/link";
import { inferBump, shortDigest, type BumpLevel, type NodeCard } from "@/lib/core";
import { cx } from "@/lib/format";
import { contentHref } from "@/lib/href";
import { Ticked } from "@/components/ui/Ticked";

/** One published version of a card, plus the blueprints pinning that exact ref. */
export interface NodeVersion {
  version: string;
  /** "id@version". */
  ref: string;
  /** "sha256:…" over the card's content. */
  digest: string;
  card: NodeCard;
  usedIn: { slug: string; title: string }[];
}

/**
 * What each bump level means, in the terms §4 decides it by. The word carries the
 * meaning; the colour only ranks it.
 */
const BUMP_META: Record<BumpLevel, { word: string; glyph: string; color: string; gloss: string }> =
  {
    major: {
      word: "major",
      glyph: "▲",
      color: "var(--color-signal)",
      gloss: "breaks something a blueprint had pinned",
    },
    minor: {
      word: "minor",
      glyph: "▴",
      color: "var(--color-amber)",
      gloss: "the declared surface grew",
    },
    patch: {
      word: "patch",
      glyph: "▪",
      color: "var(--color-cyan)",
      gloss: "wording and values, nothing wired",
    },
    none: {
      word: "none",
      glyph: "·",
      color: "var(--color-dim)",
      gloss: "no change to the card's content",
    },
  };

function Changelog({
  previous,
  next,
}: {
  previous: NodeVersion;
  next: NodeVersion;
}) {
  const bump = inferBump(previous.card, next.card);
  const meta = BUMP_META[bump.level];

  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{
            color: meta.color,
            borderColor: `color-mix(in oklab, ${meta.color} 45%, var(--color-line))`,
            background: `color-mix(in oklab, ${meta.color} 10%, transparent)`,
          }}
        >
          <span aria-hidden>{meta.glyph}</span>
          {meta.word}
        </span>
        <span className="font-mono text-[11px] text-dim">
          {previous.version} → {next.version}
        </span>
        <span className="text-[12px] text-muted">{meta.gloss}</span>
      </div>

      {bump.reasons.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {bump.reasons.map((reason) => (
            <li
              key={reason}
              className="flex gap-2 text-[13px] leading-relaxed text-muted"
            >
              {/* A bullet, not a pause. It was an em dash, which the author asked off
                  the site; a list marker is the one place the character was doing a job,
                  so it becomes the mark the rest of the site uses for one. */}
              <span className="text-faint" aria-hidden>
                ·
              </span>
              <span className="min-w-0">
                <Ticked text={reason} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Every published version of one card, newest first, with the diff between each
 * consecutive pair read back out of the two documents rather than trusted from a
 * changelog somebody remembered to write. A published version is never edited in
 * place, so this list only ever grows downward.
 */
export function VersionHistory({
  versions,
  className,
}: {
  versions: readonly NodeVersion[];
  className?: string;
}) {
  const sole = versions.length === 1;

  return (
    <section
      className={cx("panel overflow-hidden", className)}
      aria-labelledby="version-history-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2
          id="version-history-heading"
          /* 13px `text-fg`, matching the panel headings on `/nodes/[...id]` — this is a
             section of that page and used to be set like the sub-group labels *inside*
             its neighbours, so the one line a reader scans for was the same size as the
             seven lines they scan past. */
          className="font-mono text-[13px] uppercase tracking-[0.18em] text-fg"
        >
          Version history
        </h2>
        <span className="font-mono text-[11px] text-dim">
          {versions.length} version{versions.length === 1 ? "" : "s"} published
        </span>
      </div>

      <ol className="flex flex-col p-4 sm:p-5">
        {versions.map((entry, i) => {
          const previous = versions[i + 1];
          const last = i === versions.length - 1;
          return (
            <li key={entry.ref} className="flex gap-4">
              {/* rail */}
              <div className="flex flex-col items-center" aria-hidden>
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      i === 0 ? "var(--color-cyan)" : "var(--color-line-bright)",
                  }}
                />
                {!last && <span className="w-px flex-1 bg-line" />}
              </div>

              <div
                className={cx(
                  "flex min-w-0 flex-1 flex-col gap-2",
                  last ? "pb-0" : "pb-6",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="font-mono text-sm text-fg">{entry.ref}</span>
                  {i === 0 && (
                    <span className="rounded border border-cyan/50 bg-cyan/10 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">
                      current
                    </span>
                  )}
                  <span
                    className="font-mono text-[11px] text-dim"
                    title={entry.digest}
                  >
                    {shortDigest(entry.digest)}
                  </span>
                </div>

                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] text-dim">
                  {entry.usedIn.length === 0 ? (
                    <span>No blueprint pins this exact version.</span>
                  ) : (
                    <>
                      <span>pinned by</span>
                      {entry.usedIn.map((blueprint, index) => (
                        <span key={blueprint.slug}>
                          <Link
                            href={contentHref({
                              kind: "blueprint",
                              slug: blueprint.slug,
                            })}
                            className="text-muted underline-offset-4 transition-colors hover:text-cyan hover:underline"
                          >
                            {blueprint.title}
                          </Link>
                          {/* Inherits the paragraph's `text-dim`: the comma is what
                              separates two blueprint names, so it has to be legible. */}
                          {index < entry.usedIn.length - 1 && <span>,</span>}
                        </span>
                      ))}
                    </>
                  )}
                </p>

                {previous !== undefined && (
                  <Changelog previous={previous} next={entry} />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {sole && (
        <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-[13px] leading-relaxed text-muted sm:px-5">
          <span className="font-mono text-cyan" aria-hidden>
            ✓
          </span>
          <span>
            First published version, there is nothing to compare it against yet.
            A version is never edited in place, so the next change arrives as a new
            one and the diff between them shows up here, worked out from the two
            documents.
          </span>
        </p>
      )}
    </section>
  );
}
