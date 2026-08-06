import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  /* Every hover below is gated behind `hoverable` (app/globals.css declares
     `@custom-variant hoverable (@media (hover: hover) and (pointer: fine))`). A phone has no
     hover, but it still MATCHES `:hover` on tap and then holds it until the next tap lands
     somewhere else — so an ungated button keeps its hover colour all the way to the route
     change, which reads as "still loading" on the one control the reader just used.

     The primary wore `shadow-[0_0_24px_-6px_var(--color-cyan)]` — a zero-offset coloured
     halo, which is a glow rather than a shadow: it says "this element is emitting light",
     which is decoration, and it reads as a focus or active state on a control that is
     neither. A shadow carries an offset because a light source is somewhere. This one is
     cast downward and tinted with the button's own hue instead of grey, which is what
     keeps it from going muddy on the dark ground. */
  primary:
    "bg-cyan text-void font-medium hoverable:hover:bg-cyan-bright shadow-[0_6px_16px_-8px_var(--color-cyan)]",
  outline:
    "border border-line-bright text-fg hoverable:hover:border-cyan hoverable:hover:text-cyan bg-transparent",
  ghost: "text-muted hoverable:hover:text-fg bg-transparent",
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

   DISABLED. `opacity-50` put `text-void` on `bg-cyan` under the readable band, so a disabled
   primary could not be read at all — 60% is dimmer than enabled and still legible. And
   `pointer-events-none` is gone: the `disabled` attribute already blocks activation on a
   `<button>`, so all that rule bought was making the control invisible to the pointer, which
   is precisely what stopped a disabled button from showing a cursor change or a `title`
   saying why it is off (BundleDropzone's "Add to the selection" is the live case).
   The utilities compile to `&:disabled`, a pseudo-class no `<a>` can ever match, so they are
   inert on ButtonLink and correct on Button; `disabled` is not in ButtonLink's prop type
   either, so it cannot be passed there. */
const base =
  "inline-flex items-center justify-center rounded-md whitespace-nowrap select-none transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed";

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
