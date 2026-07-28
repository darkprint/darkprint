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

   ── What redesign spec §5 licensed, and what it cost ──
   The author: these pages are too dense and readers skip. Four
   blocks went, all of them a second statement of something the
   page says elsewhere:

     1. the cyan panel under the title, which restated the
        two-scales argument that `SectionLevels` states in full on
        the overview. One sentence and a link survive.
     2. "A review stops being a reading of code", which repeated
        phase 2's satisfaction report at greater length. Folded
        back into phase 2.
     3. "Trust is measured before it is granted", which repeated
        phase 3's thresholds. Its own claim, the twenty or thirty
        agreeing pull requests, is now in phase 3.
     4. "Where DarkPrint's formats sit", whose framing claim is now
        one clause of the closing section, links included.

   Three sentences went with them, each the second time the page
   made its point: the eighteen-months-with-nothing-to-show gloss on
   "every phase pays for itself", which the strip's four captions
   state one phase at a time; "earn the trust rather than declare
   it", after phase 3 has just given the number; and "the deployment
   pipeline is the one the team already had", a line after "nothing
   downstream of the merge changes".

   The four file formats are all still here, behind one disclosure,
   because they illustrate four different shapes rather than one
   shape four times. Nothing true and unrepeated stopped being said:
   the maintenance-agent rationale and the three-layer sentence were
   both cut in a first draft of this file and both are back, because
   neither is stated anywhere else.
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

/* --------------------- the four phases --------------------- */

interface Phase {
  n: string;
  title: string;
  goal: string;
  body: string;
}

const PHASES: Phase[] = [
  {
    n: "Phase 1",
    title: "Give the agents better context",
    goal: "The biggest return in the account has nothing to do with autonomy. It is giving the agent better information about the repository it is working in.",
    body: "Every repository gets an AGENTS.md of about a hundred lines, written as a table of contents, with a docs/ folder underneath holding the longer writeups on coding patterns, API conventions, auth and testing. Two rules travel with it. The agent runs the build and the full suite before it pushes anything, so a broken change is fixed locally instead of across a sequence of CI runs. And architectural rules move out of the wiki and into linters.",
  },
  {
    n: "Phase 2",
    title: "Specs, and holdout scenarios that judge them",
    goal: "An engineer writes a spec. The system produces working, validated, merge-ready code. A person still clicks merge, and what they read has changed.",
    body: "An orchestrator clones the target repository, hands the spec to the coding agent, waits for the code, runs the build and the tests, and opens a pull request. A failure is appended to the prompt and the agent tries again on the same branch, behind an abstraction that makes swapping it a line of configuration. The pull request is then deployed as an ephemeral revision and the evaluator runs the holdout scenarios against it. What the approver reads is a satisfaction report rather than a diff, which the account puts at five minutes against two hours and calls a different kind of attention.",
  },
  {
    n: "Phase 3",
    title: "Start removing the human gate",
    goal: "One or two services, chosen because their numbers hold. The configuration change is a single line, and every team member can still block a merge.",
    body: "Three measurements have to be true first, and each is a threshold with a number on it: the scenario pass rate over the last twenty pull requests above 90%, the false positive rate below 5%, and the rate at which a human rejected something the scenarios passed below 10%. The advice on timing is to wait for twenty or thirty pull requests where the gate and human judgement agreed, and then switch it on for one service. This phase also adds maintenance agents, weekly jobs that scan for drift and stale documentation and open small cleanup pull requests through the same scenario gate as everything else. The account is direct about why they exist: generated code accumulates small inconsistencies, and nothing about that is catastrophic until nobody has swept for a year.",
  },
  {
    n: "Phase 4",
    title: "The whole line",
    goal: "By this point most of the work is done. The account calls phase 4 configuration rather than architecture.",
    body: "Auto-merge expands to every service whose scenario numbers hold, the issue tracker is wired in so a ticket carrying the right tag generates a spec and enters the pipeline, and dashboards go up. One piece of infrastructure is genuinely new: digital twins, mock servers standing in for the external dependencies that make scenario evaluation flaky or expensive, built one at a time starting with whichever causes the most trouble. Nothing downstream of the merge changes.",
  },
];

/* --------------------- what the account says changed --------------------- */

