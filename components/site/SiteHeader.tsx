"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { SPEC_SEQUENCE } from "@/components/spec/sequence";
import { cx } from "@/lib/format";

export const NAV = [
  { href: "/blueprints", label: "Blueprints", group: "explore" },
  { href: "/nodes", label: "Cards", group: "explore" },
  /* "Create" points at `/skill`, not `/build`, since 2026-08-10.

     `/build` split: the authoring half — install the skill, name your goal, take the brief
     — moved onto `/skill`, which was already the page about the skill and was reachable
     from the footer alone. What is left at `/build` is the worked sandbox, and the author
     asked that one "only among the Learn pages", where it now sits as stop 04 under its own
     name. So this row follows the content rather than the path. */
  { href: "/skill", label: "Create", group: "work" },
  { href: "/upload", label: "Publish", group: "work" },
  { href: "/mcp", label: "MCP", group: "work" },
  { href: "/what-a-blueprint-is", label: "What a blueprint is", group: "docs" },
  { href: "/spec/topology", label: "Blueprint file (DOT)", group: "docs" },
  { href: "/spec/card", label: "Node card (YAML)", group: "docs" },
  { href: "/spec/ontology", label: "Ontology", group: "docs" },
  { href: "/reading-the-radar", label: "How a blueprint is graded", group: "docs" },
  { href: "/towards-a-dark-factory", label: "Towards a Dark Factory", group: "guides" },
] as const;

const PRIMARY = NAV.filter((item) => item.group === "explore" || item.group === "work");
export const LEARN = SPEC_SEQUENCE.map((page) => ({
  href: page.href,
  label: page.nav,
  step: page.step,
}));

const MOBILE_GROUPS = [
  { id: "explore", title: "Explore" },
  { id: "work", title: "Create and use" },
  { id: "learn", title: "Learn" },
] as const;

function mobileLinks(group: (typeof MOBILE_GROUPS)[number]["id"]) {
  return group === "learn" ? LEARN : NAV.filter((item) => item.group === group);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [docsAt, setDocsAt] = useState<string | null>(null);
  const [mobileAt, setMobileAt] = useState<string | null>(null);
  const docsOpen = docsAt === pathname;
  const mobileOpen = mobileAt === pathname;
  const docsRef = useRef<HTMLDetailsElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!docsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!docsRef.current?.contains(event.target as Node)) setDocsAt(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDocsAt(null);
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [docsOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-void/88 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3">
        <Link href="/" className="mr-auto font-display text-lg font-semibold tracking-tight">
          <span className="text-fg">Dark</span>
          <span className="text-cyan">Print</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {PRIMARY.map((item) => {
            const action = item.href === "/upload";
            return action ? (
              <ButtonLink key={item.href} href={item.href} variant="outline" size="sm">
                {item.label}
              </ButtonLink>
            ) : (
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
            );
          })}

          <span aria-hidden className="mx-1 h-5 w-px bg-line xl:mx-2" />

          <details
            ref={docsRef}
            open={docsOpen}
            onToggle={(event) => setDocsAt(event.currentTarget.open ? pathname : null)}
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
            </summary>
            <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-line-bright bg-surface-2 py-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.85)]">
              {LEARN.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "block px-4 py-2 text-sm transition-colors",
                    isActive(item.href) ? "text-cyan" : "text-muted hoverable:hover:text-fg",
                  )}
                >
                  <span className="mr-3 font-mono text-[10px] text-dim">{item.step}</span>
                  {item.label}
                </Link>
              ))}
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
                    {"step" in item && (
                      <span className="mr-3 font-mono text-[10px] text-dim">{item.step}</span>
                    )}
                    {item.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
