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
 * The pass that added `/spec` and the climb took the header from six items to eight, and
 * eight is where the arrangement stops being decoration: the group headings in the
 * collapsed panel below are the only thing that keeps a phone reader from scrolling a
 * flat list of eight, and the rule in the wide row is the same statement made with one
 * border.
 *
 * Seven for a while. Redesign spec §4.2 renamed `/how-to-build-a-dark-factory` to
 * `/towards-a-dark-factory` and folded `/which-tasks` into it as a child, so the two
 * items that used to sit side by side in `learn` are one item leading to a three-page
 * sequence. Both old paths redirect from `next.config.ts` and neither is listed here: a
 * nav is a map of where the site is, and a redirect is for a link somebody else already
 * wrote down.
 *
 * The `/spec` and `/towards-a-dark-factory` children are deliberately absent too. Each
 * sequence carries its own previous/next pager and its parent opens with a door per
 * child, so putting five more items in this row would make the header a table of contents
 * for two pages that already have one.
 *
 * Eight again: the content-cli plan added `/install` after `/build`, one setup action
 * for a factory the reader just downloaded. It is the shortest label in the group, so it
 * costs the row less width than the item it follows.
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
  // Right after `/build`: once the reader has something built, wiring it into a client
  // is the next setup action, not a registry surface to browse — hence "learn" rather
  // than beside the three registry routes above.
  { href: "/install", label: "Install", group: "learn" },
  // `/spec` answers the question the guided path raises: the reader has just written a
  // graph and a card, and this is what the three layers they were writing in actually
  // are.
  { href: "/spec", label: "Spec", group: "learn" },
  // The author named this label: "/which-tasks should be placed in The climb part which
  // I'd rename Towards a Dark Factory". It is also the page's own `h1`, character for
  // character, which is what `nav.test.ts` holds it to. The label a reader clicks is the
  // heading they land on, so there is nothing to re-resolve on arrival.
  { href: "/towards-a-dark-factory", label: "Towards a Dark Factory", group: "learn" },
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

        {/* Eight items again in 976px of container at `lg`, so the row tightens by two
            pixels of padding and one of type there and relaxes at `xl`, where there is
            1152px and no reason to crowd. The seven-item version of this row was measured
            at 1024, 1280 and 1440; `/install` adds "Install", the shortest label in
            either group, so it costs less width than any item already accounted for
            there — not independently re-measured in a live browser since. */}
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
        /* The panel is scrollable and capped below the header's own 4rem, because seven
           items plus two headings plus the validate row is taller than a 640px phone in
           landscape and the last item was unreachable under a `position: sticky` header.
           `overflow-y: auto` on a `svh`-based cap is what keeps it reachable; do not swap
           it for `h-screen`, which on iOS measures the viewport without the browser
           chrome that is covering the bottom of it. */
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
