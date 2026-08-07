import Link from "next/link";

import { CORE_PHASE_IDS } from "@/lib/core";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { SourcePanel } from "@/components/ui/SourcePanel";

/* ============================================================
   The second exit: a brief for the reader's own agent.

   The author, 2026-08-04: "the build objective is to show to a
   user how to create a blueprint and therefore showing a
   breakdown such that the user can understand and use it but also
   give such indications to its claude code (or gemini or codex)
   and build a blueprint of them."

   The worked example teaches the shape on one starter and hands
   back that example as files. Three choices over one starter
   cannot reach a goal that is not "build software", and most
   readers arrive with a different one. This is the generalisation:
   the same vocabulary and the same order of decisions, addressed
   to the agent that will do the writing.

   ── Two exits, not one followed by a footnote (task 5) ──
   This component used to be introduced, in this very docblock, as "the other half of the
   last step": read only after the folder, on the far side of the control that left step 8.
   It is not that any more. Take the worked example as files, or take this brief and get an
   agent to write the blueprint a different goal needs — neither is the fallback for the
   other, and nothing below assumes it is being read second, or read at all after
   `DownloadStep`. `agentBrief()` did not change; what changed is what this file says about
   its own place on the page.

   ── Fix round 1: the title dropped its leading "Or" ──
   The heading below used to open "Or have your agent write one for your own goal" — task 6's
   review caught what that word does read next to a `DownloadStep` that, at the time, had no
   title of its own: "Or" reads as the second half of a pair, and a reader meets the word
   before they have met anything for it to be paired against. `DownloadStep` now carries its
   own peer title ("This starter, as files"), so the two headings are siblings read left to
   right rather than a stated option followed by an alternative — which is what "co-equal"
   in the design spec's own words actually requires. `agentBrief()` and everything below the
   heading are unchanged; only the four characters "Or " came out.

   ── The mirror of a bundle's `AGENTS.md` ──
   `lib/content/bundle-export.ts` writes one of those into every
   download: *here is a pattern, adapt it into your code*. This is
   the same document run backwards: *here is how to describe a
   pattern you want, so it can be written*. Same vocabulary, same
   section order, and prohibitions first in both, for the same
   reason — a connection nobody drew looks exactly like a
   connection nobody thought of, so it is the part an agent is
   likeliest to get wrong and the part that has to be asked for
   explicitly.

   ── The phases are read, not typed ──
   `CORE_PHASE_IDS` is doc 3 §2's closed list. A brief that spelled
   them out by hand would be a second copy of the vocabulary the
   validator checks against, free to drift from it the day a phase
   is added.

   ── What this is not ──
   It is prose handed to a model, and nothing here can check what
   comes back. So the brief ends by telling the agent to say what
   it left out, and the paragraph under it points at `/upload`,
   which runs the real validator in the reader's own tab. Neither
   is decoration: a page that emits instructions and implies the
   output is blessed would be making the one promise the site has
   no way to keep.

   ── The DarkPrint skill lives INSIDE this exit ──
   `lib/skill.ts` ships a skill that writes a blueprint, installed with one command out of
   this repository over git. Three placements were possible on this route and two of them
   are wrong.

   NOT a third exit. "You leave with one of two things" is pinned character-for-character
   in `BuildWorkspace.test.ts`, spec §2.3 named two co-equal exits, and both of the
   existing ones hand over BYTES: a folder, or a brief. A skill is a tool you install so
   that you never need the starter again. It is not a thing a reader leaves this page
   carrying, and making it a third column would have ranked it above the two the page is
   built on while saying, in the heading directly above it, that there are two.

   NOT a replacement for the brief either, which was the tempting move. `agent-brief.test.ts`
   holds `agentBrief()` against `CORE_PHASE_IDS`, so the brief cannot drift from the
   vocabulary the validator checks; nothing equivalent can hold a skill an external CLI
   reads over git (`lib/skill.ts` records that cost in full). The brief also needs no
   install and works in any client that takes an instruction, where the skills CLI is one
   ecosystem. Deleting it would remove both the client-agnostic path and the only
   vocabulary-pinned one, to gain nothing the block below does not already give.

   So: one heading, two ways under it. The skill leads because it needs no copy-paste and
   survives the tab closing; the brief follows because it is the one that always works.
   Neither gets a box, a border or a heading level of its own — a `.label` tags a claim and
   does not open a level of the document outline (`app/globals.css`), which is precisely
   what keeps this from reading as two more exits. The whole block sits in the ~660px of
   empty column this exit has carried under the brief since `lg:items-stretch` made the
   short box match `DownloadStep`'s 1322px, so it fills a hole rather than lengthening the
   page. Measured after: `/build` is 4268px at 1440, which is the number the investigation
   measured before any of this existed. The block cost the route no height at all, because
   every pixel of it landed in space that was already there.

   ── Two sentences here are doing honesty work, not description ──
   1. The skill emits the registry shape and deliberately no `factory.dot`, while
      `DownloadStep`, in the other half of the same grid row, leads on `factory.dot` and on
      `attractor run factory.dot`. A reader who installs it, gets a folder with no
      `factory.dot` and compares that to the download on this same page concludes the thing
      is broken. The reconciling sentence is on this surface, and not only on `/skill`,
      because this is the one surface where both folder shapes are visible at once.
   2. The `/upload` paragraph's subject widened from the brief to both ways. It qualifies
      whatever an agent wrote, and after this pass two things on this screen produce that.
      It stays last, immediately before the badge line, so it is read against both.

   The `ComingSoonBadge` line at the foot did not move and did not change a word: it is
   pinned in `components/site/honesty.test.ts` under the surface "/build · agent-brief
   exit", `open`, and the registry-over-MCP call it describes is as unbuilt as it was.
   ============================================================ */

