import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { CopyButton } from "@/components/ui/CopyButton";
import { PanelHeading } from "@/components/ui/SectionHeading";
import { cx } from "@/lib/format";
import { SKILL_INSTALL_COMMAND } from "@/lib/skill";
import {
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
      {/* The emerald moved from the frame to the ink, 2026-08-11, and the swap is the mock's.
          ------------------------------------------------------------
          It was `border-emerald/50` around `text-fg`, on the author's instruction
          2026-08-07, and that instruction's reasoning is intact and now satisfied better:
          emerald is the engine's own register — `components/hero/Wordmark.tsx` argues it as
          "something the machine produces or accepts" — and the landing's hero paints this
          exact string in it. What was arguable was WHICH element carried the colour. A 50%
          emerald hairline at 3.22:1 is a frame a reader has to notice to read the register
          off; the command set in emerald on `--color-surface-2` IS the register, at roughly
          10:1, and it is the same treatment the hero gives the same string.

          So the frame drops back to `--color-line`, which is what every other box on this
          page is drawn in, and the box stops competing with the one line inside it. The
          `$ ` prompt goes with it: the mock has none, and a `select-none` glyph saying
          "this is a shell" is doing work the emerald and the panel already do. */}
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 px-3.5 py-3 font-mono text-xs leading-relaxed text-emerald">
        <code>{command}</code>
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
    /* One tone and one size, both the mock's, since 2026-08-11.
       ------------------------------------------------------------
       The ordinal was `text-dim`, which made sense while each step was a `.panel`: the
       number was a marker ON a card and the card was the thing. Off the chrome, the numeral
       is the only thing carrying the sequence and dimming it is dimming the sequence. It
       reads as one heading now, which is what it is.

       `size="2xl"` is the mock's 24px against `PanelHeading`'s own 20, and it is a PROP
       rather than a `className`: passing `text-2xl` through `className` loses to the
       component's `text-xl`, because both are font-size utilities at equal specificity and
       the winner is whichever Tailwind emits later, not whichever the caller wrote last.
       That was tried first and measured at 20px in the browser. Every other caller of
       `PanelHeading` omits the prop and is unchanged. */
    <PanelHeading as="h2" size="2xl">
      {index}. {title}
    </PanelHeading>
  );
}

/**
 * A file listing, in the register `components/home/SectionLifecycle.tsx` uses for the
 * folder a reader takes away. Two columns of mono: the path, and what is in it.
 *
 * Across rather than stacked, and unboxed, since 2026-08-11. It was a bordered `<ul>` with
 * each description under its own path, which is the right shape inside a 342px grid track
 * and the wrong one here: step 3 is a card of its own now and this list sits in the wider
 * half of it, so the three descriptions line up in a column a reader reads down instead of
 * interleaving with the paths. The box went because the card around it is the box.
 *
 * Not `truncate`, unlike the lifecycle's. A path a reader is about to look for on their own
 * disk is the wrong string to cut short, so the column is fixed at the mock's 176px from
 * `sm` up and the pair stacks below it, where 176 plus a description does not fit.
 */
function FileListing({ lines }: { lines: readonly (readonly [string, string])[] }) {
  return (
    <ul className="flex min-w-0 flex-col gap-2.5">
      {lines.map(([path, what]) => (
        <li
          key={path}
          className="flex min-w-0 flex-col gap-0.5 font-mono text-xs leading-relaxed sm:flex-row sm:items-baseline sm:gap-4"
        >
          <span className="break-all text-fg sm:w-44 sm:shrink-0">{path}</span>
          <span className="min-w-0 text-muted">{what}</span>
        </li>
      ))}
    </ul>
  );
}

/* `InOut` stood here and step 3 mounted it as "What that page does with it": four mono rows
   reading `in blueprint.dot · cards/*.yaml`, `out the graph, drawn`, `out the scorecard,
   computed`, `out every diagnostic the resolver raised`.

   It is out with the 2026-08-11 density pass, on the mock, and the argument it was carrying
   is worth recording rather than leaving for somebody to rediscover. It existed because the
   prose deliberately stops short of listing those three outputs — saying "it draws the
   graph, the scorecard and every diagnostic" in a sentence AND printing the same three in a
   box beside it is one description of one thing twice, so the sentence said what happens and
   the figure said what goes in and what comes back.

   What is lost is the enumeration, and nothing else: step 3 still names the folder's four
   files, still links `/upload`, and still says what that page does not do with them. The
   enumeration is `/upload`'s own to make, with the result in front of the reader — which is
   the same reasoning that took the `CORE_ONTOLOGY` caveat off this page on 2026-08-08. */

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
  { label: "the boundaries", text: "what has to reach each node, and what must never reach it" },
  {
    label: "the loop",
    text: "where it closes, and how many turns it may take before it stops",
  },
];

