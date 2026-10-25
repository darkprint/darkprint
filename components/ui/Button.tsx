import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "outline" | "ghost" | "card";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  /* Fine-pointer hover avoids a latched hover colour after a phone tap. */
  primary:
    "bg-cyan text-void font-medium hoverable:hover:bg-cyan-bright",
  outline:
    "border border-cyan text-cyan bg-blue-paper hoverable:hover:border-cyan-bright hoverable:hover:text-cyan-bright hoverable:hover:bg-cyan/10",
  ghost: "text-muted hoverable:hover:text-fg bg-transparent",
  /* `outline`'s shape in the card register (globals.css, amber job 3): the hue answers WHICH
     document this control is about, and the affordance still comes from the shape, the height
     and the hover, exactly as the card page's download trigger argues.

     Bordered and transparent, NEVER filled. A filled amber shape is how this site spells an
     honesty claim — `ComingSoonBadge` is one — so a filled amber button would read as a
     status about itself rather than as the register. Amber on a word is the register; amber
     around a word is what the claim wears. Named for the register and not for the hue, so a
     control that is about neither a card nor a claim has no variant to reach for here. */
  card:
    "border border-amber/70 text-amber bg-transparent hoverable:hover:border-amber-bright hoverable:hover:text-amber-bright",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

/* PRESS — the site-wide bands, recorded here because this is the primitive everything else
   copies from. Press is the most frequently-experienced motion in an interface: it is the
   only moment where the interface answers a gesture the reader is still making, so it has to
   be immediate (120ms) and it has to be proportional — a 30px star that shrank 3% would not
   read as pressed at all, and a 400px card that shrank 6% would look broken.

     ≤ 40px   (star, icon button)        scale 0.94
     40–200px (button, tab, chip, pager) scale 0.97   ← this file
     > 200px  (card, panel link)         scale 0.99

   Always `duration-[120ms]` with `--ease-out` (cubic-bezier(0.23, 1, 0.32, 1)), and always
   with an EXPLICIT `transition-[…]` property list. Never `transition-all` — it animates every
   animatable property, layout ones included — and never bare `transition`, whose default list
   silently includes `outline-color`, which would fade the focus ring in over 150ms and leave a
   reader tabbing at 80ms looking at a washed half-strength blue.

   `scale` IS IN THE LIST ON PURPOSE, and it is not a synonym for `transform`. Tailwind v4
   (4.3.3 here) compiles `scale-[0.97]` to the standalone CSS property `scale: 0.97`, not to
   `transform: scale(.97)` — `scale`, `translate` and `rotate` are independent properties in
   CSS Transforms Level 2 and a `transition-property` naming only `transform` does not cover
   any of them. Verified in Chrome: an element transitioning `transform, color` over 400ms
   linear reads `scale: 0.5` immediately, while the same element transitioning
   `transform, scale, color` reads 0.7596 at t=200ms. Drop `scale` from this list and the press
   still happens — it just snaps down and snaps back with no ramp, which is the one thing a
   120ms curve exists to prevent. Any component copying this pattern needs `scale` too.

   Disabled buttons keep readable ink on a neutral face. The native disabled attribute
   blocks activation while preserving the cursor and any explanation in the title. */
const base =
  "inline-flex items-center justify-center rounded-md whitespace-nowrap select-none transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97] disabled:border disabled:border-line-bright disabled:bg-surface-2 disabled:text-dim disabled:shadow-none disabled:cursor-not-allowed";

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