/**
 * The brief, as text.
 *
 * Exported so `build-brief.test.ts` can hold it to the vocabulary rather than to a
 * snapshot: what matters is that every phase it names is a real one and that the
 * prohibition step is present, not the wording around them.
 */
export function agentBrief(): string {
  return [
    "Write me a DarkPrint blueprint for:  <describe your goal in one sentence>",
    "",
    "A blueprint is a directed graph of automations, plus one YAML card per node.",
    "Follow this order, and ask me before guessing at anything.",
    "",
    "1. Say the goal back to me in one sentence. If it needs more than one, it is",
    "   probably two blueprints.",
    "",
    "2. Break it into nodes. One node is one job that an agent or a tool does end to",
    "   end. Where they fit the work, use these phases:",
    `     ${CORE_PHASE_IDS.join(", ")}`,
    "   Not every blueprint needs all five, and a node need not declare any.",
    "",
    "3. For each node, write a card:",
    "     id, name, type, phase, action, spec",
    "     model             the model it runs on, when it should be pinned",
    "     tools, mcp        what it may reach",
    "     inputs, outputs   the name and data type of every port",
    "     cannot            what must never reach it        <- decide this first",
    "     requires_human    true wherever a person acts",
    "",
    "4. Write the graph in DOT. One edge per handoff, and every node carrying",
    '   card="<id>@<version>".',
    "",
    "5. Leave out every edge that would carry something a node said it cannot",
    "   receive. An edge you do not draw is as much a part of the design as one you",
    "   do. This is the step to get right.",
    "",
    "Then tell me which edges you deliberately did not draw, and why. If a node needs",
    "something no edge provides, say where it comes from instead of wiring one in.",
  ].join("\n");
}

/** Cyan is "you can click this" (`app/globals.css`), spelled once for the two links this
    exit now carries rather than twice down the file. */
const linkCls =
  "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

