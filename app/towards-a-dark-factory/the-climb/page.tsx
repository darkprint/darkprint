import type { Metadata } from "next";
import Link from "next/link";

import { IsolationWall, PhaseStrip, RoutePager } from "@/components/howto";
import { More } from "@/components/ui/More";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
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

   ── Doc 2 §1.1, which binds harder here than anywhere ──
   A page about building a dark factory is one sentence away from
   teaching a reader to strip people out of graphs. It is about the
   ladder, which is a fact about an organisation and does have a
   top. It is not about a blueprint's class, which records where
   the author of that graph decided somebody should stand. The two
   scales are named apart in one line under the title, which links
   to the panel on this route's overview that states the difference
   in full, and `PhaseStrip` carries the rule visually: what moves
   across the four phases is where the person is, drawn in violet
   by construction, in a strip whose last panel puts them at the
   front of the line rather than out of the picture.

   ── The length pass (PROJECT.md §3.1): 2,024 prose words to
      under 1,200, with nothing true stopping being said ──
   The author's complaint was that the page is long enough to be
   skipped. One page rather than two: a split needs a fourth stop
   in `components/howto/route.ts`, and `nav.test.ts` then requires
   that stop in `components/site/SiteFooter.tsx`, which is another
   pass's file; and the account reads as one narrative, so the seam
   would fall where a reader is deciding whether to carry on. What
   the page lost is the same thing said twice.

     1. the four phase panels folded into `PhaseStrip`. Each phase
        was a card in the strip and a panel below it, and the
        panel's `goal` restated the caption beside the drawing.
        `PhaseStrip`'s header comment records the two clauses that
        survived the fold and the words that were only ever the
        caption again.
     2. the organisational half, "What changes around the pipeline",
        moved whole to `/towards-a-dark-factory#around`. Its subject
        is an organisation, which is the overview's subject and the
        thing the 1-5 ladder measures. It is linked from the strip.
     3. the isolation panel's DarkPrint paragraph folded into the
        closing section, which was already claiming the same layer
        one screen further down.
     4. the section leads that described the figure under them, the
        progressive-disclosure analogy about a new hire and a
        five-hundred-page wiki (the paragraph above it makes the
        point once), and the figcaption sentence recorded in
        `IsolationWall`.

   The four file formats are all still here, behind one disclosure,
   because they illustrate four different shapes rather than one
   shape four times. Nothing true and unrepeated stopped being said:
   the maintenance-agent rationale and the three-layer sentence were
   both cut in an earlier draft of this file and both are back,
   because neither is stated anywhere else.
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

const LABEL = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";

