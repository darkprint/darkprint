"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AUTHORS } from "@/lib/data/users";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { cx } from "@/lib/format";

/**
 * Two groups, and the divider between them is doc 2 §0's distinction made navigable.
 *
 * `registry` is the three surfaces of doc 1 §0 — the things a convinced reader came for.
 * `explain` is the conceptual onboarding: the two pages that answer "what is this" and
 * "would it work on my problem" for somebody who does not yet know. Mixing them into one
 * run of five reads as five equal destinations, which is the flattening §0 blames for the
 * site being unreadable cold.
 */
const NAV = [
  { href: "/blueprints", label: "Blueprints", group: "registry" },
  { href: "/nodes", label: "Nodes", group: "registry" },
  { href: "/ontology", label: "Ontology", group: "registry" },
  // Doc 2 §0 splits the two onboardings. `/build` is the practical one: about an hour,
  // ending with a factory the reader has downloaded. It sits with the explanatory pages
  // rather than with the three registry surfaces, because it is something to do rather
  // than something to browse.
  { href: "/build", label: "Build one", group: "explain" },
  { href: "/what-it-isnt", label: "What it isn't", group: "explain" },
  { href: "/which-tasks", label: "Which tasks", group: "explain" },
] as const;

/** The first item of the second group, which is where the rule goes. */
const FIRST_EXPLAIN = NAV.find((item) => item.group === "explain")?.href;

const currentUser = AUTHORS.mara;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-void/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          <span className="text-fg">Dark</span>
          <span className="text-cyan">Print</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-md px-3 py-2 text-sm transition-colors",
                item.href === FIRST_EXPLAIN && "ml-2 border-l border-line pl-4",
                isActive(item.href)
                  ? "text-cyan"
                  : "text-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* `/upload` validates and scores a bundle in the browser and stops there;
            publishing has no backend. A "+ Share" label on every page of the site
            would be the one promise the site cannot keep. */}
        <div className="hidden items-center gap-3 lg:flex">
          <ButtonLink href="/upload" variant="outline" size="sm">
            Validate
          </ButtonLink>
          <Link href={`/u/${currentUser.username}`} className="inline-flex">
            <Avatar author={currentUser} size="md" />
          </Link>
        </div>

        {/* mobile toggle — the nav is six items now, so it collapses at `lg` rather
            than at `md`: at 768px the row wrapped onto itself. */}
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <span className="text-xl">{open ? "✕" : "☰"}</span>
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-void lg:hidden">
          <nav className="container-page flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "rounded-md px-3 py-2.5 text-sm",
                  item.href === FIRST_EXPLAIN && "mt-2 border-t border-line pt-4",
                  isActive(item.href) ? "text-cyan" : "text-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/upload"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm text-cyan"
            >
              Validate a bundle
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
