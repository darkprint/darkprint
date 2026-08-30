import type { Metadata } from "next";

import Link from "next/link";

import { InstallTabs } from "@/components/mcp/InstallTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  BUNDLE_README,
  BUNDLE_CARDS_DIR,
  TOPOLOGY_DOT,
} from "@/lib/content/bundle-export";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-88) (cited at line 80): MCP tool
// TODO(SEAM-89) (cited at line 85): MCP tool
// TODO(SEAM-90) (cited at line 90): MCP tool
// TODO(SEAM-91) (cited at line 95): MCP tool
// TODO(SEAM-92) (cited at line 139): n/a

/* ============================================================
   /mcp — was a design proposal; T280 shipped it. See the header's last section before
   reading the rest of this one as current — the paragraphs below record why the page was
   rebuilt in 2026-08-11 against a registry that, at the time, had no server at all.

   `lib/mcp.ts` said it plainly, back then: there was no MCP server behind the registry and
   no `darkprint` package on npm. The page was nevertheless shaped like a setup page. It
   opened "1. Configure your client", which is the register `/skill` uses for a command
   that genuinely runs; it carried `McpJourney`, a connect button that set local state and
   a search button that revealed three real blueprints as though they had been retrieved;
   and its `<head>` description promised a reader could "connect an agent client to
   DarkPrint, test the connection, search by task, inspect provenance, and fetch an exact
   blueprint release." Every one of those verbs described something that did not exist yet.

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

   ── T280: the four operations go live, and the page stops calling itself a proposal ──
   `lib/server/mcp` ships all four verbs over HTTP at `/api/mcp/**` (D-220-10), and
   `packages/mcp` wraps them in a real stdio MCP server that any of the six client configs
   in §1 can point at once it is built from a checkout. What survives unchanged from every
   paragraph above: `darkprint` is not on npm (`npm view darkprint` answers 404, and
   `packages/mcp/package.json` is `private: true`), so `npx -y darkprint mcp` fails today
   exactly as it did before this wave, and the two open questions in §3 — ranking, and how
   much of a card an excerpt should carry — are still open, because nothing in T280 answered
   either one. `components/site/honesty.test.ts` pinned the old "there is no MCP server"
   sentence to this page; that file is frozen for this pass, so the pin goes stale here
   rather than being edited quietly, and the sentence that should replace it is reported
   alongside this diff for whoever re-pins it next.
   ============================================================ */

export const metadata: Metadata = {
  /* The one description on the site where the shared-link preview is all that stands
     between a reader and a command that looks runnable. It read "Connect an agent client to
     DarkPrint, test the connection, search by task, inspect provenance, and fetch an exact
     blueprint release" until 2026-08-11, then "there is no MCP server behind the registry
     yet" until T280 made that clause false too: `/api/mcp/**` answers all four operations
     now. `components/site/honesty.test.ts` still pins the older sentence — it is frozen for
     this pass — and phase C re-pins it against the sentence below. */
  title: "MCP, live over HTTP",
  description:
    "Four registry operations are live over HTTP at /api/mcp: search, read a card, inspect provenance, fetch a release. Running npx -y darkprint mcp still fails today: the darkprint package is not published to npm.",
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
    /* The three names come from `bundle-export.ts`, which is what actually writes them into
       every folder under `public/bundles/`. A proposal that named files the exporter does
       not produce would be describing a different registry. */
    returns: `the bundle: ${TOPOLOGY_DOT}, ${BUNDLE_CARDS_DIR}/*.yaml, ${BUNDLE_README}`,
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
    body: "Nothing has been decided about what comes back first. Everywhere else on this site, a relevance score with no published derivation gets refused. So either the ordering is explainable from the archive, or results come back with their evidence and no order at all.",
  },
  {
    label: "excerpt shape",
    body: "How much of a card an agent gets before it fetches the whole thing. If it gets too little, the agent fetches everything. If it gets too much, the excerpt becomes an unversioned copy of a document that is addressed by digest.",
  },
  {
    /* T280 built accounts, and this row is answered rather than removed: a question a
       shipped interface closes is worth saying so, the same way `/skill`'s UNBUILT rows
       point at where something now lives instead of deleting the row it used to occupy. */
    label: "authorization (resolved)",
    body: "Every MCP route reads as an anonymous caller, whatever session it is asked with. A private bundle is unreachable through MCP for the same reason it is unreachable over a bare curl request: nothing here checks who is asking. Accounts exist elsewhere on the site now. This surface deliberately still does not use them.",
  },
  {
    label: "cards or releases (resolved)",
    body: "The shipped contract answers this. Read a card returns one document by id and version. Fetch a release lists a whole release's files by digest. An agent asks for whichever promise it needs. A card pinned by version and a release pinned by digest stay two different guarantees, on purpose.",
  },
] as const;

