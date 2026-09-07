"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { DiagnosticList } from "@/components/ui/DiagnosticList";
import { KeyValueList, KeyValueRow } from "@/components/ui/KeyValueList";
import { cx } from "@/lib/format";
import { loadBundle, sortDiagnostics, type Diagnostic } from "@/lib/core";

import { B, FieldsProvider, M } from "./Blank";
import { BLANK_BY_ID, exampleValues, valueOf, type BlankValues } from "./blanks";
import { archiveEntries, bundleFiles, cardFilesOf, rubricStarted } from "./bundle";
import { FilePanel, Given, Key, Line, Note } from "./FilePanel";
import { GraphStrip, type GraphEdge, type GraphNode } from "./GraphStrip";
import {
  FORWARD_EDGES,
  TUTORIAL_ONTOLOGY,
  edgeFaults,
  emptyBlanks,
  identifierFaults,
  graphStats,
  offeredTerms,
  portsFit,
  progress,
  vocabularyFaults,
} from "./state";
import { getServerSnapshot, getSnapshot, goToStep, subscribe, syncStepFromHash, writeValues } from "./store";
import { storedZip } from "./zip";

/* ============================================================
   /tutorial — the wizard, and the only stateful thing on the page
   ------------------------------------------------------------
   Two pieces of state: what the reader has typed, and which step is
   open. Everything else on screen is derived from the first, in
   `state.ts`, so the graph, the fault list and the download button
   cannot disagree about whether the folder is ready.

   ── the fields are controlled, and the prototype's were not ──
   The design reference kept them uncontrolled and repainted the DOM
   by hand, for a reason it wrote down: steps are shown and hidden
   rather than unmounted, so a remount would empty everything typed.
   That reason survives here and the technique does not need to: with
   the values in state, a mirror is a read and an unmount would lose
   nothing. The steps stay shown-and-hidden anyway, because a reader
   who scrolls the graph strip and comes back should find the page
   where they left it.

   ── nothing is uploaded, and that is a property of the code ──
   The only network this component could reach is one it does not
   have: there is no fetch here, and the folder is assembled by
   `bundleFiles`, zipped by `storedZip` and validated by `loadBundle`,
   all of them pure and all of them in this tab.
   ============================================================ */

const STEPS = [
  { n: 1, chip: "01 name", title: "Name it" },
  { n: 2, chip: "02 crawl", title: "The crawler" },
  { n: 3, chip: "03 extract", title: "The extractor" },
  { n: 4, chip: "04 verify", title: "The checker, and the writer" },
  { n: 5, chip: "05 wire", title: "Wire them" },
  { n: 6, chip: "06 download", title: "Download the folder" },
  { n: 7, chip: "07 measure", title: "Measure it" },
] as const;

const EMPTY: BlankValues = {};

