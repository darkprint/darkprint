/* ============================================================
   Attractor compatibility, on the page instead of only in a module.

   SEAM-41 records `lintAttractor` as *"exported for an editor that
   wants to lint a buffer on its own"* with *"reserved-name and
   identifier diagnostics exist; no dedicated UI"*. So the per-
   blueprint answer to "would a runner read this file?" has been
   computable on every one of these pages since the linter shipped,
   and no reader has ever been shown it. This is that surface.

   ── the verdict is about the GRAMMAR, and the panel says so ──
   `lintAttractor` answers one question: can Attractor's parser read
   this file, and does anything in it collide with a name Attractor
   reserves. It does not answer whether the pipeline runs, and the
   two are different by a wide margin. A stored topology carries no
   `prompt` on any node and neither of the two boundary nodes
   Attractor requires, so Attractor's own `start_node` and
   `terminal_node` lint rules (spec §7.2, both ERROR) refuse the
   pipeline on a file this panel calls readable. `/spec/topology`
   already had that sentence wrong once — it said Attractor "runs it
   as it stands" — so the correction is stated here too rather than
   linked to, because a reader who reaches this panel from the
   scorecard may never open that page.

   ── every Attractor finding is a warning, BY CONSTRUCTION ──
   `lint.ts` emits nine codes and every one of them is a warning:
   the file has already parsed by the time any of them can fire, and
   what they report is a name or a spelling a runner would read
   differently, never a broken blueprint. So this panel must not
   render a count as a failure. The verdict line stays the same
   sentence whether the list below it is empty or not, and the
   findings are presented as what a runner would do differently —
   which is also why the summary in the `<summary>` row counts them
   without colouring them.

   The exception is the parse itself. `parseDot` reporting
   `dot/parse-error` means there is no graph to lint and no runner
   would get past the first line, and that IS a different verdict.
   It is unreachable from a published release — `graphsOf` answers
   absent for a release carrying an error diagnostic, so the page
   never renders — and it is handled anyway, because this component
   takes a string and the next caller may not have that guarantee.

   ── glyph AND word, per `components/ui/severity.ts` ──
   That module records the defect this rule exists for: a second
   surface started printing diagnostics as an `aria-hidden` glyph
   alone and the word "warning" left all nine blueprint pages at
   once. `SEVERITY_META` is imported rather than restated, and the
   panel's own suite asserts the word survives a render.
   ============================================================ */

import { lintAttractor, parseDot, type Diagnostic } from "@/lib/core";
import { cx } from "@/lib/format";
import { SEVERITY_META } from "@/components/ui/severity";

/** Matches `Explainability.tsx` and `ScorePanel.tsx`, which each hold their own copy. */
const LABEL = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";

/**
 * What a reader is told, in one sentence, before any list.
 *
 * Three verdicts and not two. "Reads it" and "reads it with N notes" are the same claim
 * about the file and differ only in what follows, so they share a sentence; a file that
 * does not parse is a different claim and gets its own. Collapsing the first two into
 * "compatible / not compatible" is the presentation this panel is written to avoid: it
 * would put a graph whose node is called `my-node` in the same bucket as a file no parser
 * can read, and neither reader would be told what actually happened.
 */
interface Verdict {
  /** `true` only when Attractor's parser cannot read the file at all. */
  unreadable: boolean;
  headline: string;
  detail: string;
  /** The right-hand side of the `<summary>` row, readable without opening anything. */
  summary: string;
}

function verdictFor(unreadable: boolean, findings: readonly Diagnostic[]): Verdict {
  if (unreadable) {
    return {
      unreadable: true,
      headline: "Attractor's parser cannot read this file.",
      detail:
        "The findings below are what stopped it. Nothing further was checked: the reserved-name " +
        "rules run over a graph, and there is no graph until the file parses.",
      summary: "does not parse",
    };
  }
  if (findings.length === 0) {
    return {
      unreadable: false,
      headline: "Attractor's parser reads this file, and nothing in it collides with a name Attractor reserves.",
      detail:
        "Every attribute outside Attractor's reserved list is ignored by a runner, which is what " +
        "lets the card pin travel inside a file a runner still reads.",
      summary: "no findings",
    };
  }
  const notes = findings.length === 1 ? "one note" : `${findings.length} notes`;
  return {
    unreadable: false,
    headline: `Attractor's parser reads this file, with ${notes} about how it would read it.`,
    detail:
      "None of these stops a runner and none is a defect in the blueprint. Each one is a name or a " +
      "spelling Attractor would take to mean something other than what is written.",
    summary: `${findings.length} ${findings.length === 1 ? "note" : "notes"}`,
  };
}

