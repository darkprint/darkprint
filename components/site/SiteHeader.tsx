"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "./Logo";
import { ButtonLink } from "@/components/ui/Button";
import { SPEC_SEQUENCE, SANDBOX } from "@/components/spec/sequence";
import { ACCOUNT } from "@/lib/data/account";
import { cx } from "@/lib/format";

/* ============================================================
   Five targets, not seven.

   The bar was Blueprints · Cards · Create · [Publish] · MCP · | · Learn ▾, and it had three
   problems a reader met before they met a page:

   1. **Create and Publish read as one intent.** Two of the seven targets differed by a verb
      and sat two items apart, and neither said which one you wanted.
   2. **MCP stood as a peer of the two content types.** A protocol the site does not
      implement had the same weight in the chrome as the registry's own shelves.
   3. **The vocabulary browser had no entry at all.** `/ontology` is one of the three things
      the registry holds, it has a browser and a profile tab, and the only route to it in
      the nav was the Learn menu's row for the *spec document* about it.

   So: three Browse rows for the three things the registry holds, a Build menu for the three
   ways to make one, Learn unchanged in mechanism, Publish as the button, and the account
   last, where a reader already looks for identity.

   ── Decision 1: `/ontology` is "Vocabulary" here, and `/spec/ontology` stays "Ontology" ──
   The browser and the spec document about it are two routes, and `nav.test.ts` forbids one
   label on two of them. "Vocabulary" is what the browser is for — the words a blueprint and
   a card are allowed to use — and "Ontology" is the name of the format, which is what the
   Learn stop teaches. Neither route moves.
   ============================================================ */

export const NAV = [
  { href: "/blueprints", label: "Blueprints", group: "browse" },
  { href: "/nodes", label: "Cards", group: "browse" },
  /* The third thing the registry holds. It had no entry in the chrome at all until this
     pass; see decision 1 in the header docblock for why it is not called "Ontology". */
  { href: "/ontology", label: "Vocabulary", group: "browse" },
  /* MCP first, then the skill. The author set this order in the footer and it holds here
     too: the two are not a sequence, and the one a reader is likelier to be looking for by
     name goes first.

     "Assisted Design" rather than "Create", on the author's instruction, and the page's own
     `h1` and `<title>` moved with it — `nav.test.ts` holds a route to one name everywhere,
     so a rename is three files or it is a bug. What the page is remains what it always was:
     the authoring skill that interviews you into a bundle. `/build`, the worked sandbox, is
     not in this menu; it is stop 04 of Learn, where it says what it is. */
  { href: "/mcp", label: "MCP", group: "build" },
  { href: "/skill", label: "Assisted Design", group: "build" },
  /* `/build` is NOT a row in the Build menu, and the omission is the author's call.
     It had one for a pass, and it put the sandbox in front of a reader twice — once here
     and once as the worked example under stop 03 of Learn, which is where it belongs and
     where it says what it is. The route keeps its name from `SANDBOX.nav` on both surfaces
     that do draw it (the Learn menu and the footer), so it still cannot end up with two
     names on one screen. It stays in `NAV` as `docs` for the label table below. */
  { href: "/upload", label: "Publish", group: "action" },
  { href: SANDBOX.href, label: SANDBOX.nav, group: "docs" },
  { href: "/what-a-blueprint-is", label: "What a blueprint is", group: "docs" },
  { href: "/spec/topology", label: "Blueprint file (DOT)", group: "docs" },
  { href: "/spec/card", label: "Node card (YAML)", group: "docs" },
  { href: "/spec/ontology", label: "Ontology", group: "docs" },
  { href: "/reading-the-radar", label: "How a blueprint is graded", group: "docs" },
  /* `/towards-a-dark-factory` stood here as `group: "guides"` and was deleted 2026-08-11.
     `guides` is not one of the groups this file renders (`browse`, `build`, `action`,
     `docs`) nor one of `MOBILE_GROUPS`, so the row drew nothing on any surface: it was a
     table entry describing a control that does not exist. The route reaches the header
     through `LEARN`, as stop 06 of the sequence, and Learn is its only home.

     What the row was silently doing was supplying the route's entry in `nav.test.ts`'s
     `HEADER_LABELS`. That map is built from this table, so two of that file's assertions
     read the route's label out of a row nobody could click; both read it from `LEARN` now,
     which is the surface that actually names it. */
] as const;

