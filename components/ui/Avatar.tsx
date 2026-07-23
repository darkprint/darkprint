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
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
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
        {author.validator && (
          <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-cyan">
            ✦ validator
          </span>
        )}
      </span>
    </Link>
  );
}
