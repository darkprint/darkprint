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
   is missing is the endpoint it points at, and the section says so above the command rather
   than at the bottom of the page.

   That argument used to be printed ON the page, in §1's second paragraph, alongside a
   sentence about which clients share a host. Both came out with the 2026-08-11 density
   pass and the first of them is the paragraph above: an argument for where a section sits
   is a note to whoever edits the page, not to whoever reads it. The per-client detail is
   `InstallTabs`'s own note, which it prints per tab.

   ── What the 3a pass changed, and the one line of it that was refused ──
   Three sections, numbered and ruled apart, each opening on one line instead of two
   paragraphs; the four open questions out of their card grid and into the contract table's
   own hairline register, so the page carries one table register rather than a table plus a
   grid of panels.

   Two things did not follow the mock. Its `OPEN` rows cut each body to a single clause and
   those bodies are the most honest content on the route, so the rows are the mock's and the
   words are not — the author's call. And its lead reads "Nothing behind this page is built"
   where this one reads "There is no server behind this page", because
   `components/site/honesty.test.ts` pins that clause verbatim to this surface. The pin is
   also the better sentence: §1 prints configuration for a server, so the server is the
   thing a reader has to be told does not exist.

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
    takes: "the task, in the agent's own words",
    returns: "blueprints and cards, each with its kind, author and digest",
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
    returns: "who published it, what it was forked from, every release digest",
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
 *
 * ── The chrome went and the words did not ──
 * These were four `.panel` cards in a two-column grid until 2026-08-11. They are rows in the
 * same hairline register as the contract table above them now, which is the whole point of
 * the pass: one table register on the page instead of a table plus a card grid.
 *
 * The mock cuts each body to a single clause with it, and that half is deliberately NOT
 * taken — the author's own call, in as many words: "that reasoning is the most honest
 * content on the route and I do not want it traded for whitespace." So the label is the
 * mock's and the body is the argument: that a relevance score with no published derivation
 * is the kind of number this site refuses everywhere else, that an excerpt too large becomes
 * an unversioned copy of a digest-addressed document, that a card is addressed by id and
 * version while a release is addressed by the digest of every byte. A row can hold two lines.
 * The chrome was the problem.
 *
 * Labels are lowercase mono, which is what makes them labels rather than the `h3` headings
 * they were: a title-case heading in a row promises a section under it.
 */
const OPEN = [
  {
    label: "ranking",
    body: "Nothing has been decided about what comes back first. A relevance score with no published derivation is the kind of number this site refuses everywhere else, so either the ordering is explainable from the archive or results come back with their evidence and no order at all.",
  },
  {
    label: "excerpt shape",
    body: "How much of a card an agent gets before it fetches the whole thing. Too little and the agent fetches everything; too much and the excerpt becomes an unversioned copy of a document that is addressed by digest.",
  },
  {
    label: "authorization",
    body: "There is nothing to authorize. There are no accounts, so everything in the registry is public today, and every artifact an agent could reach is one anybody can already download over HTTP. A private bundle would need all three of an account, storage and a backend.",
  },
  {
    label: "cards or releases",
    body: "Whether an agent asks for a card, a whole release, or both, and what it means to pin one without the other. A card is addressed by id and version; a release is addressed by the digest of every byte in it, and those are different promises.",
  },
] as const;