/** The three rows that stand in the bar itself. */
const BROWSE = NAV.filter((item) => item.group === "browse");

/**
 * The Design menu: the ways to make a blueprint, each with the line that tells them apart.
 *
 * Publishing is deliberately not among them. It is the button beside this menu, and a
 * paragraph at the foot of the panel used to explain that at length — three lines about the
 * validator, the tab it runs in and the backend that does not exist. The author asked it out
 * on 2026-08-11 and it is not moved elsewhere, because it was not carrying anything this
 * chrome owes a reader: `/upload` says all three things in the open, above its own dropzone,
 * where `components/site/honesty.test.ts` holds them. A dropdown explaining why a control is
 * not in it is a menu apologising for its own contents.
 */
const BUILD = NAV.filter((item) => item.group === "build");

const BUILD_BLURB: Record<string, string> = {
  "/mcp": "Reach the registry from your own agent",
  "/skill": "Install the authoring skill and name your goal",
};

export const LEARN = SPEC_SEQUENCE.map((page) => ({
  href: page.href,
  label: page.nav,
  step: page.step,
}));

/**
 * The account menu, and every route in it is real.
 *
 * `nav.test.ts` reads this table: these are header destinations the same way `LEARN`'s are,
 * which is what lets `/settings` be held to the same completeness rule as every other
 * top-level route instead of sitting in an exemption. `Sign out` is not in it, because it
 * is not a route and there is nothing to sign out of — the panel says so under the rows.
 */
export const ACCOUNT_MENU = [
  { href: `/u/${ACCOUNT.author.username}`, label: "Your profile" },
  { href: `/u/${ACCOUNT.author.username}/blueprints`, label: "Your blueprints" },
  { href: `/u/${ACCOUNT.author.username}/cards`, label: "Your cards" },
  { href: `/u/${ACCOUNT.author.username}/saved`, label: "Saved" },
  { href: "/settings", label: "Settings" },
] as const;

/**
 * The collapsed panel's four groups, and its headings now match the bar exactly.
 *
 * `You` is the fourth, added with the account menu rather than hanging the account off one
 * of the existing three. Its rows come from `ACCOUNT_MENU`, the way `learn`'s come from
 * `LEARN`; `nav.test.ts` knows about both exceptions.
 */
const MOBILE_GROUPS = [
  { id: "browse", title: "Browse" },
  { id: "build", title: "Design" },
  { id: "learn", title: "Learn" },
  { id: "you", title: "You" },
] as const;

function mobileLinks(
  group: (typeof MOBILE_GROUPS)[number]["id"],
): readonly { href: string; label: string; step?: string }[] {
  if (group === "learn") return LEARN;
  if (group === "you") return ACCOUNT_MENU;
  return NAV.filter((item) => item.group === group);
}

