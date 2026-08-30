/* ============================================================
   The Attractor compatibility panel, rendered.

   SEAM-41's reading has been computable on every blueprint page
   since `lintAttractor` shipped and was on none of them. This holds
   the surface that changed that, and it holds it against the two
   ways such a panel goes wrong.

   ── one: presenting a warning as a failure ──
   Every one of `lint.ts`'s nine codes is a warning, by
   construction: the file has already parsed by the time any of them
   can fire, and what they report is a name a runner would read
   differently. So a finding must not read as a broken blueprint,
   and the cells below assert that the verdict SENTENCE is the same
   claim with findings and without — "reads this file" either way —
   rather than asserting the absence of some particular alarming
   word, which the next rewrite would slip past.

   ── two: letting a green verdict read as "this runs" ──
   It does not, and the difference is large. A stored topology
   carries no `prompt` and neither boundary node, so Attractor's own
   `start_node` and `terminal_node` rules (spec §7.2, both ERROR)
   refuse the pipeline on a file this panel calls readable.
   `/spec/topology` shipped the opposite sentence for a while. So
   the limit is asserted OPEN — in the panel body, not behind a
   nested disclosure — over the real archive's nine bundles, the way
   `components/site/honesty.test.ts` holds every other limit
   statement on this site.

   The panel is a server component and both `parseDot` and
   `lintAttractor` are pure, so this renders it with
   `renderToStaticMarkup` and reads the markup, which is what a
   reader with no JavaScript gets.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { lintAttractor, parseDot } from "@/lib/core";
import { allBlueprints } from "@/lib/content";
import { SEVERITY_META } from "@/components/ui/severity";
import { openText, plainText } from "@/components/ui/visible-text";

import { AttractorCompatibility } from "./AttractorCompatibility";

const BLUEPRINTS = allBlueprints();

function render(dot: string, file?: string): string {
  return renderToStaticMarkup(
    createElement(AttractorCompatibility, { dot, ...(file === undefined ? {} : { file }) }),
  );
}

/** A graph the linter has nothing to say about: bare ids, comma separators, `//` comments. */
const CLEAN = `// a clean one
digraph tidy {
  a [label="A"]
  b [label="B"]
  a -> b [label="next"]
}
`;

/**
 * A graph that parses and gives the linter work: a hyphenated node id
 * (`attractor/bad-node-id`) and a node `type` attribute, which is Attractor's handler
 * override and the one reserved name DarkPrint refuses to write
 * (`attractor/reserved-attribute`).
 */
const NOTED = `digraph noted {
  "my-node" [label="Mine", type="codergen"]
  b [label="B"]
  "my-node" -> b
}
`;

/** Nothing a DOT parser can read, so there is no graph and no lint pass. */
const BROKEN = `digraph {{{ oops`;

describe("the fixtures are the fixtures", () => {
  /* Every cell below rests on these three producing what their names say. A `CLEAN` that
     quietly grew a finding would make the no-findings cells assert nothing, and a `NOTED`
     the linter had nothing to say about would make the findings cells pass against a panel
     that renders no list at all. Measured through the same pair the panel calls. */
  it("CLEAN parses with no findings, NOTED parses with several, BROKEN does not parse", () => {
    const clean = parseDot(CLEAN, "topology.dot");
    expect(clean.graph, "CLEAN does not parse").toBeDefined();
    expect(clean.diagnostics).toEqual([]);
    expect(lintAttractor(clean.graph!, CLEAN, "topology.dot")).toEqual([]);

    const noted = parseDot(NOTED, "topology.dot");
    expect(noted.graph, "NOTED does not parse").toBeDefined();
    const findings = lintAttractor(noted.graph!, NOTED, "topology.dot");
    expect(findings.length, "NOTED gives the linter nothing to say").toBeGreaterThan(1);
    expect(findings.map((d) => d.code)).toContain("attractor/reserved-attribute");
    expect(findings.map((d) => d.code)).toContain("attractor/bad-node-id");

    expect(parseDot(BROKEN, "topology.dot").graph, "BROKEN parses after all").toBeUndefined();
  });
});

