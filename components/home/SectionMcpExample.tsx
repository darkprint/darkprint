import Link from "next/link";

import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
import { MCP_FIRST_PROMPT } from "@/components/mcp/clients";
import { CopyButton } from "@/components/ui/CopyButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getBlueprintBySlug } from "@/lib/content";
import { cx } from "@/lib/format";
import { blueprintRecordHref } from "@/lib/href";

import { BeatCaption } from "./BeatCaption";

/* ============================================================
   One task taken through the MCP server, from the prompt to the run.

   The task is one a published blueprint covers only in part, because
   that is the common case and the agreement step is where the rest
   gets added. `mcp-example.test.ts` holds every fact below to the
   archive and to the search, and no score is printed because scores
   move as the registry grows.
   ============================================================ */

/** The account the seed publishes under, so a ref here reads as `find_blueprints` returns it. */
export const EXAMPLE_OWNER = "autogen";

/** The task as a person would type it, without the full stop the prompt supplies. */
export const EXAMPLE_TASK =
  "every night, take the day's new orders from our Postgres database, clean and validate them, " +
  "load them into the reporting table, and email the sales team a one-page summary each morning";

/** The `/mcp` page's first prompt with the task filled in, so the two can never disagree. */
export const EXAMPLE_PROMPT = MCP_FIRST_PROMPT.replace("<your task>", EXAMPLE_TASK);

/** What `find_blueprints` ranks first and second for `EXAMPLE_TASK`, best first. */
export const EXAMPLE_HITS = ["nightly-data-janitor", "pipeline-observability"] as const;

/** The blueprint's straight line, and the loop a failed record takes, as node ids. */
export const EXAMPLE_LINE = ["raw", "extract", "normalize", "validate", "store", "publish"] as const;
export const EXAMPLE_LOOP = ["validate", "repair", "normalize"] as const;

/** The one node whose card marks its work irreversible, where the run contract has the agent stop. */
export const EXAMPLE_IRREVERSIBLE = "publish";

/** The node the agent adds for the email, fed by `store` because `publish` emits nothing. */
export const EXAMPLE_ADDED = "summary";
export const EXAMPLE_ADDED_AFTER = "store";

const LINK =
  "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan";

function Id({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px] text-blueprint-ink">{children}</code>;
}

function Route({ ids }: { ids: readonly string[] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[13px] text-blueprint-ink">
      {ids.map((id, i) => (
        <span key={`${id}-${i}`} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-dim">
              →
            </span>
          )}
          {id}
        </span>
      ))}
    </p>
  );
}

/**
 * One row of the exchange. Violet marks the rows where the person acts and blueprint blue the
 * rows where the agent calls a tool, the same two meanings those colours carry site-wide.
 */
function Step({
  index,
  who,
  person,
  children,
}: {
  index: string;
  who: React.ReactNode;
  person: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="grid gap-3 border-t border-line px-5 py-6 first:border-t-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 sm:px-6">
      <div className="flex items-center gap-2.5 self-start font-mono text-[13px]">
        <span className="text-dim">{index}</span>
        <span
          aria-hidden
          className={cx(
            "h-[7px] w-[7px] shrink-0 rounded-full",
            person ? "bg-violet" : "bg-blueprint-line",
          )}
        />
        <span className={person ? "text-violet" : "text-blueprint-line"}>{who}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-4 text-[15px] leading-relaxed text-muted">
        {children}
      </div>
    </li>
  );
}

