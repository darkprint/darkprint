/* ============================================================
   The blanks keep focus while a reader types into them
   ------------------------------------------------------------
   This guards one defect, and it is a defect that reads as correct
   code. `<B id="c1_id" />` inside a step panel, with `B` a
   `useCallback` in `TutorialWizard`'s body whose dependencies hold
   `values`, is the natural way to write this page. It is also
   unusable: React reconciles an element by the identity of its
   `type`, a `useCallback` over `values` returns a new function on
   every keystroke, and so every field on the open step unmounted and
   remounted on every character. Measured in the browser before the
   fix, focusing a field and dispatching one `input` event:
   `sameDomNodeAfterKeystroke: false`, `stillFocusedAfterKeystroke:
   false`. A reader had to click the field again after every letter.

   ── why this is a source check and not a render ──
   Proving it properly means mounting the component, typing, and
   asking `document.activeElement`. That needs a DOM, this suite runs
   in `node` (`vitest.config.ts` explains why), and jsdom is a new
   dependency the constraint sheet refuses. What CAN be checked
   without one is the shape that caused it, which is the thing an
   author would reintroduce: a component defined inside the render.

   So this is deliberately narrow. It does not prove focus survives.
   It proves the one construction that destroyed it is absent, and it
   names the measurement in its failure message so whoever trips it
   can reproduce the real thing rather than guess.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const WIZARD = readFileSync(`${HERE}TutorialWizard.tsx`, "utf8");
const BLANK = readFileSync(`${HERE}Blank.tsx`, "utf8");

/**
 * A capitalised binding assigned a hook call is a component made during a render.
 *
 * Capitalised because that is what React requires of a component name and therefore what an
 * author writing one will type. `useCallback` and `useMemo` both, since either produces a
 * value whose identity changes with its dependencies, and either is where somebody would
 * reach to "avoid rebuilding it every render" — which is the instinct that causes this.
 */
const COMPONENT_IN_RENDER = /\bconst\s+[A-Z]\w*\s*(?::[^=]+)?=\s*use(?:Callback|Memo)\s*\(/;

describe("no component is defined inside the wizard's render", () => {
  it("does not pass vacuously", () => {
    /* Both files have to be the files. A rename would otherwise make every cell below a
       statement about an empty string. */
    expect(WIZARD.length).toBeGreaterThan(4000);
    expect(BLANK.length).toBeGreaterThan(2000);
    /* And the pattern has to match the shape it is named for, or it is a regex that reds
       nothing whatever the file says. */
    expect(COMPONENT_IN_RENDER.test("  const B = useCallback(({ id }: { id: string }) => (")).toBe(
      true,
    );
    expect(COMPONENT_IN_RENDER.test("  const v = useCallback((id: string) => x, [])")).toBe(false);
  });

  it("TutorialWizard.tsx builds no component from a hook", () => {
    const offender = WIZARD.split("\n").find((line) => COMPONENT_IN_RENDER.test(line));
    expect(
      offender,
      "A component built from `useCallback`/`useMemo` changes identity whenever its " +
        "dependencies do, so React remounts every element of that type. On this page that " +
        "destroys the `<input>` the reader is typing into, once per keystroke. Move it to " +
        "module scope and pass what it needs through the context in `Blank.tsx`. To see the " +
        "real thing: focus a blank, dispatch one `input` event, and compare the element you " +
        "focused against `document.querySelector` for it afterwards.",
    ).toBeUndefined();
  });

  it("takes its field components from the module that defines them", () => {
    expect(WIZARD).toContain('from "./Blank"');
    /* Declarations, not assignments: a `function B()` at module scope has one identity for
       the life of the module, which is the property this whole file is about. */
    expect(BLANK).toMatch(/^export function B\(/m);
    expect(BLANK).toMatch(/^export function M\(/m);
    expect(BLANK).toContain("FieldsProvider");
  });

  /**
   * And the wizard actually wraps its steps in the provider.
   *
   * Without it every blank throws, which a render test would catch and this file cannot.
   * What it can check is that the two halves of the arrangement are both present: the
   * components read a context and the wizard supplies one.
   */
  it("supplies the context the field components read", () => {
    expect(WIZARD).toContain("<FieldsProvider value={{ values, faults, set }}>");
    expect(WIZARD).toContain("</FieldsProvider>");
  });
});
