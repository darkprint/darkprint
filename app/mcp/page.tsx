import type { Metadata } from "next";

import Link from "next/link";

import { InstallTabs } from "@/components/mcp/InstallTabs";
import { MCP_ENDPOINT_URL } from "@/components/mcp/clients";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BUNDLE_CARDS_DIR, BUNDLE_README, TOPOLOGY_DOT } from "@/lib/content/bundle-export";
import { NPX_INVOCATION } from "@/packages/cli/src/index";

/* ============================================================
   /mcp: how a coding agent reads the registry

   Everything on this page describes the remote server at /api/mcp
   and the seven tools it serves. The tool table below is the
   advertised list: `tests/server/t220/surface.test.ts` reads
   `OPERATIONS` off this file and holds the server barrel to one
   verb per tool, so a tool added here without a verb reds there.
   Prerendered: nothing here reads the database, and the imports
   stay on pure modules so that stays true.
   ============================================================ */

export const metadata: Metadata = {
  title: "Connect via MCP",
  description: `Give your coding agent read access to the DarkPrint registry over MCP. One command adds ${MCP_ENDPOINT_URL} to Claude Code, Codex, Cursor or VS Code, with nothing to install. Search by task, read a card, fetch a whole blueprint pinned to its digest.`,
};

/** One row per tool, in the order the server lists them. Names are the tool names an agent calls. */
const OPERATIONS = [
  {
    name: "find_blueprints",
    takes: "the task in prose, an optional limit (1 to 20, default 5), and whether to include forks",
    returns:
      "blueprints ranked best first, each with its ref, author, digest, title, summary, tags, score, similarity, evidence and a scorecard summary",
  },
  {
    name: "find_cards",
    takes: "the task in prose and an optional limit",
    returns:
      "node cards ranked best first, one per card id, each with its ref, digest, name, type, action, phases, tools, risk markers, the blueprints that use it, score, similarity and evidence",
  },
  {
    name: "get_blueprint",
    takes: "an owner handle and a slug; optionally an exact digest and a harness (claude-code, codex or generic)",
    returns: `the whole bundle in one answer: ${TOPOLOGY_DOT}, every card it pins under ${BUNDLE_CARDS_DIR}/, ${BUNDLE_README}, plus its manifest, scorecard, provenance and numbered steps for instantiating it`,
  },
  {
    name: "read_card",
    takes: "a card reference, written id@version",
    returns:
      "the card's YAML as published: what the node does, which phase it works in, its inputs and outputs, and what must never reach it",
  },
  {
    name: "inspect_provenance",
    takes: "an owner handle and a blueprint slug",
    returns: "who published it, what it was forked from, and every release with its version and digest",
  },
  {
    name: "fetch_release",
    takes: "an owner handle, a slug and an exact digest",
    returns:
      "the list of files in that exact release; each file is then fetched from /api/files by path, or all at once through get_blueprint",
  },
  {
    name: "export_pipeline",
    takes: "an owner handle, a slug and an exact digest",
    returns:
      "that release compiled into a pipeline file for Attractor, the runner DarkPrint compiles to, with a header naming what a DarkPrint blueprint could not express in it",
  },
] as const;

/** How to read what comes back, and the two limits of the server. */
const NOTES = [
  {
    label: "order",
    body:
      "Results come back ranked by how close each blueprint or card is to the task you described, best match first: the cosine similarity between your task and the document DarkPrint keeps for it, plus a small bonus for words that match. Each hit shows its score and lists every field a word matched, so you can check the order against the documents. The score is a similarity and says nothing about quality. When the vector channel is unavailable the response says encoder: absent and the order is word matches alone.",
  },
  {
    label: "what a hit contains",
    body:
      "A find hit carries identifiers, a scorecard summary and the evidence, never a copy of the document. get_blueprint returns the whole bundle in one answer and read_card returns one card, each pinned to the version or digest you asked for, so nothing you act on is an unversioned excerpt.",
  },
  {
    label: "who is asking",
    body:
      "Send an API key from Settings as a bearer token and get_blueprint, read_card, inspect_provenance and fetch_release also reach your own private blueprints; the two find tools search public blueprints only. A key of either scope raises the rate limit, and none lets this server write anything.",
  },
  {
    label: "cards and releases",
    body:
      "A card is pinned by its id and version. A release is pinned by its digest, a SHA-256 hash over the graph and the cards it pins, attribution aside. They are two different guarantees, and your agent asks for whichever one it needs.",
  },
] as const;

