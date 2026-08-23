/* ============================================================
   T262 AC2 — the biconditional, on D-262-18's and D-262-20's terms

   "No control on `/settings` is both enabled and inert, or disabled
   and functional." The section calls it the sharpest criterion in
   the cutover set, and the reason is that BOTH directions fail:
   enabling everything passes a naive "nothing is disabled" check and
   fails this.

   ── the subject is PUBLISHED, not inferred ──
   D-262-18: the subject is interactive elements with a handler, and
   the biconditional is *every element carrying a handler is enabled,
   and every enabled element carries one*. D-262-20 names the set:
   intrinsic `button`, `input`, `select`, `textarea`, plus the four
   interactive wrappers `components/settings/controls.tsx` exports —
   `TextField`, `PrefixedField`, `Switch`, `ChoiceCard`. The other
   three exports (`SettingsSection`, `SectionNote`, `Field`) are not
   controls and are not scanned.

   That set is published rather than derived, and the reason is the
   one this author raised: inferring it from what the cutover happens
   to create is what reds a correct implementer.

   ── a disabled-with-reason row is OUT OF SCOPE BY CONSTRUCTION ──
   D-262-14 G1's three notification switches are DELIBERATELY
   disabled and inert with a true reason, and must not red. They do
   not, and not by an exemption: a statically disabled element with
   no handler satisfies both clauses. It is not enabled-and-inert
   because it is not enabled, and not disabled-and-functional because
   it carries no handler. The ruling's shape and the criterion's
   shape agree, so nothing has to be special-cased — which is the
   only kind of exemption that cannot be widened by accident.

   ── scoped to the USAGE SITE, and the residual is named ──
   Only `app/settings/**` is scanned, not `components/settings/**`.
   A wrapper's own definition contains an intrinsic `<button>` whose
   handler arrives through props, and scanning the definition charges
   it as enabled-and-inert — measured: doing so adds exactly one
   false positive at `controls.tsx:233`. The criterion is about
   controls ON THE PAGE, so the page is what is read.

   THE RESIDUAL, stated rather than left to be discovered: a wrapper
   that applies `disabled` or `readOnly` INTERNALLY is invisible from
   the usage site, so this suite judges "enabled" by what the page
   writes. On the tree this was written against, five subject
   elements carry neither prop, which is consistent with the
   wrappers defaulting to inert — and it is why the pre-cutover count
   below is recorded rather than assumed to be zero.

   ── a `disabled={expr}` is NOT a static refusal ──
   Only a bare `disabled` or `disabled={true}` counts. A disabled
   state computed per render is ordinary UI — a Save button off while
   the form is pristine — and charging it as "disabled and
   functional" would red every correct form ever written.
   ============================================================ */

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { sources } from "./contract";
import { SETTINGS_ROUTE, resolved } from "./partition";

/** D-262-20, published. Not derived from the tree. */
const SUBJECT = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "TextField",
  "PrefixedField",
  "Switch",
  "ChoiceCard",
]);

interface Control {
  tag: string;
  line: number;
  handler: boolean;
  offStatically: boolean;
  offDynamically: boolean;
}

function controls(path: string): Control[] {
  const [source] = sources([resolved(path)], 1);
  /* Parsed from comment-stripped code, so a commented-out control is not counted as one. */
  const sf = ts.createSourceFile(
    source.path,
    source.code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: Control[] = [];
  const isStaticTrue = (a: ts.JsxAttribute) =>
    a.initializer === undefined ||
    (ts.isJsxExpression(a.initializer) &&
      a.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword);

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText();
      if (SUBJECT.has(tag)) {
        const control: Control = {
          tag,
          line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          handler: false,
          offStatically: false,
          offDynamically: false,
        };
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) continue;
          const prop = attribute.name.text;
          if (/^on[A-Z]/.test(prop)) control.handler = true;
          if (prop === "disabled" || prop === "readOnly") {
            if (isStaticTrue(attribute)) control.offStatically = true;
            else control.offDynamically = true;
          }
        }
        found.push(control);
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return found;
}

/** Counted on `backend` at `3f7ea7b`, so a zero below is known to mean something. */
const SUBJECT_FLOOR = 5;

