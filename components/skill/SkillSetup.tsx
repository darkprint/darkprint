import Link from "next/link";
import { CopyButton } from "@/components/ui/CopyButton";
import { PanelHeading } from "@/components/ui/SectionHeading";
import { cx } from "@/lib/format";
import { SKILL_INSTALL_COMMAND } from "@/lib/skill";
import {
  BUNDLE_AGENTS,
  BUNDLE_CARDS_DIR,
  BUNDLE_README,
  TOPOLOGY_DOT,
} from "@/lib/content/bundle-export";

/* ============================================================
   The one thing on `/skill` that works.

   Everything else this route has ever carried is a preview of a
   server nobody has written. This is the half a reader can run
   today: one command from the `skills` CLI, an interview their own
   agent conducts, and a folder that `/upload` reads back with the
   real engine. It sits ABOVE the rule the page draws, and the MCP
   preview sits below it, which is beat 4's own order on the
   landing — what ships leads, what does not is grouped once and
   labelled once.

   ── Three panels, and why they are numbered ──
   The tutorial is a sequence and the reader is meant to be at one
   of three places in it, so the steps carry an ordinal. That is the
   only thing on this page that does: the two panels under the rule
   are a pair of unbuilt capabilities, not steps two and three of
   anything, and numbering them would say a reader is partway
   through something they cannot start.

   ── The naming hazard, resolved in copy rather than by avoiding it ──
   `skill` is ALREADY a word in this ontology and it means something
   narrower: `lib/core/card/schema.ts` defines `skill?: string` as
   "where the skill document defining this agent's behaviour lives",
   and `/what-a-blueprint-is#the-words` prints, in the open, "the
   engine reads nothing at the other end of this path, so no skill
   document travels in the download". The site's own doctrine puts a
   skill one level BELOW the graph: a skill hands one agent a
   capability, the blueprint decides who is wired to whom.

   What installs here inverts that. It is a skill that WRITES the
   graph. So the phrase is never "the skill" on its own anywhere in
   this file — it is "the DarkPrint skill" — and step 02 spends one
   sentence saying outright that this is not a node card's `skill:`
   field. A reader who meets both words on one site inside ten
   minutes and is left to reconcile them will reconcile them wrong.

   ── The other reconciliation: `factory.dot` ──
   `/build`'s download exit leads on `factory.dot` and prints
   `attractor run factory.dot`. The DarkPrint skill deliberately
   does not emit that file: darkprint's exporter compiles it from a
   blueprint (`lib/content/bundle-export.ts`), and a second writer
   of one file is two files that drift. Without the sentence in step
   02 saying so, a reader who installs the skill, gets a folder with
   no `factory.dot` in it and compares that folder to the one
   `/build` hands over concludes the skill is broken.

   ── What this file may not claim ──
   The skill's behaviour lives outside this repository's test suite.
   Nothing in `npx tsc --noEmit` and nothing in the 3500 tests can
   fail on the day its output stops matching the listing in step 02,
   so every sentence here is written at the width the author can
   actually keep: what it asks about, what shape it leaves behind,
   and where to check the result. No claim that the result validates
   cleanly, because `/upload` resolves against the core vocabulary
   and a bundle naming a local term comes back with that term
   unknown. Step 03 says so.
   ============================================================ */

/**
 * Exactly what a reader runs. One line, unwrapped, so the paste survives a terminal that
 * eats a backslash continuation, which is the same rule `components/blueprint/CloneMenu.tsx`
 * follows for the longest command on the site.
 *
 * Re-exported, not re-typed. This file and `lib/skill.ts` were written in the same session
 * by two hands and each declared its own literal under this same name, so the landing's
 * hero chip and `/build`'s second exit read one string and this page read another that
 * merely happened to match. Nothing could have caught them diverging: every surface tests
 * against whichever constant it imports, so both halves of a split would have stayed
 * green while a reader retyped a command that fails in somebody else's shell. The name is
 * kept here because `SkillSetup.test.ts` imports it from this module and pins the literal
 * bytes, which is the assertion that now guards the single definition.
 */
export { SKILL_INSTALL_COMMAND };

/**
 * A command and the control that copies it.
 *
 * `CopyButton` rather than a fifth hand-rolled clipboard block: its docblock records the
 * four that existed before it and why they behave subtly differently from each other. The
 * command is real text inside a `<pre>`, so it is readable, selectable and copyable by
 * hand with no JavaScript at all; the button is the convenience, never the only route.
 */