export default function McpPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Read-only MCP server"
        title="Connect via MCP"
        lead="Connect DarkPrint and your agent can search the registry by describing the task in its own words. It can then fetch a whole blueprint with the steps to instantiate it, read a card, inspect provenance, or fetch a release by digest."
      />

      {/* ---------- 1. Connect a client ---------- */}
      <section
        id="connect"
        aria-labelledby="connect-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5"
      >
        <h2 id="connect-title" className="font-display text-2xl font-semibold text-fg">
          1. Connect a client
        </h2>
        <p className="text-[15px] leading-relaxed text-muted">
          Pick your client and run the command, or paste the JSON into its MCP settings. The
          server is remote, so there is nothing to install and nothing to keep updated.
        </p>
        <InstallTabs />
        <p className="text-sm leading-relaxed text-dim">
          The same server also runs on your own machine over stdio, as{" "}
          <code className="font-mono text-[13px] text-blueprint-ink">{NPX_INVOCATION} mcp</code>
          . The darkprint package is not published to npm yet, so use the remote address
          above.
        </p>
        <p className="text-sm leading-relaxed text-dim">
          The server can only read. Without a key every call reads as anonymous and sees public
          blueprints and cards only; a key from{" "}
          <Link
            href="/settings"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            Settings
          </Link>
          , sent as a bearer token, raises the rate limit and lets the four addressed tools
          reach your own private blueprints. Nothing here runs a blueprint.
        </p>
      </section>

      {/* ---------- 2. The tools ---------- */}
      <section
        id="tools"
        aria-labelledby="tools-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2 id="tools-title" className="font-display text-2xl font-semibold text-fg">
          2. The tools
        </h2>
        <p className="text-[15px] leading-relaxed text-muted">
          Seven tools. Two search by task, one returns a whole blueprint, three read one thing
          by its address, and one compiles a release for Attractor. Each returns facts about a
          blueprint or a card and no judgement of it: what it is, who published it, and the
          digest it was published under.
        </p>

        <div className="overflow-x-auto rounded-xl border border-line bg-surface-2">
          <table className="w-full min-w-[46rem] table-fixed border-collapse text-left">
            {/* Four percentages under `table-fixed` so the tracks resolve deterministically;
                `returns` is the widest because it carries a sentence where `takes` carries a
                phrase, and auto layout hands the surplus the other way round. */}
            <colgroup>
              <col style={{ width: "17.5%" }} />
              <col style={{ width: "34.5%" }} />
              <col style={{ width: "39.5%" }} />
              <col style={{ width: "8.5%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="label px-5 py-3 font-normal">
                  Tool
                </th>
                <th scope="col" className="label px-5 py-3 font-normal">
                  Takes
                </th>
                <th scope="col" className="label px-5 py-3 font-normal">
                  Returns
                </th>
                <th scope="col" className="label px-5 py-3 font-normal">
                  Status
                </th>
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
                  <td className="px-5 py-4 align-top text-sm leading-relaxed text-muted">
                    {op.takes}
                  </td>
                  <td className="px-5 py-4 align-top text-sm leading-relaxed text-muted">
                    {op.returns}
                  </td>
                  {/* Emerald is the register the site spends on a figure read off the engine,
                      and a live route is exactly that. */}
                  <td className="whitespace-nowrap px-5 py-4 align-top font-mono text-[11px] tracking-[0.06em] text-emerald">
                    live
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[15px] leading-relaxed text-muted">
          Fetch by slug and you get whatever the registry holds today. Fetch by digest and you
          get the bytes you tested against, even after a newer release is cut.
        </p>

        <p className="text-[15px] leading-relaxed text-muted">
          <code className="font-mono text-[13px] text-blueprint-ink">export_pipeline</code> is
          the one tool that is not a registry read. It takes the files of one release and
          compiles them into a pipeline for Attractor, which is what{" "}
          <code className="font-mono text-[13px] text-blueprint-ink">
            darkprint export &lt;dir&gt; --attractor
          </code>{" "}
          does in a terminal. The file opens with a header listing what a DarkPrint blueprint
          cannot express in Attractor&rsquo;s format. Some settings the runner fills in with its
          own defaults. Others a handler requires, and leaving one empty makes the run refuse
          rather than guess.
        </p>
      </section>

      {/* ---------- 3. How to read the results ---------- */}
      <section
        id="results"
        aria-labelledby="results-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2 id="results-title" className="font-display text-2xl font-semibold text-fg">
          3. How to read the results
        </h2>
        <ol className="flex min-w-0 flex-col border-t border-line">
          {NOTES.map((item) => (
            <li
              key={item.label}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 border-b border-line py-3.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-5"
            >
              <span className="font-mono text-[12px] leading-relaxed tracking-[0.06em] text-blueprint-ink">
                {item.label}
              </span>
              <p className="min-w-0 text-[15px] leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Without MCP ---------- */}
      <section
        id="today"
        className="mt-11 flex scroll-mt-24 flex-col gap-3 border-t border-line pt-10"
      >
        <span className="label">Without MCP</span>
        <p className="text-[15px] leading-relaxed text-muted">
          Everything these tools return is also reachable by hand: browse{" "}
          <Link
            href="/blueprints"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            the blueprints
          </Link>
          , or{" "}
          <Link
            href="/nodes"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            the cards
          </Link>
          , where every card is listed with its digest. To have your agent write a blueprint
          rather than read one, see{" "}
          <Link
            href="/skill"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            Assisted Design
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