export function AgentHandoff({ className }: { className?: string }) {
  return (
    <div className={className}>
      <h3 className="font-display text-lg font-semibold text-fg">
        Have your agent write one for your own goal
      </h3>
      {/* The heading is verbatim and pinned (`BuildWorkspace.test.ts`). The paragraph under
          it is not, and it changed: it used to name the brief as the only way through,
          which stopped being true the day the skill shipped. It now says what both ways
          have in common, so neither is introduced as the other's alternative. */}
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
        The worked example only ever builds software, which is the one starter it
        demonstrates. Any other goal gets written by an agent, and there are two ways to
        hand one the same decisions in the same order, both of them starting with what each
        node must never receive.
      </p>

      {/* ---------- way 1: the skill ---------- */}
      <div className="mt-5 flex flex-col gap-2">
        {/* Never "the skill" on its own. `lib/core/card/schema.ts` already spends that word
            on a node card's `skill:` field, a behaviour document that sits one level BELOW
            the graph, and `/what-a-blueprint-is#the-words` prints that definition in the
            open. This one writes the graph. `/skill` spends a sentence on the collision;
            here the qualified name carries it, and `BuildWorkspace.test.ts` fails the build
            if any copy on this route says "the skill" on its own. */}
        <p className="label">The DarkPrint skill · installs today</p>

        {/* The same code-plus-copy row `DownloadPanel` uses for `attractor run
            factory.dot`, because this is the other string on `/build` a reader retypes into
            a terminal and getting it subtly wrong fails in their shell, not here.

            One deliberate difference from that row: it wraps where the other truncates.
            `attractor run factory.dot` is 25 characters and fits a phone; this is 44, so
            `truncate` there is an edge case and here it would be the normal rendering,
            hiding the exact thing the row exists to show from every reader on a phone.
            `break-words` only breaks a word that cannot fit on its own, and the longest
            here is `Brotherhood94/darkprint` at roughly 150px against a ~250px box, so in
            practice the break falls at a space. */}
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-words rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg">
            {SKILL_INSTALL_COMMAND}
          </code>
          <CopyButton
            text={SKILL_INSTALL_COMMAND}
            ariaLabel="Copy the DarkPrint skill install command"
          />
        </div>

        {/* Sixty words before the link, and each of the three sentences is here for a
            different reason: the
            first says what the command reaches (a repository, not a server), the second is
            the output a reader will compare against the folder on the other half of this
            row, and the third is the one that stops that comparison reading as a fault.
            Everything else is `/skill`'s, one link away. */}
        <p className="text-[13px] leading-relaxed text-muted">
          The skills CLI reads it out of DarkPrint&rsquo;s own repository, over git. Tell it
          what you want built and it writes what the registry stores:{" "}
          <code className="font-mono text-fg">blueprint.dot</code>, one YAML card per node,
          a <code className="font-mono text-fg">README.md</code> and an{" "}
          <code className="font-mono text-fg">AGENTS.md</code>. Not{" "}
          <code className="font-mono text-fg">factory.dot</code>, which DarkPrint&rsquo;s
          exporter compiles from those two on the way out, so a folder it writes will not
          carry one.{" "}
          <Link href={SKILL_ROUTE} className={linkCls}>
            What it writes, and what to say to it
          </Link>
          .
        </p>
      </div>

      {/* ---------- way 2: the brief ---------- */}
      <div className="mt-5 flex flex-col gap-2">
        <p className="label">The brief · any agent, no install</p>
        <p className="text-[13px] leading-relaxed text-muted">
          The same order of decisions as prose you paste in, for Claude Code, Gemini, Codex
          or anything else that takes an instruction. Nothing to install, and no particular
          CLI to be inside.
        </p>

        <SourcePanel
          source={agentBrief()}
          language="text"
          title="Brief for your agent"
          downloadName="darkprint-brief.txt"
          className="max-w-3xl"
        />
      </div>

      {/* Doc 2 §0.4. Both ways above hand prose to a model, and the site cannot check what
          a model does with either. Saying where the check is belongs beside the things that
          need checking, not on the page it links to.

          The subject widened with this pass: it read "what your agent writes back" under a
          single `SourcePanel`, where "your agent" could only mean the one holding the
          brief. Two things on this screen now produce a blueprint written by a model, so
          the subject is the agent rather than either route to it, and the sentence stays
          last, where it is read against both. */}
      <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-dim">
        Nothing here validates what an agent writes back, whichever of the two you take.
        Drop the result on{" "}
        <Link href="/upload" className={linkCls}>
          /upload
        </Link>{" "}
        and the real validator runs on it in your own tab, the same one that read every
        blueprint in the gallery.
      </p>

      {/* Task 5, step 4: the same signpost `DownloadStep` carries, verbatim — the two
          exits are meant to be read independently, so a reader who only ever opens this
          one still meets the limit rather than inferring the registry call already exists.
          Pinned together with its twin in `components/site/honesty.test.ts`. */}
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] leading-relaxed text-dim">
        <ComingSoonBadge />
        Not built yet: your agent querying the registry over MCP for the blueprint that
        best fits a goal like this one.
      </p>
    </div>
  );
}