const ORGANISATIONAL: { title: string; body: string }[] = [
  {
    title: "People do not want to stop writing code",
    body: "This is named as a real risk and given its own paragraph. Engineers have identity wrapped up in authorship, and being told the job is now writing specs lands differently than the person saying it expects. The phased shape helps, because phase 1 asks nobody to change anything and by phase 2 the results are visible.",
  },
  {
    title: "The saving can be spent badly",
    body: "Automating the coding and then raising the number of specs per sprint produces a different grind and the same exhaustion. The account says the promise about doing more of the interesting work has to be meant.",
  },
  {
    title: "Buy-in was load-bearing",
    body: "The team in the account had already watched agents do useful work unattended and were not frightened of them. That is listed alongside the CI pipeline and the test coverage as a starting condition, which is a claim about where this is easy and where it is not.",
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
    note: "Everything on this page attributed to an account comes from here. A platform team of eight, about a dozen microservices, Java and TypeScript.",
    read: true,
  },
  {
    title: "The Software Factory",
    where: "StrongDM · 2026",
    href: "https://simonwillison.net/2026/Feb/7/software-factory/",
    note: "Cited by the article as its first reference: three engineers, holdout scenarios and digital twins. We have not read it, and nothing above rests on it.",
    read: false,
  },
  {
    title: "Harness engineering: leveraging Codex in an agent-first world",
    where: "OpenAI · 2026",
    href: "https://openai.com/index/harness-engineering/",
    note: "Cited by the article as its second reference, and where it took progressive disclosure and the linter idea from. We have not read it either.",
    read: false,
  },
];

const LABEL = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";

const INLINE =
  "font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan";

