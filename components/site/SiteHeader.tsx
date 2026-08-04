"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 * Nine now: the lifecycle-scoring pass gave `/spec/scoring` its own route right after
 * `/spec`, since it grades what the three layers describe rather than adding a fourth one
 * of its own. Its label is the same phrase the page's own `h1` and every inline link to it
 * already use, "How a blueprint is graded", so a reader who has met the phrase on any of
 * those recognises it here too.
 */
export const NAV = [
  // The three registry surfaces, flat. `/ontology` sat in the menu for one pass and the
  // author put it back beside `/nodes`: "the Ontology should be placed on the right of
  // Nodes in the navbar. I prefer there." It is the vocabulary both of the others are
  // written against, so it belongs with the things you can browse rather than with the
  // pages explaining them.
  { href: "/blueprints", label: "Blueprints", group: "registry" },
  { href: "/nodes", label: "Nodes", group: "registry" },
  { href: "/ontology", label: "Ontology", group: "registry" },
  // The first item of the menu, because it is the one a cold reader needs first and the
  // only page that says what a blueprint is *for*.
  { href: "/what-a-blueprint-is", label: "What a blueprint is", group: "learn" },
  // Doc 2 §0 splits the two onboardings. `/build` is the practical one: about an hour,
  // ending with a factory the reader has downloaded. It sits with the explanatory pages
  // rather than with the registry surfaces, because it is something to do rather than
  // something to browse.
  { href: "/build", label: "Build one", group: "learn" },
  // `/spec` answers the question the guided path raises: the reader has just written a
  // graph and a card, and this is what the three layers they were writing in actually
  // are.
  { href: "/spec", label: "Spec", group: "learn" },
  // A child of `/spec`, not a fifth `learn` destination in its own right: it grades what
  // the three layers above it describe. Placed directly after `/spec` for that reason.
  { href: "/spec/scoring", label: "How a blueprint is graded", group: "learn" },
  // The picture rather than the system: five spokes, why autonomy has none, and what a
  // vertex's colour says. It sits after the grading page because it points there for the
  // arithmetic and would be a strange first stop.
  { href: "/reading-the-radar", label: "Reading the radar", group: "learn" },
  // The words that travel with this subject and are not the site's own vocabulary: eval,
  // harness, rubric, tool, MCP, skill. It sits after the spec pages because it explains
  // what the card's fields *are*, which only lands once a reader knows a card has fields.
  { href: "/concepts", label: "Eval, harness and the rest", group: "learn" },
  // The author named this label: "/which-tasks should be placed in The climb part which
  // I'd rename Towards a Dark Factory". It is also the page's own `h1`, character for
  // character, which is what `nav.test.ts` holds it to. The label a reader clicks is the
  // heading they land on, so there is nothing to re-resolve on arrival.
  { href: "/towards-a-dark-factory", label: "Towards a Dark Factory", group: "learn" },
  // Out of the menu and to the right of it, renamed, on the author's instruction. It is
  // a setup action rather than something to read, and "Install" alone said nothing about
  // what is being installed — the page is about pointing an MCP client at the registry.
  // `standalone` keeps it in the `learn` group for the phone panel, where a section of
  // one item would read as a mistake, while the wide row draws it beside the trigger.
  { href: "/install", label: "Install MCP", group: "learn", standalone: true },
] as const;

const GROUPS = [
  { id: "registry", title: "Registry" },
  { id: "learn", title: "Learn" },
] as const;

/** Inside the dropdown. */
const LEARN = NAV.filter((item) => item.group === "learn" && !("standalone" in item));
/** Flat, before the trigger. */
const REGISTRY = NAV.filter((item) => item.group === "registry");
/** Flat, after the trigger. */
const STANDALONE = NAV.filter((item) => "standalone" in item);

const currentUser = AUTHORS.mara;

