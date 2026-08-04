import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  /* The primary wore `shadow-[0_0_24px_-6px_var(--color-cyan)]` — a zero-offset coloured
     halo, which is a glow rather than a shadow: it says "this element is emitting light",
     which is decoration, and it reads as a focus or active state on a control that is
     neither. A shadow carries an offset because a light source is somewhere. This one is
     cast downward and tinted with the button's own hue instead of grey, which is what
     keeps it from going muddy on the dark ground. */
  primary:
    "bg-cyan text-void font-medium hover:bg-cyan-bright shadow-[0_6px_16px_-8px_var(--color-cyan)]",
  outline:
    "border border-line-bright text-fg hover:border-cyan hover:text-cyan bg-transparent",
  ghost: "text-muted hover:text-fg bg-transparent",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

const base =
  "inline-flex items-center justify-center rounded-md transition-colors duration-150 whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button className={cx(base, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={cx(base, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
