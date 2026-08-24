/* ============================================================
   T071 — the two source readers, extracted so they can be
   FALSIFIED

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── why these are not inline in the cells that use them ──
   Two of this suite's criteria are read off text rather than driven
   through a door: AC4's `maxLength` attribute and AC5's archive
   walk. A reader is an instrument, and a zero from an instrument is
   a claim about the instrument until something proves otherwise.
   Inline in a `.test.ts` these two could only ever be exercised
   against the one tree they run on — where a correct T071 makes the
   AC4 reader answer "found" and nothing at all makes it answer
   "found the wrong number", so its discriminating branch would ship
   having never executed.

   Split out, both take their text as an argument. A probe can hand
   them synthetic sources that differ by ONE member and check that
   green-against-red separates them, which is what distinguishes an
   instrument that works from one that merely resolves.

   Neither reader touches the filesystem. The cells that use them own
   the walk; this module owns the reading.
   ============================================================ */

import ts from "typescript";

/* ============================================================
   AC4 — the handle field and its cap, read out of TSX
   ============================================================ */

export interface CapAttribute {
  line: number;
  /** The attribute's initialiser exactly as written, or `""` for a bare `maxLength`. */
  text: string;
}

export interface HandleField {
  file: string;
  line: number;
  tag: string;
  maxLength?: CapAttribute;
}

function stringAttribute(element: ts.JsxOpeningLikeElement, name: string): string | undefined {
  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxAttribute(attribute) || attribute.name.getText() !== name) continue;
    const initializer = attribute.initializer;
    if (initializer === undefined) continue;
    if (ts.isStringLiteral(initializer)) return initializer.text;
    if (
      ts.isJsxExpression(initializer) &&
      initializer.expression !== undefined &&
      ts.isStringLiteralLike(initializer.expression)
    ) {
      return initializer.expression.text;
    }
  }
  return undefined;
}

function attributeNamed(
  element: ts.JsxOpeningLikeElement,
  name: string,
): ts.JsxAttribute | undefined {
  for (const a of element.attributes.properties) {
    if (ts.isJsxAttribute(a) && a.name.getText() === name) return a;
  }
  return undefined;
}

/**
 * Every element in one TSX source that identifies itself as the handle field.
 *
 * `id="handle"` is the marker, and it is the product's own: the field's `<label htmlFor>`
 * points at it, so it cannot be renamed without changing what a screen reader announces. Which
 * COMPONENT renders the field is the implementation's business, and D-071-02 rules that this
 * cell may not depend on it.
 *
 * Parsed with the TypeScript compiler rather than matched with a regular expression, and that
 * is not fastidiousness. JSX comments are not trivia — `getLeadingCommentRanges` cannot see
 * `{/* … *\/}` — so a comment-stripping reader misses most of the prose in a `.tsx` file, and a
 * regular-expression reader counts a commented-out element as a live one.
 */
export function handleFieldsIn(file: string, code: string): HandleField[] {
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: HandleField[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (stringAttribute(node, "id") === "handle") {
        const cap = attributeNamed(node, "maxLength");
        found.push({
          file,
          line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          tag: node.tagName.getText(),
          maxLength:
            cap === undefined
              ? undefined
              : {
                  line: sf.getLineAndCharacterOfPosition(cap.getStart()).line + 1,
                  text: cap.initializer?.getText() ?? "",
                },
        });
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return found;
}

/**
 * Whether an initialiser as written means exactly `bound`.
 *
 * `{32}` is what the criterion writes; `"32"` is what the DOM attribute becomes anyway; a
 * reference to the published constant is admitted and NAMED rather than guessed at, because
 * D-071-01(4) put `MAX_HANDLE_LENGTH` on the barrel and a call site that reads it is more
 * correct than one repeating the number, not less.
 *
 * Everything else is refused with what it found. A cap of 320 satisfies "carries a maxLength"
 * perfectly and caps the field somewhere the server does not.
 */
export function meansExactly(text: string, bound: number): boolean {
  const inner = text.replace(/^\{|\}$/g, "").trim();
  if (inner === String(bound)) return true;
  if (inner === `"${bound}"` || inner === `'${bound}'`) return true;
  return /\bMAX_HANDLE_LENGTH\b/.test(inner);
}

/** The one `<input>` carrying `id="handle"` in a block of rendered markup, as a browser gets it. */
export function handleInputIn(markup: string): string | undefined {
  for (const tag of markup.match(/<input\b[^>]*>/g) ?? []) {
    if (/\bid="handle"/.test(tag)) return tag;
  }
  return undefined;
}

/* ============================================================
   AC5 — the archive's author handles, read out of YAML
   ============================================================ */

const AUTHOR_LINE = /^[ \t]*author[ \t]*:.*$/gm;
const AUTHOR_VALUE = /^[ \t]*author[ \t]*:[ \t]*(.+?)[ \t]*$/;

export interface AuthorsRead {
  /** Every line the source spells as an `author:`, however its value is written. */
  lines: number;
  /** Every value this reader managed to READ. Equal to `lines`, or the reader is blind. */
  values: string[];
  /** The lines whose value it could not read, quoted so a red says which form defeated it. */
  unread: string[];
}

/**
 * The `author:` values in one YAML source.
 *
 * The two counts are the point. A regular expression over YAML answers "absent" for every shape
 * it was not written for — a quoted value, a folded scalar, a different case — and an absence
 * is indistinguishable from a clean archive. Counting what was SPELLED beside what was READ is
 * the only thing that tells the two apart, so a form this reader cannot parse arrives at the
 * cell as an unread line rather than as silence.
 *
 * Quotes are stripped because `author: "orin"` and `author: orin` are the same handle to the
 * loader, and a reader that saw only one of the two forms would under-count without saying so.
 */
export function authorsIn(label: string, text: string): AuthorsRead {
  const values: string[] = [];
  const unread: string[] = [];
  let lines = 0;
  for (const line of text.match(AUTHOR_LINE) ?? []) {
    lines += 1;
    const raw = AUTHOR_VALUE.exec(line)?.[1];
    const value = raw?.replace(/^["']|["']$/g, "").trim();
    /* The indicator characters are refused rather than returned, and this is not defensiveness
       — it is the defect this reader's own falsification probe found. `author: >` was coming
       back as the VALUE ">", one character long, which passes a length bound and then reaches
       `checkHandle` as a handle nobody wrote. A reader that answers a plausible wrong value for
       a form it cannot see is worse than one that answers nothing: the cell reds, but it reds
       about the archive instead of about the reader. `> | & * ! { [` are YAML's own openers for
       a block scalar, an anchor, an alias, a tag and a flow collection, and none of them is a
       handle. */
    const indicator = value !== undefined && /^[>|&*!{[]/.test(value);
    if (value === undefined || value === "" || indicator || /\s/.test(value) || value.startsWith("#")) {
      unread.push(`${label}: ${line.trim()}`);
    } else {
      values.push(value);
    }
  }
  return { lines, values, unread };
}