export function SiteHeader() {
  const pathname = usePathname();

  /* The Learn menu, controlled rather than left to the element.
     ------------------------------------------------------------
     A bare `<details>` gives keyboard operation and a toggle for free, and it gives
     nothing at all for the two things a reader expects of a menu: clicking away from it
     closes it, and so does Escape. Left alone it stayed open behind whatever the reader
     clicked next, including the page under it.

     So `open` is React state and the element is told what it is. `onToggle` syncs the
     other way, because the summary is still what the pointer and the keyboard operate;
     without it the element and the state disagree the first time somebody clicks the
     trigger. */
  /* Both menus store *where* they were opened rather than whether they are open, so
     "close on navigation" is derived instead of being an effect that writes state back
     after the route has already changed. `react-hooks/set-state-in-effect` rejects the
     effect version, and it is right to: the render after a route change would paint the
     menu still open and then close it. This way the menu is shut in the same render the
     path changes in, including on the browser's own back button. */
  const [learnAt, setLearnAt] = useState<string | null>(null);
  const [panelAt, setPanelAt] = useState<string | null>(null);
  const learnOpen = learnAt === pathname;
  const open = panelAt === pathname;
  const setLearnOpen = (next: boolean) => setLearnAt(next ? pathname : null);
  const setOpen = (next: boolean) => setPanelAt(next ? pathname : null);
  const learnRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!learnOpen) return;
    /* `pointerdown`, not `click`: a reader who presses inside the page and releases over
       the menu should not have the menu treated as the target, and pointerdown is also
       what feels immediate. Capture phase so a handler that stops propagation somewhere
       in the page cannot leave the menu stuck open. */
    /* `setLearnAt` rather than the `setLearnOpen` helper: the helper closes over
       `pathname` and is a new function every render, so depending on it would tear down
       and rebuild both listeners on each one. The raw setter is stable. */
    const onPointerDown = (event: PointerEvent) => {
      if (!learnRef.current?.contains(event.target as Node)) setLearnAt(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLearnAt(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [learnOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-void/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          <span className="text-fg">Dark</span>
          <span className="text-cyan">Print</span>
        </Link>

        {/* Three registry links, a menu, and one standalone link after it.

            The width problem this solves was real: nine items in 976px at `lg` had the row
            tightening its own padding and type to fit, and the longest label in the set
            ("How a blueprint is graded") was added without re-measuring. Five of the nine
            are behind one 5-character trigger now, so the row has slack at every
            breakpoint instead of being tuned to one.

            A `<details>` rather than a button and a popover, because keyboard operation,
            the toggle and focus order come from the element, and `More`, `DownloadPanel`
            and `ForkAction` already use the same primitive elsewhere. What it does *not*
            give is a menu that closes when a reader clicks away from it or presses
            Escape, and the first version of this row claimed it closed "on navigation
            because the page unmounts it", which is wrong: client-side routing does not
            unmount the header. Both are handled in the effects above. */}
        <nav className="hidden items-center gap-1 lg:flex">
          {REGISTRY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-md px-2 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm",
                isActive(item.href) ? "text-cyan" : "text-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}

          <details
            ref={learnRef}
            open={learnOpen}
            onToggle={(e) => setLearnOpen(e.currentTarget.open)}
            className="group relative ml-2 border-l border-line pl-3 xl:pl-4"
          >
            <summary
              className={cx(
                "flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm [&::-webkit-details-marker]:hidden",
                LEARN.some((item) => isActive(item.href))
                  ? "text-cyan"
                  : "text-muted hover:text-fg",
              )}
            >
              Learn
              <span
                aria-hidden
                className="text-[10px] transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-line bg-void py-1 shadow-lg">
              {LEARN.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "block px-4 py-2 text-sm transition-colors",
                    isActive(item.href) ? "text-cyan" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>

          {/* To the right of the trigger, on the author's instruction. A setup action is
              not something to read, so it does not belong inside a menu called Learn, and
              it is one item rather than the seven that made the row too wide. */}
          {STANDALONE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-md px-2 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm",
                isActive(item.href) ? "text-cyan" : "text-muted hover:text-fg",
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
          onClick={() => setOpen(!open)}
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