export default function McpPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        /* The badge moves up to the eyebrow row, which is the mock's. It was beside the
           `h1` on the argument that it is the first correction the page owes a reader —
           that argument is why it moves: on the eyebrow row it is read BEFORE the title
           rather than after it, and "Design proposal · coming soon" is one statement about
           what this route is. `honesty.test.ts` is indifferent either way and says so: a
           badge is a glyph, a glyph is not a sentence, and the three registers it holds
           this page to are all words. */
        eyebrow={
          <>
            Design proposal <ComingSoonBadge />
          </>
        }
        title="Connect via MCP"
        /* The first sentence is the mock's and it is the improvement: it says what MCP
           would DO, in one line, where the old lead spent its opening on an agent that
           "should be able to" do something.

           The second sentence is NOT the mock's, and the difference is six words. The mock
           writes "Nothing behind this page is built"; this says "There is no server behind
           this page", because `components/site/honesty.test.ts` pins that clause verbatim
           to this surface and the pin is the stronger sentence. "Nothing behind this page
           is built" is vaguer about what "behind this page" means; the server is the
           specific thing §1's snippet implies exists, so the server is the thing named. */
        lead="MCP would let an agent read the registry without leaving its own session: the published blueprints and cards for the task in front of it, each with its digest and provenance. There is no server behind this page, so what follows is the contract being proposed rather than one you can call."
      />

      {/* ---------- 1. Connect a client ---------- */}
      {/* Stacked, not a two-column split, and the prose is one line where it was two
          paragraphs.

          The left column argued for the section's POSITION — "a reader looking for the
          contract looks for the snippet first, and a proposal that hides its interface
          behind two sections of prose is asking to be skimmed" — which is an argument for
          the docblock and not for the reader; it is in the header above. What is left is
          the one thing a reader needs beside the snippet, which is that the package it
          names does not exist. Per-client detail was the other half and `InstallTabs`
          carries its own note per tab.

          The sections are numbered now and ruled apart, which is what makes three sections
          read as one proposal rather than three pages. */}
      <section
        id="connect"
        aria-labelledby="connect-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5"
      >
        <h2 id="connect-title" className="font-display text-2xl font-semibold text-fg">
          1. Connect a client
        </h2>
        <p className="max-w-[820px] text-[15px] leading-relaxed text-muted">
          The shape of the configuration, so the proposal can be read against a real host.
          The package does not exist: running this adds a server that is not there.
        </p>
        <InstallTabs />
        <p className="text-sm leading-relaxed text-dim">
          Read access to the registry, and nothing else.
        </p>
      </section>

      {/* ---------- 2. What the server would expose ---------- */}
      <section
        id="contract"
        aria-labelledby="contract-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2
          id="contract-title"
          className="font-display text-2xl font-semibold text-fg"
        >
          2. What it would expose
        </h2>
        {/* "and no judgement of it" is the load-bearing half and stays adjacent to the
            facts it is contrasted with; the colon then expands what the facts are. The
            mock writes that contrast with a pair of em dashes, and `app/mcp/page.tsx` is
            walked by `workspace.test.ts`'s route check — `APP_EXEMPT` covers `app/nodes`,
            `app/ontology`, `app/upload`, `app/blueprints/[slug]` and `app/u`, and this
            route is not among them. So the parenthetical becomes a colon.

            The sentence about there being no function signatures is gone with it. That was
            an argument for how the table is written rather than something a reader needs
            in front of the table; the header keeps it. */}
        <p className="max-w-[820px] text-[15px] leading-relaxed text-muted">
          Four operations. Each returns facts about an artifact and no judgement of it: what
          it is, who wrote it, and the digest it was published under.
        </p>

        {/* Still a `<table>` with `scope` on both axes, which §B2 asks for by name and is
            right for the reason it always was: four operations against what each takes and
            returns is a grid of related values with headers on both axes. The mock draws it
            as a CSS grid of `<span>`s, which is the same picture with none of the
            semantics, so what is taken from the mock is the surface and the tracks — the
            sheet's own `--color-surface-2` rather than `--color-surface`, one ruled header
            row rather than a filled one, and the mock's `200px 1fr 1.15fr 100px`.

            `table-fixed` with a `<colgroup>` because auto layout does not reproduce those
            tracks: it hands surplus width to every column that can take it, which is the
            defect measured on the landing's ledger in the same pass. `overflow-x-auto` and
            `min-w` stay — the four columns are the point and a reader compares `takes`
            against `returns` across a row. */}
        <div className="overflow-x-auto rounded-xl border border-line bg-surface-2">
          <table className="w-full min-w-[46rem] table-fixed border-collapse text-left">
            {/* The mock's `200px minmax(0,1fr) minmax(0,1.15fr) 100px`, expressed as four
                percentages so `table-fixed` resolves them deterministically: a mix of
                pixels and percentages under fixed layout is normalised by the browser when
                the two over-run the table, which is not a rule worth relying on. At the
                1152px container these land 202 / 397 / 455 / 98 against the mock's
                200 / 396 / 456 / 100.

                `returns` is the widest track and that is the point of stating them at all:
                it is the column carrying a sentence, `takes` carries a phrase, and auto
                layout hands the surplus the other way round. */}
            <colgroup>
              <col style={{ width: "17.5%" }} />
              <col style={{ width: "34.5%" }} />
              <col style={{ width: "39.5%" }} />
              <col style={{ width: "8.5%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-line">
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
                  {/* Every row says the same thing, and it is repeated per row rather than
                      stated once above the table: a four-row table with one caption is read
                      as three built operations and a caption about something else.
                      `honesty.test.ts` holds this column. Lower case at the mock's tracking
                      — the pin compares lowercased, so the case is a design choice and the
                      claim is unaffected. */}
                  <td className="whitespace-nowrap px-5 py-4 align-top font-mono text-[11px] tracking-[0.06em] text-amber">
                    not built
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="max-w-[820px] text-[15px] leading-relaxed text-muted">
          The digest is the load-bearing part. Fetch by slug and you get whatever the
          registry holds today; fetch by digest and you get the bytes you tested against.
        </p>
      </section>

      {/* ---------- 3. Still to decide ---------- */}
      <section
        id="open-questions"
        aria-labelledby="open-questions-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2
          id="open-questions-title"
          className="font-display text-2xl font-semibold text-fg"
        >
          3. Still to decide
        </h2>
        <p className="max-w-[820px] text-[15px] leading-relaxed text-muted">
          Four open questions, all product policy rather than implementation. They are why
          the contract above returns no ranking.
        </p>
        {/* Rows in the contract table's register, and the bodies kept whole. See `OPEN`:
            the chrome was the problem, the words were not, and the mock's one-clause
            versions are the one part of this page's design that is not taken.

            200px is the mock's label track, from `sm` up. Below it the two stack, which the
            mock has no width to show and a 200px column beside a forty-word body would need.
            `<ol>` because these are four of one kind and the page numbers its sections; the
            label is the item's own name rather than a header over a column, so no `<table>`
            is claimed. */}
        <ol className="flex min-w-0 max-w-[900px] flex-col border-t border-line">
          {OPEN.map((item) => (
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

      {/* ---------- What exists today ----------
          The page has spent three sections on something unbuilt, and the honest close is
          the three places a reader can go that are not. `/skill` is the one that runs. */}
      <section
        id="today"
        aria-labelledby="today-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2 id="today-title" className="font-display text-2xl font-semibold text-fg">
          What exists today instead
        </h2>
        {/* One sentence where there were two. "What is missing is the agent-side door, not
            the contents" restated the section's own heading, and the three boxes below say
            where to go better than a clause can.

            The mock goes further and replaces the boxes with this sentence carrying three
            inline links, which is §B4 of the hand-off and is NOT approved: `/skill` bans
            route-boxes by an explicit 2026-08-07 ruling and `/mcp` was never covered by
            it, so this page uses them deliberately as its ending. The paragraph is
            shortened as asked and the boxes stay until the author says otherwise. No inline
            links in it for that reason — the three routes are named once, in the boxes,
            rather than twice. */}
        <p className="max-w-[820px] text-[15px] leading-relaxed text-muted">
          Everything this contract would return is already here, addressed by hand.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
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