/** The chevron every menu trigger carries. */
function Caret() {
  return (
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
      className="transition-transform duration-150 group-open:rotate-180"
    >
      <path d="M3 4.75 6 7.75 9 4.75" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  /**
   * Which menu is open, keyed by the path it was opened on.
   *
   * One state for all three, so opening one closes the others by construction rather than
   * by three effects agreeing with each other. The pathname is part of the key for the
   * reason the single Learn menu already used it: a client-side navigation leaves the panel
   * mounted and open over the page a reader just asked for, and comparing against the
   * current path closes it without an effect that fires on every route change.
   */
  const [openAt, setOpenAt] = useState<{ menu: string; at: string } | null>(null);
  const [mobileAt, setMobileAt] = useState<string | null>(null);
  const isOpen = (menu: string) => openAt?.menu === menu && openAt.at === pathname;
  const mobileOpen = mobileAt === pathname;
  const menus = useRef<HTMLElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (openAt === null) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menus.current?.contains(event.target as Node)) setOpenAt(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenAt(null);
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openAt]);

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-void/88 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3">
        {/* The lockup: mark left of the wordmark, and the wordmark unchanged.
            ------------------------------------------------------------
            The 24px rung in a 64px row beside 18px type — two solid discs and one edge,
            because three 3-unit cores in a 64 box land near 1.5px here and the mark sheds
            nodes rather than shrinking them.

            The mark is `aria-hidden` with no `title`: the word beside it already names the
            site, and a mark announcing itself next to the word it stands for reads out
            "DarkPrint DarkPrint". The link's accessible name is the wordmark's text.

            The wordmark itself is untouched — `font-display`, `font-semibold`,
            `tracking-tight`, `Dark` in `--color-fg` and `Print` in `--color-cyan`. The
            letterforms agree with the hero by construction:
            `scripts/generate-wordmark-paths.ts` traces it out of Space Grotesk SemiBold,
            which `@theme inline` maps to `--font-display`, so one set of letterforms is
            drawn as outlines there and set as live type here. */}
        {/* `items-baseline`, not `items-center`. A lockup is a mark standing on the
            wordmark's baseline, and centring aligns the mark's BOX against the type's LINE
            BOX instead: the box carries empty room under the drawing, the line box carries
            the font's descent under the baseline, and the mark ends up hanging below the
            word by the difference between them. Measured here before the change: 3.6px.
            `align="baseline"` is the mark's half of it, and `Logo.tsx` says what it does. */}
        <Link href="/" className="mr-auto flex items-baseline gap-2.5">
          <Logo size={24} align="baseline" />
          <span className="font-display text-lg font-semibold tracking-tight">
            <span className="text-fg">Dark</span>
            <span className="text-cyan">Print</span>
          </span>
        </Link>

        <nav ref={menus} className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {BROWSE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-md px-2.5 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm",
                isActive(item.href) ? "text-cyan" : "text-muted hoverable:hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}

          <span aria-hidden className="mx-1 h-5 w-px bg-line xl:mx-2" />

          {/* Build ▾ — the three ways to make one, with the line that tells them apart. */}
          <details
            open={isOpen("build")}
            onToggle={(event) =>
              setOpenAt(event.currentTarget.open ? { menu: "build", at: pathname } : null)
            }
            className="group relative"
          >
            <summary
              className={cx(
                "flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm [&::-webkit-details-marker]:hidden",
                BUILD.some((item) => isActive(item.href))
                  ? "text-cyan"
                  : "text-muted hoverable:hover:text-fg",
              )}
            >
              Design
              <Caret />
            </summary>
            <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-line-bright bg-surface-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.85)]">
              <div className="flex flex-col py-2">
                {BUILD.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    /* `group/row` so the whole row lights, not just the word under the
                        pointer: the blurb is part of the target and a two-line row whose
                        second line stays dim reads as half-hovered. */
                    className="group/row flex flex-col gap-0.5 px-4 py-2 transition-colors hoverable:hover:bg-cyan/5"
                  >
                    <span
                      className={cx(
                        "text-sm transition-colors hoverable:group-hover/row:text-cyan",
                        isActive(item.href) ? "text-cyan" : "text-muted",
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="text-xs leading-snug text-dim transition-colors hoverable:group-hover/row:text-muted">
                      {BUILD_BLURB[item.href]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </details>

          {/* Learn ▾ — unchanged in mechanism; its contents follow `SPEC_SEQUENCE`. */}
          <details
            open={isOpen("learn")}
            onToggle={(event) =>
              setOpenAt(event.currentTarget.open ? { menu: "learn", at: pathname } : null)
            }
            className="group relative"
          >
            <summary
              className={cx(
                "flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] transition-colors xl:px-3 xl:text-sm [&::-webkit-details-marker]:hidden",
                LEARN.some((item) => isActive(item.href))
                  ? "text-cyan"
                  : "text-muted hoverable:hover:text-fg",
              )}
            >
              Learn
              <Caret />
            </summary>
            <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-line-bright bg-surface-2 py-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.85)]">
              {LEARN.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "block px-4 py-2 text-sm transition-colors hoverable:hover:bg-cyan/5 hoverable:hover:text-cyan",
                    isActive(item.href) ? "text-cyan" : "text-muted",
                  )}
                >
                  <span className="mr-3 font-mono text-[10px] text-dim">
                    {item.step ?? "└"}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          </details>

          <span aria-hidden className="mx-1 h-5 w-px bg-line xl:mx-2" />

          <ButtonLink href="/upload" variant="primary" size="sm">
            Publish
          </ButtonLink>

          {/* The account, last, where a reader already looks for identity.

              `ml-3` and not the row's `gap-1`: a 32px avatar sitting a hair off a filled
              primary button reads as part of the button, and the two are the least related
              controls in the row — one is the site's single ask, the other is who you are.
              The 12px is the `tight` tier of the vertical scale, spent horizontally. */}
          <details
            open={isOpen("account")}
            onToggle={(event) =>
              setOpenAt(event.currentTarget.open ? { menu: "account", at: pathname } : null)
            }
            className="group relative ml-3"
          >
            <summary
              className="flex cursor-pointer list-none items-center gap-1.5 rounded-md p-1 [&::-webkit-details-marker]:hidden"
              aria-label="Account menu"
            >
              <Avatar author={ACCOUNT.author} size="md" />
              <span className="text-dim">
                <Caret />
              </span>
            </summary>
            <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-line-bright bg-surface-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.85)]">
              <div className="flex items-center gap-3 border-b border-line p-4">
                <Avatar author={ACCOUNT.author} size="md" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-fg">
                    {ACCOUNT.author.displayName}
                  </span>
                  <span className="font-mono text-[11px] text-dim">
                    @{ACCOUNT.author.username}
                  </span>
                </span>
              </div>

              <div className="flex flex-col py-2">
                {ACCOUNT_MENU.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      "px-4 py-2 text-sm transition-colors hoverable:hover:bg-cyan/5 hoverable:hover:text-cyan",
                      /* Settings is the one row that is not under `/u/`, and the divider
                         above it is what the design uses to separate what you have made
                         from how the account behaves. */
                      item.href === "/settings" && "mt-2 border-t border-line pt-4",
                      isActive(item.href) ? "text-cyan" : "text-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              {/* No `Sign out` row. There is nothing to sign out of, and a menu item that
                  cannot do the one thing its verb names is worse than its absence — this
                  says why instead. */}
              <div className="flex flex-col gap-1.5 border-t border-line bg-surface-2/60 px-4 py-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber">
                  ◐ seeded
                </span>
                <p className="text-xs leading-relaxed text-muted">
                  There is no sign-in. This menu always names the handle{" "}
                  <span className="font-mono text-fg">lib/data/account.ts</span> seeds, and
                  downloads, reputation and the three community metrics behind it stay
                  seeded: there is no telemetry and no ballot.
                </p>
              </div>
            </div>
          </details>
        </nav>

        <ButtonLink href="/blueprints" variant="primary" size="sm" className="lg:hidden">
          Find one
        </ButtonLink>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors hoverable:hover:text-fg lg:hidden"
          onClick={() => setMobileAt(mobileOpen ? null : pathname)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <span className="text-xl" aria-hidden>{mobileOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100svh-4rem)] overflow-y-auto border-t border-line bg-void lg:hidden">
          <div className="container-page grid gap-1 py-3 sm:grid-cols-2">
            {MOBILE_GROUPS.map((group) => (
              <nav key={group.id} aria-label={group.title} className="py-2">
                <p className="px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                  {group.title}
                </p>
                {mobileLinks(group.id).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileAt(null)}
                    className={cx(
                      "block rounded-md px-3 py-2.5 text-sm",
                      isActive(item.href) ? "text-cyan" : "text-muted",
                    )}
                  >
                    {"step" in item && item.step !== undefined && (
                      <span className="mr-3 font-mono text-[10px] text-dim">{item.step}</span>
                    )}
                    {item.label}
                  </Link>
                ))}
                {/* Publish is the button in the wide row and the last row of this group on a
                    phone: there is no button beside the sheet to put it in. */}
                {group.id === "build" && (
                  <Link
                    href="/upload"
                    onClick={() => setMobileAt(null)}
                    className={cx(
                      "block rounded-md px-3 py-2.5 text-sm",
                      isActive("/upload") ? "text-cyan" : "text-cyan/90",
                    )}
                  >
                    Publish
                  </Link>
                )}
              </nav>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
