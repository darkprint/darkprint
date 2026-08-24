/* ============================================================
   T071 — the two source readers, falsified

   This file tests no acceptance criterion. It tests the two
   instruments that read AC4's attribute and AC5's archive, and it
   exists because a zero from an instrument is a claim about the
   instrument until something proves otherwise.

   ── what an inline reader could never have shown ──
   Against the real tree, the AC4 reader has exactly one observable
   answer before the implementation lands ("no cap") and exactly one
   after ("cap of 32"). Its discriminating branch — a cap that is
   present and is the WRONG NUMBER — is unreachable from any real
   run, so inline it would have shipped having never executed. A3
   below is that branch, and it and A2 differ by one character.

   ── and it earned its keep on the first run ──
   B4 failed when it was written. `authorsIn` was answering the VALUE
   `">"` for `author: >` — a YAML folded scalar — instead of
   reporting a form it could not read. One character long, so it
   passes a length bound, and then it reaches `checkHandle` as a
   handle nobody ever wrote and reds AC5 with a complaint about the
   archive. A reader that answers a plausible wrong value for a shape
   it cannot see is worse than one that answers nothing, because the
   red it produces names the wrong subject. The fix is in
   `sources.ts` beside the comment that records this.

   Every case differs from its neighbour by one member. Nothing here
   opens a database or imports the module under test.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { authorsIn, capOf, handleFieldsIn, handleInputIn, meansExactly } from "./sources";

const NO_CAP = `export const F = () => (<span><Field id="handle"><PrefixedField id="handle" value={v} /></Field></span>);`;
const CAP_32 = `export const F = () => (<span><Field id="handle"><PrefixedField id="handle" maxLength={32} value={v} /></Field></span>);`;
const CAP_320 = `export const F = () => (<span><Field id="handle"><PrefixedField id="handle" maxLength={320} value={v} /></Field></span>);`;
const CAP_CONST = `export const F = () => (<PrefixedField id="handle" maxLength={MAX_HANDLE_LENGTH} />);`;
const CAP_STR = `export const F = () => (<PrefixedField id="handle" maxLength="32" />);`;
const COMMENTED = `export const F = () => (<span>{/* <PrefixedField id="handle" maxLength={32} /> */}<PrefixedField id="handle" /></span>);`;
const OTHER_ID = `export const F = () => (<PrefixedField id="email" maxLength={32} />);`;

describe("AC4 reader", () => {
  it("A1 finds the field and reports NO cap", () => {
    const f = handleFieldsIn("x.tsx", NO_CAP);
    expect(f.length).toBe(2);
    expect(f.filter((x) => x.maxLength !== undefined)).toEqual([]);
  });
  it("A2 finds the cap when it is there — the branch a red-only run never executes", () => {
    const f = handleFieldsIn("x.tsx", CAP_32).filter((x) => x.maxLength !== undefined);
    expect(f.length).toBe(1);
    expect(f[0].tag).toBe("PrefixedField");
    expect(meansExactly(f[0].maxLength!.text, 32)).toBe(true);
  });
  it("A3 separates 320 from 32 — the two shapes differ by one character", () => {
    const f = handleFieldsIn("x.tsx", CAP_320).filter((x) => x.maxLength !== undefined);
    expect(f.length).toBe(1);
    expect(meansExactly(f[0].maxLength!.text, 32)).toBe(false);
  });
  it("A4 admits the published constant and the string form", () => {
    expect(meansExactly(handleFieldsIn("x", CAP_CONST)[0].maxLength!.text, 32)).toBe(true);
    expect(meansExactly(handleFieldsIn("x", CAP_STR)[0].maxLength!.text, 32)).toBe(true);
  });
  it("A5 does NOT count a commented-out cap — the JSX-comment trap", () => {
    const f = handleFieldsIn("x.tsx", COMMENTED);
    expect(f.length).toBe(1);
    expect(f[0].maxLength).toBeUndefined();
  });
  it("A6 ignores an element that is not the handle field", () => {
    expect(handleFieldsIn("x.tsx", OTHER_ID)).toEqual([]);
  });
  it("A7 the markup reader picks the right input and no other", () => {
    expect(handleInputIn('<input id="handle" maxLength="32"/>')).toContain('id="handle"');
    expect(handleInputIn('<input id="email" maxLength="32"/>')).toBeUndefined();
    expect(handleInputIn("<span>nothing</span>")).toBeUndefined();
  });

  it("A8 `capOf` reads BOTH casings — the false charge this cell exists to stop", () => {
    /* React 19.2.4 emits `maxLength="32"` and lowercases `tabIndex` in the same tag; HTML
       attribute names are case-insensitive, so both spellings ARE the cap. A reader matching
       only the lowercase form answers "absent" for a cap that is present, and the cell built on
       it charges a dropped prop against a tag that carries one. That happened, at first contact,
       and this is the case that would have caught it before the run. */
    expect(capOf('<input id="handle" maxLength="32"/>')).toBe("32");
    expect(capOf('<input id="handle" maxlength="32"/>')).toBe("32");
    expect(capOf('<input id="handle" MAXLENGTH="32"/>')).toBe("32");
  });

  it("A9 `capOf` still separates absent, wrong-number and empty — the repair did not weaken it", () => {
    /* A repair removes a red as readily by weakening the cell as by fixing it, so the three
       shapes the assertion must still exclude are asserted here rather than assumed. The VALUE
       stays exact: case-insensitivity is a property of HTML attribute NAMES and of nothing
       else, and a cap of 320 is not a cap of 32 in any casing. */
    expect(capOf('<input id="handle"/>')).toBeUndefined();
    expect(capOf('<input id="handle" maxLength="320"/>')).toBe("320");
    expect(capOf('<input id="handle" maxLength=""/>')).toBe("");
    expect(capOf('<input id="handle" data-maxlength-note="32"/>')).toBeUndefined();
  });
});

describe("AC5 reader", () => {
  it("B1 reads the plain form", () => {
    const r = authorsIn("f", "id: x\nauthor: orin\n");
    expect(r).toEqual({ lines: 1, values: ["orin"], unread: [] });
  });
  it("B2 reads the quoted forms — same handle to the loader", () => {
    expect(authorsIn("f", 'author: "orin"\n').values).toEqual(["orin"]);
    expect(authorsIn("f", "author: 'orin'\n").values).toEqual(["orin"]);
  });
  it("B3 reads an indented occurrence", () => {
    expect(authorsIn("f", "  author: sol-antczak\n").values).toEqual(["sol-antczak"]);
  });
  it("B4 a form it cannot read arrives as UNREAD, never as silence", () => {
    const r = authorsIn("f", "author: >\n  folded\n");
    expect(r.lines).toBe(1);
    expect(r.values).toEqual([]);
    expect(r.unread.length).toBe(1);
  });
  it("B5 an empty value is unread rather than an empty handle", () => {
    const r = authorsIn("f", "author:\n");
    expect(r.values).toEqual([]);
    expect(r.unread.length).toBe(1);
  });
  it("B6 lines always equals values + unread — the equality the cell rests on", () => {
    for (const text of ["author: a\nauthor: >\n", "x: 1\n", 'author: "b"\nauthor:\nauthor: c\n']) {
      const r = authorsIn("f", text);
      expect(r.values.length + r.unread.length).toBe(r.lines);
    }
  });
  it("B7 counts nothing where there is nothing", () => {
    expect(authorsIn("f", "coauthor: x\nauthorization: y\n").lines).toBe(0);
  });
});
