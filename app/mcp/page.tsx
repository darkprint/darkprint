import type { Metadata } from "next";

import { InstallTabs } from "@/components/mcp/InstallTabs";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { RouteBoxLink } from "@/components/ui/RouteBoxLink";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  BUNDLE_AGENTS,
  BUNDLE_README,
  BUNDLE_CARDS_DIR,
  TOPOLOGY_DOT,
} from "@/lib/content/bundle-export";

/* ============================================================
   /mcp — a design proposal, re-registered as one.

   `lib/mcp.ts` says it plainly: there is no MCP server behind the registry and no
   `darkprint` package on npm. The page was nevertheless shaped like a setup page. It
   opened "1. Configure your client", which is the register `/skill` uses for a command
   that genuinely runs; it carried `McpJourney`, a connect button that set local state and
   a search button that revealed three real blueprints as though they had been retrieved;
   and its `<head>` description promised a reader could "connect an agent client to
   DarkPrint, test the connection, search by task, inspect provenance, and fetch an exact
   blueprint release." Every one of those verbs describes something that does not exist.

   The fix is not a louder badge. It is to say what the page IS, which is a proposal, and
   then be a good one: what a client would connect to, what the server would expose, and
   what has not been decided. Doc 2 §0.4 is the rule and `components/site/honesty.test.ts`
   is where the description now has to keep saying it.

   ── Why "Connect a client" is first ──
   It answers "how would I use this" before the page spends two sections on what "this" is,
   and it is where a reader looks. The snippet is real configuration for a real client; what
   is missing is the endpoint it points at, and the panel says so beside the command rather
   than at the bottom of the page.

   ── No invented tool names ──
   The contract table names four operations in words and gives each one what it takes and
   what it returns. There are no `search_blueprints(...)` signatures on this page because no
   signature has been designed, and a plausible one would be the same lie `McpJourney` was
   telling in a different font. The operations are the ones the page's own description has
   always claimed; the returned fields are the ones the journey component used to show.
   ============================================================ */

export const metadata: Metadata = {
  /* The one description on the site where the shared-link preview is all that stands
     between a reader and a command that looks runnable. It used to read "Connect an agent
     client to DarkPrint, test the connection, search by task, inspect provenance, and fetch
     an exact blueprint release", five capabilities in the present tense and no server behind
     any of them. `honesty.test.ts` holds the replacement. */
  title: "MCP, as a design proposal",
  description:
    "A design proposal, not a setup guide: there is no MCP server behind the registry yet. What a client would connect to, the four operations the server would expose, and what is still to decide.",
};

/** One row of the proposed contract. Words, not signatures: see the header. */
const OPERATIONS = [
  {
    name: "search",
    takes: "the work in front of the agent, in its own words",
    returns:
      "blueprints and cards, each with its artifact kind, author and digest",
  },
  {
    name: "read a card",
    takes: "a card id",
    returns:
      "the YAML as published: phase, kind, ports, and what must never reach it",
  },
  {
    name: "inspect provenance",
    takes: "a blueprint slug",
    returns:
      "who published it, what it was forked from, and every release digest",
  },
  {
    name: "fetch a release",
    takes: "a slug and an exact digest",
    /* The four names come from `bundle-export.ts`, which is what actually writes them into
       every folder under `public/bundles/`. A proposal that named files the exporter does
       not produce would be describing a different registry. */
    returns: `the bundle: ${TOPOLOGY_DOT}, ${BUNDLE_CARDS_DIR}/*.yaml, ${BUNDLE_README}, ${BUNDLE_AGENTS}`,
  },
] as const;

/**
 * The four open questions, promoted out of a footnote.
 *
 * They were one paragraph at the foot of the page under "Retrieval contract still to
 * decide", which is where a reader stops reading. They are the most honest content on the
 * route: a proposal that lists what it has not settled is a proposal, and one that does not
 * is a specification with holes in it.
 */
const OPEN = [
  {
    title: "Ranking",
    body: "Nothing has been decided about what comes back first. A relevance score with no published derivation is the kind of number this site refuses everywhere else, so either the ordering is explainable from the archive or results come back with their evidence and no order at all.",
  },
  {
    title: "Excerpt shape",
    body: "How much of a card an agent gets before it fetches the whole thing. Too little and the agent fetches everything; too much and the excerpt becomes an unversioned copy of a document that is addressed by digest.",
  },
  {
    title: "Authorization",
    body: "There is nothing to authorize. There are no accounts, so everything in the registry is public today, and every artifact an agent could reach is one anybody can already download over HTTP. A private bundle would need all three of an account, storage and a backend.",
  },
  {
    title: "Cards versus releases",
    body: "Whether an agent asks for a card, a whole release, or both, and what it means to pin one without the other. A card is addressed by id and version; a release is addressed by the digest of every byte in it, and those are different promises.",
  },
] as const;