const INLINE =
  "font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan";

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
      <span className={LABEL}>{name}</span>
      <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-[12px] leading-relaxed text-fg">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function TheClimbPage() {
  return (
    <>
      <header className="border-b border-line bg-void py-14 sm:py-16">
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
               and had nothing to attach either to. */
            lead="The gap is the one between a pipeline a person shepherds and a dark factory, where planning, implementation, testing, debugging and deployment all run unattended. This is a quality architecture built from scratch rather than bolted onto the review process they already had."
          />
          {/* Doc 2 §1.1, said once, in one sentence, before anything else on the page. */}
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-dim">
            This page is about the ladder, which describes what an organisation is able to
            do. The class printed on a blueprint answers a different question, and{" "}
            <Link href="/towards-a-dark-factory#autonomy" className={INLINE}>
              the two scales are named apart on the overview
            </Link>
            . Nothing below is advice to take a person out of a graph.
          </p>
        </div>
      </header>

      {/* ---------- the four phases ---------- */}
      <section id="phases" className="bg-surface py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The shape of the climb"
            title="Four phases, and each one has to pay for itself"
            lead="Read the four drawings as one thing changing. The pipeline settles after phase 2, and what moves is where the person stands and what they are reading."
          />

          <div className="mt-10">
            <PhaseStrip />
          </div>

          {/* Where the organisational half went. The account's risk section is about
              people rather than pipelines, which is the overview's subject and what the
              1-5 ladder measures, so it moved there whole instead of being cut. */}
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">
            The account spends its risk section on people, and what{" "}
            <Link href="/towards-a-dark-factory#around" className={INLINE}>
              changes around the pipeline
            </Link>{" "}
            sits beside the ladder.
          </p>

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
          <div className="panel mt-2 flex flex-col gap-3 p-6">
            <span className={LABEL}>A linter message the agent can act on</span>
            <p className="text-sm leading-relaxed text-muted">
              The smallest format here is one line, and the account reports the largest
              difference per character of anything in phase 1. It is written as an
              instruction.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-line bg-surface-2 px-4 py-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
                  a description
                </span>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-muted">
                  Service layer depends on controller layer.
                </p>
              </div>
              <div className="rounded border border-line bg-surface-2 px-4 py-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-emerald">
                  an instruction
                </span>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-fg">
                  Service class imports from the controller package. Services must not
                  depend on controllers. Move the shared type to the model package.
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              With the first the agent guesses. With the second it fixes the right thing
              first time, most of the time.
            </p>
          </div>

          {/* Four shapes rather than one shape four times, so all four stay. The
              disclosure decides what is on screen before a click and nothing else: the
              text is in the prerendered HTML either way and it opens without JavaScript. */}
          <details className="panel group mt-5 p-6">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden font-mono text-[11px] uppercase tracking-[0.14em] text-dim transition-colors hover:text-fg">
              <span
                aria-hidden
                className="inline-block transition-transform group-open:rotate-90"
              >
                ▸{" "}
              </span>
              Progressive disclosure, and four files that are not code
            </summary>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
              Specs and scenarios are markdown with YAML frontmatter. The shapes are the
              account&apos;s and the contents ours, so these illustrate a form and none of
              them runs.
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Source name="A feature spec">{FEATURE_SPEC}</Source>
              <Source name="A bug spec">{BUG_SPEC}</Source>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
              A bug spec states the symptom and stops, because an agent handed a diagnosis
              implements it. The line about investigating the codebase is what stops that.
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Source name="A holdout scenario">{HOLDOUT}</Source>
              <Source name="An AGENTS.md, first hundred lines">{AGENTS_MD}</Source>
            </div>
          </details>
        </div>
      </section>

      {/* ---------- holdout scenarios ---------- */}
      <section id="holdouts" className="bg-void py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The mechanism"
            title="Holdout scenarios, and the wall they sit behind"
            lead="The account puts one section above every other, and this is it. Holdout scenarios are acceptance tests in plain English, in a directory the coding agent cannot reach."
          />

          <div className="mt-10">
            <IsolationWall />
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="panel flex flex-col gap-3 p-6">
              <span className={LABEL}>How a scenario is judged</span>
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
            <div className="panel flex flex-col gap-3 border-t-2 border-t-cyan p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
                Why the wall is the whole thing
              </span>
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

      {/* ---------- where this site fits, honestly ---------- */}
      <section className="border-t border-line bg-surface py-14">
        <div className="container-page flex flex-col gap-5">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
            What DarkPrint does with any of this
          </h2>
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            This site holds the layer the account spends the least time on: the graph.
            Which nodes exist, what flows between them, what each node is forbidden to
            receive, and which model it runs. The wall above is a rule in that layer here,
            so{" "}
            <Link href="/spec/topology" className={INLINE}>
              the starter blueprint has an edge it does not have
            </Link>
            {" "}and adding it fails the bundle. None of the four formats reaches that layer; the{" "}
            <Link href="/spec" className={INLINE}>
              three it is written in
            </Link>{" "}
            are a DOT topology, one versioned card per node, and a controlled vocabulary
            both are written against.
          </p>
          {/* Constraint 0.4, on the page most likely to read as a pitch. It used to be
              one of two copies; `/what-it-isnt` carried the other and that page is gone,
              so this is now the only place the route states it. Do not fold it. */}
          <p className="max-w-3xl text-sm leading-relaxed text-dim">
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
      <section className="border-t border-line bg-void py-12">
        <div className="container-page flex flex-col gap-10">
          {/* Folded. Three references with a provenance note each is a column and a half
              on a phone, standing between the reader and the pager. The "read in full /
              not read by us" marks are why the list exists and why it is not deleted: they
              stay in the prerendered HTML and one click away. */}
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
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                    {source.where}
                  </span>
                  <span
                    className="w-fit rounded-full border border-line px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em]"
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
