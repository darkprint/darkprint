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
    "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
    active
      ? "border-cyan/60 bg-cyan/10 text-cyan"
      : "border-line text-muted",
    // `scale` sits in that property list beside `transform` because Tailwind v4 compiles
    // `scale-[0.97]` to the standalone `scale:` property, which CSS transitions as its
    // own thing — a list naming only `transform` gives the press no duration at all.
    //
    // Feedback only where there is something to press. `:active` matches any element
    // under a mousedown, not just interactive ones, so a bare `<span>` chip carrying the
    // press scale would shrink when a reader pressed the card behind it — and every one
    // of these sits inside a card that is itself one big stretched link. Same reason the
    // hover pair is gated: a chip that lights up but goes nowhere is a promise.
    // `hoverable:` is `@media (hover: hover) and (pointer: fine)` — without it a tap on a
    // phone leaves the pill latched bright until the next tap lands elsewhere.
    href && !active && "hoverable:hover:border-line-bright hoverable:hover:text-fg",
    href && "hoverable:active:scale-[0.97]",
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
