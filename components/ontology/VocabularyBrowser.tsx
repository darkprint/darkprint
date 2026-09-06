"use client";

import { useMemo } from "react";
import Link from "next/link";

import { cx } from "@/lib/format";
import { termHref } from "@/lib/href";
import {
  CONTROL_CLASS,
  RegistryFilterBar,
  SearchField,
} from "@/components/ui/RegistryFilterBar";
import { useQueryState } from "@/components/ui/useQueryState";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-15) (cited at line 116): GET /api/ontology/terms?q&kind&origin

/* ============================================================
   The third registry browser, and the routes it has lived on.

   It was built for `/ontology`, which had no index: `app/ontology/[...term]/` is a
   catch-all, a catch-all does not match its own parent, so `/ontology` answered 404 — and
   `next.config.ts` had been 308ing `/ontologies` onto it since the section was renamed,
   which made that redirect a 404 with an extra hop. Nothing failed, because nothing linked
   it: the chrome had no entry for the vocabulary at all, which is the third of the three
   problems the nav pass names.

   The owner deleted that index on 2026-09-06 and moved this browser onto the ontology
   specification, into the slot a route box pointed across from. Later the same day that
   specification was itself folded into `/spec/card`, on the ground that every term in the
   vocabulary exists to be a legal value of a card field, so this listing now closes the
   page that defines the fields. What the component does is unchanged through all of it and
   none of its behaviour is route-specific: search, filter by kind, filter by origin, and a
   flat list of every term with its ancestry and what it costs — the three questions a
   reader has about a controlled vocabulary they are about to write a card against.
   `components/ontology/canonical-route.test.ts` carries all four positions this listing has
   held and asserts which one is current.

   ── Two ways to read 50 terms, and only ever one of them on screen ──
   This shipped as a flat list and nothing else, and the author's verdict was that the old
   catalog described the terms better. It did, for reading: the catalog groups by kind,
   draws `broader` as a tree with the subterms hanging off a rail, and puts the paragraph
   that says how to read each kind under the terms themselves. A flat list throws all of
   that away, and it throws it away for a reader who arrived to read rather than to look
   one word up.

   But it is the right shape for the reader who did arrive holding a word, which is what
   the listing had none of. So both are here and the filter decides which: with nothing
   filtered this renders `children`, the catalog exactly as it was, and the moment a
   search or a filter is set it renders the matching rows flat. One enumeration on screen
   at a time, chosen by what the reader just did rather than by a toggle they have to find.

   Ranking the two would have been the wrong call either way round: browsing a vocabulary
   and searching one are different tasks, and a page that only does the second makes every
   reader who wanted the first do it with Cmd-F.

   ── What this is not, and the argument that stopped being true ──
   This said: it is not the ontology specification, which is the document about the format
   — what a term is, how the local overlay works, what the validator refuses — and this is
   the terms themselves; one route names the format and one lists the words, which is why
   the nav called this Vocabulary and that one Ontology.

   That was the whole case for two routes and the owner overruled it on 2026-09-06. The
   distinction it drew is still a real distinction and the page still makes it, in bands
   rather than in URLs: the enumeration is its own band with its own heading, after the
   field reference that says which kind of term each card field takes. What the split cost
   was a reader holding a term having to pick which of two pages claimed the word. It is
   kept here rather than deleted so a later pass that wants to split them again knows what
   it is buying and what it is paying.

   Every row is read off the merged ontology view by the page and handed here as plain
   data, so this file never touches the engine. That view is registry-backed and read per
   request, which is why the usage count beside each row is a live figure rather than
   whatever was on disk at the last deploy.
   ============================================================ */

/**
 * One term, flattened to what a row prints.
 *
 * The shape follows what `TermRow` showed before this browser existed, because that is
 * what a reader was asking for and losing it was the defect: the **label** leads, the id
 * sits under it, a deprecated term names its successor, and a risk marker's weight comes
 * through the engine's own lookup rather than off the term. Everything is resolved on the
 * server and handed over as plain data, so this file never touches `lib/core`.
 */
