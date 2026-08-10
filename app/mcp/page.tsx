import type { Metadata } from "next";

import { InstallTabs } from "@/components/mcp/InstallTabs";
import { McpJourney } from "@/components/mcp/McpJourney";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { allBlueprints } from "@/lib/content";

export const metadata: Metadata = {
  title: "Connect via MCP",
  description:
    "Connect an agent client to DarkPrint, test the connection, search by task, inspect provenance, and fetch an exact blueprint release.",
};

export default function McpPage() {
  const results = allBlueprints().slice(0, 3).map((blueprint) => ({
    slug: blueprint.slug,
    title: blueprint.title,
    summary: blueprint.summary,
    digest: blueprint.digest,
    author: blueprint.author.displayName,
  }));

  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Agent-side registry"
        title="Connect via MCP"
        lead="The authoring skill creates a blueprint. MCP finds published blueprints and cards for the task already in front of your agent, with the exact digest and provenance attached."
      />

      <div className="mt-10 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section aria-labelledby="client-setup-title" className="min-w-0">
          <h2 id="client-setup-title" className="font-display text-2xl font-semibold text-fg">
            1. Configure your client
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Choose the client you use and add the registry configuration. Codex covers the
            CLI, IDE extension, and ChatGPT desktop app on one host; the other tabs show the
            native shape for each client. Start with registry read access only.
          </p>
        </section>
        <InstallTabs />
      </div>

      <div className="mt-8">
        <McpJourney results={results} />
      </div>

      <section className="mt-8 rounded-lg border border-line bg-surface-2/40 p-5">
        <p className="label">Retrieval contract still to decide</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Ranking, excerpt shape, authorization for private artifacts, and the mix of cards
          versus complete releases are product policy. Until that contract is settled, every
          result shown here exposes its artifact kind, author, exact digest, and inspection
          link instead of implying an unexplained relevance score.
        </p>
      </section>
    </div>
  );
}