function CommandLine({ command, ariaLabel }: { command: string; ariaLabel: string }) {
  return (
    /* `min-w-0` on this row is load-bearing and not cosmetic. It is a grid item inside
       step 01, a grid item's default `min-width: auto` is its min-content width, and the
       min-content of this row is the whole command: 46 characters of 12px mono is 331px,
       plus the copy button and the panel's own padding. Measured at 390x844 before it was
       added, the document was 423px wide against a 390 viewport, and `body { overflow-x:
       hidden }` in `app/globals.css` propagates to the viewport, so those 33px were
       unreachable rather than scrollable: the end of the repository name was simply off
       the phone, on the one line of this page a reader has to copy exactly. The `<pre>`'s
       own `overflow-x-auto` could never fire while its grid-item ancestor refused to
       shrink. This is the same defect, and the same cure, as the landing's beat 4. */
    <div className="flex min-w-0 items-start gap-2">
      {/* Wrapped, not scrolled, which is the opposite of `CloneMenu`'s ruling and for the
          reason that ruling names. That command is a `curl` with a brace expansion in it,
          462 characters at its longest, and a line break pasted into a terminal that eats
          a continuation breaks it. This one is 46 characters of plain `npx` with no
          continuation anywhere: `white-space: pre-wrap` puts a visual break between two
          words and the clipboard still receives one line, because the string has no
          newline in it. At 390 the alternative was a box showing "add Brotherho" with the
          rest of the repository name behind a scroll nobody looks for, on the one string
          this page exists to hand over. `break-words` and not `break-all`: the longest
          token here is 23 characters and fits, so the break lands between words. */}
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-line bg-void px-3 py-2 font-mono text-xs leading-relaxed text-fg">
        <code>
          <span className="select-none text-dim">$ </span>
          {command}
        </code>
      </pre>
      <CopyButton text={command} ariaLabel={ariaLabel} />
    </div>
  );
}

/** A step's ordinal and its title on one row. The ordinal is a `.label`, never a heading. */
function StepHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="label shrink-0">{index}</span>
      <PanelHeading as="h3">{title}</PanelHeading>
    </div>
  );
}

/**
 * A file listing, in the register `components/home/SectionLifecycle.tsx` uses for the
 * folder a reader takes away. Two columns of mono: the path, and what is in it.
 *
 * Not `truncate` here, unlike that one. Its lines sit in a 342px grid track on a phone and
 * had to ellipsis; these sit in a panel that owns the full column, and a path a reader is
 * about to look for on their own disk is the wrong string to cut short. `break-all` on the
 * path instead, so the longest of them wraps rather than widening the page.
 */
