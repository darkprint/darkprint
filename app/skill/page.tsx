import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";
import { SkillSetup } from "@/components/skill/SkillSetup";
import { MCP_ROUTE } from "@/lib/mcp";

/* ============================================================
   Half of `/install`, and the half that runs.
   ------------------------------------------------------------
   The author, 2026-08-07: "I prefer two pages, one for the skill
   and one for the mcp." `/install` had carried both since the
   skill shipped, under a rule that grouped everything unbuilt
   below one line. That worked while the page was one thing with a
   caveat. It stopped working the moment the landing began sending
   readers at a specific half: a reader who clicks a chip labelled
   "Design your blueprint" and lands on a page whose second half is
   an MCP preview has been given someone else's answer to read
   past.

   So the rule that grouped them is gone, and the split does its
   job: this route is a working command and the one limit that
   command provokes, and `/mcp` is the unbuilt one, whole, with its
   own badge and its own h1. Neither page has to hedge about the
   other, and the honesty ledger gained a row rather than losing
   one — the MCP sentence did not soften on the way across, it
   moved to a page that is about it.

   ── What stays here rather than moving to `/mcp` ──
   The publishing panel. It is not a second unbuilt feature filed
   beside the first; it is the question THIS page's own output
   provokes. A reader who has just been handed a folder asks where
   to put it, and the answer is nowhere yet. That answer has to sit
   on the page that handed them the folder, which is why it did not
   travel with the MCP preview.

   ── No `.route-box` on this page, still ──
   The author, 2026-08-07: "We found such buttons also in the
   install mcp page. in this page you can just delete them." That
   ruling is unchanged, and `components/ui/OnwardRoutes.tsx`
   records it. Every onward move this page offers is an inline link
   inside the sentence that gives a reason for making it.
   ============================================================ */

export const metadata: Metadata = {
  title: "The DarkPrint skill",
  description:
    "One command puts a blueprint-writing skill in your own agent, and it interviews you into a folder: blueprint.dot, one card per node, README.md and AGENTS.md. Read it back on this site with nothing sent anywhere. Not built yet: accounts and publishing.",
};

export default function SkillPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Setup"
        title="The DarkPrint skill"
        lead="One command puts a blueprint-writing skill in your own agent, and it works today. It asks your agent to ask you: what the work is, who does which part of it, and what must never reach whom. What it leaves behind is a bundle the registry stores."
      />

      <SkillSetup className="mt-10" />

      {/* 40px above the rule and 40px under it: one block tier on each side, so this reads
          as a limit the tutorial above it provokes rather than as one more step in the
          sequence. A single panel now, not the pair this page used to print — the MCP half
          of that pair is its own route. */}
      <section className="mt-10 border-t border-line pt-10">
        <SectionHeading
          as="h2"
          eyebrow="Next"
          title="Not built yet"
          lead="One thing this page will eventually do and does not do now. Nothing below this line is a control, and none of it runs."
        />

        <article className="panel mt-10 flex min-w-0 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PanelHeading as="h3">Share what you wrote</PanelHeading>
            <ComingSoonBadge />
          </div>

          {/* One sentence covering all four unbuilt capabilities, rather than four lines
              each reading as a feature with a date on it. Pinned in
              `components/site/honesty.test.ts`: the skill's whole point is that a reader
              ends up holding a blueprint, and the question a reader holding one asks next
              is where to put it. The answer is nowhere, and the answer has to be on the
              page that just handed them the folder. */}
          <p className="text-[15px] leading-relaxed text-muted">
            Not built yet: an account of your own, a blueprint kept private while it is
            under construction, publishing one to the registry, and pushing a change to it
            straight from Claude Code as you work.
          </p>

          <p className="text-[15px] leading-relaxed text-muted">
            What is real is the folder on your disk and what you can do with it here. Read
            it back on{" "}
            <Link
              href="/upload"
              className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              Upload blueprint
            </Link>{" "}
            as often as you like, and compare it against the nine bundles in{" "}
            <Link
              href="/blueprints"
              className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              the gallery
            </Link>
            , which are the same files published the same way. Reading the registry from
            inside your agent instead is{" "}
            <Link
              href={MCP_ROUTE}
              className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              the other half of setup
            </Link>
            , and it is not built either.
          </p>
        </article>
      </section>
    </div>
  );
}