export function TutorialWizard() {
  /* The typed values and the open step, from the store rather than from `useState`: the
     page is server-rendered and both only exist in the browser. `store.ts` records why an
     effect that sets state is the wrong shape for this. */
  const { values, step } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [message, setMessage] = useState("");
  const [findings, setFindings] = useState<readonly Diagnostic[] | undefined>(undefined);

  /* The reader edited the address, or followed a link on the page back to a step. Mount is
     covered by the store's own first read, so this is the change and nothing else. */
  useEffect(() => {
    window.addEventListener("hashchange", syncStepFromHash);
    return () => window.removeEventListener("hashchange", syncStepFromHash);
  }, []);

  const write = useCallback((next: BlankValues) => {
    writeValues(next);
    setMessage("");
    setFindings(undefined);
  }, []);

  const set = useCallback(
    (id: string, value: string) => {
      write({ ...values, [id]: value });
    },
    [values, write],
  );

  const goTo = useCallback((n: number) => {
    goToStep(n);
  }, []);

  const v = useCallback((id: string) => valueOf(values, id), [values]);
  const on = rubricStarted(values);

  /* Both kinds in one list, because both refuse the download and a reader fixing red
     keywords should not have to learn that there are two sorts of red. */
  const faults = useMemo(
    () => [...vocabularyFaults(values, TUTORIAL_ONTOLOGY), ...identifierFaults(values)],
    [values],
  );
  const mismatches = useMemo(() => edgeFaults(values, TUTORIAL_ONTOLOGY), [values]);
  const { filled, total } = useMemo(() => progress(values), [values]);

  const datalists = useMemo(
    () => ({
      "node-type": offeredTerms(TUTORIAL_ONTOLOGY, "node-type"),
      "data-type": offeredTerms(TUTORIAL_ONTOLOGY, "data-type"),
      tool: offeredTerms(TUTORIAL_ONTOLOGY, "tool"),
    }),
    [],
  );

  /* ---------- the graph ---------- */

  const nodes: GraphNode[] = useMemo(() => {
    const spec = (ids: readonly string[]) => ({
      filled: ids.filter((id) => v(id) !== "").length,
      total: ids.length,
    });
    const ref = (id: string) => (v(id) === "" ? undefined : `${v(id)}@1.0.0`);
    const port = (label: string, type: string) => `${label}: ${type === "" ? "?" : type}`;

    return [
      {
        name: v("n1") || "crawl",
        type: v("c1_type"),
        ref: ref("c1_id"),
        ...spec(["n1", "c1_id", "c1_name", "c1_type", "c1_action", "c1_spec", "c1_tools", "shape_page", "c1_out_type", "c1_will_not"]),
        ports: ["in seeds: json", `out ${port("pages", v("c1_out_type"))}`],
      },
      {
        name: v("n2") || "extract",
        type: v("c2_type"),
        ref: ref("c2_id"),
        ...spec(["n2", "c2_id", "c2_name", "c2_type", "c2_action", "c2_in_type", "shape_entry", "c2_out_type", "c2_will_not"]),
        ports: [
          `in ${port("pages", v("c2_in_type"))} · unsupported: json`,
          `out ${port("entries", v("c2_out_type"))}`,
        ],
        ...(on ? { cannot: "acceptance-criteria" } : {}),
      },
      {
        name: v("n3") || "verify",
        type: v("c3_type"),
        ref: ref("c3_id"),
        ...spec(["n3", "c3_id", "c3_name", "c3_type", "c3_action", "c3_in_type", "c3_out_type", "c3_max_iterations", "c3_will_not"]),
        ports: [
          `in ${port("entries", v("c3_in_type"))}${on ? " · criteria" : ""}`,
          `out ${port("grounded", v("c3_out_type"))} · unsupported: json`,
        ],
      },
      {
        name: v("n4") || "assemble",
        type: v("c4_type"),
        ref: ref("c4_id"),
        ...spec(["n4", "c4_id", "c4_type", "c4_in_type"]),
        ports: [`in ${port("grounded", v("c4_in_type"))}`, "out knowledge: artifact"],
      },
    ];
  }, [v, on]);

  const edges: GraphEdge[] = useMemo(
    () =>
      FORWARD_EDGES.map((edge) => {
        const from = v(edge.from);
        const to = v(edge.to);
        const shape =
          edge.label === "pages"
            ? v("shape_page") || BLANK_BY_ID.get("shape_page")!.example
            : `${v("shape_entry") || BLANK_BY_ID.get("shape_entry")!.example}${edge.label === "grounded" ? " + checked_at" : ""}`;
        return {
          label: edge.label,
          from,
          to,
          fits: from === "" || to === "" || portsFit(from, to, TUTORIAL_ONTOLOGY),
          shape,
        };
      }),
    [v],
  );

  const definedNodes = nodes.filter((node) => node.filled === node.total).length;

  /* ---------- the folder ---------- */

  const download = useCallback(() => {
    if (faults.length > 0) {
      setMessage(
        "The vocabulary does not know one of these terms, and the validator would report it " +
          "as an error. Fix the red keywords first.",
      );
      return;
    }
    if (mismatches.length > 0) {
      setMessage(
        "Two ends of an edge that cannot carry the same thing. The validator reports that as " +
          "an error too. Fix the red edge first.",
      );
      return;
    }
    const empty = emptyBlanks(values);
    if (empty.length > 0) {
      setMessage(
        `${empty.length} keyword${empty.length === 1 ? "" : "s"} still empty. Fill them, or ` +
          "press “fill with example”.",
      );
      return;
    }

    const files = bundleFiles(values);
    const name = v("blueprint_name") || "blueprint";
    const url = URL.createObjectURL(storedZip(archiveEntries(files, name)));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    /* Revoked on a timer rather than immediately: the click is asynchronous and a URL
       revoked in the same frame is a download that never starts in some browsers. */
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);

    setMessage(
      `${files.length} files downloaded as ${name}.zip` +
        (on ? ", rubric and scenario included." : ". Step 07 adds the rubric."),
    );

    /*
     * The same validator `/upload` runs, over the same bytes, in this tab.
     *
     * `cardFilesOf` is not optional: `loadBundle` reads every entry of `cardFiles` as a node
     * card whatever its path, so handing it the whole folder reports `evals/scenario.yaml`
     * as a card missing eight required fields.
     */
    const dot = files.find((file) => file.path === "topology.dot");
    if (dot === undefined) return;
    const result = loadBundle(
      {
        manifest: { slug: name, title: name, summary: "", tags: [] },
        dot: dot.text,
        cardFiles: cardFilesOf(files),
      },
      { ontology: TUTORIAL_ONTOLOGY },
    );
    setFindings(sortDiagnostics(result.diagnostics));
  }, [faults, mismatches, values, v, on]);

  /* ---------- the page ---------- */

  const stats = graphStats(values, definedNodes);
  const cardName = (id: string) => (
    <>
      cards/<M id={id} />@1.0.0.yaml
    </>
  );

  return (
    <FieldsProvider value={{ values, faults, set }}>
      <GraphStrip
        nodes={nodes}
        edges={edges}
        rubric={{
          on,
          ref: on ? `${v("c5_id")}@1.0.0` : "step 07",
          into: v("n3") || "verify",
        }}
        returnArc={`unsupported: json · ${v("shape_entry") || BLANK_BY_ID.get("shape_entry")!.example} + reason · back to ${v("n2") || "extract"}`}
        stats={stats}
        faults={mismatches}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-line-bright bg-surface-2/70 px-4 py-3.5">
        <nav aria-label="Steps" className="flex flex-wrap gap-2">
          {STEPS.map((entry) => (
            <button
              key={entry.n}
              type="button"
              aria-current={entry.n === step ? "step" : undefined}
              onClick={() => goTo(entry.n)}
              className={cx(
                "rounded-md border px-2.5 py-1.5 font-mono text-xs transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97]",
                entry.n === step
                  ? "border-cyan bg-cyan/10 text-cyan"
                  : "border-line text-muted hoverable:hover:text-fg",
              )}
            >
              {entry.chip}
            </button>
          ))}
        </nav>
        <span className="ml-auto font-mono text-xs text-dim">
          {filled}/{total} filled
        </span>
        <Button variant="outline" size="sm" onClick={() => write({ ...exampleValues(), ...stripEmpty(values) })}>
          fill with example
        </Button>
        <Button variant="ghost" size="sm" onClick={() => write(EMPTY)}>
          clear
        </Button>
      </div>

      {faults.length === 0 ? null : (
        <ul className="mt-4 flex flex-col gap-2 rounded-lg border border-signal/40 border-l-2 border-l-signal bg-surface-2/70 px-4 py-3">
          {faults.map((fault) => (
            <li key={fault.id} className="flex flex-wrap gap-x-3 text-sm leading-relaxed">
              <span className="font-mono text-xs text-signal">{fault.id}</span>
              <span className="min-w-0 flex-1 text-muted">{fault.text}</span>
            </li>
          ))}
        </ul>
      )}

      {STEPS.map((entry) => (
        <section
          key={entry.n}
          hidden={entry.n !== step}
          aria-labelledby={`step-${entry.n}-title`}
          className="mt-9 flex min-w-0 flex-col gap-5"
        >
          <h2 id={`step-${entry.n}-title`} className="font-display text-2xl font-semibold text-fg">
            {String(entry.n).padStart(2, "0")} · {entry.title}
          </h2>
          {renderStep(entry.n)}
        </section>
      ))}

      <div className="mt-9 flex items-center justify-between gap-4 border-t border-line pt-5">
        <Button variant="outline" onClick={() => goTo(Math.max(1, step - 1))} disabled={step === 1}>
          ← Back
        </Button>
        <span className="font-mono text-xs text-dim">
          step {String(step).padStart(2, "0")} of 07
        </span>
        <Button
          onClick={() => goTo(Math.min(STEPS.length, step + 1))}
          disabled={step === STEPS.length}
        >
          Next →
        </Button>
      </div>

      {/* One datalist per vocabulary, built from the ontology rather than typed out. The
          design prototype hard-coded the three lists twice over, in the datalists and again
          in its validator, and the two copies had already drifted: one ended `signal, event,
          status` and the other `signal, status, event`. */}
      {Object.entries(datalists).map(([kind, terms]) => (
        <datalist key={kind} id={`dp-${kind}`}>
          {terms.map((term) => (
            <option key={term} value={term} />
          ))}
        </datalist>
      ))}
    </FieldsProvider>
  );

  function renderStep(n: number): React.ReactNode {
    switch (n) {
      case 1:
        return (
          <>
            <p className="text-[15px] leading-relaxed text-muted">
              A blueprint is a folder: <code className="font-mono text-blueprint-ink">topology.dot</code>{" "}
              plus one card per node. The graph&rsquo;s name is the blueprint&rsquo;s, like a
              repository: lowercase, hyphenated. The summary says what comes out of a run.
            </p>
            <FilePanel name="topology.dot" meta="header">
              <Line>
                <Key>digraph</Key> &quot;
                <B id="blueprint_name" />
                &quot; {"{"}
              </Line>
              <Line>
                {"  "}
                <Given>rankdir=LR;</Given>
              </Line>
              <Line>
                {"  "}
                <Given>node [shape=box, style=rounded];</Given>
              </Line>
            </FilePanel>
            <FilePanel name="README.md">
              <Line>
                <Given># </Given>
                <M id="blueprint_name" />
              </Line>
              <Line />
              <Line>
                <B id="summary" />
              </Line>
            </FilePanel>
            <p className="text-[15px] leading-relaxed text-muted">
              The summary goes in the README rather than on the{" "}
              <code className="font-mono text-blueprint-ink">digraph</code> line. DOT would
              accept a graph-level attribute there and the validator ignores it. A
              blueprint&rsquo;s title, summary, category and tags are entered on the Publish page
              when you publish (a <code className="font-mono text-blueprint-ink">blueprint.yaml</code>{" "}
              in the folder pre-fills them); the graph file is not where they live. Step 05
              fills in the rest of the graph file.
            </p>
          </>
        );

      case 2:
        return (
          <>
            <p className="text-[15px] leading-relaxed text-muted">
              It fetches pages from the seed sites and hands the text on untouched, deciding
              nothing about what is worth keeping. Its output port carries the contract: a data
              type the validator checks, and a record shape the next node reads. Cards first,
              because the graph pins them by id.
            </p>
            <FilePanel name={cardName("c1_id")}>
              <Line>
                <Key>id</Key>: <B id="c1_id" />
              </Line>
              <Line>
                <Key>name</Key>: <B id="c1_name" />
              </Line>
              <Line>
                <Key>type</Key>: <B id="c1_type" /> <Note># deterministic, so: tool</Note>
              </Line>
              <Line>
                <Key>action</Key>: <Given>&gt;-</Given>
              </Line>
              <Line>
                <B id="c1_action" />
              </Line>
              <Line>
                <Key>spec</Key>: <Given>&gt;-</Given>
              </Line>
              <Line>
                <B id="c1_spec" />
              </Line>
              <Line>
                <Key>tools</Key>:
              </Line>
              <Line>
                {"  - "}
                <B id="c1_tools" />
              </Line>
              <Line>
                <Key>mcp</Key>: <Given>[]</Given>
              </Line>
              <Line>
                <Key>inputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: seeds"}</Given>
              </Line>
              <Line>
                <Given>{"    description: \"the seed URLs, one per line\""}</Given>
              </Line>
              <Line>
                <Given>{"    type: json"}</Given>
              </Line>
              <Line>
                <Key>outputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: pages"}</Given>
              </Line>
              <Line>
                {"    "}
                <Key>description</Key>: <Given>&quot;one record per page, </Given>
                <B id="shape_page" />
                <Given>&quot;</Given>
              </Line>
              <Line>
                {"    "}
                <Key>type</Key>: <B id="c1_out_type" />
              </Line>
              <Line>
                <Key>dependencies</Key>: <Given>[]</Given>
              </Line>
              <Line>
                <Key>cannot</Key>: <Given>[]</Given>
              </Line>
              <Line>
                <Key>will_not</Key>:
              </Line>
              <Line>
                {"  - "}
                <B id="c1_will_not" />
              </Line>
              <Line>
                <Key>risk_markers</Key>: <Given>[]</Given>
              </Line>
              <Line>
                <Key>version</Key>: <Given>1.0.0</Given>
              </Line>
            </FilePanel>
            <KeyValueList>
              <KeyValueRow
                keyWidth={132}
                term={<span className="font-mono text-xs text-blueprint-ink">cannot</span>}
              >
                <span className="text-sm leading-relaxed text-muted">
                  Data types the validator refuses to let an edge carry into this node. It takes
                  terms from the vocabulary and nothing else; a sentence here is an error that
                  fails the whole folder. Empty on this card; step 07 puts the one entry it takes
                  on the extractor.
                </span>
              </KeyValueRow>
              <KeyValueRow
                keyWidth={132}
                term={<span className="font-mono text-xs text-blueprint-ink">will_not</span>}
              >
                <span className="text-sm leading-relaxed text-muted">
                  The promise in your own words. Nothing checks it, and it is addressed to whoever
                  reads the card and to the agent that runs from it.
                </span>
              </KeyValueRow>
            </KeyValueList>
          </>
        );

      case 3:
        return (
          <>
            <p className="text-[15px] leading-relaxed text-muted">
              A model reads the pages and decides what each one claims, so its type is agent.
              Every entry it writes carries the URL and the quoted span it came from. It takes
              a second input: what the checker sent back.
            </p>
            <FilePanel name={cardName("c2_id")}>
              <Line>
                <Key>id</Key>: <B id="c2_id" />
              </Line>
              <Line>
                <Key>name</Key>: <B id="c2_name" />
              </Line>
              <Line>
                <Key>type</Key>: <B id="c2_type" /> <Note># non-deterministic output</Note>
              </Line>
              <Line>
                <Key>action</Key>: <Given>&gt;-</Given>
              </Line>
              <Line>
                <B id="c2_action" />
              </Line>
              <Line>
                <Key>spec</Key>: <Given>&gt;- (given: the entry form, and what to do with one sent back)</Given>
              </Line>
              <Line>
                <Key>inputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: pages"}</Given>
              </Line>
              <Line>
                {"    "}
                <Key>description</Key>: <Given>&quot;one record per page, </Given>
                <M id="shape_page" />
                <Given>&quot;</Given>
              </Line>
              <Line>
                {"    "}
                <Key>type</Key>: <B id="c2_in_type" />{" "}
                <Note># same as the crawler&rsquo;s output</Note>
              </Line>
              <Line>
                <Given>{"  - name: unsupported"}</Given>
              </Line>
              <Line>
                <Given>{"    description: \"an entry sent back, "}</Given>
                <M id="shape_entry" />
                <Given>{" + reason\""}</Given>
              </Line>
              <Line>
                <Given>{"    type: json"}</Given>
              </Line>
              <Line>
                <Key>outputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: entries"}</Given>
              </Line>
              <Line>
                {"    "}
                <Key>description</Key>: <Given>&quot;one entry per claim, </Given>
                <B id="shape_entry" />
                <Given>&quot;</Given>
              </Line>
              <Line>
                {"    "}
                <Key>type</Key>: <B id="c2_out_type" />
              </Line>
              <Line>
                <Key>dependencies</Key>: <Given>[</Given>
                <M id="c1_id" />
                <Given>, </Given>
                <M id="c3_id" />
                <Given>]</Given>
              </Line>
              <Line>
                <Key>cannot</Key>:{" "}
                {on ? <Given>[acceptance-criteria]</Given> : <Given>[] # step 07 fills this</Given>}
              </Line>
              <Line>
                <Key>will_not</Key>:
              </Line>
              <Line>
                {"  - "}
                <B id="c2_will_not" />
              </Line>
              <Line>
                <Key>version</Key>: <Given>1.0.0</Given>
              </Line>
            </FilePanel>
            <p className="text-[15px] leading-relaxed text-muted">
              <code className="font-mono text-blueprint-ink">dependencies</code> names the cards
              upstream of this one, by card id rather than by node name. Leave it empty and every
              edge into the node is a warning: the graph says data arrives and the card does not
              say it expects any.
            </p>
          </>
        );

      case 4:
        return (
          <>
            <p className="text-[15px] leading-relaxed text-muted">
              The checker reopens every cited span. Two output ports, one verdict each. It also
              carries the number that bounds the loop. The writer only files what arrived grounded.
            </p>
            <FilePanel name={cardName("c3_id")}>
              <Line>
                <Key>id</Key>: <B id="c3_id" />
              </Line>
              <Line>
                <Key>name</Key>: <B id="c3_name" />
              </Line>
              <Line>
                <Key>type</Key>: <B id="c3_type" /> <Note># it judges, so: validation</Note>
              </Line>
              <Line>
                <Key>action</Key>: <Given>&gt;-</Given>
              </Line>
              <Line>
                <B id="c3_action" />
              </Line>
              <Line>
                <Key>tools</Key>: <Given>[http-fetch]</Given>
              </Line>
              <Line>
                <Key>params</Key>:
              </Line>
              <Line>
                {"  "}
                <Key>max_iterations</Key>: <B id="c3_max_iterations" />{" "}
                <Note># the cap on the loop</Note>
              </Line>
              <Line>
                <Key>inputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: entries"}</Given>
              </Line>
              <Line>
                {"    "}
                <Key>type</Key>: <B id="c3_in_type" />
              </Line>
              {on ? (
                <>
                  <Line>
                    <Given>{"  - name: criteria"}</Given>
                  </Line>
                  <Line>
                    <Given>{"    type: acceptance-criteria"}</Given>{" "}
                    <Note># added in step 07</Note>
                  </Line>
                </>
              ) : null}
              <Line>
                <Key>outputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: grounded"}</Given>
              </Line>
              <Line>
                {"    "}
                <Key>type</Key>: <B id="c3_out_type" />
              </Line>
              <Line>
                <Given>{"  - name: unsupported"}</Given>
              </Line>
              <Line>
                <Given>{"    type: json"}</Given>
              </Line>
              <Line>
                <Key>will_not</Key>:
              </Line>
              <Line>
                {"  - "}
                <B id="c3_will_not" />
              </Line>
              <Line>
                <Key>version</Key>: <Given>1.0.0</Given>
              </Line>
            </FilePanel>
            <FilePanel name={cardName("c4_id")}>
              <Line>
                <Key>id</Key>: <B id="c4_id" />
              </Line>
              <Line>
                <Key>name</Key>: <Given>Knowledge Writer</Given>
              </Line>
              <Line>
                <Key>type</Key>: <B id="c4_type" />
              </Line>
              <Line>
                <Key>tools</Key>: <Given>[file-io]</Given>
              </Line>
              <Line>
                <Key>inputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: grounded"}</Given>
              </Line>
              <Line>
                {"    "}
                <Key>type</Key>: <B id="c4_in_type" />{" "}
                <Note># same as the checker&rsquo;s grounded port</Note>
              </Line>
              <Line>
                <Key>outputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: knowledge"}</Given>
              </Line>
              <Line>
                <Given>{"    type: artifact"}</Given>
              </Line>
              <Line>
                <Key>version</Key>: <Given>1.0.0</Given>
              </Line>
            </FilePanel>
          </>
        );

      case 5:
        return (
          <>
            <p className="text-[15px] leading-relaxed text-muted">
              Name each node once. The card references and the edges below reuse the names.
            </p>
            <FilePanel name="topology.dot" meta="nodes &amp; edges">
              <Line>
                <Given>
                  digraph &quot;<M id="blueprint_name" />&quot; {"{"} …
                </Given>
              </Line>
              <Line>
                {"  "}
                <B id="n1" /> <Given>[card=&quot;</Given>
                <M id="c1_id" />
                <Given>@1.0.0&quot;];</Given>
              </Line>
              <Line>
                {"  "}
                <B id="n2" /> <Given>[card=&quot;</Given>
                <M id="c2_id" />
                <Given>@1.0.0&quot;];</Given>
              </Line>
              <Line>
                {"  "}
                <B id="n3" /> <Given>[card=&quot;</Given>
                <M id="c3_id" />
                <Given>@1.0.0&quot;];</Given>
              </Line>
              <Line>
                {"  "}
                <B id="n4" /> <Given>[card=&quot;</Given>
                <M id="c4_id" />
                <Given>@1.0.0&quot;];</Given>
              </Line>
              <Line />
              <Line>
                <Given>
                  {"  "}
                  <M id="n1" /> {"->"} <M id="n2" /> [out=&quot;pages&quot;, in=&quot;pages&quot;];
                </Given>
              </Line>
              <Line>
                <Given>
                  {"  "}
                  <M id="n2" /> {"->"} <M id="n3" /> [out=&quot;entries&quot;,
                  in=&quot;entries&quot;];
                </Given>
              </Line>
              <Line>
                <Given>
                  {"  "}
                  <M id="n3" /> {"->"} <M id="n2" /> [label=&quot;unsupported&quot;, style=dashed,
                  out=&quot;unsupported&quot;, in=&quot;unsupported&quot;];
                </Given>
              </Line>
              <Line>
                <Given>
                  {"  "}
                  <M id="n3" /> {"->"} <M id="n4" /> [label=&quot;grounded&quot;,
                  out=&quot;grounded&quot;, in=&quot;grounded&quot;];
                </Given>
              </Line>
              {on ? (
                <>
                  <Line>
                    <Given>
                      {"  "}rubric [card=&quot;<M id="c5_id" />@1.0.0&quot;];
                    </Given>
                  </Line>
                  <Line>
                    <Given>
                      {"  "}rubric {"->"} <M id="n3" /> [out=&quot;criteria&quot;,
                      in=&quot;criteria&quot;];
                    </Given>
                  </Line>
                </>
              ) : null}
              <Line>
                <Given>{"}"}</Given>
              </Line>
            </FilePanel>
            <span className="label">The contracts on each edge</span>
            <div className="panel min-w-0 overflow-x-auto">
              <table className="w-full min-w-[40rem] table-fixed border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="label w-[28%] px-4 py-2.5 font-normal">
                      Edge
                    </th>
                    <th scope="col" className="label w-[32%] px-4 py-2.5 font-normal">
                      Carrier <span className="normal-case text-dim">checked by the validator</span>
                    </th>
                    <th scope="col" className="label w-[40%] px-4 py-2.5 font-normal">
                      Shape <span className="normal-case text-dim">port description</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { a: "n1", b: "n2", carrier: "pages", type: "c1_out_type", shape: <><M id="shape_page" /></> },
                    { a: "n2", b: "n3", carrier: "entries", type: "c2_out_type", shape: <><M id="shape_entry" /></> },
                    { a: "n3", b: "n2", carrier: "unsupported", type: undefined, shape: <><M id="shape_entry" /> + reason</> },
                    { a: "n3", b: "n4", carrier: "grounded", type: "c3_out_type", shape: <><M id="shape_entry" /> + checked_at</> },
                  ].map((row) => (
                    <tr key={`${row.a}-${row.b}-${row.carrier}`} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3 align-top font-mono text-xs text-blueprint-ink">
                        <M id={row.a} /> → <M id={row.b} />
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted">
                        {row.carrier}: {row.type === undefined ? "json" : <M id={row.type} />}
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted">{row.shape}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[15px] leading-relaxed text-muted">
              Two layers. The <em>carrier</em> is a data type from the vocabulary that the
              validator holds every edge to, and a mismatch is an error before anything runs.
              The <em>shape</em> is the field list inside it, written on the port&rsquo;s{" "}
              <code className="font-mono text-blueprint-ink">description</code>: the validator
              reads it as prose, and your harness and the next node&rsquo;s{" "}
              <code className="font-mono text-blueprint-ink">spec</code> are what hold to it.
            </p>
            <KeyValueList>
              <KeyValueRow keyWidth={168} term={<span className="font-mono text-xs text-blueprint-ink">out= / in=</span>}>
                <span className="text-sm leading-relaxed text-muted">
                  Which port leaves and which arrives. Without them the validator takes the one
                  type-compatible pairing it can find, and reports an edge with more than one as
                  ambiguous instead of guessing. One of the four edges here has more than one:{" "}
                  <M id="n3" /> → <M id="n4" /> could carry either of the checker&rsquo;s two
                  outputs, because <code className="font-mono text-blueprint-ink">json</code> fits
                  a <code className="font-mono text-blueprint-ink">structured</code> port, so that
                  edge names its ports. Once step 07 wires the rubric into the checker, that edge is
                  the second one that needs them.
                </span>
              </KeyValueRow>
              <KeyValueRow keyWidth={168} term={<span className="font-mono text-xs text-blueprint-ink">style=dashed</span>}>
                <span className="text-sm leading-relaxed text-muted">
                  The failure lane, drawn apart from the path a successful run takes.
                </span>
              </KeyValueRow>
              <KeyValueRow keyWidth={168} term={<span className="font-mono text-xs text-blueprint-ink">the return edge</span>}>
                <span className="text-sm leading-relaxed text-muted">
                  It lands on the extractor, so only the checker sends an entry forward and the
                  extractor never blesses its own work. It also means the checker&rsquo;s verdicts
                  flow back to the node whose work it judges. Once a rubric exists (step 07), the
                  validator reports that path as criteria relayed through a judge: it stopped at
                  the checker and cannot see further. What keeps the criteria out of the
                  extractor is the shape of the checker&rsquo;s unsupported port, a design choice
                  nothing on this site verifies.
                </span>
              </KeyValueRow>
              <KeyValueRow keyWidth={168} term={<span className="font-mono text-xs text-blueprint-ink">the cap</span>}>
                <span className="text-sm leading-relaxed text-muted">
                  A cycle with no{" "}
                  <code className="font-mono text-blueprint-ink">params.max_iterations</code> on
                  any member marks every node in it{" "}
                  <code className="font-mono text-blueprint-ink">unbounded-loop</code>, which
                  subtracts 1.5 from the computed security score. This blueprint already scores 3
                  rather than 4, because the crawler and the checker both reach the network
                  (<code className="font-mono text-blueprint-ink">unvalidated-external-access</code>,
                  1.0). Left uncapped, it scores 2. Step 04 asks for the number on the
                  checker&rsquo;s card.
                </span>
              </KeyValueRow>
            </KeyValueList>
          </>
        );

      case 6:
        return (
          <>
            <p className="text-[15px] leading-relaxed text-muted">
              Built in this tab from what you typed. Nothing is uploaded.{" "}
              {on
                ? "The rubric card and the scenario are in it because step 07 has been started."
                : "Step 07 adds two more files to the same download."}
            </p>
            <KeyValueList>
              {bundleFiles(values).map((file) => (
                <KeyValueRow
                  key={file.path}
                  keyWidth={240}
                  term={<span className="font-mono text-xs text-fg">{file.path}</span>}
                >
                  <span className="text-sm text-muted">{file.text.trimEnd().split("\n").length} lines</span>
                </KeyValueRow>
              ))}
            </KeyValueList>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={download}>
                Download the folder
              </Button>
              <span className="font-mono text-xs text-dim">
                {filled}/{total} filled
              </span>
            </div>
            {message === "" ? null : (
              <p className="text-sm leading-relaxed text-amber">{message}</p>
            )}
            <Findings findings={findings} />
            <FilePanel name="the two commands">
              <Line>
                <Given>
                  darkprint validate ./<M id="blueprint_name" />
                </Given>
              </Line>
              <Line>
                <Given>
                  darkprint export ./<M id="blueprint_name" /> --attractor {">"} desk.dot
                </Given>
              </Line>
            </FilePanel>
            <p className="text-sm leading-relaxed text-dim">
              The first prints the validator&rsquo;s findings; the second writes the compiled graph
              your harness takes. The{" "}
              <code className="font-mono text-blueprint-ink">darkprint</code> CLI is not published to
              npm yet, and a checkout of the repository puts no darkprint on your path until you link
              it. <Link href="/capabilities#cli">What you can do</Link> lists the commands that work today.
            </p>
          </>
        );

      case 7:
        return (
          <>
            <p className="text-[15px] leading-relaxed text-muted">
              A blueprint is measured by running it on a fixed <strong>scenario</strong> and
              grading what comes out against a <strong>rubric</strong> written before the run. The
              rubric reaches the checker and nobody else: a node that can read its own criteria
              optimises for the criteria rather than for the work.
            </p>
            <FilePanel name={cardName("c5_id")}>
              <Line>
                <Key>id</Key>: <B id="c5_id" />
              </Line>
              <Line>
                <Key>name</Key>: <B id="c5_name" />
              </Line>
              <Line>
                <Key>type</Key>: <Given>human-input</Given>{" "}
                <Note># a person writes the criteria, before the run</Note>
              </Line>
              <Line>
                <Key>action</Key>: <Given>&gt;- (given)</Given>
              </Line>
              <Line>
                <Key>spec</Key>: <Given>&gt;- (given)</Given>
              </Line>
              <Line>
                <Key>inputs</Key>: <Given>[]</Given>
              </Line>
              <Line>
                <Key>outputs</Key>:
              </Line>
              <Line>
                <Given>{"  - name: criteria"}</Given>
              </Line>
              <Line>
                <Given>{"    type: acceptance-criteria"}</Given>
              </Line>
              <Line>
                <Key>version</Key>: <Given>1.0.0</Given>
              </Line>
            </FilePanel>
            <KeyValueList>
              <KeyValueRow keyWidth={240} term={<span className="font-mono text-xs text-fg">topology.dot</span>}>
                <span className="text-sm leading-relaxed text-muted">
                  + rubric → <M id="n3" /> [out=&quot;criteria&quot;, in=&quot;criteria&quot;]
                </span>
              </KeyValueRow>
              <KeyValueRow keyWidth={240} term={<span className="font-mono text-xs text-fg">cards/<M id="c3_id" /></span>}>
                <span className="text-sm leading-relaxed text-muted">
                  + an input port <code className="font-mono text-blueprint-ink">criteria: acceptance-criteria</code>
                </span>
              </KeyValueRow>
              <KeyValueRow keyWidth={240} term={<span className="font-mono text-xs text-fg">cards/<M id="c2_id" /></span>}>
                <span className="text-sm leading-relaxed text-muted">
                  + <code className="font-mono text-blueprint-ink">cannot: [acceptance-criteria]</code>.
                  This forbids an edge; it does not hide a risk marker. Wire the rubric into the
                  extractor with this line in place and the validator refuses the whole folder,
                  reporting{" "}
                  <code className="font-mono text-blueprint-ink">bundle/prohibition-violated</code>.
                </span>
              </KeyValueRow>
            </KeyValueList>
            <FilePanel name="evals/scenario.yaml">
              <Line>
                <Key>scenario</Key>: <B id="s_name" />
              </Line>
              <Line>
                <Key>seeds</Key>: <Note># the websites, fixed so two runs compare</Note>
              </Line>
              <Line>
                {"  - "}
                <B id="s_seed1" />
              </Line>
              <Line>
                {"  - "}
                <B id="s_seed2" />
              </Line>
              <Line>
                <Key>expect</Key>: <Note># what a good run must contain</Note>
              </Line>
              <Line>
                {"  "}
                <Key>entries_min</Key>: <B id="s_min" />
              </Line>
              <Line>
                {"  "}
                <Key>must_include</Key>:
              </Line>
              <Line>
                {"    - \""}
                <B id="s_fact" />
                {"\""}
              </Line>
              <Line>
                <Key>rubric</Key>: <Note># written before the run, read by the checker only</Note>
              </Line>
              <Line>
                {"  - "}
                <Key>criterion</Key>: <Given>coverage</Given>
              </Line>
              <Line>
                {"    "}
                <Key>threshold</Key>: <B id="s_cov" />
              </Line>
              <Line>
                {"  - "}
                <Key>criterion</Key>: <Given>grounding</Given>
              </Line>
              <Line>
                {"    "}
                <Key>threshold</Key>: <B id="s_ground" />
              </Line>
              <Line>
                {"  - "}
                <Key>criterion</Key>: <Given>within_seeds</Given>
              </Line>
              <Line>
                {"    "}
                <Key>threshold</Key>: <B id="s_seeds" />
              </Line>
            </FilePanel>
            <p className="text-[15px] leading-relaxed text-muted">
              This file travels in the folder and DarkPrint never opens it: the validator reads
              topology.dot, the cards under{" "}
              <code className="font-mono text-blueprint-ink">cards/</code> and a local vocabulary
              file if there is one, so nothing on this site checks a scenario or grades a run. It
              sits beside the graph it measures because that is where somebody will look for it.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              The last command needs two things this tutorial has not given you: the blueprint
              published under your handle (<Link href="/upload">publish the folder</Link> first
              and put that handle in{" "}
              <code className="font-mono text-blueprint-ink">--target</code>), and a way to
              authenticate. <Link href="/capabilities#cli">What you can do</Link> says how{" "}
              <code className="font-mono text-blueprint-ink">report</code> signs in.
            </p>
            <FilePanel name="the three commands">
              <Line>
                <Given>
                  darkprint export ./<M id="blueprint_name" /> --attractor {">"} desk.dot
                </Given>
              </Line>
              <Line>
                <Note>
                  {"<your harness> desk.dot --scenario evals/scenario.yaml --out ./run   # not DarkPrint's job"}
                </Note>
              </Line>
              <Line>
                <Given>
                  darkprint report ./run --target you/<M id="blueprint_name" /> --cost 1200 \
                </Given>
              </Line>
              <Line>
                <Given>
                  {"    --model <name> --provider <name> --hardware <what ran it> \\"}
                </Given>
              </Line>
              <Line>
                <Given>{"    --harness <version> --input-size <count>"}</Given>
              </Line>
            </FilePanel>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={download}>
                Download with the rubric
              </Button>
              <span className="font-mono text-xs text-dim">
                {filled}/{total} filled
              </span>
            </div>
            {message === "" ? null : (
              <p className="text-sm leading-relaxed text-amber">{message}</p>
            )}
            {/* The same block step 06 shows: step 05 sends a reader here to read the finding
                the rubric edge produces, so it has to be rendered here too. */}
            <Findings findings={findings} />
          </>
        );

      default:
        return null;
    }
  }
}

/**
 * What the validator says about the folder that was just built, shown under both download
 * buttons: step 06's folder produces one finding and step 07's a different one, and step
 * 05 sends a reader to step 07 specifically to read the second.
 */
function Findings({ findings }: { findings: readonly Diagnostic[] | undefined }) {
  if (findings === undefined) return null;
  return (
    <div className="flex flex-col gap-3">
      <span className="label">What the validator says about it</span>
      {findings.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">No findings.</p>
      ) : (
        <DiagnosticList diagnostics={findings} />
      )}
      <p className="text-sm leading-relaxed text-dim">
        Checked in this tab by the same validator the CLI and the{" "}
        <Link href="/upload">Publish page</Link> use, over the exact files you just downloaded.
      </p>
    </div>
  );
}

/** The values a reader has actually typed, so "fill with example" leaves them alone. */
function stripEmpty(values: BlankValues): BlankValues {
  const kept: Record<string, string> = {};
  for (const [id, value] of Object.entries(values)) {
    if (value.trim() !== "") kept[id] = value;
  }
  return kept;
}