export default function McpPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Design proposal"
        title={
          <>
            Connect via MCP{" "}
            {/* Beside the `h1` rather than further down, because the badge is the first
                correction the page owes a reader and the lead is the second. */}
            <ComingSoonBadge />
          </>
        }
        lead="An agent that already has a task should be able to ask the registry for a blueprint that fits it, and get back the exact bytes with the provenance attached. There is no server behind this page, so what follows is the contract being proposed rather than one you can call."
      />

      {/* ---------- 1. Connect a client ---------- */}
      <section
        id="connect"
        aria-labelledby="connect-title"
        className="mt-10 scroll-mt-24 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"
      >
        <div className="min-w-0">
          <h2
            id="connect-title"
            className="font-display text-2xl font-semibold text-fg"
          >
            Connect a client
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This is the shape the configuration would take, per client, and it is real
            configuration: what is missing is the server it points at. Codex covers the CLI,
            the IDE extension and the desktop app on one host; the other tabs show the
            native shape for each client.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Running one of these today adds a server entry that will fail to start. It is
            here because a reader looking for the contract looks for the snippet first, and
            a proposal that hides its interface behind two sections of prose is asking to be
            skimmed.
          </p>
        </div>
        <InstallTabs />
      </section>

      {/* ---------- 2. What the server would expose ---------- */}
      <section
        id="contract"
        aria-labelledby="contract-title"
        className="mt-14 scroll-mt-24"
      >
        <h2
          id="contract-title"
          className="font-display text-2xl font-semibold text-fg"
        >
          What the server would expose
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Four operations, named in words. There are no function signatures on this page
          because none has been designed, and a plausible one would read as an interface
          somebody could code against.
        </p>

        {/* `overflow-x-auto` and not a stacked card list: the three columns are the point,
            and a reader compares `takes` against `returns` across a row. */}
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                <th scope="col" className="label px-5 py-3 font-normal">
                  Operation
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
                    className="px-5 py-4 align-top font-mono text-[13px] font-normal text-fg"
                  >
                    {op.name}
                  </th>
                  <td className="px-5 py-4 align-top text-[13px] leading-relaxed text-muted">
                    {op.takes}
                  </td>
                  <td className="px-5 py-4 align-top text-[13px] leading-relaxed text-muted">
                    {op.returns}
                  </td>
                  {/* Every row says the same thing, and it is repeated per row rather than
                      stated once above the table: a four-row table with one caption is read
                      as three built operations and a caption about something else. */}
                  <td className="whitespace-nowrap px-5 py-4 align-top font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
                    not built
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
          The digest is the load-bearing part of the last row. Fetching by slug gets whatever
          the registry holds today; fetching by digest gets the bytes the agent was tested
          against, which is the only version of this that is worth an agent&rsquo;s trust.
        </p>
      </section>

      {/* ---------- 3. Still to decide ---------- */}
      <section
        id="open-questions"
        aria-labelledby="open-questions-title"
        className="mt-14 scroll-mt-24"
      >
        <h2
          id="open-questions-title"
          className="font-display text-2xl font-semibold text-fg"
        >
          Still to decide
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Four questions this proposal does not answer. They are product policy rather than
          engineering, and naming them is what separates a proposal from a specification with
          holes in it.
        </p>
        <ol className="mt-5 grid gap-5 md:grid-cols-2">
          {OPEN.map((item) => (
            <li key={item.title} className="panel flex flex-col gap-2 p-5">
              <h3 className="font-display text-lg font-semibold leading-snug text-fg">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- What exists today ----------
          The page has spent three sections on something unbuilt, and the honest close is
          the three places a reader can go that are not. `/skill` is the one that runs. */}
      <section
        id="today"
        aria-labelledby="today-title"
        className="mt-14 scroll-mt-24 border-t border-line pt-10"
      >
        <h2 id="today-title" className="font-display text-2xl font-semibold text-fg">
          What exists today instead
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Everything the proposed server would hand an agent is already in the archive and
          already addressable over HTTP. What is missing is the agent-side door, not the
          contents.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <RouteBoxLink
            href="/blueprints"
            label={
              <>
                Browse <span aria-hidden>&rarr;</span>
              </>
            }
            title="Every published blueprint, with its digest"
          />
          <RouteBoxLink
            href="/nodes"
            label={
              <>
                Cards <span aria-hidden>&rarr;</span>
              </>
            }
            title="Every node card, by id and version"
          />
          <RouteBoxLink
            href="/skill"
            label={
              <>
                Assisted Design <span aria-hidden>&rarr;</span>
              </>
            }
            title="The one command here that runs"
          />
        </div>
      </section>
    </div>
  );
}
