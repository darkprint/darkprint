import Link from "next/link";
import type { Author } from "@/lib/types";
import { avatarGradient, cx } from "@/lib/format";

const SIZES = { sm: 24, md: 32, lg: 44, xl: 64 } as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Deterministic gradient avatar with an optional validator ring. */
export function Avatar({
  author,
  size = "md",
  link = false,
  className,
}: {
  author: Author;
  size?: keyof typeof SIZES;
  link?: boolean;
  className?: string;
}) {
  const px = SIZES[size];
  const inner = (
    <span
      /* `text-void`, not `text-white`. The initials are small text at every size the
         scale offers — 8.6px at `sm`, 11.5px at `md`, 15.8px at `lg` — so they owe
         4.5:1, and bold does not buy the large-text exemption below 18.66px. See
         `avatarGradient` for why the ink is dark and the ground is light. */
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-void",
        author.validator && "ring-2 ring-cyan/70 ring-offset-2 ring-offset-void",
        className,
      )}
      style={{
        width: px,
        height: px,
        background: avatarGradient(author.avatarHue),
        fontSize: px * 0.36,
      }}
      title={author.displayName}
    >
      {initials(author.displayName)}
    </span>
  );
  return link ? (
    <Link href={`/u/${author.username}`} className="inline-flex">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Avatar + name row. */
export function AuthorChip({
  author,
  size = "md",
}: {
  author: Author;
  size?: keyof typeof SIZES;
}) {
  return (
    <Link
      href={`/u/${author.username}`}
      className="group inline-flex items-center gap-2"
    >
      <Avatar author={author} size={size} />
      <span className="text-sm text-muted group-hover:text-fg">
        {author.displayName}
        {/* 11px, and tracked like every other micro-label on the site rather than
            `tracking-wide`. It was the last piece of real text on the node card pages
            still rendering under 11px, and unlike the disclosure caret beside it in the
            nav it is a word a reader is meant to read, not a glyph. */}
        {author.validator && (
          <span className="ml-1 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">
            ✦ validator
          </span>
        )}
      </span>
    </Link>
  );
}
