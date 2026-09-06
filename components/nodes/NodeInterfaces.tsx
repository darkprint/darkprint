import Link from "next/link";
import { cx } from "@/lib/format";
import { nodeHref, termHref } from "@/lib/href";

/** One declared port, with the ontology lookup already done on the server. */
export interface PortView {
  name: string;
  /** `data-type` term id, exactly as the card writes it. */
  type: string;
  /** True when the vocabulary carries the term, so it has a page to link to. */
  known: boolean;
  /** Outputs are always sent; the column is only rendered for inputs. */
  required: boolean;
  description?: string;
}

/** One declared upstream dependency — a card id, or the DOT node id that supplies it. */
export interface DependencyView {
  id: string;
  /** True when the id names a card in the registry, not only a node in one graph. */
  known: boolean;
}

const INPUT_ACCENT = "var(--color-cyan)";
const OUTPUT_ACCENT = "var(--color-emerald)";

/** The port name, in the chip vocabulary the schematic's interface panel established. */
function PortChip({ name, accent }: { name: string; accent: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg">
      <span className="h-1 w-1 rounded-full" style={{ background: accent }} aria-hidden />
      {name}
    </span>
  );
}

/** A data type, linked into the vocabulary that defines it. */
function TypeCell({ type, known }: { type: string; known: boolean }) {
  const chip =
    "inline-flex rounded border px-2 py-0.5 font-mono text-[11px] transition-colors";
  return known ? (
    <Link
      href={termHref(type)}
      aria-label={`Ontology data type: ${type}`}
      className={cx(chip, "border-violet/40 bg-violet/10 text-violet hover:border-violet")}
    >
      {type}
    </Link>
  ) : (
    <span className={cx(chip, "border-line bg-surface-2 text-dim")}>{type}</span>
  );
}

/** Glyph and word both, so the column reads without the colour. */
function RequiredCell({ required }: { required: boolean }) {
  return required ? (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-fg">
      <span aria-hidden>✓</span> required
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-dim">
      <span aria-hidden>○</span> optional
    </span>
  );
}

/* 11px, not 10px. These are column headers, not decoration — a reader who cannot tell
   `Data type` from `Required` cannot read the row under it — and 10px was the smallest
   type on the page, below the floor the rest of the site holds to. Tracking matches
   `LABEL` on the node page so the two label systems stop differing by 0.22px. */
const TH =
  "pb-2 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.18em] text-dim";
const TD = "py-2.5 pr-4 align-top";

function PortTable({
  label,
  ports,
  accent,
  showRequired,
  empty,
}: {
  label: string;
  ports: readonly PortView[];
  accent: string;
  showRequired: boolean;
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden />
        {/* `h3`, not a styled span. This sits under the `Interfaces` panel heading and
            is a named sub-section of it, so a screen-reader user rotoring by heading
            should be able to reach `Inputs` and `Outputs` directly. Tailwind's preflight
            resets heading `font-size` and `font-weight` to `inherit`, so promoting the
            element changes the outline and not one rendered pixel. */}
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          {label}
        </h3>
        <span className="font-mono text-[11px] text-dim">{ports.length}</span>
      </div>

      {ports.length === 0 ? (
        <p className="text-xs leading-relaxed text-dim">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <caption className="sr-only">
              {label} declared by this node card
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>
                  Name
                </th>
                <th scope="col" className={TH}>
                  Data type
                </th>
                {showRequired && (
                  <th scope="col" className={TH}>
                    Required
                  </th>
                )}
                <th scope="col" className={cx(TH, "w-1/2")}>
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ports.map((port) => (
                <tr key={port.name}>
                  {/* `th scope="row"`, not `td`. The port name is what identifies the
                      row, and without a row header a screen reader announces every
                      cell against the column alone — three ports of the same type read
                      as "Ontology data type: json" three identical times, with nothing
                      saying which port each belongs to. */}
                  <th scope="row" className={cx(TD, "font-normal")}>
                    <PortChip name={port.name} accent={accent} />
                  </th>
                  <td className={TD}>
                    <TypeCell type={port.type} known={port.known} />
                  </td>
                  {showRequired && (
                    <td className={TD}>
                      <RequiredCell required={port.required} />
                    </td>
                  )}
                  <td className={cx(TD, "text-sm leading-relaxed text-muted")}>
                    {port.description ?? (
                      <span className="text-dim">Not described.</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * What the node accepts and what it hands on — the contract a blueprint wires
 * against, and the only part of a card that a version bump can break.
 */
export function NodeInterfaces({
  inputs,
  outputs,
  dependencies,
  className,
}: {
  inputs: readonly PortView[];
  outputs: readonly PortView[];
  dependencies: readonly DependencyView[];
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-6", className)}>
      <PortTable
        label="Inputs"
        ports={inputs}
        accent={INPUT_ACCENT}
        showRequired
        empty="No inputs declared, nothing upstream feeds this node."
      />
      <PortTable
        label="Outputs"
        ports={outputs}
        accent={OUTPUT_ACCENT}
        showRequired={false}
        empty="No outputs declared, whatever this node produces leaves the graph."
      />

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--color-muted)" }}
            aria-hidden
          />
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
            Dependencies
          </h3>
          <span className="font-mono text-[11px] text-dim">
            {dependencies.length}
          </span>
        </div>
        {dependencies.length === 0 ? (
          <p className="text-xs leading-relaxed text-dim">
            None declared, no edge has to arrive for this node to run.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {dependencies.map((dependency) => (
                <li key={dependency.id}>
                  {dependency.known ? (
                    <Link
                      href={nodeHref(dependency.id)}
                      /* Amber on hover, the card register: every one of these
                         dependencies is another CARD, and the link lands on its page. */
                      className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg transition-colors hover:border-amber hover:text-amber"
                    >
                      <span
                        className="h-1 w-1 rounded-full bg-current"
                        aria-hidden
                      />
                      {dependency.id}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted">
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{ background: "var(--color-faint)" }}
                        aria-hidden
                      />
                      {dependency.id}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-dim">
              The upstream nodes this card expects to hear from. The resolver
              checks each one against a real edge in every blueprint that pins the
              card. Unlinked names belong to a graph, not the library.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
