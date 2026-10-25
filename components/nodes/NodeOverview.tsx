import type { NodeCard } from "@/lib/core";
import styles from "./NodeOverview.module.css";

function Ports({ label, ports }: { label: string; ports: NodeCard["inputs"] }) {
  return (
    <div className={styles.ports}>
      <h3 className="font-mono text-xs uppercase tracking-widest text-cyan">{label}</h3>
      {ports.length === 0 ? <p className="text-sm text-muted">None declared</p> : (
        <ul className="flex flex-col gap-2">
          {ports.map((port) => <li key={port.name} className="flex flex-wrap items-baseline gap-x-2"><span className="break-words font-mono text-sm text-fg">{port.name}</span><span className="break-words font-mono text-xs text-muted">{port.type}</span></li>)}
        </ul>
      )}
    </div>
  );
}

export function NodeOverview({ card }: { card: NodeCard }) {
  return (
    <section id="node-overview" className={`${styles.overview} scroll-mt-32`} aria-labelledby="node-overview-heading">
      <div className="border-b border-blue-rule px-5 py-3"><h2 id="node-overview-heading" className="font-display text-lg font-medium text-cyan">Inputs and outputs</h2></div>
      <div className={styles.flow}>
        <Ports label="Inputs" ports={card.inputs} />
        <span aria-hidden className={styles.arrow}>→</span>
        <div className={styles.node}>
          <p className="font-display text-xl font-semibold text-copper-ink">{card.name}</p>
          <span className="font-mono text-xs text-muted">{card.type}</span>
          {card.model !== undefined && <span className="break-words font-mono text-xs text-copper-ink">{card.model}</span>}
        </div>
        <span aria-hidden className={styles.arrow}>→</span>
        <Ports label="Outputs" ports={card.outputs} />
      </div>
      {(card.cannot.length > 0 || card.willNot.length > 0) && (
        <div className={styles.constraints}>
          {card.cannot.length > 0 && <div><h3 className="font-mono text-xs text-copper-line">Cannot receive</h3><p className="mt-1 text-xs leading-relaxed text-muted">DarkPrint checks these types against graph connections.</p><ul className="mt-2 flex flex-wrap gap-2">{card.cannot.map((term) => <li key={term} className="break-words rounded border border-copper-line/30 px-2 py-1 font-mono text-xs text-copper-ink">{term}</li>)}</ul></div>}
          {card.willNot.length > 0 && <div><h3 className="font-mono text-xs text-copper-line">Author promises</h3><p className="mt-1 text-xs leading-relaxed text-muted">Nothing checks these promises automatically.</p><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-fg">{card.willNot.map((promise) => <li key={promise}>{promise}</li>)}</ul></div>}
        </div>
      )}
    </section>
  );
}
