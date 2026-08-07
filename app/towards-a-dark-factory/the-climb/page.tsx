import type { Metadata } from "next";
import Link from "next/link";

import { IsolationWall, PhaseStrip, RoutePager } from "@/components/howto";
import { More } from "@/components/ui/More";
import { ButtonLink } from "@/components/ui/Button";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Stop 2 of 2, and the whole of it is one question: what did it
   actually take? Evidence, read once, by somebody the page before
   this one has already convinced.

   Redesign spec §4.2. `/how-to-build-a-dark-factory` renamed and
   moved under `/towards-a-dark-factory`, and cut to the three
   things the spec names for it: the four phases, the holdout
   scenarios, and progressive disclosure.

   ── The one source, and why it is the only one ──
   Saumya Tyagi, "The Dark Factory Pattern: Moving From
   AI-Assisted to Fully Autonomous Coding", HackerNoon, February
   2026. Read in full. Every phase, threshold, format and number
   attributed below is in it, and the two papers it cites are cited
   here as its references rather than as ours, because we have not
   read them.

   The BlueGrid series is deliberately absent. It sits behind a
   Cloudflare challenge, it could not be read, and the author
   answered "ignore" when told so. A source nobody checked is worse
   than no source, so it is not cited, not paraphrased and not
   linked.

   ── Doc 2 §1.1, and where it moved to (2026-08-07) ──
   A page about building a dark factory is one sentence away from
   teaching a reader to strip people out of graphs. This page
   carried the rule three ways: a 14px `text-dim` paragraph under
   the `h1`, a link to the panel that states it in full, and
   `PhaseStrip`'s violet mark.

   The dim paragraph is gone and its claim is in the lead, at deck
   weight. It was the dimmest text on the page carrying the route's
   most load-bearing constraint, and the sentence it linked to now
   sits in the DECK of `/towards-a-dark-factory`, above the ladder
   rather than 2,586px below it — which is where a reader meets it
   before anything can install the wrong reading. Stating it a
   fourth time here, smaller than everything around it, was three
   disclaimers pretending to be a layout.

   What stays is the structural half, which is the half that works:
   `HumanFlowNode` is violet by construction, `FlowTone` has no
   `human` member, and the strip's last panel puts the person at the
   FRONT of the line rather than out of the picture.

   ── The length pass (PROJECT.md §3.1): 2,024 prose words to
      under 1,200, with nothing true stopping being said ──
   The author's complaint was that the page is long enough to be
   skipped. What the page lost is the same thing said twice.

     1. the four phase panels folded into `PhaseStrip`. Each phase
        was a card in the strip and a panel below it, and the
        panel's `goal` restated the caption beside the drawing.
     2. the isolation panel's DarkPrint paragraph folded into the
        closing section, which was already claiming the same layer
        one screen further down.
     3. the section leads that described the figure under them, the
        progressive-disclosure analogy about a new hire and a
        five-hundred-page wiki, and the figcaption sentence
        recorded in `IsolationWall`.

   ── `#around` came back (2026-08-07) ──
   That same pass moved "What changes around the pipeline" to the
   parent, on the argument that its subject is an organisation and
   the parent is where the 1-5 ladder is. The block's own lead
   opened "the technology in the account this route ends on", which
   is a sentence only readable on the page that IS the account — and
   the parent then forward-linked past the stop between them, so the
   reader's path through one account ran 1 → 3 → 2 → 3. It is the
   account's risk section and it is on the account.

   The two sentences it lost when it moved are still gone: the
   eighteen-months gloss on "every phase pays for itself" (the
   phase strip's four captions state it one phase at a time) and the
   opening of the closing paragraph, which said what the first card
   says. The eight-people-to-thirty projection stayed, with the
   hedge it arrived with — a number quoted with its own caveat is
   not a length problem.

   The four file formats are all still here, behind one disclosure,
   because they illustrate four different shapes rather than one
   shape four times.
   ============================================================ */

export const metadata: Metadata = {
  title: "The climb",
  description:
    "One team's account of the climb from level 2 to level 5, in four phases: better context for the agents, specs judged by holdout scenarios the coding agent never sees, the human gate coming off one service at a time, and the numbers that have to hold first.",
};

const HERE = "/towards-a-dark-factory/the-climb";

/* --------------------- the formats, as text --------------------- */

/**
 * The three file shapes the account describes, written out.
 *
 * These are illustrations of a shape, and the shape is the claim: markdown with YAML
 * frontmatter, a feature spec that states a goal, a bug spec that states a symptom and
 * refuses to state a cause, and a scenario in plain English with no step definitions
 * under it. The contents are ours. Anybody wanting the originals has the article.
 */
const FEATURE_SPEC = `---
target_repo: your-org/query-engine
target_branch: release
type: feature
---

# Add a SQL validation endpoint

## Goal
POST /api/v1/sql/validate validates a statement without running it.

## Requirements
- Reject anything that is not a SELECT
- Return the tables and columns the statement touches
- Structured JSON for all of the above

## Constraints
- Follow the controller patterns already in the repo
- No new dependencies`;

const BUG_SPEC = `---
target_repo: your-org/writeback-service
target_branch: release
type: bug-fix
---

# Writeback returns 500 when supplier is null

## Symptom
POST /oracle/writeback with a null supplier field returns HTTP 500.

## Expected
HTTP 400, with a validation error naming "supplier".

## Do not assume the root cause. Investigate the codebase.`;

const HOLDOUT = `---
service: query-engine
feature: sql-validation
priority: P0
---

# SQL injection is detected

## Scenario
POST to /api/v1/sql/validate with
  sql: "SELECT * FROM users; DROP TABLE users; --"
Then valid is false.
The errors mention the disallowed statement type.`;

const AGENTS_MD = `# AGENTS.md for QueryEngine

## What this service does
Query execution for the analytics platform. Takes SQL from the
frontend, validates and transforms it, runs it, returns results.

## Architecture
- Java 21, Spring Boot, Gradle multi-module
- JWT auth on every endpoint

## Key patterns
- Controllers extend the generated OpenAPI interfaces
- See docs/coding-patterns.md for the rest

## Directory map
- src/main/java/.../controller/ : REST endpoints
- src/main/java/.../service/ : business logic`;

/* --------------------- the risk section --------------------- */

/**
 * The account's own risk section, back on the account.
 *
 * Four risks, each named in the article and each given its own paragraph there. The
 * wording is the wording that shipped, less the sentences that repeated something said
 * elsewhere on this page: the eighteen-months gloss on "every phase pays for itself" (the
 * phase strip's four captions state it one phase at a time) and the opening of the closing
 * paragraph, which said what the first card says.
 */
const AROUND: { title: string; body: string }[] = [
  {
    title: "People do not want to stop writing code",
    body: "Engineers have identity wrapped up in authorship, and being told the job is now writing specs lands differently than the person saying it expects. The account names this as a real risk and gives it its own paragraph. The phased shape helps, because phase 1 asks nobody to change anything and by phase 2 the results are visible.",
  },
  {
    title: "The saving can be spent badly",
    body: "Automating the coding and then raising the number of specs per sprint produces a different grind and the same exhaustion. The account says the promise about doing more of the interesting work has to be meant.",
  },
  {
    title: "Buy-in was load-bearing",
    body: "The team had already watched agents do useful work unattended and were not frightened of them. That is listed alongside the CI pipeline and the test coverage as a starting condition, which is a claim about where this is easy and where it is not.",
  },
  {
    title: "There is a bill, and it has a cap",
    body: "Retries are capped at three attempts per spec, with token monitoring and alerts. For scale, the account cites its own reference reporting roughly a thousand dollars a day per engineer-equivalent, and observes that this is still cheaper than a salary.",
  },
];

/* --------------------- further reading --------------------- */

const SOURCES: {
  title: string;
  where: string;
  href: string;
  note: string;
  read: boolean;
}[] = [
  {
    title: "The Dark Factory Pattern: Moving From AI-Assisted to Fully Autonomous Coding",
    where: "Saumya Tyagi · HackerNoon · February 2026",
    href: "https://hackernoon.com/the-dark-factory-pattern-moving-from-ai-assisted-to-fully-autonomous-coding",
    note: "Everything attributed to an account here comes from this. A platform team of eight, a dozen microservices, Java and TypeScript.",
    read: true,
  },
  {
    title: "The Software Factory",
    where: "StrongDM · 2026",
    href: "https://simonwillison.net/2026/Feb/7/software-factory/",
    note: "The article's first reference: three engineers, holdout scenarios, digital twins. Nothing above rests on it.",
    read: false,
  },
  {
    title: "Harness engineering: leveraging Codex in an agent-first world",
    where: "OpenAI · 2026",
    href: "https://openai.com/index/harness-engineering/",
    note: "The article's second reference, and where progressive disclosure and the linter idea come from. Nothing above rests on it either.",
    read: false,
  },
];

const INLINE =
  "font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan";

/**
 * The right edge of a box that scrolls sideways, faded rather than cut.
 *
 * Measured at 390: each of the four samples below hides between 24% and 42% of itself, and
 * `overflow-x-auto` alone gives a reader no way to know that. In a screenshot — and to
 * anybody who does not think to drag a code block — it photographs as a crop, which is a
 * different and worse claim than "there is more this way". A mask over the last 12% of the
 * box means the last visible characters trail off instead of ending on a hard rule.
 *
 * It lifts at `md`, and the breakpoint is measured rather than picked. The samples sit in
 * a `lg:grid-cols-2` grid: at `md` that is one column of ~632px, which holds the longest
 * line here (66 characters of 12px mono, ~475px), and at `lg` each column is ~514px, which
 * still holds it. Below `md` nothing does. A permanent mask would fade the end of a line
 * that has nothing after it, which is the one thing worse than the cut.
 *
 * `black` and `transparent` are mask keywords rather than palette colours: a mask reads
 * only alpha, so this fades to whatever ground the box is already on and cannot disagree
 * with a token.
 */
const CUT_EDGE =
  "[mask-image:linear-gradient(to_right,black_88%,transparent)] md:[mask-image:none]";

/**
 * One named source file, as a scrollable code block.
 *
 * `min-w-0` on the wrapper is load-bearing. This sits in a `lg:grid-cols-2` grid, and a
 * grid item defaults to `min-width: auto`, so it refuses to shrink below its own
 * min-content — here, the longest line of the sample inside it. Measured at 378px with
 * the disclosure above open, the page ran to `scrollWidth` 561 against a 367 viewport,
 * and `body { overflow-x: hidden }` clipped the difference: the right ~28% of every
 * sample was lost rather than merely off-screen, because the `<pre>`'s own
 * `overflow-x-auto` had nothing to scroll once the box had grown instead of
 * constraining. Same defect, same one-class fix, as the node card page's main column.
 */
function Source({ children, name }: { children: string; name: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* `.label`: this tags a listing, it does not title a block. */}
      <span className="label">{name}</span>
      <pre
        className={`overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-[12px] leading-relaxed text-fg ${CUT_EDGE}`}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function TheClimbPage() {
  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="The account"
            title="How one team crossed the gap"
            /* The gap is named in the lead, because the title does not name it and the
               URL promises a phrase the page's own prose never used: "dark factory"
               appeared here only in a source title and the pager eyebrow. A reader
               landing on `/towards-a-dark-factory/the-climb` from a link or a search
               result met "the ladder" in the next paragraph as a second undefined term
               and had nothing to attach either to.

               What it no longer does is retype the five lifecycle phases. That list was
               word-for-word the lead of the page one click back, which is where a reader
               arriving in order has just read it; here it names the shape and points at
               the definition rather than printing a second copy of the closed set.

               The last clause is doc 2 §1.1, at deck weight. It was a 14px `text-dim`
               paragraph under this heading — the dimmest text on the page carrying the
               route's most load-bearing constraint. */
            lead="The gap is the one between a pipeline a person shepherds and a dark factory, where every phase of the work runs unattended. This is a quality architecture built from scratch rather than bolted onto the review process they already had, and nothing below is advice to take a person out of a graph."
          />
        </div>
      </header>

      {/* ---------- the four phases ---------- */}
      <section id="phases" className="bg-surface py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The shape of the climb"
            title="Four phases, and each one has to pay for itself"
            lead="Read the four drawings as one thing changing. The pipeline settles after phase 2, and what moves is where the person stands and what they are reading."
          />

          <div className="mt-10">
            <PhaseStrip />
          </div>

          {/* `#formats` is the id the same material carried on
              `/how-to-build-a-dark-factory`, which 308s here. A fragment never reaches
              the server, so the redirect cannot carry it, and the old link would land at
              the top of the page. An empty target rather than an id on the block, because
              an element gets one and this one is a `<details>` a reader may not open. */}
          <span id="formats" aria-hidden className="mt-10 block scroll-mt-24" />

          {/* The section this used to be had its own heading, eyebrow and lead, and the
              lead said what phase 1's own card says: that the layering is AGENTS.md over
              a docs/ folder. What the lead alone carried, that the account takes
              progressive disclosure from one of its references, is in the OpenAI entry
              under Sources. So the heading became a summary and the block sits under the
              phases it is about. */}
          {/* `.label-lead` titles the panel; the two sentences inside it are prose and
              run in `.prose-lane`. They were the widest body copy on the site at 181 and
              182 characters per line — a full 1102px panel at 14px — on a page whose
              other paragraphs run at 118. The two mono samples are a figure, not prose,
              and keep the panel's full width. */}
          <div className="panel mt-2 flex flex-col gap-4 p-5">
            <span className="label-lead">A linter message the agent can act on</span>
            <p className="prose-lane text-sm leading-relaxed text-muted">
              The smallest format here is one line, and the account reports the largest
              difference per character of anything in phase 1. It is written as an
              instruction.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-line bg-surface-2 px-4 py-3">
                <span className="label text-signal">a description</span>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-muted">
                  Service layer depends on controller layer.
                </p>
              </div>
              <div className="rounded border border-line bg-surface-2 px-4 py-3">
                <span className="label text-emerald">an instruction</span>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-fg">
                  Service class imports from the controller package. Services must not
                  depend on controllers. Move the shared type to the model package.
                </p>
              </div>
            </div>
            <p className="prose-lane text-sm leading-relaxed text-muted">
              With the first the agent guesses. With the second it fixes the right thing
              first time, most of the time.
            </p>
          </div>

          {/* Four shapes rather than one shape four times, so all four stay. The
              disclosure decides what is on screen before a click and nothing else: the
              text is in the prerendered HTML either way and it opens without JavaScript.

              `More`, not a fourth hand-written `<details>` on this route. This one wrote
              the ▸ and its trailing space inside an `inline-block` span, and a trailing
              space collapses at the box edge, so the built page read
              "▸PROGRESSIVE DISCLOSURE…" with the marker welded to the word — the same
              defect `PhaseStrip` and `WhichTasksChecks` shipped. `More` puts the marker
              in a flex row with `gap-2`. One child, so the block sets its own rhythm
              rather than inheriting the component's. */}
          <More
            bare
            className="panel mt-5 p-5"
            summary="Progressive disclosure, and four files that are not code"
          >
            <div className="flex flex-col gap-5">
              <p className="prose-lane text-sm leading-relaxed text-muted">
                Specs and scenarios are markdown with YAML frontmatter. The shapes are the
                account&apos;s and the contents ours, so these illustrate a form and none
                of them runs.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <Source name="A feature spec">{FEATURE_SPEC}</Source>
                <Source name="A bug spec">{BUG_SPEC}</Source>
              </div>
              <p className="prose-lane text-sm leading-relaxed text-muted">
                A bug spec states the symptom and stops, because an agent handed a
                diagnosis implements it. The line about investigating the codebase is what
                stops that.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <Source name="A holdout scenario">{HOLDOUT}</Source>
                <Source name="An AGENTS.md, first hundred lines">{AGENTS_MD}</Source>
              </div>
            </div>
          </More>
        </div>
      </section>

      {/* ---------- holdout scenarios ---------- */}
      {/* `border-t` on every seam now, not on three of five. The other page of this route
          marks each band with a rule and a change of ground, and two of the seams here
          changed ground alone — which reads as one long section on a phone, where the
          ground change is the only thing left of the boundary. */}
      <section id="holdouts" className="border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The mechanism"
            title="Holdout scenarios, and the wall they sit behind"
            lead="The account puts one section above every other, and this is it. Holdout scenarios are acceptance tests in plain English, in a directory the coding agent cannot reach."
          />

          <div className="mt-10">
            <IsolationWall />
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="panel flex flex-col gap-3 p-5">
              <span className="label-lead">How a scenario is judged</span>
              <p className="text-sm leading-relaxed text-muted">
                A model plans the API calls a scenario needs, runs them against the pull
                request&apos;s ephemeral deployment, and reads whether the responses
                satisfied it. No step definitions anywhere, which is what rots in an
                abandoned BDD suite.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                Model judging is probabilistic, so the account puts numbers on it: each
                scenario runs three times and two have to pass, and 90% of the set has to
                pass before the pull request moves forward.
              </p>
            </div>
            {/* `.panel-lead`, which is the documented way to say "this is the panel to
                start at".
                ------------------------------------------------------------
                This carried `border-t-2 border-t-cyan` and rendered a 1px
                `--color-line` hairline, because `.panel` was unlayered and an unlayered
                class beats every utility. That is fixed, and the rule now renders as
                written — verified in the DOM here: `borderTopWidth: 2px`,
                `borderTopColor: rgb(56,189,248)`. So the question was not whether it
                works but whether it is the right sentence, and the intent behind it —
                the section's own lead says "the account puts one section above every
                other, and this is it" — is exactly what `.panel-lead` exists to say. A
                lifted ground and a brighter edge, once per page, rather than a fifth
                colour rule this site does not otherwise use on a panel. The cyan also
                cost something: cyan means interactive here, and a 2px cyan edge on a
                block nobody can click spends the one colour the palette reserves for
                things that respond. */}
            <div className="panel panel-lead flex flex-col gap-3 p-5">
              <span className="label-lead">Why the wall is the whole thing</span>
              {/* The DarkPrint paragraph that used to close this panel is now one clause
                  of the closing section, which was making the same claim about the same
                  layer a screen further down. */}
              <p className="text-sm leading-relaxed text-fg">
                A coding agent that can read the scenarios will aim at them, and the gate
                stops measuring anything. The framing is machine learning&apos;s: the
                scenarios are the test set, the spec is the training data, a model that sees
                the evaluation data overfits it. A failing agent is told which scenario
                failed and one line about what happened, never the text.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- what changes around the pipeline ---------- */}
      {/* Back from `/towards-a-dark-factory`, where an earlier pass had moved it. Its lead
          opens on "the technology in this account", which is a sentence that can only be
          read on the page that is the account; on the parent it named a referent the
          reader would not meet for two more pages. It is the risk section of a narrative
          and it belongs at the end of that narrative, after the mechanism and before the
          page says what DarkPrint has to do with any of it. */}
      <section id="around" className="scroll-mt-24 border-t border-line bg-surface py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The half that is not technical"
            title="What changes around the pipeline"
            lead="The technology in this account is ordinary: an orchestrator script, a GitHub Action, containers on infrastructure the team already ran. What it spends its risk section on is people."
          />

          <ul className="mt-10 grid gap-5 md:grid-cols-2">
            {AROUND.map((item) => (
              <li key={item.title} className="panel flex flex-col gap-3 p-5">
                <PanelHeading>{item.title}</PanelHeading>
                <p className="text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>

          <p className="prose-lane mt-10 text-[15px] leading-[1.7] text-muted">
            Writing code used to be the floor of what it meant to be an engineer. In the
            account&apos;s model the work is deciding what to build and how to know it is
            right, which is closer to product engineering than to what most people were
            trained for. The team in question is eight people, and the projection it offers
            is the sustained output of twenty-five or thirty. That is a projection from a
            team partway up its own ladder, and it is quoted here as one.
          </p>
        </div>
      </section>

      {/* ---------- where this site fits, honestly ---------- */}
      <section className="border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-5">
          {/* A `SectionHeading`, like the sections above it.
              ------------------------------------------------------------
              This was the page's only orphan `h2`: 24px against its siblings' 36, no
              eyebrow, and a hand-written class list rather than the component every other
              section title on the site is drawn by. Sections in one scroll, some announced
              and one of them not, reads as a paragraph that grew a title rather than as
              the place the page lands.

              The lead is the first two sentences of the paragraph that used to open the
              section, verbatim. Nothing was rewritten to make the block fit: they were
              already the sentence that says what this site is, which is what a lead is
              for, and the rest of the paragraph carries on underneath at body size. */}
          <SectionHeading
            eyebrow="Where this site fits"
            title="What DarkPrint does with any of this"
            lead="This site holds the layer the account spends the least time on: the graph. Which nodes exist, what flows between them, what each node is forbidden to receive, and which model it runs."
          />
          <p className="prose-lane mt-5 text-[15px] leading-[1.7] text-muted">
            The wall above is a rule in that layer here, so{" "}
            <Link href="/spec/topology" className={INLINE}>
              the starter blueprint has an edge it does not have
            </Link>
            {" "}and adding it fails the bundle. None of the four formats reaches that layer; the{" "}
            <Link href="/what-a-blueprint-is" className={INLINE}>
              three it is written in
            </Link>{" "}
            are a DOT topology, one versioned card per node, and a controlled vocabulary
            both are written against.
          </p>
          {/* Constraint 0.4, on the page most likely to read as a pitch. It used to be
              one of two copies; `/what-it-isnt` carried the other and that page is gone,
              so this is now the only place the route states it. Do not fold it.
              `components/site/honesty.test.ts` holds it verbatim and in the open as of
              2026-08-07 — a source comment saying "do not fold it" is what guarded it
              through the two passes that nearly did. */}
          <p className="prose-lane text-sm leading-relaxed text-dim">
            Nothing here runs a factory. Execution happens on your own machine, through
            Claude Code or an agent that reads the same cards. Publishing is not built,
            there are no accounts, no votes and no telemetry, and there is no MCP server to
            point a client at yet.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/build" variant="primary">
              Build one in an hour
            </ButtonLink>
            <ButtonLink href="/blueprints" variant="outline">
              Read published graphs
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ---------- sources ---------- */}
      <section className="border-t border-line bg-surface py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          {/* Folded. Three references with a provenance note each is a column and a half
              on a phone, standing between the reader and the pager. The "read in full /
              not read by us" marks are why the list exists and why it is not deleted: they
              stay in the prerendered HTML and one click away.

              This is the route's only citation block now. The parent page cites the same
              article through `SectionLevels`, for the ladder's framing rather than for the
              account, and `levels.test.ts` holds that note to what the article actually
              supports. */}
          <More summary="Sources, and which of them we read in full">
            <ul className="grid gap-5 md:grid-cols-3">
              {SOURCES.map((source) => (
                <li key={source.href} className="flex flex-col gap-1.5">
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium leading-snug text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
                  >
                    {source.title}
                    <span className="ml-1 font-mono text-[11px] text-dim" aria-hidden>
                      ↗
                    </span>
                  </a>
                  <span className="label">{source.where}</span>
                  <span
                    className="label w-fit rounded-full border border-line px-2 py-0.5"
                    style={{
                      color: source.read
                        ? "var(--color-emerald)"
                        : "var(--color-muted)",
                    }}
                  >
                    {source.read ? "read in full" : "not read by us"}
                  </span>
                  <p className="text-xs leading-relaxed text-dim">{source.note}</p>
                </li>
              ))}
            </ul>
          </More>

          <RoutePager href={HERE} />
        </div>
      </section>
    </>
  );
}
