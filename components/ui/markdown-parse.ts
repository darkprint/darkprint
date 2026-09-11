/* ============================================================
   Markdown, hand-written, for one document this repository generates itself.

   What renders through here is the bundle README — the `README.md` that
   `lib/content/bundle-export.ts` writes into every download and that
   `components/bundle/ReadmePanel.tsx` shows on the blueprint page. It is a GENERATED
   document, so its grammar is bounded and knowable: measured across all nine
   `public/bundles/<slug>/README.md`, the entire construct set is h1, h2, fenced code blocks,
   pipe tables, blockquotes, `- ` bullets, thematic breaks, paragraphs, 271 code spans
   and one `*italic*`. No bold. No links.

   ── why no dependency ──
   A general Markdown parser is a large amount of code that exists to be correct about
   constructs this input does not contain, and every line of it would run over text a
   stranger typed. The blueprint title, the summary, the card names and the node labels
   all reach the README from `blueprint.yaml` and `content/cards/*.yaml`; on a live
   registry those are somebody else's words. A small grammar that can be read end to end
   is the cheaper thing to trust here, and this file is the whole of it.

   ── the two rules that make it safe ──
   1. This module produces a TREE, never a string of HTML. `Markdown.tsx` turns the tree
      into React elements, so every piece of author text arrives as a text child and
      React escapes it. A `<script>` in the source comes out as the visible characters
      `<script>`. No branch anywhere sets markup from a string.
   2. A link destination is filtered by `safeHref`. Only `http:`, `https:`, `mailto:`
      and scheme-less (relative, anchor) destinations survive; anything else, most of all
      `javascript:`, makes the whole `[label](dest)` construct fall back to its literal
      source text. The reader sees what was written and the browser is handed no href at
      all. A refused link stays visible rather than being laundered into innocent-looking
      prose, which is the same principle as the next rule.

   ── the fallback rule ──
   Anything this grammar does not implement renders as its literal source characters.
   Nothing vanishes. That is why an unterminated fence, an unterminated code span, a
   `_underscore_`, a raw HTML tag and a refused link are all merely text: a reader who
   opens the same file in an editor sees the same words.

   Supported beyond the measured set — h3 to h6, ordered lists, `**bold**` and links —
   because an author-written README will reach this later and dropping a construct on
   that day would be worse than the small cost of carrying it now.

   NOT supported, each one falling back to literal text: `_` emphasis (underscores sit
   inside identifiers all over this corpus, and CommonMark's intraword rules are the
   fiddly part of emphasis, so `*` carries the job alone), setext headings, reference
   links, indented code blocks, nested lists, and raw HTML.

   Pure: no clock, no randomness, no I/O.
   ============================================================ */

/* --------------------- the tree --------------------- */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

/** A pipe table's per-column alignment, read off the `:---:` delimiter row. */
export type ColumnAlign = "left" | "center" | "right" | null;

export type Block =
  | { kind: "heading"; level: number; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "fence"; language: string; text: string }
  | { kind: "quote"; children: Block[] }
  | { kind: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][]; align: ColumnAlign[] }
  | { kind: "rule" };

/* --------------------- line shapes --------------------- */

/* Three leading spaces are tolerated on every block opener and four are not, which is
   CommonMark's own boundary. It matters here only in that it keeps an indented line from
   being read as a new block in the middle of a paragraph. */
const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const RULE = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const BULLET = /^ {0,3}([-*+])[ \t]+(.*)$/;
const ORDERED = /^ {0,3}(\d{1,9})[.)][ \t]+(.*)$/;
const DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

/** The ASCII punctuation a backslash may escape, per CommonMark. */
const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/* --------------------- destinations --------------------- */

const ALLOWED_SCHEMES = new Set(["http", "https", "mailto"]);

/**
 * The destination a link may keep, or `undefined` when it may not have one.
 *
 * Control characters and spaces come out first, because a browser strips them before it
 * reads the scheme: a `javascript:` URL with a tab wedged into the word navigates
 * exactly as if the tab were not there, so testing the raw string would pass a live one
 * through. The cleaned string is also what is returned, so what was tested is what is
 * emitted.
 *
 * A destination with no scheme at all — `#anchor`, `/blueprints/x`, `./cards/a.yaml` —
 * is relative and allowed. `a/b:c` has a `/` before its colon, which no scheme may have,
 * so the pattern does not match and it stays relative too.
 */
export function safeHref(raw: string): string | undefined {
  const cleaned = raw.replace(/[\u0000-\u0020\u007f]/g, "");
  if (cleaned === "") return undefined;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(cleaned);
  if (scheme && !ALLOWED_SCHEMES.has(scheme[1].toLowerCase())) return undefined;
  return cleaned;
}

/* --------------------- inline --------------------- */

/** How many of `ch` start at `i`. */
function runLength(src: string, i: number, ch: string): number {
  let n = 0;
  while (i + n < src.length && src[i + n] === ch) n += 1;
  return n;
}

