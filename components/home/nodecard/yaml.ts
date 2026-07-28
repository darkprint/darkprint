/* ============================================================
   A YAML card, split into coloured spans, without leaving the
   string it came from.

   Spec §3.2 is unusually specific about this: "The YAML is **real
   text in the DOM**, syntax-coloured with spans. Not an image, not
   painted by JS. It must be selectable, and it must survive into
   the prerendered HTML." So the colouring cannot be a highlighter
   that runs on mount, and it cannot be a `<pre>` handed to a
   library that rewrites it. It is this: a pure function from the
   file's bytes to a list of tokens, called during render on both
   sides of the boundary, so the finished listing is in
   `.next/server/app/index.html` before any script has loaded.

   Deliberately a line scanner and not a YAML parser. `yaml@2.9.0`
   is a dependency and could give a real AST, but an AST has thrown
   away the two things a listing needs — the original spacing and
   the original line numbers — and putting them back is harder than
   this. The invariant that keeps the shortcut honest is that the
   tokens of a line concatenate back to the line, character for
   character, which `nodecard.test.ts` checks over the whole card.

   What it therefore does not do: flow mappings spanning lines,
   anchors, aliases, multi-document streams, or a `#` comment
   opened in the middle of a value. None appears in an archive card,
   and a scanner that guessed at them would mis-colour the cases it
   does have to get right.
   ============================================================ */

export type YamlTokenKind =
  /** Indentation and trailing space. Carries no colour, carries the layout. */
  | "plain"
  /** A mapping key, up to but not including its colon. */
  | "key"
  /** `:`, a sequence dash, an empty flow collection. */
  | "sep"
  /** A block scalar header: `>-`, `|`, `|+`. */
  | "block"
  /** A line of a block scalar's content. */
  | "text"
  | "string"
  | "number"
  | "bool"
  | "comment";

export interface YamlToken {
  readonly kind: YamlTokenKind;
  readonly text: string;
}

export interface YamlLine {
  /** 1-based, the number a reader sees in the gutter. */
  readonly no: number;
  readonly tokens: readonly YamlToken[];
}

/** `key:` or `- key:`, with whatever follows the colon left for the caller. */
const KEY_LINE = /^(\s*)(-\s+)?([A-Za-z_][A-Za-z0-9_.-]*)(:)(\s*)(.*)$/;
/** A sequence entry that is a bare scalar. */
const ITEM_LINE = /^(\s*)(-\s+)(.*)$/;
/** `>`, `|`, and their chomping and indentation indicators. */
const BLOCK_HEAD = /^[|>][+-]?\d*$/;
const NUMBER = /^-?\d+(\.\d+)?$/;
const CONSTANTS = new Set(["true", "false", "null", "~"]);

function scalar(text: string): YamlToken {
  // An empty flow collection is punctuation rather than a value: `tools: []` says the
  // node reaches for nothing, and colouring it like a string would make it look like one.
  if (text === "[]" || text === "{}") return { kind: "sep", text };
  if (CONSTANTS.has(text)) return { kind: "bool", text };
  if (NUMBER.test(text)) return { kind: "number", text };
  return { kind: "string", text };
}

/** Split a value from the whitespace after it, so the line still reassembles exactly. */
function pushValue(out: YamlToken[], rest: string): void {
  if (rest === "") return;
  const value = rest.trimEnd();
  if (value === "") {
    out.push({ kind: "plain", text: rest });
    return;
  }
  if (value.startsWith("#")) out.push({ kind: "comment", text: value });
  else if (BLOCK_HEAD.test(value)) out.push({ kind: "block", text: value });
  else out.push(scalar(value));
  const trail = rest.slice(value.length);
  if (trail !== "") out.push({ kind: "plain", text: trail });
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * The whole document, line by line, in source order.
 *
 * Block scalars are tracked because they are most of this card: `spec` and `notes` are
 * folded prose, and a line inside one that happens to contain a colon is prose rather
 * than a mapping. The block ends at the first non-blank line indented no further than
 * the key that opened it, which is the YAML rule and also the one a blank line inside a
 * paragraph would break if it were written any other way.
 */
export function tokenizeYaml(source: string): YamlLine[] {
  const out: YamlLine[] = [];
  let blockIndent: number | undefined;

  source.split("\n").forEach((raw, index) => {
    const no = index + 1;
    const tokens: YamlToken[] = [];

    if (raw.trim() === "") {
      if (raw !== "") tokens.push({ kind: "plain", text: raw });
      out.push({ no, tokens });
      return;
    }

    if (blockIndent !== undefined) {
      if (indentOf(raw) > blockIndent) {
        out.push({ no, tokens: [{ kind: "text", text: raw }] });
        return;
      }
      blockIndent = undefined;
    }

    const key = KEY_LINE.exec(raw);
    if (key !== null) {
      const [, indent, dash, name, colon, gap, rest] = key;
      if (indent !== "") tokens.push({ kind: "plain", text: indent });
      if (dash !== undefined) tokens.push({ kind: "sep", text: dash });
      tokens.push({ kind: "key", text: name ?? "" });
      tokens.push({ kind: "sep", text: colon ?? ":" });
      if (gap !== "") tokens.push({ kind: "plain", text: gap ?? "" });
      pushValue(tokens, rest ?? "");
      if (BLOCK_HEAD.test((rest ?? "").trim())) blockIndent = (indent ?? "").length;
      out.push({ no, tokens });
      return;
    }

    const item = ITEM_LINE.exec(raw);
    if (item !== null) {
      const [, indent, dash, rest] = item;
      if (indent !== "") tokens.push({ kind: "plain", text: indent });
      tokens.push({ kind: "sep", text: dash ?? "- " });
      pushValue(tokens, rest ?? "");
      out.push({ no, tokens });
      return;
    }

    const trimmed = raw.trimStart();
    const indent = raw.slice(0, raw.length - trimmed.length);
    if (indent !== "") tokens.push({ kind: "plain", text: indent });
    pushValue(tokens, trimmed);
    out.push({ no, tokens });
  });

  return out;
}

/** A closed run of 1-based line numbers. */
export interface LineRange {
  readonly from: number;
  readonly to: number;
}

/**
 * The lines a top-level key owns: the key itself, plus everything indented under it.
 *
 * Found by name rather than by number, because the annotations in `annotations.ts` are
 * written against a file another agent is editing this same pass — the `model` line was
 * added to 25 cards while this section was being built. A table of line numbers would
 * have gone silently wrong; a missing key resolves to `undefined` and drops its
 * annotation, which the test catches.
 *
 * A blank line does not end the block and does not extend it either. `to` only moves for
 * an indented line, so the run reported for `cannot` stops at its last entry rather than
 * swallowing the paragraph break after it.
 */
export function keyBlock(source: string, key: string): LineRange | undefined {
  const lines = source.split("\n");
  const head = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (head < 0) return undefined;
  let to = head;
  for (let i = head + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue;
    if (!/^\s/.test(line)) break;
    to = i;
  }
  return { from: head + 1, to: to + 1 };
}

/**
 * One run covering several keys, for a step that annotates more than one line.
 *
 * `undefined` when no key resolved. A key that resolved is kept even if a sibling did
 * not, so a step naming `tools` and `mcp` still points at `tools` on a card that
 * declares no servers.
 */
export function keySpan(source: string, keys: readonly string[]): LineRange | undefined {
  const found = keys
    .map((key) => keyBlock(source, key))
    .filter((range): range is LineRange => range !== undefined);
  if (found.length === 0) return undefined;
  return {
    from: Math.min(...found.map((range) => range.from)),
    to: Math.max(...found.map((range) => range.to)),
  };
}
