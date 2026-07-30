import Link from "next/link";
import { notFound } from "next/navigation";
import type { OntologyTerm, OntologyView } from "@/lib/core";
import { CORE_PHASE_IDS, DARKPRINT_CONFIG, INFERRED_MARKERS } from "@/lib/core";
import { getOntologyView, getRegistry } from "@/lib/content";
import { HUMAN_PRESENCE_MARK } from "@/lib/format";
import { contentHref, nodeHref, termHref } from "@/lib/href";
import {
  NO_USAGE,
  TERM_KIND_META,
  TermKindBadge,
  formatWeight,
  markerWeight,
  termUsageIndex,
  type TermUsage,
} from "@/components/ontology/TermTable";

/**
 * One page per term in the vocabulary.
 *
 * **The segment is a catch-all, and that is load-bearing.** Every *core* id is
 * slash-free, but doc 3 §7 lets an author namespace one, and
 * `content/ontology/extensions.yaml` ships `lupo/pii-handling` — reachable from the
 * risk-marker list on `/ontology`, from `isolation-breach`'s narrower terms and from
 * two node cards. A `/` inside a *single* dynamic segment is not a character, it is a
 * separator: with `[term]` the build wrote `ontology/lupo%2Fpii-handling.html`, Next
 * decoded the incoming pathname before matching it, and every route to that term was a
 * 404. So the id travels as the segments it is made of — `generateStaticParams` splits
 * it, the page joins it back — and `termHref` (`lib/href.ts`) encodes each segment
 * without encoding the separators between them.
 *
 * A term id is otherwise opaque to this route: it is rejoined and handed to
 * `view.get`, which knows the vocabulary, so an id of any depth resolves or 404s on the
 * vocabulary's say-so rather than on the shape of the path.
 *
 * `dynamicParams = false` closes the other half: a term outside the list is a 404 from
 * the prerendered output rather than a request-time render of a page whose data comes
 * off the filesystem.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getOntologyView().ontology.terms.map((term) => ({
    term: term.id.split("/"),
  }));
}

export async function generateMetadata({ params }: PageProps<"/ontology/[...term]">) {
  const { term } = await params;
  const found = getOntologyView().get(term.join("/"));
  if (!found) return { title: "Term not found" };
  return {
    title: `${found.label} — ${TERM_KIND_META[found.kind].label}`,
    description: found.description,
  };
}

/** Small mono heading for the in-page panels. Matches the blueprint detail page. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
      {children}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right font-mono text-sm tabular-nums text-fg">{value}</dd>
    </div>
  );
}

/**
 * A term as a mono chip with a keyed dot — the vocabulary the node cards use. A
 * deprecated one says so in a word as well as in the dot: a term can be both narrower
 * than the one it sits under *and* superseded by another, and a chip that showed only
 * the first would read as a live sibling of its replacement.
 */
function TermChip({ term, accent }: { term: OntologyTerm; accent: string }) {
  const retired = term.deprecated !== undefined;
  return (
    <Link
      href={termHref(term.id)}
      className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg transition-colors hover:border-line-bright hover:text-cyan"
    >
      <span
        className="h-1 w-1 rounded-full"
        style={{ background: retired ? "var(--color-amber)" : accent }}
        aria-hidden
      />
      {term.id}
      {retired && (
        <span className="text-[10px] uppercase tracking-[0.12em] text-amber">
          deprecated
        </span>
      )}
    </Link>
  );
}

/**
 * How much of the registry a term reaches *through the terms below it*. An abstract
 * root — `node`, `any`, `risk` — is never written on a card, so its own count is zero
 * and reading that as "nobody wants it" is exactly backwards: subsumption is the
 * point, and a rule written about the root catches every card counted here.
 */
