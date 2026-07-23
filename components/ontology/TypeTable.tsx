import type { OntologyNodeType, OntologyEdgeType } from "@/lib/types";

/** Definition list of a vocabulary's node kinds: a mono chip + its meaning. */
export function NodeTypeTable({
  nodeTypes,
}: {
  nodeTypes: OntologyNodeType[];
}) {
  return (
    <dl className="divide-y divide-line">
      {nodeTypes.map((nt) => (
        <div
          key={nt.name}
          className="grid grid-cols-1 gap-1.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[160px_1fr] sm:gap-5"
        >
          <dt>
            <code className="inline-flex rounded border border-violet/40 bg-violet/10 px-2 py-0.5 font-mono text-[12px] text-violet">
              {nt.name}
            </code>
          </dt>
          <dd className="text-sm leading-relaxed text-muted">
            {nt.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Edge kinds rendered as `from —name→ to` signatures with a gloss. */
export function EdgeTypeTable({
  edgeTypes,
}: {
  edgeTypes: OntologyEdgeType[];
}) {
  return (
    <ul className="divide-y divide-line">
      {edgeTypes.map((et) => (
        <li
          key={et.name}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
        >
          <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
            <span className="rounded border border-line bg-surface-2 px-2 py-0.5 text-muted">
              {et.from}
            </span>
            <span className="flex items-center gap-1 text-violet">
              <span className="text-faint">—</span>
              {et.name}
              <span className="text-faint">→</span>
            </span>
            <span className="rounded border border-line bg-surface-2 px-2 py-0.5 text-muted">
              {et.to}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted">{et.description}</p>
        </li>
      ))}
    </ul>
  );
}
