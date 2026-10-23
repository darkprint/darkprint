import type { Metadata } from "next";

import Link from "next/link";

import { InstallTabs } from "@/components/mcp/InstallTabs";
import { MCP_ENDPOINT_URL, MCP_FIRST_PROMPT } from "@/components/mcp/clients";
import { CopyButton } from "@/components/ui/CopyButton";
import { More } from "@/components/ui/More";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BUNDLE_CARDS_DIR, BUNDLE_README, TOPOLOGY_DOT } from "@/lib/content/bundle-export";
import { NPX_INVOCATION } from "@/packages/cli/src/index";

/* ============================================================
   /mcp: connect an agent, ask about a real task, review what comes back.

   The tool table is the advertised surface. `tests/server/t220/surface.test.ts` reads
   `OPERATIONS` and holds the MCP server to one verb per tool, so a tool added here without
   a server implementation fails there. This page stays on pure modules and prerenders.
   ============================================================ */

export const metadata: Metadata = {
  title: "Connect via MCP",
  description:
    "Connect an agent to DarkPrint's remote MCP server with no package to install. Search public workflows or reusable cards, then review provenance and adapt locally. Public reads need no sign-in. DarkPrint does not run a blueprint.",
};

/** One row per tool, in the order the server lists them. Names are the tool names an agent calls. */
const OPERATIONS = [
  {
    name: "find_blueprints",
    takes: "A task in prose, with optional result and structure filters.",
    returns: "Public workflow matches, their scorecard summaries and evidence for the match.",
  },
  {
    name: "find_cards",
    takes: "A task in prose and an optional result limit.",
    returns: "Public versioned cards that may fit, with their type, risks, uses and match evidence.",
  },
  {
    name: "get_blueprint",
    takes: "An owner and slug, optionally an exact digest and client harness.",
    returns: `The workflow bundle: ${TOPOLOGY_DOT}, its pinned cards under ${BUNDLE_CARDS_DIR}/, ${BUNDLE_README}, scorecard, provenance and instantiation steps.`,
  },
  {
    name: "read_card",
    takes: "A card reference in id@version form.",
    returns: "The published card, including its job, inputs, outputs and restrictions.",
  },
  {
    name: "inspect_provenance",
    takes: "An owner and blueprint slug.",
    returns: "The publisher, any source blueprint and the release history.",
  },
  {
    name: "fetch_release",
    takes: "An owner, slug and exact digest.",
    returns: "The file list for that exact release; get_blueprint can return the complete bundle.",
  },
  {
    name: "export_pipeline",
    takes: "An owner, slug and exact digest.",
    returns: "An Attractor pipeline compiled from that release, with a header describing what it cannot express.",
  },
] as const;

const CONCRETE_PROMPT = MCP_FIRST_PROMPT.replace("<your task>", "review my pull requests");

