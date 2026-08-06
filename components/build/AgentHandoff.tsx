import { CORE_PHASE_IDS } from "@/lib/core";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
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

export function AgentHandoff({ className }: { className?: string }) {
  return (
    <div className={className}>
      <h3 className="font-display text-lg font-semibold text-fg">
        Have your agent write one for your own goal
      </h3>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
        The worked example only ever builds software, which is the one starter it
        demonstrates. For a different goal, hand the brief below to Claude Code, Gemini or
        Codex. It asks for the same things in the same order, starting with what each node
        must never receive.
      </p>

      <SourcePanel
        source={agentBrief()}
        language="text"
        title="Brief for your agent"
        downloadName="darkprint-brief.txt"
        className="mt-4 max-w-3xl"
      />

      {/* Doc 2 §0.4. The brief is prose handed to a model, and the site cannot check what
          a model does with it. Saying where the check is belongs beside the thing that
          needs checking, not on the page it links to. */}
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-dim">
        Nothing here validates what your agent writes back. Drop the result on{" "}
        <a
          href="/upload"
          className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
        >
          /upload
        </a>{" "}
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