/**
 * Where the next run of EXACTLY `want` backticks starts, or -1.
 *
 * Exactly, not at least: a span opened with two backticks closes on the next two, and a
 * longer run inside it is content. This is the one CommonMark subtlety worth keeping,
 * because a code span is how the README quotes every path, ref and marker it names.
 */
function findTickRun(src: string, from: number, want: number): number {
  for (let i = from; i < src.length; i += 1) {
    if (src[i] !== "`") continue;
    const n = runLength(src, i, "`");
    if (n === want) return i;
    i += n - 1;
  }
  return -1;
}

/**
 * CommonMark strips one space from each end of a code span when both are present, which
 * is what lets a span whose content is itself a backtick be written with padding.
 */
function stripCodePadding(text: string): string {
  if (text.length >= 2 && text.startsWith(" ") && text.endsWith(" ") && text.trim() !== "") {
    return text.slice(1, -1);
  }
  return text;
}

/**
 * Where the emphasis run of length `want` closes, or -1.
 *
 * The closing delimiter may not be preceded by whitespace, which is what keeps the
 * arithmetic in "2 * 3 * 4" from turning into an italic. The opening side is checked by
 * the caller for the same reason.
 */
function findEmphasisClose(src: string, from: number, want: number): number {
  for (let i = from; i < src.length; i += 1) {
    if (src[i] !== "*") continue;
    const n = runLength(src, i, "*");
    if (n >= want && i > from && !/\s/.test(src[i - 1])) return i;
    i += n - 1;
  }
  return -1;
}

/**
 * `[label](dest)` starting at `open`, or null when it is not one.
 *
 * Null is also the answer for a destination `safeHref` refuses, and that is the whole
 * javascript-URL defence: the caller then emits the `[` as an ordinary character and
 * carries on, so the construct reaches the reader as the literal text somebody wrote.
 */
function parseLink(src: string, open: number): { node: Inline; end: number } | null {
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "\\") { i += 1; continue; }
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) { close = i; break; }
    }
  }
  if (close < 0 || src[close + 1] !== "(") return null;

  depth = 0;
  let destEnd = -1;
  for (let i = close + 1; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "\\") { i += 1; continue; }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) { destEnd = i; break; }
    }
  }
  if (destEnd < 0) return null;

  /* A title — `[a](/b "t")` — is dropped rather than rendered. It is a tooltip, it is
     never visible text, and keeping it would mean deciding what to escape in an
     attribute no reader ever sees. */
  const dest = src.slice(close + 2, destEnd).trim().split(/\s+/)[0] ?? "";
  const href = safeHref(dest);
  if (href === undefined) return null;

  return {
    node: { kind: "link", href, children: parseInline(src.slice(open + 1, close)) },
    end: destEnd + 1,
  };
}

/**
 * One run of text to inline nodes.
 *
 * A single left-to-right pass: whichever of backtick, `[` and `*` comes first wins, and
 * anything that fails to close is copied out as the characters it is made of. No branch
 * here can lose input.
 */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf !== "") {
      out.push({ kind: "text", text: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.test(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const open = runLength(src, i, "`");
      const close = findTickRun(src, i + open, open);
      if (close >= 0) {
        flush();
        /* Newlines inside a span become spaces: it is one run of text however the
           source happened to wrap. */
        const raw = src.slice(i + open, close).replace(/\n/g, " ");
        out.push({ kind: "code", text: stripCodePadding(raw) });
        i = close + open;
        continue;
      }
      buf += src.slice(i, i + open);
      i += open;
      continue;
    }

    if (ch === "[") {
      const link = parseLink(src, i);
      if (link) {
        flush();
        out.push(link.node);
        i = link.end;
        continue;
      }
      buf += ch;
      i += 1;
      continue;
    }

    if (ch === "*") {
      const run = runLength(src, i, "*");
      const want = run >= 2 ? 2 : 1;
      const inner = i + want;
      const close =
        inner < src.length && !/\s/.test(src[inner]) ? findEmphasisClose(src, inner, want) : -1;
      if (close >= 0) {
        flush();
        out.push({
          kind: want === 2 ? "strong" : "em",
          children: parseInline(src.slice(inner, close)),
        });
        i = close + want;
        continue;
      }
      buf += src.slice(i, i + run);
      i += run;
      continue;
    }

    buf += ch;
    i += 1;
  }

  flush();
  return out;
}

/* --------------------- tables --------------------- */

/**
 * One table row's cells, outer pipes discarded.
 *
 * Only the first and last cell are dropped, and only when the line actually carries the
 * outer pipe: `| a || b |` keeps its empty middle cell, because an empty cell in a
 * generated table is a fact about the row rather than a formatting artefact.
 */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === "\\" && trimmed[i + 1] === "|") {
      cur += "|";
      i += 1;
      continue;
    }
    if (ch === "|") {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  if (trimmed.startsWith("|")) cells.shift();
  if (cells.length > 0 && trimmed.endsWith("|") && !trimmed.endsWith("\\|")) cells.pop();
  return cells.map((cell) => cell.trim());
}