describe("the verdict", () => {
  it("says the parser reads a clean file, and says there are no findings", () => {
    const text = plainText(render(CLEAN));
    expect(text).toContain("Attractor's parser reads this file");
    expect(text).toContain("no findings");
  });

  /* The claim about the FILE is unchanged when there are findings. This is the cell that
     stops the panel drifting into a pass/fail badge: the same sentence opens both verdicts,
     and what differs is only what follows it. */
  it("still says the parser reads the file when there are findings", () => {
    const text = plainText(render(NOTED));
    expect(text).toContain("Attractor's parser reads this file");
    expect(text).toContain("None of these stops a runner and none is a defect in the blueprint");
  });

  it("counts the findings in the summary row without colouring them a failure", () => {
    const findings = lintAttractor(parseDot(NOTED, "topology.dot").graph!, NOTED, "topology.dot");
    expect(plainText(render(NOTED))).toContain(`${findings.length} notes`);
  });

  /* And the one verdict that IS different, so the shared sentence above is a decision and
     not an inability to say anything else. */
  it("says the parser cannot read a file that does not parse", () => {
    const text = plainText(render(BROKEN));
    expect(text).toContain("Attractor's parser cannot read this file");
    expect(text).not.toContain("Attractor's parser reads this file");
    expect(text).toContain("there is no graph until the file parses");
  });
});

describe("the findings themselves", () => {
  it("prints every finding the linter produced", () => {
    const findings = lintAttractor(parseDot(NOTED, "topology.dot").graph!, NOTED, "topology.dot");
    const text = plainText(render(NOTED));
    for (const finding of findings) {
      expect(text, `the panel dropped ${finding.code}`).toContain(finding.code);
      expect(text, `the panel dropped the message for ${finding.code}`).toContain(finding.message);
    }
  });

  /* `components/ui/severity.ts` records the defect this rule exists for: a surface started
     printing an `aria-hidden` glyph alone and the word "warning" left all nine blueprint
     pages at once for anyone not reading colour. Asserted on the WORD, and asserted that
     the glyph alone is not what carries it — the glyph is `aria-hidden` here, so a panel
     that dropped the word would leave a screen reader with no severity at all. */
  it("gives every severity its word and not only its glyph", () => {
    const html = render(NOTED);
    const findings = lintAttractor(parseDot(NOTED, "topology.dot").graph!, NOTED, "topology.dot");
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(plainText(html)).toContain(SEVERITY_META[finding.severity].word);
    }
    expect(html).toContain('aria-hidden="true"');
  });

  it("names where each finding is, using the file it was given", () => {
    expect(plainText(render(NOTED, "graph.dot"))).toContain("graph.dot:");
  });

  it("draws no list when there is nothing to list", () => {
    expect(render(CLEAN)).not.toContain("<ul");
  });
});

describe("the limit, over the real archive", () => {
  /* `openText` and not `plainText`: a limit on something printed in the open has to be in
     the open with it, which is `components/site/honesty.test.ts`'s own rule and the reason
     that file distinguishes the two. The panel's `<details open>` keeps its body open, so a
     sentence moved into a nested closed disclosure would red here. */
  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp.graph.dot] as const))(
    "%s: says parsing is not running, and names the command that compiles one",
    (_slug, dot) => {
      const text = openText(render(dot));
      expect(text).toContain("Parsing is not running");
      expect(text).toContain("neither of the two boundary nodes Attractor requires");
      expect(text).toContain("darkprint export <dir> --attractor");
    },
  );

  /* The premise for the nine cells above. A filter that matched nothing passes every case,
     and this suite's whole point is that the statement is on the pages a reader visits. */
  it("has the archive's nine to hold it over", () => {
    expect(BLUEPRINTS.length).toBe(9);
  });

  /* The shipped archive is where the "does a green verdict read as runnable" risk actually
     bites, so the state is measured rather than assumed: every published release passed a
     zero-warning gate at export (`lib/server/export/build.ts`), so all nine reach this
     panel clean and every reader of a real page sees the green verdict. If that ever stops
     being true the panel's other branch is what they see, and this cell says which one was
     under test. */
  it("renders the archive's nine with no findings, which is the branch a reader meets", () => {
    for (const bp of BLUEPRINTS) {
      expect([bp.slug, plainText(render(bp.graph.dot)).includes("no findings")]).toEqual([
        bp.slug,
        true,
      ]);
    }
  });
});
