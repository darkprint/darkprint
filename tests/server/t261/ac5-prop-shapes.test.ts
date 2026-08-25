/* ============================================================
   T261 AC5 — what `severity-word.test.ts` actually holds, and the
   thing it holds that nobody would guess from its name.

   `severity-word.test.ts` is named by AC5 and by the section's
   must-pass-unchanged list. `frozen-tests.test.ts` pins its BYTES.
   This file pins the two surfaces those bytes DEPEND ON, which is a
   different claim and the one a cutover can break without touching
   the file at all.

   Measured: `severity-word.test.ts` reads NO page file (it was the
   one I expected the migration to break, and it does not). It
   renders two components over `allBlueprints()`. So it survives the
   route move — and it is therefore the only instrument in the
   repository holding these two component surfaces against the
   cutover:

     Explainability  { autonomy, security, phaseCoverage,
                       nodeNames, onHighlight }
     BundlePanel     { digest, ontologyVersion,
                       scoredOntologyVersion, nodes, pinnedCards,
                       diagnostics, explainedNotes }

   ── the asymmetry that makes this more than a restatement ──
   D-261-07(8) freezes these exports in D-260-04's construction:
   ADDITIONS PERMITTED, changes/renames/reshapes not. So the pin is
   NOT an equality. It is two claims with different shapes:

     1. every prop the frozen caller passes is still ACCEPTED —
        a rename or a removal reds here;
     2. every prop the frozen caller does NOT pass is OPTIONAL —
        because a REQUIRED addition is the permitted direction
        arriving in the forbidden way. `severity-word.test.ts`
        cannot pass a prop it does not know about, so a new
        required member renders it `undefined` on every one of the
        nine bundles. That does not necessarily throw, and a
        silently-degraded render is exactly the failure a
        must-pass-unchanged test is supposed to catch and would
        not.

   Claim 2 is the reason this file exists. Claim 1 alone would be
   satisfied by a component that had grown a required prop.

   ── how a blind author holds a surface it may not read ──
   PARSED, never imported and never opened for its behaviour —
   `tests/server/t260/partition.ts`'s construction. The parse reads
   declarations, which is what the freeze is about. Binding these
   components as modules would also couple this suite to their
   render, and a render is exactly what `severity-word.test.ts`
   already owns.
   ============================================================ */

import { readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { sources } from "./contract";

/** One component, and the props the frozen caller passes it. */
interface Held {
  readonly path: string;
  readonly component: string;
  /** Exactly what `severity-word.test.ts` puts in the `createElement` props object. */
  readonly passed: readonly string[];
  readonly where: string;
}

const HELD: readonly Held[] = [
  {
    path: "components/blueprint/Explainability.tsx",
    component: "Explainability",
    passed: ["autonomy", "security", "phaseCoverage", "nodeNames", "onHighlight"],
    where: "components/blueprint/severity-word.test.ts:64-71",
  },
  {
    path: "components/blueprint/BundlePanel.tsx",
    component: "BundlePanel",
    passed: [
      "digest",
      "ontologyVersion",
      "scoredOntologyVersion",
      "nodes",
      "pinnedCards",
      "diagnostics",
      "explainedNotes",
    ],
    where: "components/blueprint/severity-word.test.ts:73-88",
  },
];

interface Prop {
  name: string;
  optional: boolean;
}

/**
 * The first parameter's members of an exported function component, off the AST.
 *
 * Read from the TYPE annotation and not from the destructuring pattern. The two disagree
 * in exactly the case this file is about: a member with a DEFAULT (`explainedNotes = []`)
 * is destructured like any other and is optional at the call site, while a member the
 * function never destructures is still part of the accepted surface. The type is what a
 * caller is held to; the pattern is what the body happens to use.
 */
function propsOf(path: string, component: string): Prop[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );

  let found: Prop[] | undefined;
  const walk = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === component) {
      const [first] = node.parameters;
      if (first?.type !== undefined && ts.isTypeLiteralNode(first.type)) {
        found = first.type.members.flatMap((member) =>
          ts.isPropertySignature(member) && member.name !== undefined
            ? [{ name: member.name.getText(), optional: member.questionToken !== undefined }]
            : [],
        );
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(source);

  if (found === undefined) {
    throw new Error(
      `${path}: no exported \`function ${component}\` with an inline object type for its first ` +
        `parameter. Either the component was renamed or reshaped — which D-261-07(8) forbids — ` +
        `or its props moved to a named interface, in which case this parser must follow them ` +
        `before any assertion below means anything.`,
    );
  }
  return found;
}

describe("AC5: the surfaces severity-word.test.ts depends on", () => {
  /*
   * The premise. It fails outside every cell below: if the frozen caller has stopped
   * passing what this file says it passes, then both claims are being checked against a
   * table that no longer describes anything, and they would pass while describing nothing.
   */
  it("the frozen caller still passes exactly the props this file holds", () => {
    const [caller] = sources(["components/blueprint/severity-word.test.ts"], 1);
    for (const { component, passed, where } of HELD) {
      for (const prop of passed) {
        expect(
          caller.raw,
          `severity-word.test.ts no longer passes \`${prop}\` to ${component} (${where}). ` +
            `This file's table is stale, so both claims below are about a call that does not ` +
            `happen. Re-read the caller before touching the components.`,
        ).toContain(`${prop}:`);
      }
    }
  });

  it.each(HELD)("$component still accepts every prop the frozen caller passes", ({ path, component, passed, where }) => {
    const props = new Map(propsOf(path, component).map((p) => [p.name, p]));
    const gone = passed.filter((name) => !props.has(name));

    expect(
      gone,
      `${component} no longer accepts ${gone.join(", ")}.\n\n` +
        `\`severity-word.test.ts\` passes these at ${where} and AC5 requires that file to pass ` +
        `UNCHANGED. D-261-07(8) freezes this export in D-260-04's construction: additions are ` +
        `permitted, renames and removals are not. A cutover that reshapes these props is ` +
        `changing a named must-pass-unchanged test's subject without changing the test — ` +
        `which is the one way to break it that leaves its bytes alone.`,
    ).toEqual([]);
  });

  /*
   * Claim 2, and the reason this file is not a restatement of the pin.
   *
   * A REQUIRED addition is the permitted direction arriving in the forbidden way. The
   * frozen caller cannot pass a prop it does not know about, so a new required member
   * arrives as `undefined` on all nine bundles. It need not throw. A component that
   * renders one band less, silently, passes every assertion `severity-word.test.ts` makes
   * about severity words — and the cutover would have degraded the page with a green
   * must-pass-unchanged test sitting on top of it.
   */
  it.each(HELD)("$component has added no REQUIRED prop the frozen caller cannot supply", ({ path, component, passed, where }) => {
    const known = new Set(passed);
    // `className` is passed by neither and is optional on both today; it is not exempted,
    // it simply satisfies the rule. An exemption list here would be the hole this cell is for.
    const addedRequired = propsOf(path, component)
      .filter((prop) => !known.has(prop.name) && !prop.optional)
      .map((prop) => prop.name);

    expect(
      addedRequired,
      `${component} now REQUIRES ${addedRequired.join(", ")}, which \`severity-word.test.ts\` ` +
        `does not pass (${where}).\n\n` +
        `Additions are the permitted direction under D-261-07(8) — but a required one is not ` +
        `an addition to this caller, it is a reshape of the call. The frozen test will render ` +
        `${addedRequired.join(", ")} as \`undefined\` on all nine bundles and may well stay ` +
        `GREEN while the panel it renders has quietly lost a band.\n\n` +
        `If the cutover genuinely needs this data, make it optional and let the page supply ` +
        `it, or get the ruling that amends AC5's named list. Do not make it required and ` +
        `leave the frozen caller to render undefined.`,
    ).toEqual([]);
  });
});

describe("AC5: and the archive helper the frozen caller reads through", () => {
  /*
   * `severity-word.test.ts:97` asserts `allBlueprints().length === 9`, and `:46` binds
   * `allBlueprints` from `@/lib/content` — the FILESYSTEM archive, not the registry.
   *
   * So AC5 passing unchanged REQUIRES that `lib/content` keeps answering nine. The page
   * moving onto the registry while the archive helper stays put is the only combination
   * that satisfies both AC5 and the cutover, and D-261-04 makes it the ruled one by putting
   * `lib/content/**` in `Forbidden`. This cell is what makes that a checked fact rather
   * than an inference from a Forbidden line.
   */
  it("severity-word.test.ts still reads the archive rather than the registry", () => {
    const [caller] = sources(["components/blueprint/severity-word.test.ts"], 1);

    expect(
      caller.raw,
      "`severity-word.test.ts` no longer imports `allBlueprints` from `@/lib/content`. If it " +
        "now reads the registry, AC5's nine-bundle premise is a database fixture and the " +
        "named test has been rewritten onto the cutover's own source — which is the failure " +
        "the must-pass-unchanged rule exists to prevent.",
    ).toContain('from "@/lib/content"');

    expect(
      caller.raw,
      "`severity-word.test.ts` no longer pins the archive at nine bundles. That count is the " +
        "premise its per-blueprint cases walk; a walk that matched nothing passes all of them.",
    ).toMatch(/BLUEPRINTS\.length\)\s*\.toBe\(9\)/);
  });
});
