"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "./Logo";
import { ButtonLink } from "@/components/ui/Button";
import { SPEC_SEQUENCE, SANDBOX } from "@/components/spec/sequence";
import { authorFor, profileHref } from "@/components/profile/author";
import type { AccountRecord } from "@/lib/server/accounts";
import { cx } from "@/lib/format";
import { SIGN_IN_PROVIDERS } from "@/components/auth/SignInButtons";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-42 is LIVE: GET /api/account behind the session cookie, GET /api/auth/github/login
// to start the OAuth dance, POST /api/auth/logout to end it. The planned shapes were
// `POST /api/auth/session`, `DELETE /api/auth/session` and `GET /api/auth/me`; none of the
// three was built under those names and all three are answered by the routes above.

/* ============================================================
   Five targets, not seven.

   The bar was Blueprints · Cards · Create · [Publish] · MCP · | · Learn ▾, and it had three
   problems a reader met before they met a page:

   1. **Create and Publish read as one intent.** Two of the seven targets differed by a verb
      and sat two items apart, and neither said which one you wanted.
   2. **MCP stood as a peer of the two content types.** A protocol the site does not
      implement had the same weight in the chrome as the registry's own shelves.
   3. **The ontology browser had no entry at all.** `/ontology` is one of the three things
      the registry holds, it has a browser and a profile tab, and the only route to it in
      the nav was the Learn menu's row for the *spec document* about it.

   So: three Browse rows for the three things the registry holds, a Build menu for the three
   ways to make one, Learn unchanged in mechanism, Publish as the button, and the account
   last, where a reader already looks for identity.

   ── Decision 1: `/ontology` is "Ontology", and the spec row takes its siblings' shape ──
   The browser and the spec document about it are two routes, and `nav.test.ts` forbids one
   label on two of them. That constraint was answered for a while by calling the browser
   "Vocabulary" — the words a blueprint and a card are allowed to use — and leaving
   "Ontology" to the format.

   The author overruled it on 2026-08-12: "adopt the term Ontology also for /ontology page …
   be consistent through all the website". One concept, one word, everywhere it appears —
   the route is `/ontology`, the file is `ontology/`, the field on a card is
   `ontology_version`, and the chrome was the only surface calling it something else.

   So the collision is resolved at the other end, and the fix was available all along:
   `/spec/ontology` becomes "Ontology file (YAML)", which is the shape its two siblings in
   the same menu already have — "Blueprint file (DOT)", "Node card (YAML)". Those pages'
   own `h1`s differ from their nav rows in exactly this way ("The node card, in YAML"), so
   nothing on the spec page moves. Neither route moves either.
   ============================================================ */

