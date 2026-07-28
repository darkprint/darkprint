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
 * `learn` is everything that answers "what is this", "would it work on my problem" and
 * "how is any of it written down" for somebody who does not yet know. Mixing them into
 * one run reads as eight equal destinations, which is the flattening §0 blames for the
 * site being unreadable cold.
 *
 * The pass that added `/spec` and `/how-to-build-a-dark-factory` took the header from six
 * items to eight, and eight is where the arrangement stops being decoration: the group
 * headings in the collapsed panel below are the only thing that keeps a phone reader from
 * scrolling a flat list of eight, and the rule in the wide row is the same statement made
 * with one border.
 */
export const NAV = [
  { href: "/blueprints", label: "Blueprints", group: "registry" },
  { href: "/nodes", label: "Nodes", group: "registry" },
  { href: "/ontology", label: "Ontology", group: "registry" },
  // Doc 2 §0 splits the two onboardings. `/build` is the practical one: about an hour,
  // ending with a factory the reader has downloaded. It sits with the explanatory pages
  // rather than with the three registry surfaces, because it is something to do rather
  // than something to browse.
  { href: "/build", label: "Build one", group: "learn" },
  // `/spec` follows `/build` because it answers the question the guided path raises:
  // the reader has just written a graph and a card, and this is what the three layers
  // they were writing in actually are.
  { href: "/spec", label: "Spec", group: "learn" },
  // "The climb", which is the page's own eyebrow, and not "How to build one".
  //
  // Two items apart from "Build one" the old label differed by two words and led
  // somewhere unrelated: `/build` is a seven-step path that ends with a downloaded
  // factory, and this is a prose account of an organisation crossing four phases with no
  // artefact at the end. A visitor choosing between them from the nav had no signal, and
  // the labels inverted the distinction the two pages were written to hold apart. This
  // one names the ladder, which is what the page is about.
  { href: "/how-to-build-a-dark-factory", label: "The climb", group: "learn" },
  { href: "/which-tasks", label: "Which tasks", group: "learn" },
  { href: "/what-it-isnt", label: "What it isn't", group: "learn" },
] as const;

/** The first item of the second group, which is where the rule goes. */
const FIRST_LEARN = NAV.find((item) => item.group === "learn")?.href;

const GROUPS = [
  { id: "registry", title: "Registry" },
  { id: "learn", title: "Learn" },
] as const;

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

        {/* Eight items in 976px of container at `lg`, so the row tightens by two pixels
            of padding and one of type there and relaxes at `xl`, where there is 1152px
            and no reason to crowd. Measured at 1024, 1280 and 1440. */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-md px-2 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm",
                item.href === FIRST_LEARN && "ml-2 border-l border-line pl-3 xl:pl-4",
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
        /* The panel is scrollable and capped below the header's own 4rem, because eight
           items plus two headings plus the validate row is taller than a 640px phone in
           landscape and the last item was unreachable under a `position: sticky` header. */
        <div className="max-h-[calc(100svh-4rem)] overflow-y-auto border-t border-line bg-void lg:hidden">
          <div className="container-page flex flex-col py-3">
            {/* A `nav` per group, named by the same word the reader sees. The label is a
                `p` and not a heading: the panel opens above the page's own `h1`, and a
                heading here would put two levels of outline in front of it. */}
            {GROUPS.map((group) => (
              <nav key={group.id} aria-label={group.title} className="py-2">
                <p className="px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                  {group.title}
                </p>
                {NAV.filter((item) => item.group === group.id).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cx(
                      "block rounded-md px-3 py-2.5 text-sm",
                      isActive(item.href) ? "text-cyan" : "text-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ))}
            <Link
              href="/upload"
              onClick={() => setOpen(false)}
              className="mt-2 border-t border-line px-3 pb-1 pt-4 text-sm text-cyan"
            >
              Validate a bundle
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
