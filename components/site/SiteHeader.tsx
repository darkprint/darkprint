"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 * flat list, and the rule in the wide row is the same statement made with one border.
 *
 * Seven for a while, then nine. Redesign spec §4.2 renamed `/how-to-build-a-dark-factory`
 * to `/towards-a-dark-factory` and folded `/which-tasks` into it as a child, so the two
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
 * ── Nine back to nine, with three of them different (2026-08-07) ──
 * The IA pass removed three `learn` rows and added none:
 *
 *   - `/spec` is deleted. `/what-a-blueprint-is` is the door onto the three layer pages
 *     now, and it was already the item above `/spec` in this list, so the row came out
 *     rather than being repointed.
 *   - `/spec/scoring` is deleted. Its content merged into `/reading-the-radar`, which
 *     takes over its label: "How a blueprint is graded" is the phrase that page's own
 *     `h1` and every inline link on the site already use, and it covers the merged page
 *     where "Reading the radar" covered only the picture half.
 *   - `/concepts` is deleted. Its content is the `#the-words` section of
 *     `/what-a-blueprint-is`, so a row here would have been a second name for a page
 *     already in this list.
 *
 * Two rows were renamed rather than moved. `/build` is "Design a blueprint" on the
 * author's instruction, and sits directly before `/towards-a-dark-factory`; the page's
 * own `h1` says the same words, which is what `nav.test.ts` holds every label to. And the
 * `/upload` control is "Upload blueprint", the label the footer and the phone panel use
 * as well — one destination, one name, and that test reads all three out of this source.
 *
 * Nine, then: home, three registry surfaces, four in the menu, and `/install` beside it.
 */
