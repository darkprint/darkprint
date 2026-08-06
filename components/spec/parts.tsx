/* ============================================================
   The two pieces of furniture the four spec pages share.

   Redesign spec §4.1 split one page into four, and a split is where
   a page's small habits turn into four slightly different ones: a
   quoted field name set in mono here and in a `<code>` with a
   background there, a mono eyebrow at three different tracking
   values. None of that is a decision worth taking four times, so it
   is taken here.

   There used to be a third: `LABEL`, the literal string `font-mono
   text-[11px] uppercase tracking-[0.18em] text-dim`. Hoisting it to
   a constant stopped this corner of the site from spelling the label
   two ways, but it left the site as a whole with two answers — the
   constant, and the `.label` class in `app/globals.css` that every
   other page adopted. A label is a typographic tier, not a spec-page
   part, so the tier now has exactly one definition and it lives in
   CSS. The two call sites write `className="label"`.

   Not a client component. These render markup and nothing else.
   ============================================================ */

import Link from "next/link";

/**
 * A term id or a field name quoted inside prose.
 *
 * Takes a string rather than `ReactNode`, which is the constraint doing the work: a field
 * name is a literal out of a schema, and a component that accepted markup would let one
 * page nest a link inside an identifier and read differently from the other three.
 */
export function Id({ children }: { children: string }) {
  return <code className="font-mono text-[0.92em] text-fg">{children}</code>;
}

/**
 * A link inside a paragraph, in the site's cyan underline.
 *
 * `rel` and `target` are set together and only for an outbound link, so a caller cannot
 * open an internal route in a new tab by forgetting one of the two.
 */
export function SpecLink({
  href,
  external = false,
  children,
}: {
  href: string;
  /** Leaves the site. Adds the two attributes an outbound link needs, together. */
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan";

  if (external) {
    return (
      <a
        href={href}
        className={className}
        rel="noreferrer noopener"
        target="_blank"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
