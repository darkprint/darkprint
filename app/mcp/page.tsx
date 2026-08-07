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

      {/* Full width rather than `--measure`, on the author's instruction 2026-08-07. Both
          paragraphs on this route run the whole column. */}
      <div className="mt-10 flex flex-col gap-4">
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

        {/* ── What the server is actually for ──
            The author, 2026-08-07: "I want to clear the scope of the MCP that is that a
            claude code session can look in the RAG that I'll implement that embededs
            blueprints and node, and claude code, can access and leverage published
            blueprint and nodes that can be helpful for the task the user asked to solve
            to claude code."

            That is a materially different claim from the one this page made before, and
            the difference is worth stating rather than smoothing over. "Expose every
            blueprint as a resource" describes a directory a client can list and read by
            name — useful only to somebody who already knows which blueprint they want.
            What the author is describing is retrieval: the session starts from the task,
            not from a blueprint name, and the registry answers with the graphs and cards
            that bear on it. The reader arriving here is holding a task, not a slug, so
            the second is the sentence that tells them what this is for.

            Tense is the whole discipline in this paragraph. The RAG does not exist and
            the author said so in the same breath ("the RAG that I'll implement"), so every
            verb here is future or conditional and the page's lead has already said the
            server is not built. This is the one place on the site where a description of
            unbuilt machinery is detailed enough to read like a changelog entry, which is
            exactly why it sits under that lead and above a badge rather than on its own. */}
        <p className="text-[15px] leading-relaxed text-muted">
          The point is retrieval, not a file listing. The registry will be embedded: every
          published blueprint and every node card, indexed so that a Claude Code session
          can search it by the work in front of it rather than by name. You describe the
          task; the server returns the graphs and cards that bear on it, and the session
          reads them as context and reuses what fits: a topology someone has already
          argued for, a card whose{" "}
          <code className="font-mono text-[13px] text-copper-line">cannot</code> already
          names the thing you were about to get wrong. Neither the index nor the search
          exists yet.
        </p>
      </div>

      {/* Held to the same `--measure` the prose above and below it uses, and centred in the
          column on the author's instruction 2026-08-07.

          `InstallTabs` reserves 189px of panel height whichever tab is open, so switching
          from Claude Code's one-line command to Claude Desktop's eight-line JSON does not
          shove everything below it down the page mid-read. That reservation was invisible
          on `/install`, where the panel sat in a 342px grid column beside another panel and
          the tallest snippet nearly filled it. Full width it was not invisible at all: a
          void the width of the page under three words reads as content that failed to load
          rather than as space held for a taller sibling. The measure does not remove the
          reservation — it is doing real work and stays — it stops the empty part being the
          largest thing on the route. The widest snippet line is about 40 monospace
          characters, comfortably inside 36rem, so nothing is squeezed to buy it.

          `mx-auto` is what the measure was missing. A 576px box hard against the left edge
          of a 1200px column reads as a block that failed to reach its width, because every
          other element on the route does reach it; the same box centred reads as a panel
          sized to its contents. Measured before and after: 576 in 1200, left edge 64 → 344.
          The tab row and the snippet stay left-aligned inside it, because centred code is
          unreadable and a tablist that recentres as labels change is a moving target. */}
      <InstallTabs className="mx-auto mt-10 max-w-[var(--measure)]" />

      <div className="mt-10">
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