export const NAV = [
  // The three registry surfaces, flat. `/ontology` sat in the menu for one pass and the
  // author put it back beside `/nodes`: "the Ontology should be placed on the right of
  // Nodes in the navbar. I prefer there." It is the vocabulary both of the others are
  // written against, so it belongs with the things you can browse rather than with the
  // pages explaining them.
  // The wordmark already goes home, and a reader who has not learned that a logo is a
  // link has no way in from a deep page. Its own group, so the wide row draws the same
  // rule after it that it draws before `Learn`.
  { href: "/", label: "Home", group: "home" },
  { href: "/blueprints", label: "Blueprints", group: "registry" },
  { href: "/nodes", label: "Nodes", group: "registry" },
  { href: "/ontology", label: "Ontology", group: "registry" },
  // The first item of the menu, because it is the one a cold reader needs first and the
  // only page that says what a blueprint is *for*. It is also the door onto the three
  // layer pages, and stop 00 of `SPEC_SEQUENCE`, since `/spec` was deleted — which is why
  // the row that used to sit two below this one is gone rather than repointed.
  { href: "/what-a-blueprint-is", label: "What a blueprint is", group: "learn" },
  // The scorecard, whole: the picture (five spokes, why autonomy has none, what a
  // vertex's colour says) and the arithmetic (three badges, every weight) on one route
  // after `/spec/scoring` merged into it. The label is the phrase the page's own `h1` and
  // every inline link on the site already use. It follows "What a blueprint is" because a
  // reader has to know what a blueprint is made of before a grade of one means anything.
  { href: "/reading-the-radar", label: "How a blueprint is graded", group: "learn" },
  // Doc 2 §0 splits the two onboardings. `/build` is the practical one: about an hour,
  // ending with a blueprint the reader has downloaded. It sits with the explanatory pages
  // rather than with the registry surfaces, because it is something to do rather than
  // something to browse — and directly before the route sequence, on the author's
  // instruction. Renamed from "Build one": the page's `h1` says the same words.
  { href: "/build", label: "Design a blueprint", group: "learn" },
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

/**
 * The phone panel's sections. `home` is deliberately absent.
 *
 * A section headed "Home" holding one link called "Home" says the word twice and reads as
 * a mistake, which is the same reason `/install` carries `standalone` rather than a group
 * of its own. On the panel it is rendered above these, unheaded, where a first item does
 * not need a category to be understood.
 */
const GROUPS = [
  { id: "registry", title: "Registry" },
  { id: "learn", title: "Learn" },
] as const;

/** Inside the dropdown. */
const LEARN = NAV.filter((item) => item.group === "learn" && !("standalone" in item));
/** Flat, first, with a rule after it. */
const HOME = NAV.filter((item) => item.group === "home");
/** Flat, before the trigger. */
const REGISTRY = NAV.filter((item) => item.group === "registry");
/** Flat, after the trigger. */
const STANDALONE = NAV.filter((item) => "standalone" in item);

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
    /* z-50, and it is the top of a ladder rather than a number picked to win an
       argument. One rung per kind of thing, so the next sticky element has a number to
       pick instead of another 50:

         50  the header — the only chrome that outranks a page
         40  page chrome  (a sticky filter bar)
         30  section chrome (a sticky group heading inside a list)
         20  card furniture (a favourite star, an author link)
         10  a card's stretched hit target

       Nothing inside a card may exceed 20. The Learn panel below carries `z-50` of its
       own, which is a rank *within this header's* stacking context and not a second
       claim on the page's. */
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
          {/* Home, then the same `border-l` rule that separates the registry from the
              menu. One divider means one thing across the row: what is on either side of
              it is a different kind of destination. */}
          {/* Every `hover:` in this row is gated behind `hoverable`
              (`@custom-variant hoverable (@media (hover: hover) and (pointer: fine))`,
              declared in `app/globals.css`). A phone has no hover and still MATCHES
              `:hover` on tap, then holds it until the next tap lands somewhere else — so
              an ungated nav link stays lit all the way to the route change, which reads
              as "still loading" on the item the reader just chose. */}
          {HOME.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-md px-2 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm",
                pathname === item.href ? "text-cyan" : "text-muted hoverable:hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}

          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line xl:mx-2" />

          {REGISTRY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-md px-2 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm",
                isActive(item.href) ? "text-cyan" : "text-muted hoverable:hover:text-fg",
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
                "flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-2 text-[13px] transition-[transform,scale,color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97] xl:px-3 xl:text-sm [&::-webkit-details-marker]:hidden",
                LEARN.some((item) => isActive(item.href))
                  ? "text-cyan"
                  : "text-muted hoverable:hover:text-fg",
              )}
            >
              Learn
              {/* An SVG chevron and not `▾`. A text glyph sits on the baseline of its own
                  em square with the box's slack underneath it, so rotating the character
                  180° pivots it about a centre that is not its own — the caret visibly
                  drifts downward as it flips. A path drawn in a 12×12 box rotates about
                  the middle of the mark.

                  The list names `rotate` explicitly, for the reason
                  `components/ui/Button.tsx` records at length: Tailwind v4 compiles
                  `rotate-180` to the standalone CSS property `rotate: 180deg`, and an
                  EXPLICIT `transition-[…]` naming only `transform` does not cover it.
                  The bare `transition-transform` shorthand is not that trap — measured in
                  the compiled stylesheet, v4 expands it to
                  `transform, translate, scale, rotate`, so the span this replaced did
                  ramp. The trap is only ever a hand-written list. */}
              <svg
                aria-hidden
                viewBox="0 0 12 12"
                width={12}
                height={12}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-[transform,rotate] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-180"
              >
                <path d="M3 4.75 6 7.75 9 4.75" />
              </svg>
            </summary>
            {/* `shadow-lg` computed to rgba(0,0,0,0.1) over `--color-void` #05060d — a
                shadow the ground cannot show — and `bg-void` is the page's own colour, so
                the site's only dropdown was separated from what it covers by a single 1px
                hairline. It now sits on `surface-2` with a shadow dark enough for this
                ground, and `menu-panel` gives it the `@starting-style` entrance declared
                in `app/globals.css`: it unfolds from its top-right corner, which is the
                corner it hangs from. */}
            <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-line-bright bg-surface-2 py-1 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.85)]">
              {LEARN.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "block px-4 py-2 text-sm transition-colors",
                    isActive(item.href) ? "text-cyan" : "text-muted hoverable:hover:text-fg",
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
                isActive(item.href) ? "text-cyan" : "text-muted hoverable:hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* The one action the chrome carries, and it is now the brightest thing in it.
            ------------------------------------------------------------
            Two things were wrong here. The 40px of highest contrast in the header was a
            32px magenta avatar reading MV inside a cyan focus ring — a signed-in
            identity on a site with no auth at all, wearing the name of `AUTHORS.mara`,
            a seeded persona in `lib/data/users.ts`. This site's doctrine is strict about
            exactly that: `ContentCard` marks a seeded download count with ◐ and the
            footer prints "seeded community". So the header cannot claim a session it
            does not have. It is gone, with its imports.

            And the one real action lived inside `hidden … lg:flex`, so a phone got a
            header with no affordance in it whatsoever — a wordmark and a hamburger. It
            is out of that wrapper and visible at every width, `primary` rather than
            `outline`, sized `sm` and stepping up to the `md` geometry (h-10 px-4) at
            `lg` where there is room for it.

            `/upload` validates and scores a bundle in the browser and stops there;
            publishing has no backend. A "+ Share" label on every page would be the one
            promise the site cannot keep — and the label is "Upload blueprint", the
            same words the phone panel, the footer and both landing doors use, so one
            destination has one name everywhere. `nav.test.ts` holds them together, and
            it holds the page's own `h1` and `<title>` to the same words. Renamed from
            "Upload blueprint" on the author's instruction: the noun a reader is
            carrying is a blueprint, and "bundle" is the word for the folder it arrives
            in rather than for the thing they made. */}
        <div className="flex items-center gap-2">
          <ButtonLink
            href="/upload"
            variant="primary"
            size="sm"
            className="lg:h-10 lg:gap-2 lg:px-4"
          >
            Upload blueprint
          </ButtonLink>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted transition-[transform,scale,color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:text-fg hoverable:active:scale-[0.97] lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <span className="text-xl">{open ? "✕" : "☰"}</span>
          </button>
        </div>
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
            {/* Home first and unheaded: see `GROUPS`. */}
            {HOME.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "block rounded-md px-3 py-2.5 text-sm",
                  pathname === item.href ? "text-cyan" : "text-muted",
                )}
              >
                {item.label}
              </Link>
            ))}

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
              Upload blueprint
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