export const NAV = [
  { href: "/blueprints", label: "Blueprints", group: "browse" },
  { href: "/nodes", label: "Cards", group: "browse" },
  /* The third thing the registry holds. It had no entry in the chrome at all until this
     pass, and was called "Vocabulary" until 2026-08-12; see decision 1 in the header
     docblock for why the word changed and what it cost the spec row below. */
  { href: "/ontology", label: "Ontology", group: "browse" },
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
  /* `/upload` stood here as `group: "action"` (the Publish button) until the owner took
     publishing out of the chrome (2026-08-25): a release is cut from the surfaces that
     own one — the profile shelf's New bundle flow, a draft's own landing, and /skill's
     accounts row — not from a global button. The route stays exempt in `nav.test.ts`'s
     ELSEWHERE for that reason. */
  { href: SANDBOX.href, label: SANDBOX.nav, group: "docs" },
  { href: "/what-a-blueprint-is", label: "What a blueprint is", group: "docs" },
  { href: "/spec/topology", label: "Topology file (DOT)", group: "docs" },
  { href: "/spec/card", label: "Node card (YAML)", group: "docs" },
  /* "Ontology file (YAML)" and not "Ontology": the browser one group up took that word on
     the author's instruction, and this row moves to the shape its two siblings above it
     already have rather than the browser wearing a synonym. See decision 1. */
  { href: "/spec/ontology", label: "Ontology file (YAML)", group: "docs" },
  { href: "/reading-the-radar", label: "How a blueprint is graded", group: "docs" },
  /* `/towards-a-dark-factory` stood here as `group: "guides"` and was deleted 2026-08-11.
     `guides` is not one of the groups this file renders (`browse`, `build`, `docs`;
     `action` left with the Publish button) nor one of `MOBILE_GROUPS`, so the row drew
     nothing on any surface: it was a
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
 * Publishing is deliberately not among them. It was the button beside this menu until the
 * owner took it out of the chrome entirely (2026-08-25) — a release is cut from the pages
 * that own one — and a
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
 * top-level route instead of sitting in an exemption.
 *
 * ── Why the four profile rows name a ROUTE and not a reader (D-262-06) ──
 * These hrefs used to interpolate the seeded handle, which made the whole table a function
 * of `lib/data/account.ts`. There is a session now, so the handle is per-request — and
 * `nav.test.ts:47` imports this array at MODULE SCOPE and reads `.href` off every row,
 * which is exactly what a per-request value cannot be. So the row carries the route
 * pattern, the way `app/u/[username]` is spelled on disk, and `accountMenuHref` below
 * substitutes the reader at render. The table stays static, the test stays unchanged, and
 * no row claims to know who is reading.
 *
 * `Sign out` is not a row here because it is not a route: it is a `POST` to
 * `/api/auth/logout`, and it renders as a control under the rows rather than beside them.
 */
export const ACCOUNT_MENU = [
  /* "Your blueprints" left at T280: the profile index IS the bundle shelf now, so its row
     and this one had one destination — /u/[username]/blueprints survives only as a 308.
     "Your cards" and "Saved" left on the owner's instruction (2026-08-25): the profile's
     own tab strip is where those lists live, and the menu keeps the two destinations that
     are not tabs of the page the first row already opens. */
  { href: "/u/[username]", segment: "", label: "Your profile" },
  { href: "/settings", segment: undefined, label: "Settings" },
] as const;

/**
 * One account-menu row's destination for one reader, or `undefined` when there is nowhere
 * to send them.
 *
 * `/settings` has no `segment` and is the same URL for everybody, so it passes through. The
 * four profile rows go through `profileHref`, which answers `undefined` for an account with
 * no handle yet — the state D-263-09 established is reachable by T050 AC1. A row that
 * cannot resolve is not rendered as a dead link; the panel omits it and says why.
 */
function accountMenuHref(
  item: (typeof ACCOUNT_MENU)[number],
  handle: string | null,
): string | undefined {
  return item.segment === undefined ? item.href : profileHref(handle, item.segment);
}

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
  account: AccountRecord | null | undefined,
): readonly { href: string; label: string; step?: string }[] {
  if (group === "learn") return LEARN;
  if (group === "you") {
    /* The whole account state, not just the handle, because a null handle means two
       different things here: nobody is signed in, or somebody is and has not chosen one
       yet. The first gets a sign-in and the second gets Settings, which is where the
       choosing happens — collapsing them would offer a signed-in reader a second sign-in
       and hide the one row that would fix their account. */
    if (account === undefined || account === null) {
      /* Both providers, from the one list that also feeds `/welcome` and `/settings`
         (`components/auth/SignInButtons.tsx`). A single row naming GitHub is how this
         menu keeps offering one provider after a second one ships. */
      return SIGN_IN_PROVIDERS.map((provider) => ({ href: provider.href, label: provider.label }));
    }
    return ACCOUNT_MENU.flatMap((item) => {
      const href = accountMenuHref(item, account.author.handle);
      return href === undefined ? [] : [{ href, label: item.label }];
    });
  }
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

  /**
   * Who is reading, read from the browser rather than from the server.
   *
   * `undefined` while the answer is outstanding, `null` for a signed-out reader, the record
   * for a signed-in one. Three states rather than two because the first paint genuinely
   * knows nothing: rendering the signed-out control during it would flash `Sign in` at
   * somebody who is signed in on every page they open.
   *
   * ── Why a fetch, and not `readSession()` ──
   * This component is in the ROOT layout. A server-side session read here is a request-time
   * API on every route in the repository, which would opt T260's browse shelves out of the
   * static rendering B-15 keeps them in — the chrome would decide the caching policy for
   * pages it has nothing to do with. So the header pays one request for itself and the
   * pages stay static. `components/profile/session.ts` carries the other half of this
   * decision, for the routes whose CONTENT is per-reader.
   *
   * `/api/account` rather than `/api/auth/session`: the menu needs a display name and a hue
   * as well as a handle, and `SessionPayload` is `{ accountId, handle }`. One request that
   * answers both is one request. A 401 is the ordinary signed-out answer, not an error.
   */
  const [account, setAccount] = useState<AccountRecord | null | undefined>(undefined);

  useEffect(() => {
    const cancelled = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/account", { signal: cancelled.signal });
        setAccount(response.ok ? ((await response.json()) as AccountRecord) : null);
      } catch {
        /* An aborted or failed request is not evidence of being signed out, but the menu
           has to draw something. Signed-out is the safe wrong answer: it offers a sign-in
           that works, where a signed-in menu drawn on no evidence offers profile links
           built from a handle this component does not have. */
        if (!cancelled.signal.aborted) setAccount(null);
      }
    })();
    return () => cancelled.abort();
  }, []);

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

          {/* The account, last, where a reader already looks for identity. The Publish
              button that stood between the divider and the avatar left with the NAV row
              above — publishing belongs to the pages that own a release now. */}
          {account === undefined ? (
            /* The outstanding answer. A dimmed disc the same size as the avatar, so the row
               does not reflow when the account arrives, and `aria-hidden` because there is
               nothing here for a screen reader to act on yet. */
            <span
              aria-hidden
              className="ml-3 inline-flex h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-2"
            />
          ) : account === null ? (
            /* `/welcome` rather than a provider directly: it is the one surface that offers
               the choice, and hard-coding GitHub here would make the header disagree with
               the menu beside it about how many ways in there are. */
            <ButtonLink href="/welcome" variant="outline" size="sm" className="ml-3">
              Sign in
            </ButtonLink>
          ) : (
            <details
              open={isOpen("account")}
              onToggle={(event) =>
                setOpenAt(event.currentTarget.open ? { menu: "account", at: pathname } : null)
              }
              className="group relative ml-3"
            >
              <summary
                className="flex cursor-pointer list-none items-center gap-2 rounded-md p-1 [&::-webkit-details-marker]:hidden"
                aria-label="Account menu"
              >
                <Avatar author={authorFor(account.author)} size="md" />
                {/* The name beside the icon, on the owner's instruction (2026-08-25).
                    The handle when one exists (it is the identity URLs use), the display
                    name for the T050 AC1 account that has not chosen one yet. */}
                <span className="max-w-[14ch] truncate text-sm text-muted">
                  {account.author.handle ?? authorFor(account.author).displayName}
                </span>
                <span className="text-dim">
                  <Caret />
                </span>
              </summary>
              <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-line-bright bg-surface-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.85)]">
                <div className="flex items-center gap-3 border-b border-line p-4">
                  <Avatar author={authorFor(account.author)} size="md" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-fg">
                      {authorFor(account.author).displayName}
                    </span>
                    {/* The handle line is omitted rather than printed as `@null` for an
                        account that has not chosen one yet — a state T050 AC1 makes legal.
                        Settings is where it gets chosen, and that row is still below. */}
                    {account.author.handle !== null && (
                      <span className="font-mono text-[11px] text-dim">
                        @{account.author.handle}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex flex-col py-2">
                  {ACCOUNT_MENU.map((item) => {
                    const href = accountMenuHref(item, account.author.handle);
                    if (href === undefined) return null;
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        className={cx(
                          "px-4 py-2 text-sm transition-colors hoverable:hover:bg-cyan/5 hoverable:hover:text-cyan",
                          /* Settings is the one row that is not under `/u/`, and the divider
                             above it is what the design uses to separate what you have made
                             from how the account behaves. */
                          item.href === "/settings" && "mt-2 border-t border-line pt-4",
                          isActive(href) ? "text-cyan" : "text-muted",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                {/* The four profile rows resolve to nothing until a handle exists, so the
                    menu would otherwise be a single Settings row with no explanation. */}
                {account.author.handle === null && (
                  <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-muted">
                    Your profile lives at a handle, and this account does not have one yet.
                    Choose one in <span className="text-fg">Settings</span> and these rows
                    appear.
                  </p>
                )}

                {/* Sign out is a `POST`, so it is a form and not a menu row: a `GET` link
                    that ends a session is reachable by a prefetch and by anything that
                    walks links. It was absent entirely until there was a session to end,
                    and the panel that stood here saying so has come off with it (D-78). */}
                <form action="/api/auth/logout" method="post" className="border-t border-line">
                  <button
                    type="submit"
                    className="w-full px-4 py-3 text-left text-sm text-muted transition-colors hoverable:hover:bg-cyan/5 hoverable:hover:text-cyan"
                  >
                    Sign out
                  </button>
                </form>

                {/* The `✓ counted` strip stood here from T280 until the owner took it off
                    (2026-08-25). Its claims were true and stay true elsewhere: the two
                    residual absences (no mail, no instrumented runs) are stated on
                    /settings and /reading-the-radar, the surfaces that own them — a menu
                    is chrome, not a ledger. */}
              </div>
            </details>
          )}
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
                {mobileLinks(group.id, account).map((item) => (
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
                {/* The Publish row that closed this group left with the wide row's button
                    (owner, 2026-08-25) — publishing is reached from the pages that own a
                    release, not from the chrome. */}
              </nav>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
