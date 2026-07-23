import Link from "next/link";
import { cx } from "@/lib/format";

/** Small mono tag chip. Renders as a link when `href` is provided. */
export function TagPill({
  label,
  href,
  active = false,
  className,
}: {
  label: string;
  href?: string;
  active?: boolean;
  className?: string;
}) {
  const cls = cx(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
    active
      ? "border-cyan/60 bg-cyan/10 text-cyan"
      : "border-line text-muted hover:border-line-bright hover:text-fg",
    className,
  );
  const content = <span>#{label}</span>;
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <span className={cls}>{content}</span>
  );
}