export function SkillSetup({ className }: { className?: string }) {
  return (
    /* An `<ol>` of three bare steps, not three `.panel` articles, since 2026-08-11.
       ------------------------------------------------------------
       The panels were doing two jobs and only one of them was real. They grouped each step's
       parts, which the `gap` inside a step already does, and they drew three cards down a
       page whose subject is one sequence — so a reader met three boxes and had to infer the
       order from the numerals inside them. Off the chrome, the ordinals and the 44px between
       steps carry the sequence on their own, and the two things on the page that ARE boxes,
       the command and the folder, stop being boxes inside boxes.

       `<ol>` rather than the old `<div>` of `<article>`s, which is what the numbering was
       always claiming: a screen reader now gets the list semantics the "1." "2." "3." were
       drawing by hand, and `StepHeading` keeps the visible ordinal because the mock does. */
    <ol className={cx("flex flex-col gap-11", className)}>
      {/* ---------- 01 · install ---------- */}
      <li className="flex min-w-0 flex-col gap-4">
        <StepHeading index={1} title="Install it" />

        {/* Command left, sentence right, which reverses the 2026-08-08 centring.
            ------------------------------------------------------------
            The author asked then for the box centred with the text below it, and the
            reasoning was that the command is the page's one instruction and should not read
            as one of two equal columns. That argument was against the paragraph it had
            BESIDE it: fifty-five words about the CLI, git and where the document lands, which
            genuinely did compete.

            The paragraph is fifteen words now and says the two things a reader needs before
            pasting, so the competition is gone and the centring costs what it was buying —
            at `max-w-2xl` centred, a 44-character command left 700px of empty panel beside
            it and pushed step 2 a screen further down. Side by side at `md`, each half is
            the size of its content. Below `md` they stack, command first, which is the
            2026-08-08 order restored for the width that asked for it. */}
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <CommandLine
            command={SKILL_INSTALL_COMMAND}
            ariaLabel="Copy the command that installs the DarkPrint skill"
          />

          {/* What the command does and the two things it does not do, in fifteen words.
              It was fifty-five: the `skills` CLI reading this repository over git, the
              agent's skills directory, no account, no key, nothing fetched, and where the
              document lands. Every clause was true and only two were load-bearing for a
              reader one paste from running it — nothing leaves the machine, and no account
              is created — so those two stay in the open beside the command and the
              mechanism goes. `lib/skill.ts` still carries the git-over-CLI detail. */}
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-relaxed text-muted">
              One skill, added to your own agent. Nothing leaves the machine and no account
              is created.
            </p>
            {/* The caveat this page owed and did not print, added 2026-08-11 on the
                author's own account of where the skill stands: implemented, and not really
                tested, so not really there.

                This file's header has said the underlying fact since it was written — "the
                skill's behaviour lives outside this repository's test suite. Nothing in
                `npx tsc --noEmit` and nothing in the 3500 tests can fail on the day its
                output stops matching the listing in step 02" — and said it to a maintainer
                in a comment while the page said nothing to a reader. The three steps below
                describe an interview and a folder in the present tense, which is the exact
                shape doc 2 §0.4 warns about: a description of behaviour nobody here checks,
                read as a guarantee.

                A sentence and not a `ComingSoonBadge`, for two reasons. The badge would be
                false in the other direction — the command runs and the skill installs, so
                "coming soon" would be a worse claim than none — and this page's own rule,
                held by `SkillSetup.test.ts`, is that every amber marker sits below the
                rule. `honesty.test.ts`'s doctrine is the same one: a badge is a glyph, and
                the site's limits are carried by words. */}
            <p className="text-[15px] leading-relaxed text-muted">
              What it does after that is not tested here. The DarkPrint skill is a document
              your agent reads and runs. Everything below describes what it asks for and
              what it leaves behind. This site does not check anything beyond that.
            </p>
          </div>
        </div>
      </li>

      {/* ---------- 02 · the interview ---------- */}
      <li className="flex min-w-0 flex-col gap-4">
        <StepHeading index={2} title="Answer its questions" />

        {/* The `What it asks` label is gone with the panel that needed it.
            ------------------------------------------------------------
            It captioned the bullet list inside a panel whose heading was three lines above
            it, past a paragraph, so the list needed something to say what it was. The rows
            are labelled one by one now and the heading is "Answer its questions", which is
            the caption. A `.label` reading "What it asks" over five rows of questions is the
            heading said a third time.

            The hand-off's §A2 asks for it to stay; the mock does not draw it and the mock is
            the spec here. Recorded rather than done quietly, because the two disagree. */}
        <div className="flex min-w-0 flex-col gap-4">
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
      </li>

      {/* ---------- 03 · read it back ---------- */}
      <li className="flex min-w-0 flex-col gap-4">
        {/* "Keep the folder", not "See what you end up holding", since 2026-08-11. The old
            title described the reader's posture at the end of a tutorial; this one names the
            thing, which is what the other two headings do — "Install it", "Answer its
            questions". It is also four words against six in a heading a screen reader reads
            as one of three steps in a sequence, and the step under it opens on the folder
            anyway. */}
        <StepHeading index={3} title="Keep the folder" />

        {/* One card, the mark beside what it holds, which reverses the 2026-08-08 stacking.
            ------------------------------------------------------------
            The author asked then for the two halves centred and stacked, because `InOut` was
            four short mono rows against a forty-word paragraph and side by side one column
            ran to two lines and the other to four. `InOut` is gone and the paragraph is
            twenty-five words, so the halves are no longer a short box and a long one: they
            are a 192px figure and everything the step has to say, which is the one pairing
            that does want a row.

            This is also now the only box in the tutorial, where it used to be a box inside a
            panel. `--color-surface-2` at `--color-line`, which is the command's frame one
            step up, so the two things a reader takes away from this page are drawn the same
            way and nothing else on it is. */}
        <div className="flex flex-col items-center gap-8 rounded-xl border border-line bg-surface-2 px-6 py-7 sm:flex-row sm:items-center sm:px-8">
          {/* The folder, drawn as the mark that means one.
              ------------------------------------------------------------
              This is the one place on the site where the logo is also a diagram. The mark
              is a folder holding a graph, and the rows beside it are the files that folder
              actually contains: the graph, one card per node, and the README. It is the
              same drawing as the header and the hero, at the 64 rung, with no glow and
              nothing added — a figure rather than a badge, which is the only way a brand
              mark earns a place inside a tutorial step.

              `aria-hidden`, because the list beside it says everything it says and a mark
              with an accessible name here would announce the brand in the middle of a
              procedure. The names come from `bundle-export.ts`, which is what writes them
              into every folder under `public/bundles/`, so the figure and the disk cannot
              disagree. */}
          <Logo size={192} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <span className="label">What it writes</span>
            <FileListing
              lines={[
                [TOPOLOGY_DOT, "the graph: who is wired to whom"],
                [`${BUNDLE_CARDS_DIR}/<node>.yaml`, "one card per node the graph pins"],
                [BUNDLE_README, "what it is, and how to check it"],
              ]}
            />

            {/* Twenty-five words where there were forty-five, and the two things a reader
                needs are both still in them: where to check the folder, and that checking it
                sends nothing anywhere.

                The mock's version stops at "the same four files" and that is the one place
                this file does not follow it. "Nothing is uploaded and nothing is sent
                anywhere" is a limit statement — `SkillSetup.test.ts` pins it, the pass that
                produced this mock is scoped "no change to what either page claims", and this
                site has twice lost a sentence of exactly this kind to a length pass
                (`components/site/honesty.test.ts`'s header records both). The clause costs
                eight words and is the last thing on the page a reader reads before leaving
                for `/upload`.

                What did go is the mechanism: "the same engine that scored every bundle in
                the gallery is compiled into that page and runs in your own browser tab" is
                `/upload`'s own claim to make, with the result in front of the reader.

                A colon, not the mock's em dash. `components/skill` is in
                `workspace.test.ts`'s `COPY_TREES`, which keeps the pause dash off the
                rendered site. */}
            <p className="text-[15px] leading-relaxed text-muted">
              Plain text on your disk. Check it on{" "}
              <Link
                href="/upload"
                className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
              >
                Upload blueprint
              </Link>
              , or hold it against the nine published bundles in{" "}
              <Link
                href="/blueprints"
                className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
              >
                the gallery
              </Link>
              : the same three files. Nothing is uploaded and nothing is sent anywhere.
            </p>

            {/* A paragraph stood here about `/upload` resolving against `CORE_ONTOLOGY`, so
                a local term comes back unknown unless the folder carries the file defining
                it. The author asked it out on 2026-08-08: it is `/upload`'s to say, with the
                result in front of the reader, rather than a caveat here about a page they
                have not opened. */}
          </div>
        </div>
      </li>
    </ol>
  );
}
