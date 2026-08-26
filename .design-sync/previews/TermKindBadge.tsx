import { TermKindBadge } from "darkprint";

/** The five structural fields a term can fill, `TERM_KIND_META`'s own order. */
export const AllKinds = () => (
  <div className="flex flex-wrap items-center gap-2">
    <TermKindBadge kind="phase" />
    <TermKindBadge kind="node-type" />
    <TermKindBadge kind="risk-marker" />
    <TermKindBadge kind="data-type" />
    <TermKindBadge kind="tool" />
  </div>
);

/** `/ontology/[...term]` header row: the badge beside the version a term was declared at. */
export const InTermHeader = () => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <TermKindBadge kind="risk-marker" />
      <code className="font-mono text-xs text-dim">since v0.1.0</code>
    </div>
    <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-fg">
      Criteria leak
    </h1>
    <code className="font-mono text-sm text-cyan">criteria-leak</code>
  </div>
);