function narrowerReach(
  view: OntologyView,
  index: ReadonlyMap<string, TermUsage>,
  term: OntologyTerm,
): { terms: number; cards: number } {
  const cards = new Set<string>();
  // `broader` is validated acyclic, but a local extension could still introduce a
  // loop (§7) and a page must not hang because of one.
  const seen = new Set<string>([term.id]);
  const queue = [term.id];
  let terms = 0;
  for (;;) {
    const current = queue.pop();
    if (current === undefined) break;
    // Same kind only, exactly as the "Narrower terms" list below: a `broader` that
    // crosses kinds is a vocabulary error `validate()` reports, not a subsumption.
    for (const child of view.children(current)) {
      if (child.kind !== term.kind || seen.has(child.id)) continue;
      seen.add(child.id);
      terms += 1;
      queue.push(child.id);
      for (const card of index.get(child.id)?.cards ?? []) cards.add(card);
    }
  }
  return { terms, cards: cards.size };
}

export default async function Page({ params }: PageProps<"/ontology/[...term]">) {
  const { term: segments } = await params;
  const view = getOntologyView();
  // The catch-all captures `["lupo", "pii-handling"]`; the vocabulary is keyed on the
  // id, which is those segments with the separator put back.
  const term = view.get(segments.join("/"));
  if (!term) notFound();

  const registry = getRegistry();
  const usageIndex = termUsageIndex(registry);
  const usage = usageIndex.get(term.id) ?? NO_USAGE;
  const reach = narrowerReach(view, usageIndex, term);
  const meta = TERM_KIND_META[term.kind];

  // `ancestors` is nearest-first and includes the term itself; the chain reads from
  // the root down, which is the direction the subsumption actually runs.
  const chain = view.ancestors(term.id).slice().reverse();
  const children = view
    .children(term.id)
    .filter((child) => child.kind === term.kind)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // The other half of §6.2: terms this one absorbed when they were renamed away.
  const supersedes = view.ontology.terms.filter(
    (other) => other.deprecated?.replacedBy === term.id,
  );

  const cards = usage.cards
    .map((id) => registry.versionsOf(id)[0])
    .filter((record) => record !== undefined);
  const blueprints = usage.blueprints.map((slug) => ({
    slug,
    title: registry.blueprint(slug)?.manifest.title ?? slug,
  }));

  const replacedBy =
    term.deprecated?.replacedBy === undefined
      ? undefined
      : view.get(term.deprecated.replacedBy);

  // Doc 3 §4 keeps the seven core weights in the engine's configuration rather than in the
  // vocabulary, so `term.defaultWeight` is unset on every one of them and reading it alone
  // would print no cost for the whole dimension. `markerWeight` follows the engine's own
  // lookup order; `undefined` means nobody priced it anywhere.
  const weight = markerWeight(term);
  // Which of the engine's three lookup steps produced that number. The block below used to
  // state the first one unconditionally; `lupo/pii-handling` is priced by the second, and
  // a page that says otherwise contradicts its own chip.
  const configured = Object.keys(DARKPRINT_CONFIG.security.weights).includes(term.id);
  // Doc 3 §4.1 — three markers the analyzer derives from the graph even when no card
  // declares them, taken from the engine's own list rather than re-typed here.
  const inferred = INFERRED_MARKERS.includes(term.id);

  return (
    <div className="container-page py-10 lg:py-12">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-5">
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/ontology" className="transition-colors hover:text-cyan">
            ← Ontology
          </Link>
          <span className="mx-2 text-faint">/</span>
          <span className="text-muted">{meta.plural}</span>
        </nav>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <TermKindBadge kind={term.kind} />
            {term.deprecated !== undefined && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber">
                <span aria-hidden>◑</span>
                deprecated
              </span>
            )}
            <code className="font-mono text-xs text-dim">since v{term.since}</code>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
            {term.label}
          </h1>
          <code className="font-mono text-sm text-cyan">{term.id}</code>
          <p className="max-w-3xl text-lg leading-relaxed text-muted">
            {term.description}
          </p>
        </div>
      </header>

      {/* ---------- Body ---------- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* MAIN */}
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          {/* Deprecation — §6.2, shown as the redirect it is */}
          {term.deprecated !== undefined && (
            <section className="panel overflow-hidden" aria-labelledby="deprecation-heading">
              <div className="border-b border-line px-5 py-3">
                <h2 id="deprecation-heading">
                  <PanelLabel>Deprecated, not deleted</PanelLabel>
                </h2>
              </div>
              <div className="flex flex-col gap-4 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
                  <code className="rounded border border-amber/40 bg-amber/10 px-2 py-1 text-[12px] text-amber">
                    {term.id}
                  </code>
                  <span className="text-faint" aria-hidden>
                    →
                  </span>
                  {replacedBy === undefined ? (
                    <span className="text-[12px] text-dim">no successor declared</span>
                  ) : (
                    <Link
                      href={termHref(replacedBy.id)}
                      className="rounded border border-emerald/40 bg-emerald/10 px-2 py-1 text-[12px] text-emerald transition-colors hover:border-emerald"
                    >
                      {replacedBy.id}
                    </Link>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  Deprecated in v{term.deprecated.since}. The term stays in the
                  vocabulary and stays valid: a card that names it still resolves, still
                  type-checks and still scores — the resolver simply follows the pointer
                  once and carries on.
                  {term.deprecated.note !== undefined && ` ${term.deprecated.note}`}
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  The usage figures on this page count the id exactly as a card spells
                  it, not as the resolver rewrites it. That is the whole point of
                  keeping the count: it answers whether anybody is still writing the old
                  spelling.
                </p>
              </div>
            </section>
          )}

          {/* Where it sits — doc 3 §2 for a phase, doc 1 §6.1 for everything else.
              The five phases are flat, closed and parentless, so a broader chain and a
              "leaf of the vocabulary" line would both be true and both be misleading:
              the fact worth stating is which of the five this is and that there are
              exactly five. */}
          {term.kind === "phase" ? (
            <section className="panel overflow-hidden" aria-labelledby="hierarchy-heading">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <h2 id="hierarchy-heading">
                  <PanelLabel>Where it sits</PanelLabel>
                </h2>
                <span className="font-mono text-[11px] text-dim">
                  one of {CORE_PHASE_IDS.length} · closed set
                </span>
              </div>
              <div className="flex flex-col gap-6 px-5 py-4">
                <div className="flex flex-col gap-2">
                  <PanelLabel>The lifecycle</PanelLabel>
                  <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-[12px]">
                    {CORE_PHASE_IDS.map((id, i) => (
                      <li key={id} className="flex items-center gap-2">
                        {i > 0 && (
                          <span className="text-faint" aria-hidden>
                            →
                          </span>
                        )}
                        {id === term.id ? (
                          <span
                            className="rounded border border-line-bright bg-surface-3 px-2 py-1 text-fg"
                            aria-current="page"
                          >
                            {id}
                          </span>
                        ) : (
                          <Link
                            href={termHref(id)}
                            className="rounded border border-line bg-surface-2 px-2 py-1 text-muted transition-colors hover:border-line-bright hover:text-fg"
                          >
                            {id}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs leading-relaxed text-dim">
                    Read left to right as the arc of a piece of work. The order is the
                    lifecycle, not a ranking, and the arrows are the sequence a factory
                    tends to run in rather than one it is obliged to.
                  </p>
                </div>

                <p className="text-sm leading-relaxed text-muted">
                  The five are the one dimension a local namespace cannot extend: a node
                  type or a risk marker can be coined by anybody, a sixth phase would be a
                  different definition of what a dark factory is. There is no abstract
                  root above them either, because a root would make the set look open.
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  A card may name one of them, several, or none. The five describe the
                  factory rather than every node inside it, so an intake or a retrieval
                  step declares no phase at all and a node that both builds and repairs
                  declares two. Neither is a card with something missing from it.
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  Which phases a blueprint has nodes in is its <em>phase coverage</em>, and
                  it is shown as a description of scope — <em>this factory covers planning,
                  implementation and testing</em> — not as boxes ticked out of five. A
                  factory that stops before deployment has decided where it stops.
                </p>
              </div>
            </section>
          ) : (
          <section className="panel overflow-hidden" aria-labelledby="hierarchy-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h2 id="hierarchy-heading">
                <PanelLabel>Where it sits</PanelLabel>
              </h2>
              <span className="font-mono text-[11px] text-dim">
                {chain.length === 1
                  ? "root of its branch"
                  : `${chain.length - 1} level${chain.length - 1 === 1 ? "" : "s"} deep`}
              </span>
            </div>
            <div className="flex flex-col gap-6 px-5 py-4">
              <div className="flex flex-col gap-2">
                <PanelLabel>Broader chain</PanelLabel>
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-[12px]">
                  {chain.map((step, i) => (
                    <li key={step.id} className="flex items-center gap-2">
                      {i > 0 && (
                        <span className="text-faint" aria-hidden>
                          →
                        </span>
                      )}
                      {step.id === term.id ? (
                        <span
                          className="rounded border border-line-bright bg-surface-3 px-2 py-1 text-fg"
                          aria-current="page"
                        >
                          {step.id}
                        </span>
                      ) : (
                        <Link
                          href={termHref(step.id)}
                          className="rounded border border-line bg-surface-2 px-2 py-1 text-muted transition-colors hover:border-line-bright hover:text-fg"
                        >
                          {step.id}
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="text-xs leading-relaxed text-dim">
                  Read left to right as &ldquo;is a kind of&rdquo;, backwards. A rule
                  written about any term in this chain also catches {term.id}.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <PanelLabel>Narrower terms</PanelLabel>
                {children.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {children.map((child) => (
                      <TermChip key={child.id} term={child} accent={meta.color} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-dim">
                    Nothing specialises {term.id} — it is a leaf of its branch.
                  </p>
                )}
              </div>

              {supersedes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <PanelLabel>Supersedes</PanelLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {supersedes.map((old) => (
                      <TermChip key={old.id} term={old} accent="var(--color-amber)" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-dim">
                    Older spellings that were renamed into this term. They are still
                    valid and still resolve here.
                  </p>
                </div>
              )}
            </div>
          </section>
          )}

          {/* Weight — doc 3 §4–§5, risk markers only */}
          {term.kind === "risk-marker" && (
            <section className="panel overflow-hidden" aria-labelledby="weight-heading">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <h2 id="weight-heading">
                  <PanelLabel>What it costs</PanelLabel>
                </h2>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-dim">
                  <span aria-hidden>{inferred ? "◎" : "◍"}</span>
                  {inferred ? "declared or inferred" : "declared on the card"}
                </span>
              </div>
              <div className="flex flex-col gap-4 px-5 py-4">
                {/* The arithmetic only means something for a marker somebody has priced.
                    Printing "4 − 0.00" under a category no card can declare would
                    contradict the sentence below it. */}
                {weight === undefined ? (
                  <div className="flex flex-wrap items-baseline gap-3 font-mono">
                    <span className="text-2xl tabular-nums text-dim">
                      {formatWeight(DARKPRINT_CONFIG.security.unknownMarkerWeight)}
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em] text-dim">
                      points — no weight configured
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-3 font-mono">
                    <span className="text-2xl tabular-nums text-fg">4</span>
                    <span className="text-dim" aria-hidden>
                      −
                    </span>
                    <span className="text-2xl tabular-nums text-signal">
                      {formatWeight(weight)}
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em] text-dim">
                      points, once per blueprint
                    </span>
                  </div>
                )}

                <p className="text-sm leading-relaxed text-muted">
                  {weight === undefined
                    ? children.length > 0
                      ? `${term.id} is a category, not a marker a card declares: it exists so a rule can be written about ${children.length === 1 ? "the marker" : "the markers"} underneath it and catch ${children.length === 1 ? "it" : "them all"}. It carries no weight and never moves a score; the terms narrower than it carry theirs.`
                      : `No weight is configured for ${term.id} anywhere, so it counts ${formatWeight(DARKPRINT_CONFIG.security.unknownMarkerWeight)} and does not move a score. A locally namespaced marker has to declare one, or it documents a risk without pricing it — and the author is told so rather than silently charged a number nobody chose.`
                    : `A blueprint starts at a clean 4, loses the weight of every marker present, and the result is clamped into 1–4. ${term.id} is charged once for the whole blueprint however many nodes carry it — gravity, not frequency — and the explanation still lists every node that established it.`}
                </p>

                <p className="text-sm leading-relaxed text-muted">
                  {inferred
                    ? `${term.id} is one of the three markers the analyzer derives from the graph itself, so it can fire on a blueprint whose cards never mention it — that is the point, since the author who most needs to hear it is the one who did not see it. A card that declares it and a graph that implies it are the same marker and are charged once; the finding records which way round it was established.`
                    : `Nothing in the topology can establish ${term.id} on its own — it is a fact about what the node does that only its author can state. The analyzer takes the card at its word and names the node in the explanation.`}
                </p>

                {/* Conditional, and it was not. The sentence asserted for every term that
                    "the number lives in the engine's configuration and not in this
                    vocabulary", which is false of a locally namespaced marker: doc 3 §7
                    lets one carry its own `defaultWeight`, `markerWeight` reads it, and
                    `content/ontology/extensions.yaml` ships `lupo/pii-handling` at 0.50 —
                    a number this page had already chipped as "declared on the card" three
                    paragraphs above the claim that no such number exists here. */}
                <p className="text-sm leading-relaxed text-muted">
                  {configured
                    ? "The number lives in the engine's configuration and not in this vocabulary, so a recalibration touches one file and every blueprint is re-scored consistently. That is also why a score records which vocabulary version produced it: move a weight and two evaluations stop being comparable."
                    : `The engine's configuration prices the curated markers and is silent about this one, so the number is the ${term.id.includes("/") ? "namespaced" : "local"} term's own declared weight, read from the vocabulary the bundle ships. That is why a score records which vocabulary version produced it: move a weight and two evaluations stop being comparable.`}{" "}
                  {/* Lifecycle-scoring spec §4: the weight table moved with `ScoringModel`
                      off `/spec` onto `/spec/scoring`, and `#weights` is the section's own
                      id on both — a fragment never reaches the server, so the href has to
                      name the route the id actually lives on now rather than the one it
                      used to. */}
                  <Link
                    href="/spec/scoring#weights"
                    className="text-muted underline decoration-line underline-offset-4 hover:text-cyan"
                  >
                    Every weight the engine knows
                  </Link>
                  .
                </p>
              </div>
            </section>
          )}

          {/* Usage — §7 phase 1 */}
          <section className="panel overflow-hidden" aria-labelledby="usage-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h2 id="usage-heading">
                <PanelLabel>Who uses it</PanelLabel>
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-dim">
                {usage.cards.length} card{usage.cards.length === 1 ? "" : "s"} ·{" "}
                {usage.blueprints.length} blueprint
                {usage.blueprints.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-col gap-6 px-5 py-4">
              {usage.cards.length === 0 ? (
                <p className="flex items-start gap-2 text-sm leading-relaxed text-muted">
                  {term.deprecated !== undefined ? (
                    <>
                      <span className="mt-0.5 font-mono text-emerald" aria-hidden>
                        ✓
                      </span>
                      <span>
                        Nothing in the archive spells it {term.id} any more. A card
                        that did would still load, still type-check and still score —
                        the resolver follows the pointer to{" "}
                        {term.deprecated.replacedBy ?? "its successor"} and carries on
                        — so the zero is not a gap, it is what a finished rename looks
                        like, and the count is the only way to tell.
                      </span>
                    </>
                  ) : reach.cards > 0 ? (
                    <>
                      <span className="mt-0.5 font-mono text-cyan" aria-hidden>
                        ↳
                      </span>
                      <span>
                        No card names {term.id} directly — it sits above the terms that
                        do. The {reach.terms} term{reach.terms === 1 ? "" : "s"}{" "}
                        narrower than it are named by {reach.cards} card
                        {reach.cards === 1 ? "" : "s"} between them, and a rule written
                        about {term.id} catches every one of them.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="mt-0.5 font-mono text-dim" aria-hidden>
                        ○
                      </span>
                      <span>
                        No card in the registry names {term.id} yet, and none names
                        anything narrower. A term with no takers is not a broken term —
                        it is vocabulary waiting for a use.
                      </span>
                    </>
                  )}
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <PanelLabel>Node cards</PanelLabel>
                    <ul className="divide-y divide-line">
                      {cards.map((record) => (
                        <li key={record.ref}>
                          <Link
                            href={nodeHref(record.id)}
                            className="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                          >
                            <span className="text-sm text-fg transition-colors group-hover:text-cyan">
                              {record.card.name}
                            </span>
                            <code className="font-mono text-[11px] text-dim">
                              {record.id}@{record.version}
                            </code>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-2">
                    <PanelLabel>Blueprints</PanelLabel>
                    <ul className="divide-y divide-line">
                      {blueprints.map((bp) => (
                        <li key={bp.slug}>
                          <Link
                            href={contentHref({ kind: "blueprint", slug: bp.slug })}
                            className="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                          >
                            <span className="text-sm text-fg transition-colors group-hover:text-cyan">
                              {bp.title}
                            </span>
                            <code className="font-mono text-[11px] text-dim">
                              {bp.slug}
                            </code>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          <section className="panel p-5" aria-labelledby="facts-heading">
            <div className="mb-2">
              <h2 id="facts-heading">
                <PanelLabel>Term</PanelLabel>
              </h2>
            </div>
            <dl className="flex flex-col divide-y divide-line">
              <StatRow label="Kind" value={meta.label} />
              <StatRow label="Id" value={term.id} />
              <StatRow label="Introduced" value={`v${term.since}`} />
              {/* The phases are flat, closed and parentless (doc 3 §2, §7), so "— root"
                  and "0 narrower" would both be true and neither would say anything. What
                  a reader needs there is that the set cannot grow. */}
              {term.kind === "phase" ? (
                <StatRow
                  label="Extensible"
                  value={<span className="text-dim">no · closed set</span>}
                />
              ) : (
                <>
                  <StatRow
                    label="Broader"
                    value={
                      term.broader === undefined ? (
                        <span className="text-dim">— root</span>
                      ) : (
                        <Link
                          href={termHref(term.broader)}
                          className="transition-colors hover:text-cyan"
                        >
                          {term.broader}
                        </Link>
                      )
                    }
                  />
                  <StatRow label="Narrower" value={children.length} />
                </>
              )}
              <StatRow
                label="Status"
                value={
                  term.deprecated === undefined ? (
                    <span className="text-emerald">✓ current</span>
                  ) : (
                    <span className="text-amber">◑ deprecated</span>
                  )
                }
              />
              {term.kind === "risk-marker" && (
                <StatRow
                  label="Weight"
                  value={
                    weight === undefined ? (
                      <span className="text-dim">— not priced</span>
                    ) : (
                      formatWeight(weight)
                    )
                  }
                />
              )}
              {/* Violet, from `HUMAN_PRESENCE_MARK`. Doc 2 §1.1 again: this row says a
                  card carrying this term puts a person in the graph, which is a fact about
                  the vocabulary and not a complaint about it. */}
              {term.impliesHuman === true && (
                <StatRow
                  label="A person acts here"
                  value={
                    <span className={HUMAN_PRESENCE_MARK.className}>
                      {HUMAN_PRESENCE_MARK.glyph} yes
                    </span>
                  }
                />
              )}
            </dl>
          </section>

          <section className="panel p-5" aria-labelledby="adoption-heading">
            <div className="mb-2">
              <h2 id="adoption-heading">
                <PanelLabel>Adoption</PanelLabel>
              </h2>
            </div>
            <dl className="flex flex-col divide-y divide-line">
              <StatRow label="Cards" value={usage.cards.length} />
              <StatRow label="Blueprints" value={usage.blueprints.length} />
              <StatRow label="Distinct authors" value={usage.authors.length} />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-dim">
              These are the three figures the first phase of promotion watches for, to
              spot a local term that has become a real pattern rather than one
              author&apos;s habit. The counting works; the workflow that would read it
              does not exist, no threshold has been calibrated, and no term has ever been
              promoted. They are shown because knowing what the registry actually leans on
              is worth something on its own.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