/** `topology.dot:12:4`, or as much of it as the diagnostic carries. */
function where(diagnostic: Diagnostic, file: string): string {
  const at = diagnostic.location;
  const parts = [at?.file ?? file];
  if (at?.line !== undefined) parts.push(String(at.line));
  if (at?.line !== undefined && at.column !== undefined) parts.push(String(at.column));
  return parts.join(":");
}

/**
 * One finding: the severity as a word, the code, where it is, and what to do.
 *
 * The code is printed because it is the thing a reader can look up — every one of the nine
 * is documented on `/spec/topology` under its own name — and because it is what
 * `darkprint validate` prints for the same file, so the page and the command agree in a
 * form a person can match by eye.
 */
function Finding({ diagnostic, file }: { diagnostic: Diagnostic; file: string }) {
  const meta = SEVERITY_META[diagnostic.severity];
  return (
    <li className="flex flex-col gap-1 rounded border border-line bg-surface-2 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span aria-hidden style={{ color: meta.color }} className="font-mono text-[11px]">
          {meta.glyph}
        </span>
        {/* The word beside the glyph, never instead of it: `components/ui/severity.ts`
            records a pass that shipped the glyph alone and took the severity off nine
            pages for anyone not reading colour. */}
        <span
          className="font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: meta.color }}
        >
          {meta.word}
        </span>
        <span className="font-mono text-[11px] text-dim">{diagnostic.code}</span>
        <span className="font-mono text-[11px] text-dim">{where(diagnostic, file)}</span>
      </div>
      <p className="text-sm leading-relaxed text-muted">{diagnostic.message}</p>
      {diagnostic.hint !== undefined && diagnostic.hint !== "" && (
        <p className="font-mono text-[11px] leading-relaxed text-dim">{diagnostic.hint}</p>
      )}
    </li>
  );
}

/**
 * The panel.
 *
 * Takes the DOT source rather than a diagnostic list, so the page mounts it in one line and
 * the reading cannot drift from the file being shown: `parseDot` and `lintAttractor` are the
 * same pair `lib/server/engine/validate.ts` runs for `POST /api/validate/dot` and the same
 * pair `resolveBundle` folds in, so this panel and `darkprint validate` cannot disagree
 * about one file. It is a server component and computes at render; both functions are pure,
 * isomorphic and take a string, so nothing is shipped to the browser for it.
 */
export function AttractorCompatibility({
  dot,
  file = "topology.dot",
  className,
}: {
  dot: string;
  /** The name to print beside a finding that carries no file of its own. */
  file?: string;
  className?: string;
}) {
  const parsed = parseDot(dot, file);
  /* Parse diagnostics AND lint diagnostics, in that order, because a reader asking "would
     a runner read this" is asking about both and `parseDot` is the half that answers first.
     `lintAttractor` is only reachable with a graph, which is exactly when `parsed.graph` is
     present — the parser omits it only for `dot/parse-error`. */
  const findings: Diagnostic[] = [
    ...parsed.diagnostics,
    ...(parsed.graph === undefined ? [] : lintAttractor(parsed.graph, dot, file)),
  ];
  const verdict = verdictFor(parsed.graph === undefined, findings);

  return (
    <details
      open
      className={cx("group panel p-5", className)}
      aria-labelledby="attractor-compatibility"
    >
      <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span
            className="inline-block shrink-0 text-cyan transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          <h3 id="attractor-compatibility" className={LABEL}>
            Attractor, what a runner reads
          </h3>
        </span>
        <span className="font-mono text-[11px] text-dim">{verdict.summary}</span>
      </summary>

      <p className="flex items-start gap-2 rounded border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-muted">
        <span
          className={cx("mt-0.5 font-mono", verdict.unreadable ? "text-signal" : "text-cyan")}
          aria-hidden
        >
          {verdict.unreadable ? "✕" : "▸"}
        </span>
        <span>
          <span className="text-fg">{verdict.headline}</span> {verdict.detail}
        </span>
      </p>

      {findings.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {findings.map((diagnostic, i) => (
            <Finding key={`${diagnostic.code}-${i}`} diagnostic={diagnostic} file={file} />
          ))}
        </ul>
      )}

      {/* The limit of the whole reading, in the open and not behind the `<details>` the
          findings sit in. `/spec/topology` shipped the opposite claim for a while and it is
          the easiest one on this page to get wrong: a green verdict here reads as "this
          runs", and it is not what was measured. The two boundary nodes and the prompts are
          named rather than alluded to, so a reader can check the file in front of them. */}
      <p className="mt-3 rounded border border-line bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-dim">
        Parsing is not running. This reads the topology on its own, and a topology carries no
        prompts and neither of the two boundary nodes Attractor requires, so a runner parses
        it and then refuses the pipeline. <span className="text-fg">darkprint export &lt;dir&gt; --attractor</span>{" "}
        compiles the graph and its cards into the file a runner takes, and that file opens
        with a list of everything a blueprint had no way to say.
      </p>
    </details>
  );
}