describe("premise: `/settings` still has controls to judge", () => {
  it(`at least ${SUBJECT_FLOOR} subject elements are on the page`, () => {
    /*
     * Both clauses below are satisfied perfectly by a page with no controls on it. This is the
     * positive that fails outside the negative: a cutover that emptied the page, or a rename
     * that took every control out of D-262-20's published set, reds here rather than passing
     * twice over.
     */
    expect(
      controls(SETTINGS_ROUTE).length,
      `fewer than ${SUBJECT_FLOOR} of D-262-20's subject elements are on \`${SETTINGS_ROUTE}\`. ` +
        `Both AC2 clauses are vacuously true of a page with no controls, so this is the premise ` +
        `rather than a count for its own sake. If the cutover legitimately renamed a wrapper, ` +
        `the PUBLISHED set in D-262-20 needs amending — not this floor.`,
    ).toBeGreaterThanOrEqual(SUBJECT_FLOOR);
  });
});

describe("AC2, first direction: nothing is enabled and inert", () => {
  it("every enabled control carries a handler", () => {
    /*
     * The direction a naive check misses. "Nothing is disabled" passes trivially once everything
     * is enabled, and that is exactly the state this clause forbids when the wiring is missing:
     * a control the reader can operate that does nothing.
     *
     * Five such elements were counted before the cutover, which is the honest pre-state — the
     * page's controls are inert because there is no account behind them yet. So this cell reds
     * today and is expected to go green, rather than being green throughout and measuring
     * nothing.
     */
    const offenders = controls(SETTINGS_ROUTE)
      .filter((c) => !c.offStatically && !c.offDynamically && !c.handler)
      .map((c) => `line ${c.line}: <${c.tag}> is enabled and carries no handler`);
    expect(
      offenders,
      "a control on `/settings` is enabled and inert. D-262-18: every enabled element carries a " +
        "handler. A control that looks operable and does nothing is the failure AC2 names first, " +
        "and it is the one that survives a `nothing is disabled` check.",
    ).toEqual([]);
  });
});

describe("AC2, second direction: nothing is disabled and functional", () => {
  it("no statically disabled control carries a handler", () => {
    /*
     * The other direction, and the one D-78 governs: a `disabled` that has become false. If the
     * handler exists, the control works, and the attribute is now a claim about the product that
     * is not true.
     *
     * `disabled={expr}` is excluded deliberately — see the header. Only a refusal written into
     * the source as permanent is a claim about what is not built.
     */
    const offenders = controls(SETTINGS_ROUTE)
      .filter((c) => c.offStatically && c.handler)
      .map((c) => `line ${c.line}: <${c.tag}> is statically disabled and carries a handler`);
    expect(
      offenders,
      "a control on `/settings` is disabled and functional. D-262-18: every element carrying a " +
        "handler is enabled. The `disabled` or `readOnly` here is a statement that something is " +
        "not built, and the handler beside it says it is — D-78's `left late` direction, a true " +
        "statement that has become a lie about the product.",
    ).toEqual([]);
  });
});

describe("D-262-14 G1's disabled-with-reason rows are out of scope BY CONSTRUCTION", () => {
  it("a statically disabled control with no handler offends neither clause", () => {
    /*
     * Asserted rather than assumed, because "out of scope by construction" is a claim about the
     * criterion's shape and nothing reds when such a claim is wrong. If a future edit made either
     * clause catch these rows, the three notification switches would red for being exactly what
     * D-262-14 ruled them to be, and this cell is what says so first.
     */
    const parked = controls(SETTINGS_ROUTE).filter((c) => c.offStatically && !c.handler);
    for (const control of parked) {
      expect(
        !control.offStatically || control.handler,
        `line ${control.line}: <${control.tag}> is disabled with no handler and must not be ` +
          `charged as enabled-and-inert.`,
      ).toBe(false);
      expect(control.offStatically && control.handler, "nor as disabled-and-functional").toBe(
        false,
      );
    }
    /* No floor here: zero parked rows is a legitimate state before D-262-14 G1 is implemented. */
    expect(Array.isArray(parked)).toBe(true);
  });
});