export interface VocabularyRow {
  id: string;
  kind: string;
  /** The human name. The row leads with this; the id is the second line. */
  label: string;
  description: string;
  /** The parent term, when the id has one. Local terms must have one (doc 3 §7). */
  broader?: string;
  /**
   * What this risk marker subtracts, through `markerWeight` on the server.
   *
   * Absent on everything that is not a risk marker, and absent on a marker nobody has
   * priced — which is a different fact from `0` and is said in words below, because
   * "0.00" reads like a priced marker worth nothing.
   */
  weight?: number;
  /** True when the id is namespaced, i.e. arrived through the local channel. */
  local: boolean;
  /** How many cards in the archive name it. */
  usedBy: number;
  /**
   * §6.2: a term is never removed, it is signposted at whatever supersedes it.
   *
   * The successor and nothing else. This carried `since` — the ontology version the term
   * was deprecated in — which no row ever printed and which stopped meaning anything when
   * the vocabulary stopped being versioned (2026-09-05, see `OntologyCatalog`). A pointer
   * to the current spelling is the whole of what a reader can act on.
   */
  deprecated?: { replacedBy?: string };
}

const KIND_LABEL: Record<string, string> = {
  phase: "Phase",
  "node-type": "Node type",
  "data-type": "Data type",
  tool: "Tool",
  "risk-marker": "Risk marker",
};

