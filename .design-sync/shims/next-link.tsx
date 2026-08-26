// Browser stand-in for `next/link`, aliased in .design-sync/tsconfig.sync.json.
// The real Link needs the App Router context, which exists only inside a running
// Next.js app. A design built from this DS is plain React, so the anchor is the
// honest rendering: same markup, same classes, navigation inert.
import * as React from "react";

type LinkProps = Omit<React.ComponentPropsWithoutRef<"a">, "href"> & {
  href: string | { pathname?: string };
  // Accepted and dropped: routing behaviour has no meaning outside Next.
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  locale?: string | false;
  onNavigate?: unknown;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch, replace, scroll, shallow, passHref, legacyBehavior, locale, onNavigate, children, ...rest },
  ref,
) {
  const url = typeof href === "string" ? href : (href?.pathname ?? "#");
  return (
    <a ref={ref} href={url} {...rest}>
      {children}
    </a>
  );
});

export default Link;