export function SectionMcpExample() {
  const hits = EXAMPLE_HITS.map((slug) => {
    const blueprint = getBlueprintBySlug(slug);
    if (blueprint === undefined) throw new Error(`The landing's example names ${slug}, which the archive does not hold.`);
    return blueprint;
  });
  const [chosen] = hits;

  return (
    <section id="example" className="scroll-mt-24 border-t border-line bg-void py-14 sm:py-20">
      <div className="container-page">
        <SectionHeading
          title="A real task, matched to a blueprint"
          lead="MCP finds a close fit. Your agent adapts it locally, and you approve the graph before it runs."
          align="center"
          className="mx-auto"
        />

        <ol className="panel mt-8">
          <Step index="01" who="Your task" person>
            <p>
              Process each night&apos;s new orders, load valid records, and email the sales team a
              one-page summary.
            </p>
          </Step>
          <Step index="02" who="MCP match" person={false}>
            <p>
              The top registry hit is{" "}
              <Link
                href={blueprintRecordHref({ slug: chosen.slug, ownerHandle: EXAMPLE_OWNER })}
                className={cx("font-mono text-[13px]", LINK)}
              >
                {EXAMPLE_OWNER}/{chosen.slug}
              </Link>
              , a real {chosen.graph.nodes.length}-node blueprint.
            </p>
          </Step>
          <Step index="03" who="Adapt locally" person={false}>
            <p>
              The agent adds <Id>{EXAMPLE_ADDED}</Id> after <Id>{EXAMPLE_ADDED_AFTER}</Id> for the
              email summary. The published blueprint has no email node.
            </p>
          </Step>
          <Step index="04" who="You approve" person>
            <p>
              Review and approve the graph first. Your agent then runs it locally, one node at a time,
              following the card-marked stop at irreversible work.
            </p>
          </Step>
        </ol>

        <details className="panel group mt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-muted transition-colors hoverable:hover:text-fg focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan [&::-webkit-details-marker]:hidden sm:px-6">
            <span>Full prompt, match, graph, and run contract</span>
            <span aria-hidden className="font-mono text-lg text-blueprint-line transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <ol className="border-t border-line">
            <Step index="01" who="You ask" person>
              <div className="flex min-w-0 items-start gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
                <pre className="min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere font-mono text-xs leading-relaxed text-blueprint-line">
                  <code>{EXAMPLE_PROMPT}</code>
                </pre>
                <CopyButton text={EXAMPLE_PROMPT} ariaLabel="Copy the example prompt" />
              </div>
            </Step>

            <Step index="02" who="find_blueprints" person={false}>
              <p>The agent searches the registry with your task. These are its top two hits.</p>
              <ul className="flex flex-col gap-2">
                {hits.map((hit, i) => (
                  <li
                    key={hit.slug}
                    className={cx(
                      "flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border px-3.5 py-2.5",
                      i === 0 ? "border-line-bright bg-surface-2" : "border-line",
                    )}
                  >
                    <span className="font-mono text-[13px] text-dim">{i + 1}</span>
                    <Link
                      href={blueprintRecordHref({ slug: hit.slug, ownerHandle: EXAMPLE_OWNER })}
                      className={cx("font-mono text-[13px]", LINK)}
                    >
                      {EXAMPLE_OWNER}/{hit.slug}
                    </Link>
                    <span className="text-fg">{hit.title}</span>
                    <span className="font-mono text-[13px] text-dim">{hit.graph.nodes.length} nodes</span>
                  </li>
                ))}
              </ul>
            </Step>

            <Step index="03" who="get_blueprint" person={false}>
              <p>
                It writes the first hit&apos;s files under <Id>./{chosen.slug}/</Id> and shows you
                the graph with its scorecard.
              </p>
              <div className="rounded-lg border border-line bg-blueprint-deep/30 px-3 py-4">
                <GraphThumbnail
                  graph={chosen.graph}
                  className="mx-auto block h-auto w-full"
                  ariaLabel={`The ${chosen.title} graph`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Route ids={EXAMPLE_LINE} />
                <p className="text-sm text-dim">
                  A record that fails the schema goes back: <Id>{EXAMPLE_LOOP.join(" → ")}</Id>
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <p className="eyebrow">Covered by the blueprint</p>
                  <p>
                    It sweeps the rows changed since its last run, cleans them, checks each record
                    against a schema and loads the ones that pass into your table. Its last node,{" "}
                    <Id>{EXAMPLE_IRREVERSIBLE}</Id>, refreshes the views and posts the night&apos;s
                    counts to an ops channel.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="eyebrow">Added by your agent</p>
                  <p>
                    No node in it emails anyone. Your agent adds a <Id>{EXAMPLE_ADDED}</Id> node
                    after <Id>{EXAMPLE_ADDED_AFTER}</Id> that writes the one-page summary for the
                    sales team, and the run you agree to includes it.
                  </p>
                </div>
              </div>
            </Step>

            <Step index="04" who="You agree" person>
              <p>
                The agent runs the graph on your machine, one node at a time, each in its own
                context with only the inputs its card declares. No node here waits for a person,
                so the contract has the agent stop on its own wherever the work is irreversible,
                and <Id>{EXAMPLE_IRREVERSIBLE}</Id> is the node whose card says so.
              </p>
            </Step>
          </ol>
        </details>

        <BeatCaption href="/mcp" cta="Connect your agent">
          DarkPrint hands out the files and the run contract, and executes nothing.
        </BeatCaption>
      </div>
    </section>
  );
}
