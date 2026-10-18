import Link from "next/link";

import { cx } from "@/lib/format";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   The registry, and what an account adds to it.

   The beats above show how a blueprint is written, so a reader who
   skims them leaves thinking the site is a course. This one says the
   registry is open to read and what signing in is for, with every
   claim read off the code: the guards in `lib/server/auth/guard.ts`,
   the read ceilings in `lib/server/limits/config.ts`, and the
   anonymous MCP tier in `lib/server/mcp/http.ts`.

   Static on purpose. `/` is prerendered for every visitor, so the
   per-reader sign-in stays in the hero's account line.
   ============================================================ */

const LINK =
  "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan";

function Column({
  title,
  dot,
  children,
}: {
  title: string;
  /** The register's colour: blueprint blue for reading, violet for where a person acts. */
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col gap-4 p-5 sm:p-6">
      <PanelHeading className="flex items-center gap-2.5">
        <span aria-hidden className={cx("h-[7px] w-[7px] shrink-0 rounded-full", dot)} />
        {title}
      </PanelHeading>
      <ul className="flex list-disc flex-col gap-3 ps-5 text-[15px] leading-relaxed text-muted marker:text-dim">
        {children}
      </ul>
    </div>
  );
}

export function SectionRegistry() {
  return (
    <section id="registry" className="scroll-mt-24 bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          title="When you need an account"
          lead="Anyone can read the registry. An account is for publishing to it."
          align="center"
          className="mx-auto"
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Column title="Without an account" dot="bg-blueprint-line">
            <li>
              Search the{" "}
              <Link href="/blueprints" className={LINK}>
                public blueprints
              </Link>{" "}
              and{" "}
              <Link href="/nodes" className={LINK}>
                node cards
              </Link>
              , and download or clone any of them.
            </li>
            <li>
              Your agent can do the same over{" "}
              <Link href="/mcp" className={LINK}>
                MCP
              </Link>
              , with no key.
            </li>
          </Column>

          <Column title="With an account" dot="bg-violet">
            <li>Publish blueprints and cards, each one public or private.</li>
            <li>Fork a public blueprint, or star it to keep it on a shelf only you see.</li>
            <li>
              A key from{" "}
              <Link href="/settings" className={LINK}>
                Settings
              </Link>{" "}
              lets MCP fetch your private blueprints and raises the read limit tenfold.
            </li>
            <li>A key with write scope publishes from your terminal.</li>
          </Column>
        </div>
      </div>
    </section>
  );
}
