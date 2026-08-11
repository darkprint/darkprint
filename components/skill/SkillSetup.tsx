import Link from "next/link";
import { Logo } from "@/components/site/Logo";
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
      {/* `border-emerald/50` rather than `border-line`, on the author's instruction
          2026-08-07, and the colour is already argued: the landing's hero paints this exact
          string in emerald and `components/hero/Wordmark.tsx` records why — emerald is the
          engine's own register, "something the machine produces or accepts", extended there
          to mean a command that genuinely reaches it. This is the same command on the page
          that explains it, so the two surfaces now frame it the same way.

          50% is the rung, measured rather than picked: over `bg-void` it lands at 3.22:1,
          past the 3:1 floor WCAG 1.4.11 sets for a graphical object, where 40% would be
          2.43:1. The ink inside stays `text-fg` — the frame carries the register and the
          command stays maximally legible. */}
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-emerald/50 bg-void px-3 py-2 font-mono text-xs leading-relaxed text-fg">
        <code>
          <span className="select-none text-dim">$ </span>
          {command}
        </code>
      </pre>
      <CopyButton text={command} ariaLabel={ariaLabel} />
    </div>
  );
}

/**
 * A step's ordinal and its title, as one heading.
 *
 * It was two elements on a row: a `.label` carrying "01" beside an `h3`. The ordinal is in
 * the heading now, which is the hand-off's call and closes a real gap. The three panels are
 * this page's own top-level sections, so they are `h2` in the outline a screen reader walks
 * — and under the old shape the number was not in the heading at all, so that outline read
 * "Install it, Answer its questions, See what you end up holding" with nothing saying they
 * were a sequence. A reader looking at the page could see it from the numbers; a reader
 * listening to it could not.
 *
 * `PanelHeading` and not `SectionHeading`, so the level goes up and the size does not: four
 * things at 28px on one page is what a second `SectionHeading` here would produce.
 */
