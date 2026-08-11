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
  /* "Create", because this route is now the one the header's "Create" points at.
     `components/site/nav.test.ts` holds a page's `h1` and its `<title>` to the label that
     sends a reader to it, and the label arrived here when `/build` split.

     The description keeps "Not built yet: accounts and publishing" verbatim and in the
     open: `components/site/honesty.test.ts` pins that string to this surface, and a retitle
     is not a reason for it to move.

     Renamed from "Create" on 2026-08-11, on the author's instruction, in all three places
     one route's name lives: this `<title>`, the `h1` below, and the `NAV` row that sends a
     reader here. "Create" named the verb; "Assisted Design" names what actually happens on
     the other side of the command, which is your own agent interviewing you into a bundle
     rather than you writing one. */
  title: "Assisted Design",
  description:
    "Start from your goal: one command puts a blueprint-writing skill in your own agent, and it interviews you into a folder of blueprint.dot, one card per node, README.md and AGENTS.md. Read it back on this site with nothing sent anywhere. Not built yet: accounts and publishing.",
};

export default function SkillPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Setup"
        title="Assisted Design"
        /* Two sentences, not three, since 2026-08-11. The middle one — "It asks your agent
           to ask you: what the work is, who does which part of it, and what must never reach
           whom" — was a summary of step 2's list, and step 2's list sits 200px below it and
           says the same thing five times more precisely. A lead that previews a table the
           reader is about to reach is spending the top of the page on the second-best
           statement of it.

           What the two survivors carry is the pair a stranger needs before scrolling: that
           this is one command into an agent they already have, and that what comes back is
           text on their disk rather than an account somewhere. */
        lead="One command puts a blueprint-writing skill in the agent you already use. It interviews you about the work, then writes what you decided as a folder of text the registry can store."
      />

      {/* `CreateEntry` stood here, above the steps: a goal field, a textarea that wrote a
          brief in the browser, and a copy of the install command. The author asked it off
          the route on 2026-08-11 and the component is deleted rather than left mounted
          nowhere.

          Nothing a reader can run is lost with it. Its command was `SKILL_INSTALL_COMMAND`,
          which is step 1 below and always was, so the page printed the same line twice with
          a form between the copies; and the brief it composed was a prompt for the skill
          the same step installs, written before the reader had it. What the page has
          instead is one spine, install first, which is the order every other setup page on
          this site uses.

          `#create-entry-title` went with it. It was a live anchor `components/spec/
          sequence.ts` listed under `/build` before the split, and nothing has pointed at it
          since; grep before assuming that is still true. */}
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
          lead="Two things this page will eventually do and does not do now. Nothing below this line is a control, and none of it runs."
        />

        {/* Two panels, since 2026-08-08. The section's lead says "one thing"; it says two
            now, and the second is the one the author asked for. */}
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <article className="panel flex min-w-0 flex-col gap-4 p-5">
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

        {/* ---------- the second unbuilt half: the skill reading the registry ----------
            The author, 2026-08-08: the skill should also be able to "use the mcp to look
            for node cards already prepared by others from which draw inspiration for
            drawing their own blueprint … in this way the assisted design is grounded to
            already defined cards or even subgraphs of blueprints that can be used."

            It belongs on this page and under this rule, and both halves of that matter.

            On this page, because it changes what the INTERVIEW is. The skill asks a reader
            what the work is and writes a graph from the answers; with the registry behind
            it, the same question can be answered against cards somebody has already written
            and scored, so a reader picks a published node rather than describing one from
            nothing. That is a different tool, not a faster one, and the page that installs
            the tool is where the difference is worth stating.

            Under this rule, because none of it exists. `/mcp` is a design and this is a use
            of it, so it is one unbuilt thing depending on another. `ComingSoonBadge` says
            so in the site's own amber, which `app/globals.css` reserves for exactly this
            claim, and the sentence says it again in words rather than leaving the badge to
            carry it alone — the same rule the panel beside it follows.

            No number, no date, and no list of what would be reachable. `components/site/
            honesty.test.ts` holds this page to describing what is not built without
            promising when; a paragraph enumerating a catalogue nobody can query yet would
            be a specification wearing a badge. */}
        <article className="panel flex min-w-0 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PanelHeading as="h3">Design against what exists</PanelHeading>
            <ComingSoonBadge />
          </div>

          <p className="text-[15px] leading-relaxed text-muted">
            The interview draws on nothing but your answers today. Pointed at the registry
            over{" "}
            <Link
              href={MCP_ROUTE}
              className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              MCP
            </Link>
            , it could search the cards other people have already written and scored, and
            offer you one instead of asking you to describe a node from nothing: a published
            card to pin, or a run of nodes out of a blueprint that already does part of what
            you are describing.
          </p>

          <p className="text-[15px] leading-relaxed text-muted">
            That is what would make assisted design grounded rather than generative. It
            needs the server, and the server is not built, so today the skill writes what
            you tell it and the comparing is yours to do in{" "}
            <Link
              href="/blueprints"
              className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              the gallery
            </Link>{" "}
            and{" "}
            <Link
              href="/nodes"
              className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              the cards
            </Link>
            .
          </p>
        </article>
        </div>
      </section>
    </div>
  );
}