export function VocabularyBrowser({
  terms,
  children,
}: {
  terms: readonly VocabularyRow[];
  /**
   * The catalog, rendered on the server and shown whenever nothing is filtered.
   *
   * It arrives already rendered, so this file still never touches `lib/core` or the
   * filesystem: a server component passed as children through a client boundary is the one
   * way `OntologyCatalog` and its trees can keep reading the ontology view directly.
   */
  children: React.ReactNode;
}) {
  const { params, set: setParam, clear } = useQueryState();
  const search = params.get("q") ?? "";
  const kind = params.get("kind");
  const origin = params.get("origin");

  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const term of terms) counts.set(term.kind, (counts.get(term.kind) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [terms]);

  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return terms.filter((term) => {
      if (kind !== null && term.kind !== kind) return false;
      if (origin === "local" && !term.local) return false;
      if (origin === "core" && term.local) return false;
      if (origin === "deprecated" && term.deprecated === undefined) return false;
      if (needle === "") return true;
      return (
        term.id.toLowerCase().includes(needle) ||
        term.label.toLowerCase().includes(needle) ||
        term.description.toLowerCase().includes(needle) ||
        (term.broader ?? "").toLowerCase().includes(needle)
      );
    });
  }, [terms, search, kind, origin]);

  const active = [kind, origin].filter((v) => v !== null).length + (search === "" ? 0 : 1);

  return (
    /* No width cap anywhere in here, and the wrapper that carried one is gone with it.
       The bar, the count line and the flat list were held at `max-w-4xl` to match the
       catalog's own 896px panels, on the rule that a filter bar wider than the list it
       filters is a stray edge. The rule stands and the number went: the catalog's panels
       run to `container-page` now (owner, 2026-09-05), so matching them means matching
       1200px, which is what an uncapped child of the route container already does. */
    <div className="flex flex-col gap-5">
      <RegistryFilterBar
        id="vocabulary-filters"
        label="Filter the vocabulary"
        results={results.length}
        total={terms.length}
        active={active}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            value={search}
            onChange={(value) => setParam("q", value || null)}
            placeholder="Search ids, labels, descriptions…"
            ariaLabel="Search the vocabulary"
          />

          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by kind</span>
            <select
              value={kind ?? ""}
              onChange={(e) => setParam("kind", e.target.value || null)}
              aria-label="Filter by kind"
              className={CONTROL_CLASS}
            >
              <option value="">All kinds</option>
              {kinds.map(([id, count]) => (
                <option key={id} value={id}>
                  {KIND_LABEL[id] ?? id} ({count})
                </option>
              ))}
            </select>
          </label>

          {/* Doc 3 §7's one real division: a term is curated or it arrived namespaced
              through the local channel, and which of the two it is decides whether
              anybody may edit it. */}
          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by origin</span>
            <select
              value={origin ?? ""}
              onChange={(e) => setParam("origin", e.target.value || null)}
              aria-label="Filter by origin"
              className={CONTROL_CLASS}
            >
              <option value="">Core and local</option>
              <option value="core">Curated core</option>
              <option value="local">Local namespace</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </label>
        </div>
      </RegistryFilterBar>

      <div className="flex items-center justify-between gap-3 font-mono text-xs text-dim">
        {/* The count line stands over both views, and says which one is below it. Reading
            "50 of 50" over a set of grouped panels and "9 of 50" over a flat list is how a
            reader learns the two are the same terms arranged twice, without being told. */}
        <p role="status" aria-live="polite" aria-atomic="true">
          {/* This read `… terms · ontology v0.1.0`. The semver came off with the field
              behind it (owner, 2026-09-05; the reasoning is in `OntologyCatalog`), and
              nothing takes its place: the line's job is to say how much of the
              vocabulary is on screen, and a number nobody could compare it against was
              never part of that. */}
          <span className="text-fg">{results.length}</span> of {terms.length} term
          {terms.length === 1 ? "" : "s"}
          {active === 0 && " · grouped by kind"}
        </p>
        {active > 0 && (
          <button
            type="button"
            onClick={() => clear(["q", "kind", "origin"])}
            className="cursor-pointer text-muted underline-offset-4 transition-colors hoverable:hover:text-cyan hoverable:hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {active === 0 ? (
        children
      ) : results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface/40 px-5 py-16 text-center text-sm text-muted">
          No term matches. The vocabulary is curated and small on purpose. Doc 3 §6 adds a
          term. A term is not coined at the point of use.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line bg-surface">
          {results.map((term) => (
            <li
              key={term.id}
              className="flex flex-col gap-2 border-b border-line p-5 last:border-b-0"
            >
              {/* The label leads and the id is the second line, which is the order
                  `TermRow` used and the order a reader needs: "Human in the loop" is what
                  the term MEANS and `human-in-the-loop` is what a card has to spell. A
                  browser that led with the id made every row look like a slug. */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                <Link
                  href={termHref(term.id)}
                  className="font-display text-[15px] font-semibold text-fg transition-colors hoverable:hover:text-cyan"
                >
                  {term.label}
                </Link>
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-dim">
                  {KIND_LABEL[term.kind] ?? term.kind}
                </span>
                {term.local && (
                  <span className="rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 font-mono text-[11px] text-violet">
                    local
                  </span>
                )}
                {/* §6.2 made visible: a deprecated term is signposted, never removed, and
                    the successor is a real link rather than a word. */}
                {term.deprecated !== undefined && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
                    deprecated
                    {term.deprecated.replacedBy !== undefined && (
                      <>
                        <span aria-hidden>→</span>
                        <Link
                          href={termHref(term.deprecated.replacedBy)}
                          aria-label={`Replaced by ${term.deprecated.replacedBy}`}
                          className="normal-case tracking-normal underline underline-offset-2 transition-colors hoverable:hover:text-amber-bright"
                        >
                          {term.deprecated.replacedBy}
                        </Link>
                      </>
                    )}
                  </span>
                )}
                <span
                  className={cx(
                    "ml-auto font-mono text-[11px]",
                    term.usedBy > 0 ? "text-emerald" : "text-dim",
                  )}
                >
                  {term.usedBy > 0
                    ? `✓ named by ${term.usedBy} card${term.usedBy === 1 ? "" : "s"}`
                    : "no card names it yet"}
                </span>
              </div>

              <code className="font-mono text-[11px] text-dim">{term.id}</code>

              <p className="text-[13px] leading-relaxed text-muted">
                {term.description}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-dim">
                {term.broader !== undefined && (
                  <span>
                    <span className="text-muted">broader</span>{" "}
                    <Link
                      href={termHref(term.broader)}
                      className="transition-colors hoverable:hover:text-cyan"
                    >
                      {term.broader}
                    </Link>
                  </span>
                )}
                {/* Only a risk marker has one, and an unpriced marker says so in words:
                    doc 3 §4 moved the core weights into `DARKPRINT_CONFIG`, and a marker
                    nobody has priced counts `unknownMarkerWeight` and moves the security
                    level not at all — which "0.00" would misreport as a marker worth
                    nothing. */}
                {term.kind === "risk-marker" && (
                  <span>
                    <span className="text-muted">weight</span>{" "}
                    {term.weight === undefined ? (
                      <span title="A category a rule is written about. A card does not declare it as a marker.">
                        unpriced
                      </span>
                    ) : (
                      <span className="tabular-nums text-fg">
                        {term.weight.toFixed(2)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