export default function McpPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        /* "Design proposal · coming soon" made sense while the page had no interface behind
           it to name. T280 gave it one, so the eyebrow now names what the route IS rather
           than what it is waiting to become. `ComingSoonBadge` comes off the eyebrow with
           it — amber is spent on things that do not exist, and the four operations below
           do — and the one gap that marker was honestly about, the unpublished package,
           gets its own sentence in §1 rather than a glyph up here standing in for it.
           `honesty.test.ts` was indifferent to the badge either way and says so in its own
           header: a badge is a glyph, a glyph is not a sentence, and the three registers it
           holds this page to are all words. */
        eyebrow="Live contract"
        title="Connect via MCP"
        /* The first sentence keeps the mock's shape — what MCP DOES, in one line — now true
           in the present tense instead of the conditional the page opened on before T280.

           The second sentence is the one `components/site/honesty.test.ts` pins to "there
           is no server behind this page", verbatim, and that pin is stale rather than
           satisfied now: T280 put a server behind every one of the four operations below.
           What is still true, and still worth a reader's first ten seconds, is that the one
           command the page prints does not run yet — see §1 for why. */
        lead="MCP lets an agent read the registry without leaving its own session: the published blueprints and cards for the task in front of it, each with its digest and provenance. Four operations are live over HTTP. Running the command below still fails, because the darkprint package on npm does not exist yet."
      />

      {/* ---------- 1. Connect a client ---------- */}
      {/* Stacked, not a two-column split, and the prose is one line where it was two
          paragraphs.

          The left column argued for the section's POSITION — "a reader looking for the
          contract looks for the snippet first, and a page that hides its interface behind
          two sections of prose is asking to be skimmed" — which is an argument for the
          docblock and not for the reader; it is in the header above. What is left is the
          one thing a reader needs beside the snippet: the server these configs point at is
          real now (T280), and the package that would make any of them run is still not on
          npm. Per-client detail was the other half and `InstallTabs` carries its own note
          per tab.

          The sections are numbered and ruled apart, which is what makes three sections
          read as one contract rather than three pages. */}
      <section
        id="connect"
        aria-labelledby="connect-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5"
      >
        <h2 id="connect-title" className="font-display text-2xl font-semibold text-fg">
          1. Connect a client
        </h2>
        <p className="text-[15px] leading-relaxed text-muted">
          The shape of the configuration, so the contract can be read against a real host.
          The server behind it is real. The darkprint package itself still fails. It is not
          published to npm yet.
        </p>
        <InstallTabs />
        <p className="text-sm leading-relaxed text-dim">
          Read access to the registry, and nothing else.
        </p>
      </section>

      {/* ---------- 2. What it exposes ---------- */}
      <section
        id="contract"
        aria-labelledby="contract-title"
        className="mt-11 flex scroll-mt-24 flex-col gap-5 border-t border-line pt-10"
      >
        <h2
          id="contract-title"
          className="font-display text-2xl font-semibold text-fg"
        >
          2. What it exposes
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
        <p className="text-[15px] leading-relaxed text-muted">
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
                  {/* Every row said "not built", repeated per row rather than stated once
                      above the table, so a four-row table with one caption would not read
                      as three built operations and a caption about something else.
                      `components/site/honesty.test.ts` pinned that word to this column; it
                      is frozen for this pass and still holds it, so this row's own claim
                      goes stale here rather than being edited quietly — T280 answers all
                      four operations over HTTP, and the new word is reported alongside this
                      diff for whoever re-pins the ledger. Emerald rather than blueprint-ink:
                      `app/globals.css` reserves emerald for "a figure read off the engine",
                      and a live HTTP route is exactly that, the same register
                      `components/skill/SkillSetup.tsx` spends on its one genuinely running
                      command. Lower case at the mock's tracking, matching the register the
                      column used before. */}
                  <td className="whitespace-nowrap px-5 py-4 align-top font-mono text-[11px] tracking-[0.06em] text-emerald">
                    live
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[15px] leading-relaxed text-muted">
          The digest is the load-bearing part. Fetch by slug and you get whatever the
          registry holds today. Fetch by digest and you get the bytes you tested against.
        </p>

        {/* The server offers a fifth tool and the table above has four rows, so the page has
            to say which is which rather than let a client's tool list contradict it. It is
            deliberately NOT a fifth row: the table is the advertised registry contract, held
            to this array's own count by `tests/server/t220/surface.test.ts`, and
            `export_pipeline` is not a registry operation. It reads the release route and the
            files route, both of which `fetch a release` already grants, and compiles their
            bytes locally. A row would claim the registry gained an answer it did not. */}
        <p className="text-[15px] leading-relaxed text-muted">
          The server offers one more tool that is not a registry read.{" "}
          <code className="font-mono text-[13px] text-blueprint-ink">export_pipeline</code>{" "}
          takes the files of one release and compiles them into a DOT pipeline a graph runner
          takes, which is the same thing{" "}
          <code className="font-mono text-[13px] text-blueprint-ink">
            darkprint export &lt;dir&gt; --attractor
          </code>{" "}
          does in a terminal. It reaches nothing the four operations above do not, and the
          file it returns opens with a list of everything a DarkPrint blueprint had no way to
          express, so a reader can see what the runner falls back to its own defaults for.
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
        <p className="text-[15px] leading-relaxed text-muted">
          Two of these are still undecided. The shipped contract has already answered the
          other two. They stay on the page, marked as such, rather than being deleted
          quietly.
        </p>
        {/* Rows in the contract table's register, and the bodies kept whole. See `OPEN`:
            the chrome was the problem, the words were not, and the mock's one-clause
            versions are the one part of this page's design that is not taken.

            200px is the mock's label track, from `sm` up. Below it the two stack, which the
            mock has no width to show and a 200px column beside a forty-word body would need.
            `<ol>` because these are four of one kind and the page numbers its sections; the
            label is the item's own name rather than a header over a column, so no `<table>`
            is claimed. */}
        <ol className="flex min-w-0 flex-col border-t border-line">
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
          A closing note, not a fourth section, since 2026-08-11.

          It was an `h2` over three `RouteBoxLink`s. The author approved §B4 and both halves
          of that go together: with the boxes gone the block is one label and one sentence,
          which is a note and not a section, so the heading comes down to a `.label` and the
          `aria-labelledby` goes with it rather than pointing at nothing. Nothing links to
          `#today`; the id stays for the anchor.

          `components/ui/OnwardRoutes.tsx` records the 2026-08-07 ruling that took
          route-boxes off `/skill` — "we found such buttons also in the install mcp page. in
          this page you can just delete them" — and notes that `/mcp` kept them. It does not
          any more, so that file's count of remaining mounts is stale by one and says so.

          The three routes are still named, in the sentence, which is what the ruling asked
          for on the other page: every onward move is an inline link inside a clause that
          gives a reason for it. `/skill` is described as the half of setup a reader can
          install rather than the half that runs — the skill's behaviour is not covered by
          this repository's tests, which is `/skill`'s own caveat and not a claim to make
          louder from here. */}
      <section
        id="today"
        className="mt-11 flex scroll-mt-24 flex-col gap-3 border-t border-line pt-10"
      >
        <span className="label">What exists today instead</span>
        <p className="text-[15px] leading-relaxed text-muted">
          Everything this contract returns is also reachable by hand. The bundles are
          in{" "}
          <Link
            href="/blueprints"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            the gallery
          </Link>
          . Every card is in{" "}
          <Link
            href="/nodes"
            className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            the cards index
          </Link>
          , with its digest. The half of setup you can install today is at{" "}
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