function readAlignment(line: string): ColumnAlign[] {
  return splitRow(line).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

/** A header line with a delimiter line under it. Both must carry a pipe. */
function startsTable(line: string, next: string | undefined): boolean {
  return line.includes("|") && next !== undefined && next.includes("|") && DELIMITER.test(next);
}

/* --------------------- blocks --------------------- */

function isBlockStart(line: string, next: string | undefined): boolean {
  return (
    line.trim() === "" ||
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    startsTable(line, next)
  );
}

function parseBlocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    /* An info string carrying a backtick is not a fence. CommonMark's rule, and the one
       that keeps a paragraph made mostly of code spans from opening one. */
    if (fence && !(fence[1].startsWith("`") && fence[2].includes("`"))) {
      const marker = fence[1];
      const body: string[] = [];
      i += 1;
      /* An unterminated fence runs to the end of the document rather than throwing or
         reverting to a paragraph. A truncated README still reads; a thrown error is a
         blank panel where the document should be. */
      while (i < lines.length) {
        const closing = FENCE.exec(lines[i]);
        if (
          closing &&
          closing[1][0] === marker[0] &&
          closing[1].length >= marker.length &&
          closing[2].trim() === ""
        ) {
          i += 1;
          break;
        }
        body.push(lines[i]);
        i += 1;
      }
      const language = (fence[2] ?? "").trim().split(/\s+/)[0] ?? "";
      out.push({ kind: "fence", language, text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      /* A closing run of hashes is decoration: `## Run it ##` is the same heading as
         `## Run it`. A heading with no text at all is legal and stays empty. */
      const text = (heading[2] ?? "").replace(/[ \t]+#+$/, "");
      out.push({ kind: "heading", level: heading[1].length, children: parseInline(text) });
      i += 1;
      continue;
    }

    /* Ahead of the bullet test, so `- - -` is a rule and not a list of one dash. The
       table test can never see it, because a delimiter row only counts under a header
       line that this branch has already passed over. */
    if (RULE.test(line)) {
      out.push({ kind: "rule" });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length) {
        const quoted = QUOTE.exec(lines[i]);
        if (quoted) {
          body.push(quoted[1]);
          i += 1;
          continue;
        }
        /* Lazy continuation: a plain line under a quote belongs to the quote's own
           paragraph. A blank line, or anything that opens a block, ends it. */
        if (isBlockStart(lines[i], lines[i + 1])) break;
        body.push(lines[i]);
        i += 1;
      }
      out.push({ kind: "quote", children: parseBlocks(body) });
      continue;
    }

    if (startsTable(line, lines[i + 1])) {
      const head = splitRow(line);
      const align = readAlignment(lines[i + 1]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      out.push({
        kind: "table",
        head: head.map(parseInline),
        align,
        /* A short row is padded and a long one keeps its extra cells. Neither throws and
           neither eats text: dropping a cell because the header row was narrower would
           lose words somebody wrote, and this panel's whole promise is that what is in
           the file is what is on the screen. */
        rows: rows.map((row) => {
          const padded =
            row.length >= head.length
              ? row
              : [...row, ...Array<string>(head.length - row.length).fill("")];
          return padded.map(parseInline);
        }),
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      const isOrdered = ordered !== null;
      const start = ordered ? Number(ordered[1]) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const match = isOrdered ? ORDERED.exec(lines[i]) : BULLET.exec(lines[i]);
        if (match) {
          items.push(match[2]);
          i += 1;
          continue;
        }
        /* A wrapped item continues on the next line, which is how a hand-written README
           wraps at 90 columns. A blank line, or any other block opener, ends the list.
           Nested lists are not supported and an indented bullet reads as a sibling. */
        if (items.length > 0 && !isBlockStart(lines[i], lines[i + 1])) {
          items[items.length - 1] += `\n${lines[i]}`;
          i += 1;
          continue;
        }
        break;
      }
      out.push({ kind: "list", ordered: isOrdered, start, items: items.map(parseInline) });
      continue;
    }

    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length && !isBlockStart(lines[i], lines[i + 1])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    out.push({ kind: "paragraph", children: parseInline(paragraph.join("\n")) });
  }

  return out;
}

/**
 * A Markdown document to blocks.
 *
 * CRLF and a lone CR are normalised on the way in: a README that has been through a
 * Windows checkout has to render the same as one that has not, and a stray carriage
 * return left on a line end would otherwise defeat every `$`-anchored pattern above.
 *
 * Total. There is no input this throws on, the empty string included.
 */
export function parseMarkdown(source: string): Block[] {
  return parseBlocks(source.split(/\r\n|\n|\r/));
}
