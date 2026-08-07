import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InstallTabs } from "@/components/mcp/InstallTabs";
import { SKILL_ROUTE } from "@/lib/skill";

/* ============================================================
   The other half of `/install`, and the half that does not run.
   ------------------------------------------------------------
   The author, 2026-08-07: "I prefer two pages, one for the skill
   and one for the mcp." This is the second, and it is the whole
   page rather than a panel under a rule, which changes one thing
   for the better and forces one piece of care.

   ── The better thing ──
   On `/install` the MCP preview sat under a heading that said "Not
   built yet" and covered two unrelated absences at once. A reader
   scanning for the tab strip had to read a rule about publishing
   to get there. Here the limit and the thing it qualifies are the
   same page, so the disclaimer can be the lead again — which is
   where it lived before the skill shipped, and where it reads most
   plainly.

   ── The care the split forces ──
   A dedicated route for an unbuilt capability is a page that looks,
   at a glance, exactly like a page for a built one: an h1, a
   command, a tab strip of client configs. It is now reachable
   from the header, from the landing's hero, and from `/skill`, and
   none of those entry points can carry the caveat for it. So this
   page states the limit three times, in the three registers a
   reader actually meets: the `<head>` description a search result
   and a shared link quote, the lead directly under the h1, and
   `InstallTabs`'s own `ComingSoonBadge` beside the snippet a
   reader might otherwise copy. `components/site/honesty.test.ts`
   pins all three.

   The lead sentence is UNCHANGED, character for character, from
   the one `/install` carried. It has now moved twice — page lead,
   then into the MCP panel when the skill took the top of the page,
   then back to being a lead here — and it has never been reworded,
   because a limit that gets rephrased every time it is relocated
   is a limit being negotiated down.
   ============================================================ */

export const metadata: Metadata = {
  title: "Connect via MCP",
  description:
    "Not built yet: this is what setup will look like once the registry has an MCP server to point a client at. What runs today is the blueprint-writing skill, on its own page.",
};

export default function McpPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Setup"
        title="Connect via MCP"
        lead="Not built yet: this is what setup will look like once the registry has an MCP server to point a client at."
      />

      <div className="mt-10 max-w-[var(--measure)]">
        <p className="text-[15px] leading-relaxed text-muted">
          An MCP server here will expose every published blueprint and node card as a
          resource an agent can read directly, from the same registry{" "}
          <Link
            href="/blueprints"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            the gallery
          </Link>{" "}
          already browses by hand. Nothing on this page reaches a server today, because
          there is no server and no package behind the command.
        </p>
      </div>

      {/* Held to the same `--measure` the prose above and below it uses, which is a change
          the split forced. `InstallTabs` reserves 189px of panel height whichever tab is
          open, so that switching from Claude Code's one-line command to Claude Desktop's
          eight-line JSON does not shove everything below it down the page mid-read. That
          reservation was invisible on `/install`, where the panel sat in a 342px grid
          column beside another panel and the tallest snippet nearly filled it.

          Full-width it is not invisible at all: the one-line tab leaves a void the width of
          the page under three words, which reads as content that failed to load rather than
          as space held for a taller sibling. The measure does not remove the reservation —
          it is doing real work and stays — it just stops the empty part being the largest
          thing on the route. The widest snippet line is about 40 monospace characters,
          comfortably inside 36rem, so nothing is being squeezed to buy this. */}
      <InstallTabs className="mt-10 max-w-[var(--measure)]" />

      <div className="mt-10 max-w-[var(--measure)]">
        <p className="text-[15px] leading-relaxed text-muted">
          The half of setup that does run is{" "}
          <Link
            href={SKILL_ROUTE}
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            the DarkPrint skill
          </Link>
          : one command, installed out of this repository over git, and an interview that
          leaves a blueprint on your disk. It writes files and reads nothing over the
          network, so it does not need what this page is waiting for.
        </p>
      </div>
    </div>
  );
}