export default function McpPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="AI tools · read-only"
        title="Connect via MCP"
        lead="Connect a client, give your agent a real task, then review a matching workflow or useful cards before adapting anything locally. Public reads need no sign-in. DarkPrint does not run blueprints."
      />

      <section
        id="connect"
        aria-labelledby="connect-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5"
      >
        <h2 id="connect-title" className="font-display text-2xl font-semibold text-fg">
          1. Connect a client
        </h2>
        <p className="text-[15px] leading-relaxed text-muted">
          Choose a client and use its setup command. The remote server is at{" "}
          <code className="font-mono text-[13px] text-blueprint-ink">{MCP_ENDPOINT_URL}</code>;
          there is nothing to install for the remote connection.
        </p>
        <InstallTabs />
        <p className="text-sm leading-relaxed text-dim">
          For a client that cannot reach the remote server, the same MCP tools are available
          locally over stdio with{" "}
          <code className="font-mono text-[13px] text-blueprint-ink">{NPX_INVOCATION} mcp</code>.
        </p>
        <p className="text-sm leading-relaxed text-dim">
          Without a key, every call is anonymous and can read public blueprints and cards. Public
          search needs no sign-in. A bearer key from{" "}
          <Link
            href="/settings"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan"
          >
            Settings
          </Link>{" "}
          raises the rate limit and lets addressed reads reach your own private blueprints. Search
          stays public-only. This server is read-only and never executes a blueprint.
        </p>
      </section>

      <section
        id="tools"
        aria-labelledby="tools-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2 id="tools-title" className="font-display text-2xl font-semibold text-fg">
          2. Ask about a task
        </h2>
        <p className="text-[15px] leading-relaxed text-muted">
          Give the agent a concrete task. It can search for a complete workflow or cards that do
          one useful part of the work.
        </p>
        <div className="flex min-w-0 items-start gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
          <pre className="min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere font-mono text-xs leading-relaxed text-blueprint-line">
            <code>{CONCRETE_PROMPT}</code>
          </pre>
          <CopyButton text={CONCRETE_PROMPT} ariaLabel="Copy the example MCP task prompt" />
        </div>
      </section>

      <section
        id="results"
        aria-labelledby="results-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2 id="results-title" className="font-display text-2xl font-semibold text-fg">
          3. Review, then adapt locally
        </h2>
        <p className="text-[15px] leading-relaxed text-muted">
          Search returns ranked matches and evidence, not a verdict. A similarity score says
          nothing about quality. Open the source and decide what fits before using any of it.
        </p>
        <ol className="flex flex-col gap-4 border-t border-line pt-4">
          <li className="text-[15px] leading-relaxed text-muted">
            <strong className="font-medium text-fg">Start with a whole workflow:</strong> ask for
            its graph, pinned cards, scorecard and provenance. A fetched bundle includes the
            files and a release digest. Review the edges, limits and source, then ask your agent
            to suggest local changes.
          </li>
          <li className="text-[15px] leading-relaxed text-muted">
            <strong className="font-medium text-fg">Reuse one useful node:</strong> read its full
            card at <code className="font-mono text-[13px] text-blueprint-ink">id@version</code>.
            Keep a reused card unchanged; an adapted card is a new versioned card with a new
            identity.
          </li>
        </ol>
        <p className="text-sm leading-relaxed text-dim">
          Nothing here runs a blueprint. DarkPrint only supplies files and read-only tools.
          Execution depends on a runner you choose and happens in your own environment, under
          your direction.
        </p>
      </section>

      <section
        id="details"
        aria-labelledby="details-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2 id="details-title" className="font-display text-2xl font-semibold text-fg">
          Tool reference
        </h2>
        <More summary="See all seven tools, search details and release guarantees">
          <p className="text-sm leading-relaxed text-muted">
            Two tools search by task. <code>get_blueprint</code> returns a complete workflow;
            <code>read_card</code> returns one pinned card. Other tools inspect provenance, fetch
            an exact release or compile one for Attractor. Export creates a pipeline file; it
            does not run it.
          </p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface-2 sm:hidden">
            {OPERATIONS.map((op) => (
              <li key={op.name} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 font-mono text-[13px] text-blueprint-ink wrap-anywhere">
                    {op.name}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.06em] text-emerald">live</span>
                </div>
                <dl className="flex flex-col gap-2.5 text-sm leading-relaxed text-muted">
                  <div>
                    <dt className="label">Takes</dt>
                    <dd className="mt-1">{op.takes}</dd>
                  </div>
                  <div>
                    <dt className="label">Returns</dt>
                    <dd className="mt-1">{op.returns}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface-2 sm:block">
            <table className="w-full min-w-[46rem] table-fixed border-collapse text-left">
              <colgroup>
                <col style={{ width: "17.5%" }} />
                <col style={{ width: "34.5%" }} />
                <col style={{ width: "39.5%" }} />
                <col style={{ width: "8.5%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="label px-5 py-3 font-normal">Tool</th>
                  <th scope="col" className="label px-5 py-3 font-normal">Takes</th>
                  <th scope="col" className="label px-5 py-3 font-normal">Returns</th>
                  <th scope="col" className="label px-5 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {OPERATIONS.map((op) => (
                  <tr key={op.name} className="border-b border-line last:border-b-0">
                    <th
                      scope="row"
                      className="px-5 py-4 align-top font-mono text-[13px] font-normal text-blueprint-ink"
                    >
                      {op.name}
                    </th>
                    <td className="px-5 py-4 align-top text-sm leading-relaxed text-muted">{op.takes}</td>
                    <td className="px-5 py-4 align-top text-sm leading-relaxed text-muted">{op.returns}</td>
                    <td className="whitespace-nowrap px-5 py-4 align-top font-mono text-[11px] tracking-[0.06em] text-emerald">live</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            Results combine vector similarity with matching words and return evidence. If vector
            search is unavailable, the response says so and uses word matches; the score still
            says nothing about quality. A slug fetch follows the current release. A digest pins
            the graph and cards in an exact release by SHA-256. A reused card is pinned by its
            id and version.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            With a key, addressed reads can reach your private blueprints, while search remains
            public-only. Neither key scope can write. Attractor export documents settings the
            target format cannot represent; a runner may provide defaults or refuse when a
            required setting is missing.
          </p>
        </More>
      </section>
    </div>
  );
}
