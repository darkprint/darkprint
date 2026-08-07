import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";
import { InstallTabs } from "@/components/install/InstallTabs";
import { SkillSetup } from "@/components/install/SkillSetup";

/* ============================================================
   The route that stopped being a preview of nothing.
   ------------------------------------------------------------
   Until now every word on `/install` described an MCP server that
   does not exist: a tab strip of four client configs, a lead
   sentence saying so, and 150px of dead space under a one-line
   command. It was the emptiest page on the site and nothing on it
   was built.

   The DarkPrint skill is the first thing here a reader can run, so
   the page is reordered around beat 4's own rule on the landing:
   what ships leads, what does not is grouped once, under one rule,
   and labelled once. `SkillSetup` is the top half. The MCP preview
   is the bottom half, unchanged in substance, and it keeps the two
   things that qualify it: `InstallTabs`'s own `ComingSoonBadge` and
   the lead sentence pinned in `components/site/honesty.test.ts`.

   ── The sentence that moved, and why the move is the risky edit ──
   "Not built yet: this is what setup will look like once the
   registry has an MCP server to point a client at." used to be the
   page's `lead`, directly under the `h1`, when the whole page was
   the MCP preview. It is unchanged, character for character, and it
   now sits inside the MCP panel beside the thing it qualifies.

   That is not cosmetic. Its ledger entry is `where: "open"`, and
   the ledger renders the WHOLE page, so the assertion passes with
   the sentence anywhere on it. Left at the top it would have sat
   above a working install command and read as a qualification of
   THAT, which is the one failure mode a green test cannot see here.
   The rule the ledger's own header states is the one that decides
   it: a sentence qualifying something printed in the open has to be
   in the open with the thing it qualifies.

   ── metadata.description, rewritten rather than left ──
   Its old ledger entry pinned "not built yet: nothing here runs",
   which is now false in the other direction: something here runs.
   The claim is rewritten in the same commit, with the reason in the
   message, which is exactly what the ledger's header licenses. The
   description still carries a limit, because a search result and a
   shared link quote this string and nothing else.

   ── No `.route-box` on this page, still ──
   The author, 2026-08-07: "We found such buttons also in the
   install mcp page. in this page you can just delete them." That
   ruling is unchanged, and `components/ui/OnwardRoutes.tsx` records
   it. Every onward move this page offers is an inline link inside
   the sentence that gives a reason for making it.
   ============================================================ */

export const metadata: Metadata = {
  title: "Install",
  description:
    "Install the DarkPrint skill and have your agent interview you into a blueprint, then read it back on this site with nothing sent anywhere. Not built yet: accounts, publishing, and an MCP server to point a client at.",
};

export default function InstallPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Setup"
        title="Install"
        lead="One command puts a blueprint-writing skill in your own agent, and it works today. Pointing a client at the registry over MCP is the other half of this page, and that half is not built."
      />

      {/* ---------- what ships ---------- */}
      <section className="mt-10">
        <SectionHeading
          as="h2"
          eyebrow="Works today"
          title="One command, then an interview"
          lead="The DarkPrint skill asks your agent to ask you: what the work is, who does which part of it, and what must never reach whom. What it leaves behind is a folder in the shape the registry stores."
        />
        <SkillSetup className="mt-10" />
      </section>

      {/* ---------- the rule, and everything under it ----------
          A border and a heading rather than the landing's rule-plus-`.label`, because at
          page scale this is a section of the document outline and a `.label` is not a
          heading level (`app/globals.css` writes that rule down). The words are beat 4's
          own, so a reader who has met the pattern on the landing meets the same one here.
          40px above the rule and 40px under it: one block tier on each side, so the pair
          below reads as a group with a shared state rather than as two more panels in the
          tutorial's sequence. */}
      <section className="mt-10 border-t border-line pt-10">
        <SectionHeading
          as="h2"
          eyebrow="Next"
          title="Not built yet"
          lead="Two things this page will eventually do and does not do now. Nothing below this line is a control, and none of it runs."
        />

        {/* `items-start`, so neither panel is stretched to the other's height. The MCP
            panel is the taller of the two by a long way: `InstallTabs` reserves 189px for
            the tallest client's snippet whichever tab is open, which is the right call
            inside that component and would otherwise print 280px of empty box under the
            publishing panel's last sentence. Two boxes of honest, different heights read
            as two facts; one box with a void in it reads as content that failed to load. */}
        <div className="mt-10 grid items-start gap-5 md:grid-cols-2">
          {/* ---------- publishing, accounts, and the live push ---------- */}
          <article className="panel flex min-w-0 flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PanelHeading as="h3">Share what you wrote</PanelHeading>
              <ComingSoonBadge />
            </div>

            {/* One sentence covering all four of the unbuilt capabilities, rather than four
                lines each reading as a feature with a date on it. Pinned in
                `components/site/honesty.test.ts`: the skill's whole point is that a reader
                ends up holding a blueprint, and the question a reader holding one asks next
                is where to put it. The answer is nowhere, and the answer has to be on the
                page that just handed them the folder. */}
            <p className="text-[15px] leading-relaxed text-muted">
              Not built yet: an account of your own, a blueprint kept private while it is
              under construction, publishing one to the registry, and pushing a change to
              it straight from Claude Code as you work.
            </p>

            <p className="text-[15px] leading-relaxed text-muted">
              What is real is the folder on your disk and what you can do with it here.
              Read it back on{" "}
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
              , which are the same files published the same way.
            </p>
          </article>

          {/* ---------- the MCP preview, whole ---------- */}
          <article className="panel flex min-w-0 flex-col gap-4 p-5">
            <PanelHeading as="h3">Point a client at the registry</PanelHeading>

            {/* Verbatim, and pinned. See this file's header for why it is here and not at
                the top of the page where it used to be. */}
            <p className="text-[15px] leading-relaxed text-muted">
              Not built yet: this is what setup will look like once the registry has an MCP
              server to point a client at.
            </p>

            <InstallTabs />

            <p className="text-sm leading-relaxed text-muted">
              An MCP server here will expose every published blueprint and node card as a
              resource an agent can read directly, from the same registry{" "}
              <Link
                href="/blueprints"
                className="underline decoration-line-bright underline-offset-4 transition-colors hover:text-fg"
              >
                the gallery
              </Link>{" "}
              already browses by hand.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