function StepHeading({ index, title }: { index: number; title: string }) {
  return (
    <PanelHeading as="h2">
      <span className="text-dim">{index}.</span> {title}
    </PanelHeading>
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
 * What the interview wants out of the reader, in the order it asks, one row per phase of
 * `skills/darkprint/SKILL.md`: the artefact, the gate, the nodes, the ports and the absent
 * edge, the cap on the cycle. Written from that document rather than from an idea of what a
 * blueprint interview ought to cover, and it is the part of this page most likely to go
 * stale, since the skill is read over git by a CLI this repository does not test.
 *
 * ── The labels are new, and they are the part to be careful with ──
 * Each sentence gained a two-word label in a fixed left column on 2026-08-11. As five
 * bullets these were five paragraphs of up to eighteen words with nothing to scan by; the
 * label is what lets a reader find the row they are being asked about rather than reading
 * all five to locate one.
 *
 * The staleness risk this docblock already carried now has a second half. A sentence that
 * drifts from `SKILL.md` describes the interview wrongly; a LABEL that drifts renames a
 * phase of it, and a caption that renames the thing it captions is worse than no caption.
 * Two of the five are that document's own words — `the nodes` is Phase 1's title exactly,
 * and `the check` is the noun Phase 0 uses for the gate. `the outcome` and `the loop` name
 * what a phase establishes rather than the phase.
 *
 * `the boundaries` is the one that is neither, and it is recorded here rather than left for
 * somebody to find: it covers Phase 2 (`the ports`) and Phase 3 (`the absent edge`), and
 * `SKILL.md` spends `boundary` on a release boundary and on the `spec`'s own sentences, never
 * on these. Phase 3 is the one that document calls "the centre of the grill and the reason
 * the format exists", so this label is where the most is folded away. It is the author's
 * copy and it ships as given; if the two phases ever need telling apart on this page, this
 * is the row that splits.
 *
 * Two sentences are also trimmed at the head, because the label now says that part: "what
 * you want done, and…" and "which node does each part of it" lost their opening clauses.
 */
const QUESTIONS: readonly { label: string; text: string }[] = [
  { label: "the outcome", text: "what exists at the end that does not exist now" },
  { label: "the check", text: "the command that exits non-zero when the work is wrong" },
  {
    label: "the nodes",
    text: "who does each part, and whether that is an agent, a tool or a person",
  },
  { label: "the boundaries", text: "what has to reach each node, and what must never" },
  {
    label: "the loop",
    text: "where it closes, and how many turns it may take before it stops",
  },
];

export function SkillSetup({ className }: { className?: string }) {
  return (
    <div className={cx("flex flex-col gap-5", className)}>
      {/* ---------- 01 · install ---------- */}
      <article className="panel flex min-w-0 flex-col gap-4 p-5">
        <StepHeading index={1} title="Install it" />

        {/* Centred and capped, with the sentence UNDER it, since 2026-08-08. The author:
            "align central the box containing npx skills@latest add … and place below the
            text The skills CLI reads this repository over git…".

            It was command left, sentence right, on the argument that an artefact should sit
            beside the sentence it is evidence for. That argument holds for a FILE LISTING
            and not for a command: the command is the thing a reader has come to run, and
            half a panel wide with a paragraph competing for the eye beside it, it read as
            one of two equal columns rather than as the page's one instruction. Centred at
            42rem it is the only thing on its line, and the sentence explaining it follows —
            which is also the order a reader uses them in.

            `max-w-2xl mx-auto` rather than the panel's full width: a 1152px input holding a
            44-character command is a field with 700px of nothing in it, which is the shape
            the author asked off `/build` for the same reason. */}
        <div className="flex flex-col gap-4">
          <div className="mx-auto w-full max-w-2xl">
            <CommandLine
              command={SKILL_INSTALL_COMMAND}
              ariaLabel="Copy the command that installs the DarkPrint skill"
            />
          </div>

          {/* What the command does, and the three things it does not do. The reader is one
              paste away from running it, so the account question is answered before it is
              asked rather than in the block under the rule. */}
          <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-muted">
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
        <StepHeading index={2} title="Answer its questions" />

        {/* One column, not two, and the file listing at the foot rather than beside the
            questions. The author: put "What it writes" at the bottom of the panel and "use
            full horizontal space" for the interview paragraph and its list.

            The two halves were never peers. What a reader is about to ANSWER is five
            questions of up to eighteen words each, and in a half-width column every one of
            them wrapped to three lines; what they are HOLDING at the end is three file
            names. Side by side, the longer half was cramped so the shorter half could have
            a column it did not need. Down the page, each takes the width it wants and they
            are in the order a reader meets them: the interview, then its output.

            `gap-6` between the two blocks rather than the panel's `gap-4`: the author asked
            for "some vertical space between the text in this section as it is very dense",
            and a five-item list under a paragraph under a heading is the densest block on
            this page. */}
        <div className="flex flex-col gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Tightened with the table below it, and it says one thing more than it did:
                "Five things". The count was carried by the bullets and nothing else, and a
                labelled table is scanned rather than read through, so the number a reader
                is committing to now has to be in the sentence. */}
            <p className="text-[15px] leading-relaxed text-muted">
              An interview, not a generator. Ask it for a blueprint and it asks you what the
              work is first, because a graph nobody described is a graph nobody can check.
              Five things, all of which you would have had to decide anyway.
            </p>

            <div className="flex min-w-0 flex-col gap-3">
              <span className="label">What it asks</span>
              {/* A hairline table, not a bullet list.
                  ------------------------------------------------------------
                  It was five `<li>` of up to eighteen words at `gap-2.5`, and the gap was
                  there because five sentences that long ARE five paragraphs. That is the
                  shape the label fixes rather than the spacing: a reader arriving at this
                  panel wants to know what they are about to be asked, and five paragraphs
                  answer that only by being read end to end. With a two-word label in a fixed
                  column the same five are scannable, and the sentence beside each is the
                  answer to "what does that mean" rather than the only way in.

                  Still a `<ul>`. It is five items of one kind and the label is the item's
                  own name, not a header over a column of values — `QUESTIONS` has no second
                  axis, so this is a list that happens to be aligned, and a `<table>` here
                  would promise a grid that is not there. The label and its sentence sit in
                  one `<li>` so a screen reader takes them together.

                  148px is the mock's column and it is a `sm:` and up rule: at 390 a fixed
                  148 leaves about 170 for a fifteen-word sentence, which wraps to four lines
                  beside a two-word label. Below `sm` the two stack, which the mock has no
                  width to show. */}
              <ul className="flex min-w-0 flex-col border-t border-line">
                {QUESTIONS.map((question) => (
                  <li
                    key={question.label}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 border-b border-line py-[13px] sm:grid-cols-[148px_minmax(0,1fr)] sm:gap-5"
                  >
                    <span className="font-mono text-[12px] leading-relaxed tracking-[0.06em] text-blueprint-ink">
                      {question.label}
                    </span>
                    <span className="min-w-0 text-[15px] leading-relaxed text-muted">
                      {question.text}
                    </span>
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
            {/* `What it writes` and its `FileListing` stood here, at the foot of the
                interview panel. They are step 3 now: the hand-off asks that step to be
                what a reader ends up holding, and the folder IS that. Naming the output
                inside the panel about the questions answered step 3 before a reader got
                there, and left the last step with nothing of its own to show but a
                pointer at another route. */}

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
        {/* "Keep the folder", not "See what you end up holding", since 2026-08-11. The old
            title described the reader's posture at the end of a tutorial; this one names the
            thing, which is what the other two headings do — "Install it", "Answer its
            questions". It is also four words against six in a heading a screen reader reads
            as one of three steps in a sequence, and the panel under it opens on the folder
            anyway. Nothing inside the step moved with it. */}
        <StepHeading index={3} title="Keep the folder" />

        {/* The panel centred, its sentence under it, since 2026-08-08. The author: "align
            central the left part with the right part … instead place the text Drop the
            folder on Upload blueprint … below the panel What that page does with it."

            The two were never a pair. `InOut` is four short mono rows and the paragraph is
            forty words, so side by side one column ran to two lines and the other to four,
            and the halves shared a top edge and nothing else. Down the page each takes the
            width it wants, and the order is the one a reader uses them in: what the page
            does, then how to hand it the folder.

            `max-w-2xl mx-auto` on both, which is what step 01 does with its command and its
            sentence — the same shape, one panel up, for the same reason. */}
        <div className="flex flex-col gap-5">
          {/* The folder, drawn as the mark that means one.
              ------------------------------------------------------------
              This is the one place on the site where the logo is also a diagram. The mark
              is a folder holding a graph, and the four rows beside it are the files that
              folder actually contains: the graph, one card per node, and the two documents.
              It is the same drawing as the header and the hero, at the 64 rung, with no
              glow and nothing added — a figure rather than a badge, which is the only way
              a brand mark earns a place inside a tutorial step.

              `aria-hidden`, because the list beside it says everything it says and a mark
              with an accessible name here would announce the brand in the middle of a
              procedure. The names come from `bundle-export.ts`, which is what writes them
              into every folder under `public/bundles/`, so the figure and the disk cannot
              disagree. */}
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
            <Logo size={192} className="shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
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
          </div>

          <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-2">
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

          <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-3">
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

            {/* A paragraph stood here about `/upload` resolving against `CORE_ONTOLOGY`, so
                a local term comes back unknown unless the folder carries the file defining
                it. The author asked it out on 2026-08-08: it is `/upload`'s to say, with the
                result in front of the reader, rather than a caveat here about a page they
                have not opened. */}
          </div>
        </div>

      </article>
    </div>
  );
}
