import type { Diagnostic, DiagnosticLocation } from "@/lib/core";
import { sortDiagnostics, summarize } from "@/lib/core";
import { cx } from "@/lib/format";
import { SEVERITY_META, severityCount } from "@/components/ui/severity";

/* Severity presentation moved to `components/ui/severity.ts`. The rule it records — the
   glyph and the word both carry the meaning — has to hold on every surface that prints a
   diagnostic, and it stopped holding when PROJECT.md §3.1 routed the criteria notes to
   `components/blueprint/Explainability.tsx`, which had its own glyph and no word. One
   table, imported by all of them. */

/**
 * Where a diagnostic points, in the most specific form the location carries:
 * `file:line:col` for a source position, the node id for a node, `source → target`
 * for an edge, the card ref or the document path for everything else.
 */
export function locationLabel(location: DiagnosticLocation | undefined): string | undefined {
  if (location === undefined) return undefined;
  const parts: string[] = [];
  if (location.file !== undefined) {
    let where = location.file;
    if (location.line !== undefined) where += `:${location.line}`;
    if (location.line !== undefined && location.column !== undefined) {
      where += `:${location.column}`;
    }
    parts.push(where);
  }
  if (location.nodeId !== undefined) parts.push(location.nodeId);
  if (location.edge !== undefined) parts.push(`${location.edge.source} → ${location.edge.target}`);
  if (location.cardRef !== undefined) parts.push(location.cardRef);
  if (location.path !== undefined) parts.push(location.path);
  return parts.length === 0 ? undefined : parts.join("  ·  ");
}

function DiagnosticRow({ diagnostic }: { diagnostic: Diagnostic }) {
  const meta = SEVERITY_META[diagnostic.severity];
  const where = locationLabel(diagnostic.location);

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className="mt-0.5 shrink-0 font-mono text-xs leading-5"
        style={{ color: meta.color }}
        aria-hidden
      >
        {meta.glyph}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{ color: meta.color }}
          >
            {meta.word}
          </span>
          <code className="font-mono text-[11px] text-dim">{diagnostic.code}</code>
          {where !== undefined && (
            <code className="font-mono text-[11px] text-dim">{where}</code>
          )}
        </div>
        <p className="text-sm leading-relaxed text-fg">{diagnostic.message}</p>
        {diagnostic.hint !== undefined && (
          <p className="text-xs leading-relaxed text-muted">
            <span className="font-mono text-dim">hint </span>
            {diagnostic.hint}
          </p>
        )}
      </div>
    </li>
  );
}

/** "2 errors, 1 warning" — the one-line verdict, used bare and as the summary. */
function countLine(diagnostics: readonly Diagnostic[]): string {
  if (diagnostics.length === 0) return "No problems found";
  return severityCount(summarize(diagnostics));
}

function EmptyState() {
  return (
    <p className="flex items-center gap-2 py-1 text-sm text-muted">
      <span className="font-mono text-emerald" aria-hidden>
        ✓
      </span>
      No problems found, the validator had nothing to say about this bundle.
    </p>
  );
}

/**
 * Everything the engine reported, errors first. Used by the blueprint page for a
 * bundle's validation notes and by the upload flow for a bundle the browser just
 * validated, so it renders an explicit clean state rather than collapsing to nothing.
 */
export function DiagnosticList({
  diagnostics,
  title,
  collapsible = false,
  className,
}: {
  diagnostics: readonly Diagnostic[];
  /** Heading text; omit to render bare. */
  title?: string;
  /** When true, start collapsed behind a summary line. */
  collapsible?: boolean;
  className?: string;
}) {
  const sorted = sortDiagnostics(diagnostics);
  const summary = countLine(sorted);

  const body =
    sorted.length === 0 ? (
      <EmptyState />
    ) : (
      <ul className="divide-y divide-line">
        {sorted.map((d, i) => (
          <DiagnosticRow key={`${d.code}-${i}`} diagnostic={d} />
        ))}
      </ul>
    );

  if (collapsible) {
    return (
      <details className={cx("panel group px-4 py-3", className)}>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-xs text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
          <span
            className="inline-block text-cyan transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          {title ?? "Validation notes"}
          <span className="text-dim">{summary}</span>
        </summary>
        <div className="mt-3 border-t border-line pt-3">{body}</div>
      </details>
    );
  }

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {title !== undefined && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            {title}
          </h3>
          <span className="font-mono text-[11px] text-dim">{summary}</span>
        </div>
      )}
      {body}
    </div>
  );
}
