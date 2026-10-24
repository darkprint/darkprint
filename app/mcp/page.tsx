import type { Metadata } from "next";

import Link from "next/link";

import { InstallTabs } from "@/components/mcp/InstallTabs";
import { MCP_ENDPOINT_URL, MCP_FIRST_PROMPT } from "@/components/mcp/clients";
import { CodePanel, GuideStepHeading, guideStyles as guide } from "@/components/ui/Guide";
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
    "Connect your agent to the registry with no package to install. Find blueprints and cards to adapt locally. DarkPrint does not run a blueprint.",
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

const CONCRETE_PROMPT = MCP_FIRST_PROMPT.replace("<your task>", "reviewing pull requests");

export default function McpPage() {
  return (
    <div className={`${guide.page} container-page py-16 sm:py-20`}>
      <SectionHeading
        as="h1"
        eyebrow="AI tools · read-only"
        title="Connect via MCP"
        lead="Let your agent find blueprints and cards for your task. Public reads need no sign-in."
      />

      <section
        id="connect"
        aria-labelledby="connect-title"
        className={`${guide.panel} mt-9 flex scroll-mt-24 flex-col gap-5`}
      >
        <GuideStepHeading id="connect-title" index={1} title="Connect a client" />
        <p className={guide.prose}>
          Choose your agent below. Remote server:{" "}
          <code className="font-mono text-[13px] text-blueprint-ink">{MCP_ENDPOINT_URL}</code>.
          There is nothing to install for the remote connection.
        </p>
        <InstallTabs />
        <p className="text-sm leading-relaxed text-dim">
          For stdio, use{" "}
          <code className="font-mono text-[13px] text-blueprint-ink">{NPX_INVOCATION} mcp</code>. This downloads the darkprint package from npm.
        </p>
        <p className="text-sm leading-relaxed text-dim">
          Without a key, every call is anonymous. A bearer key from{" "}
          <Link
            href="/settings"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan"
          >
            Settings
          </Link>{" "}
          raises the rate limit and lets you fetch your own private blueprints by name.
          Search stays public-only. MCP is read-only.
        </p>
      </section>

      <section
        id="tools"
        aria-labelledby="tools-title"
        className={`${guide.panel} mt-6 flex scroll-mt-24 flex-col gap-5`}
      >
        <GuideStepHeading id="tools-title" index={2} title="Ask about a task" />
        <CodePanel title="Try this in your agent" text={CONCRETE_PROMPT} ariaLabel="Copy the example MCP task prompt" prose />
      </section>

      <section
        id="results"
        aria-labelledby="results-title"
        className={`${guide.panel} mt-6 flex scroll-mt-24 flex-col gap-5`}
      >
        <GuideStepHeading id="results-title" index={3} title="Review the files" />
        <p className={guide.prose}>
          A similarity score says nothing about quality. Read the matched files before adapting them.
        </p>
        <ol className="flex flex-col gap-4 border-t border-line pt-4">
          <li className={guide.prose}>
            <strong className="font-medium text-fg">Blueprint:</strong> review the graph, version-pinned
            cards, scorecard and provenance.
          </li>
          <li className={guide.prose}>
            <strong className="font-medium text-fg">Card:</strong> read the exact version,{" "}
            <code className="font-mono text-[13px] text-blueprint-ink">id@version</code>.
            Reuse it unchanged; adaptations need a new identity and version.
          </li>
        </ol>
        <p className="text-sm leading-relaxed text-dim">
          Nothing here runs a blueprint. Execution depends on a runner you choose and happens in your own environment.
        </p>
      </section>

      <section
        id="details"
        aria-labelledby="details-title"
        className={`${guide.panel} mt-6 flex scroll-mt-24 flex-col gap-5`}
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
            says nothing about quality. Fetching by name returns the current release. A digest, the release’s SHA-256 hash, pins
            the graph and cards in an exact release. A reused card is pinned by its
            id and version.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            With a key, you can fetch your own private blueprints by name. Search remains
            public-only. Neither key scope can write. Attractor export documents settings the
            target format cannot represent; a runner may provide defaults or refuse when a
            required setting is missing.
          </p>
        </More>
      </section>
    </div>
  );
}