function Source({ children, name }: { children: string; name: string }) {
  return (
    <div className="flex flex-col gap-2">
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
            eyebrow="One team's account"
            title="How one team crossed the gap"
            lead="Four phases, each worth doing on its own, and a quality architecture built from scratch rather than bolted onto the review process they already had."
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
            lead="Read the four drawings as one thing changing. The pipeline settles after phase 2, and what keeps moving is where the person stands and what they are reading when they act."
          />

          <div className="mt-10">
            <PhaseStrip />
          </div>

          <ol className="mt-8 grid gap-5 lg:grid-cols-2">
            {PHASES.map((phase) => (
              <li key={phase.n} className="panel flex flex-col gap-3 p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">
                  {phase.n}
                </span>
                <h3 className="font-display text-xl font-semibold leading-snug text-fg">
                  {phase.title}
                </h3>
                <p className="border-l-2 border-line-bright pl-4 text-[15px] leading-relaxed text-fg">
                  {phase.goal}
                </p>
                <details className="group">
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden font-mono text-[11px] uppercase tracking-[0.14em] text-dim transition-colors hover:text-fg">
                    <span
                      aria-hidden
                      className="inline-block transition-transform group-open:rotate-90"
                    >
                      ▸{" "}
                    </span>
                    What the phase actually is
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{phase.body}</p>
                </details>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- holdout scenarios ---------- */}
      <section id="holdouts" className="bg-void py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The mechanism"
            title="Holdout scenarios, and the wall they sit behind"
            lead="The account puts one section above every other, and this is it. Holdout scenarios are acceptance tests written in plain English, kept in a directory the coding agent has no access to. The agent builds from the spec alone, and a separate evaluator runs the scenarios against what it produced."
          />

          <div className="mt-10">
            <IsolationWall />
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="panel flex flex-col gap-3 p-6">
              <span className={LABEL}>How a scenario is judged</span>
              <p className="text-sm leading-relaxed text-muted">
                The evaluator reads a scenario, uses a model to plan the API calls that
                would exercise the behaviour it describes, executes them against the
                ephemeral deployment, and then asks a model whether the responses satisfied
                the scenario. There are no step definitions anywhere, which is the thing
                that rots in every BDD suite that has ever been abandoned.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                Judging with a model is probabilistic, so the account puts numbers around
                it. Each scenario runs three times and two of the three have to pass. Across
                the set, 90% have to pass before the pull request moves forward.
              </p>
            </div>
            <div className="panel flex flex-col gap-3 border-t-2 border-t-cyan p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
                Why the wall is the whole thing
              </span>
              <p className="text-sm leading-relaxed text-fg">
                A coding agent that can read the scenarios will aim at them, and the gate
                stops measuring anything. The account borrows the framing from machine
                learning: the scenarios are the test set, the spec is the training data,
                and a model that sees the evaluation data overfits it. So a failing agent
                is told which scenario failed and given one line about what happened, and
                never the scenario text. What broke is feedback, and the criterion itself
                is something to game.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                DarkPrint makes the same claim from the other end.{" "}
                <Link href="/what-it-isnt" className={INLINE}>
                  The starter blueprint has an edge it does not have
                </Link>
                , the builder card names the type it will not accept, and adding the edge
                fails the bundle. The rule lives in the topology, where no single agent gets
                to interpret it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- progressive disclosure ---------- */}
      <section id="disclosure" className="bg-surface py-14 sm:py-20">
        {/* `#formats` is what this section was called on
            `/how-to-build-a-dark-factory`, which 308s here. A fragment never reaches the
            server, so the redirect cannot carry it, and the old link would land at the top
            of a page four sections long. An empty target rather than a second `id` on the
            section, because an element gets one. */}
        <span id="formats" aria-hidden className="block scroll-mt-24" />
        <div className="container-page">
          <SectionHeading
            eyebrow="What you actually write"
            title="Progressive disclosure, and four files that are not code"
            lead="The layering in phase 1 has a name, and the account takes it from one of its own references. The agent reads the map. When it needs the detail on auth it opens docs/auth.md. Nobody hands a new hire a five-hundred-page wiki on their first morning either."
          />

          <div className="panel mt-10 flex flex-col gap-3 p-6">
            <span className={LABEL}>A linter message the agent can act on</span>
            <p className="text-sm leading-relaxed text-muted">
              The smallest format on the page is one line long, and the account reports the
              largest difference per character of anything in phase 1. Architectural rules
              become linter checks, and the message is written as an instruction.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-line bg-surface-2 px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal">
                  a description
                </span>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-muted">
                  Service layer depends on controller layer.
                </p>
              </div>
              <div className="rounded border border-line bg-surface-2 px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald">
                  an instruction
                </span>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-fg">
                  Service class imports from the controller package. Services must not
                  depend on controllers. Move the shared type to the model package.
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              With the first, the agent guesses. With the second it fixes the right thing
              on the first attempt, most of the time.
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
              The four files, as they look
            </summary>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
              Specs and scenarios are markdown with YAML frontmatter. The shapes are the
              account&apos;s and the contents are ours, so read them as illustrations of a
              form rather than as anything you can run.
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Source name="A feature spec">{FEATURE_SPEC}</Source>
              <Source name="A bug spec">{BUG_SPEC}</Source>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
              The difference between the two matters more than it looks. A bug spec
              describes the symptom and stops. It does not say where the missing null check
              is, because an agent handed a diagnosis will implement the diagnosis, and the
              line about investigating the codebase is there to stop it.
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Source name="A holdout scenario">{HOLDOUT}</Source>
              <Source name="An AGENTS.md, first hundred lines">{AGENTS_MD}</Source>
            </div>
          </details>
        </div>
      </section>

      {/* ---------- the organisational half ---------- */}
      <section id="organisation" className="bg-void py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The half that is not technical"
            title="What changes around the pipeline"
            lead="The technology in the account is ordinary: an orchestrator script, a GitHub Action, containers on infrastructure the team already ran. What it spends its risk section on is people."
          />

          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {ORGANISATIONAL.map((item) => (
              <li key={item.title} className="panel flex flex-col gap-2.5 p-6">
                <h3 className="font-display text-lg font-semibold leading-snug text-fg">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-muted">
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
      <section className="border-t border-line bg-surface py-14">
        <div className="container-page flex flex-col gap-5">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
            What DarkPrint does with any of this
          </h2>
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            This site holds the layer the account spends the least time on and the one that
            is hardest to copy from a blog post: the graph. Which nodes exist, what flows
            between them, what each node is forbidden to receive, and which model each one
            runs on. None of the four file formats above describes that layer, and{" "}
            <Link href="/spec" className={INLINE}>
              the three it is written in
            </Link>{" "}
            are a DOT topology, one versioned card per node, and a controlled vocabulary
            both are written against. DarkPrint reads a bundle, computes an autonomy class
            and a security level off the drawing without executing a line, and hands you
            the files.
          </p>
          {/* Constraint 0.4, and the one surviving copy of it on this route. The same
              sentence /what-it-isnt carries, on the page most likely to read as a pitch. */}
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
              on a phone, standing between the reader and the pager on a page that is
              fourteen viewport-heights long. The "read in full / not read by us" marks are
              why the list exists and why it is not deleted: they stay in the prerendered
              HTML and one click away. */}
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
                    className="w-fit rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
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