function FileListing({ lines }: { lines: readonly (readonly [string, string])[] }) {
  return (
    <ul className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-3">
      {lines.map(([path, what]) => (
        <li key={path} className="flex flex-col gap-0.5">
          <span className="break-all font-mono text-xs text-fg">{path}</span>
          <span className="font-mono text-[11px] leading-relaxed text-dim">{what}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The same box with the key inline, for a figure whose left-hand column is a direction
 * rather than a path. `components/home/SectionLifecycle.tsx`'s `Artefact` is where this
 * register comes from, and beat 4's own Upload panel is where a reader will have met it.
 *
 * It carries what step 03's prose deliberately stops short of listing. Saying "it draws
 * the graph, the scorecard and every diagnostic" in a sentence AND printing the same three
 * things in a box beside it is one description of one thing twice, which is the
 * duplication this site's spec names; the sentence says what happens and where, and the
 * figure says what goes in and what comes back.
 */
function InOut({ lines }: { lines: readonly (readonly [string, string])[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
      {lines.map(([key, value]) => (
        <div
          key={key + value}
          className="flex items-baseline gap-3 font-mono text-[11px] leading-[1.9]"
        >
          <span className="w-6 shrink-0 text-dim">{key}</span>
          <span className="min-w-0 text-fg">{value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * What the interview wants out of the reader, in the order it asks, one line per phase of
 * `skills/darkprint/SKILL.md`: the artefact, the gate, the nodes, the ports and the absent
 * edge, the cap on the cycle. Written from that document rather than from an idea of what
 * a blueprint interview ought to cover, and it is the part of this page most likely to go
 * stale, since the skill is read over git by a CLI this repository does not test.
 */
const QUESTIONS: readonly string[] = [
  "what you want done, and what exists at the end that does not exist now",
  "the command that exits non-zero when the work is wrong",
  "which node does each part of it, and whether that node is an agent, a tool or a person",
  "what has to reach each node, and what must never reach it",
  "where the loop closes, and how many turns it may take before it stops",
];

export function SkillSetup({ className }: { className?: string }) {
  return (
    <div className={cx("flex flex-col gap-5", className)}>
      {/* ---------- 01 · install ---------- */}
      <article className="panel flex min-w-0 flex-col gap-4 p-5">
        <StepHeading index="01" title="Install it" />

        {/* Command left, what it does right. Every panel in this tutorial is the same two
            columns for the same reason `components/home/SectionLifecycle.tsx` gives its
            Download panel: the artefact is the evidence for the sentence beside it, and a
            reader should be able to check one against the other without scrolling between
            them. It is also what stops a 1152px panel from carrying a 576px paragraph and
            600px of nothing, which is the shape a reviewer measured on `/build` and asked
            off that page. */}
        <div className="grid gap-5 md:grid-cols-2">
          <CommandLine
            command={SKILL_INSTALL_COMMAND}
            ariaLabel="Copy the command that installs the DarkPrint skill"
          />

          {/* What the command does, and the three things it does not do. The reader is one
              paste away from running it, so the account question is answered before it is
              asked rather than in the block under the rule. */}
          <p className="text-[15px] leading-relaxed text-muted">
            The <code className="font-mono text-fg">skills</code>{" "}
            CLI reads this repository over git and writes the DarkPrint skill into your
            agent&rsquo;s skills directory. There is no account, no key and nothing fetched
            from this site: what lands is a document your agent reads, on the machine you
            ran the command on.
          </p>
        </div>
      </article>

      {/* ---------- 02 · the interview ---------- */}
      <article className="panel flex min-w-0 flex-col gap-4 p-5">
        <StepHeading index="02" title="Answer its questions" />

        {/* Asks left, writes right, and the two clarifications under the listing they are
            about. The two halves are the whole of what a reader needs before they start:
            what they are going to be answering, and what they are holding when the
            answering stops. */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-[15px] leading-relaxed text-muted">
              It is an interview and not a generator. Ask it for a blueprint and it starts
              by asking you what the work is, because a graph nobody described is a graph
              nobody can check. Expect to decide the things you would have had to decide
              anyway.
            </p>

            <div className="flex min-w-0 flex-col gap-2">
              <span className="label">What it asks</span>
              <ul className="flex flex-col gap-1.5">
                {QUESTIONS.map((question) => (
                  <li
                    key={question}
                    className="flex gap-2 text-[15px] leading-relaxed text-muted"
                  >
                    <span className="shrink-0 text-cyan" aria-hidden>
                      ·
                    </span>
                    <span className="min-w-0">{question}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* The refusal, said before a reader starts rather than discovered halfway
                through. `SKILL.md` phase 0: "If they cannot name it, stop here and say so.
                Do not draw a graph." A tutorial that promises a folder at the end of every
                interview would be describing a different skill from the one that installs. */}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <span className="label">What it writes</span>
              <FileListing
                lines={[
                  [TOPOLOGY_DOT, "the graph: who is wired to whom"],
                  [`${BUNDLE_CARDS_DIR}/<node>.yaml`, "one card per node the graph pins"],
                  [
                    `${BUNDLE_README} · ${BUNDLE_AGENTS}`,
                    "one for you, one for the next agent",
                  ],
                ]}
              />
            </div>

            {/* Three paragraphs stood here and under "What it asks", and the author took
                all three out on 2026-08-07: the one saying the interview can decline to
                draw a graph, the one reconciling this folder with `/build`'s `factory.dot`
                download, and the one telling the two senses of the word "skill" apart.

                Each was doing real work and the loss is worth naming rather than leaving
                for somebody to rediscover:

                  · `/build`'s download exit leads on `factory.dot` and prints
                    `attractor run factory.dot`. A reader who compares the two folders now
                    finds a file in one and not the other with nothing on this page saying
                    why. `lib/skill.ts`'s header still carries the reasoning.
                  · `lib/core/card/schema.ts` defines `skill?: string` as a per-node
                    document, and `/what-a-blueprint-is#the-words` prints in the open that
                    the engine reads nothing at the other end of that path. This page
                    installs a thing that WRITES the graph, which is the opposite level of
                    the same word. The qualifier "the DarkPrint skill" is still used
                    everywhere on this page, which is what keeps the two apart now.

                The author's framing is the reason: this page is about guiding an author to
                a blueprint that satisfies the DOT semantics, the card vocabulary and the
                ontology. Reconciling footnotes about a file the skill does not write, and
                about a homonym, are notes to a maintainer rather than to that author. */}
          </div>
        </div>
      </article>

      {/* ---------- 03 · read it back ---------- */}
      <article className="panel flex min-w-0 flex-col gap-4 p-5">
        <StepHeading index="03" title="See what it wrote" />

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="label">What that page does with it</span>
            <InOut
              lines={[
                ["in", `${TOPOLOGY_DOT} · ${BUNDLE_CARDS_DIR}/*.yaml`],
                ["out", "the graph, drawn"],
                ["out", "the scorecard, computed"],
                ["out", "every diagnostic the resolver raised"],
              ]}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-[15px] leading-relaxed text-muted">
              Drop the folder on{" "}
              <Link
                href="/upload"
                className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
              >
                Upload blueprint
              </Link>
              . The same engine that scored every bundle in the gallery is compiled into
              that page and runs in your own browser tab. Nothing is uploaded and nothing
              is sent anywhere.
            </p>

            {/* No claim that a skill-written bundle comes back clean. `/upload` resolves
                against `CORE_ONTOLOGY`, so a local term is an unknown term there and the
                reading is computed without it. The site already says this; it now covers a
                case the site itself creates. */}
            <p className="text-[13px] leading-relaxed text-dim">
              That page resolves against the core vocabulary. A card naming a term of your
              own comes back with that term unknown, and a reading computed without it,
              unless the folder also carries the file that defines it.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
