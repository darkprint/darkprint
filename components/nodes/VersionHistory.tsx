import Link from "next/link";
import { inferBump, type BumpLevel, type NodeCard } from "@/lib/core";
import { cx } from "@/lib/format";
import { blueprintRecordHref } from "@/lib/href";
import { Ticked } from "@/components/ui/Ticked";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-11) (cited at line 1): folded into SEAM-09

/** One published version of a card, plus the blueprints pinning that exact ref. */
export interface NodeVersion {
  version: string;
  /** "id@version". */
  ref: string;
  /** "sha256:…" over the card's content. */
  digest: string;
  card: NodeCard;
  /**
   * The blueprints pinning this exact version.
   *
   * `ownerHandle` is optional for the reason `lib/types.ts`'s `Blueprint.ownerHandle` is
   * (D-261-07): the registry answers it and a fixture cannot, so a row that has it links to
   * the canonical B-09 URL and a row that does not rides the 308 for one hop. Not
   * `BlueprintSummary` — this shape also carries the `title` a summary keeps inside its
   * manifest, which is what the link actually prints.
   */
  usedIn: { ownerHandle?: string; slug: string; title: string }[];
}

/**
 * What each bump level means, in the terms §4 decides it by. The word carries the
 * meaning; the colour only ranks it.
 *
 * Left alone by the 2026-09-06 card-register pass, and the cyan on `patch` is the reason
 * to say so. This is a four-step ranked scale, not an accent: every row prints its glyph,
 * its word and a gloss, so the colour is the last thing a reader is going on. Repointing
 * `patch` to the register would collide with `minor`, which has been amber here since
 * before the ruling, and would leave the scale with two steps in one hue and no rank.
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
                {/* The newest version's dot, in the card register. Amber since the owner
                    ruled it on 2026-09-06; it was cyan, which is the blueprint's. */}
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      i === 0 ? "var(--color-amber)" : "var(--color-line-bright)",
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
                    /* `current` in the card register. #ffb020 on this panel's ground
                        reads 10.2:1 against cyan's 8.71:1, and the 50% edge composites to
                        3.34:1 where the cyan one sat at 3.05:1.

                        It is a small filled amber pill in uppercase mono, which is also
                        `ComingSoonBadge`'s shape, and the two never meet: nothing in this
                        panel is unbuilt, the badge lives in the download menu at the top of
                        the page, and this pill says a word no status badge on the site
                        says. Worth stating rather than leaving to luck, since
                        `app/globals.css` now makes shape the thing that separates a claim
                       from the register. */
                    <span className="rounded border border-amber/50 bg-amber/10 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
                      current
                    </span>
                  )}
                  {/* The whole digest, as text, and no `title`.
                      ------------------------------------------------------------
                      It used to be `shortDigest(entry.digest)` with the full string in a
                      `title`, and the card page carried the long form twice more: once in
                      the Identity panel's row and once as selectable text under the Card
                      source panel. The author asked both of those panels off (2026-09-05),
                      which would have left the full digest existing only inside a tooltip
                      — unreachable by keyboard, unreachable by touch, and impossible to
                      copy, which is the one thing anybody wants a digest for.

                      So the string is printed. Measured on `merge-executor`: `sha256:` and
                      64 hex characters, about 470px at 11px mono, on a page that is one
                      full-width column since its aside went — it sits on the row it was
                      already on. `break-all` because a hex run gives a browser nowhere it
                      would choose to break. */}
                  <span className="break-all font-mono text-[11px] text-dim">
                    {entry.digest}
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
                            href={blueprintRecordHref(blueprint)}
                            /* Cyan on hover, and deliberately NOT the card register the
                               rest of this panel now wears: every link in this list leaves
                               for a BLUEPRINT page, and the two registers only earn their
                               keep if a control that crosses between them says which side
                               it lands on. */
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

      {/* What a digest is, once, under the list that prints one per row. This paragraph
          stood under the card page's Card source panel and the author asked that panel
          off; the sentences are about the digests, so they moved to where the digests
          are rather than going with the YAML. */}
      <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-dim sm:px-5">
        A digest is hashed over the card&apos;s content, leaving author and provenance out.
        The same node from two people lands on the same digest, and any edit lands on a
        different one.
      </p>

      {sole && (
        <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-[13px] leading-relaxed text-muted sm:px-5">
          {/* The card register, not cyan. */}
          <span className="font-mono text-amber" aria-hidden>
            ✓
          </span>
          <span>
            First published version. There is nothing to compare it against yet.
            A version is never edited in place. The next change arrives as a new
            version. The diff between them shows up here, worked out from the two
            documents.
          </span>
        </p>
      )}
    </section>
  );
}
