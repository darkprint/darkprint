/* ============================================================
   DarkPrint core — card document parsing
   Text in, `unknown` out: the YAML/JSON layer that sits under
   `validate.ts`. It decides nothing about card shape, only that
   the bytes are a document at all.
   Design doc §3, engine spec §5.
   ============================================================ */

import { LineCounter, parseDocument as parseYamlDocument } from "yaml";

import { error, warning, type Diagnostic, type DiagnosticLocation } from "../diagnostics";

/** The two hand-writable card formats. The model behind them is identical. */
export type CardFormat = "yaml" | "json";

/**
 * Infers the format from the filename extension; anything that is not `.json`
 * is treated as YAML, which is the format the design doc favours for hand
 * editing. Matching on the whole suffix means "notes.json.bak" stays YAML.
 */
export function formatForFilename(filename: string): CardFormat {
  return filename.trim().toLowerCase().endsWith(".json") ? "json" : "yaml";
}

/** The outcome of parsing one document. */
export interface ParseResult {
  /** Undefined when the document could not be parsed at all. */
  value?: unknown;
  diagnostics: Diagnostic[];
}

/**
 * Parse one card document. Never throws: a syntax error comes back as a
 * `card/parse-error` diagnostic carrying 1-based line and column.
 */
export function parseDocument(text: string, format: CardFormat, file?: string): ParseResult {
  // An empty document is legal YAML (it parses to `null`), but as a card it is
  // a mistake worth naming precisely instead of leaving to the shape check.
  if (text.trim() === "") {
    return {
      diagnostics: [
        error("card/parse-error", "The document is empty.", {
          hint: "A card needs at least `id`, `name`, `type`, `action` and `version`.",
          location: locate(file, 1, 1),
        }),
      ],
    };
  }
  return format === "json" ? parseJsonText(text, file) : parseYamlText(text, file);
}

/* --------------------- YAML --------------------- */

function parseYamlText(text: string, file?: string): ParseResult {
  const lineCounter = new LineCounter();
  const diagnostics: Diagnostic[] = [];
  try {
    // `prettyErrors` is off on purpose: it splices " at line 3, column 1:" plus a
    // source excerpt into `message`, and a Diagnostic message is one clean
    // sentence. The LineCounter gives us the same position, structured.
    const doc = parseYamlDocument(text, { lineCounter, prettyErrors: false });
    for (const e of doc.errors) {
      diagnostics.push(
        error("card/parse-error", sentence(e.message), {
          location: offsetLocation(lineCounter, e.pos[0], file),
        }),
      );
    }
    for (const w of doc.warnings) {
      diagnostics.push(
        warning("card/parse-error", sentence(w.message), {
          location: offsetLocation(lineCounter, w.pos[0], file),
        }),
      );
    }
    if (doc.errors.length > 0) return { diagnostics };
    return { value: doc.toJS() as unknown, diagnostics };
  } catch (e) {
    // The `yaml` API collects syntax errors rather than throwing, so reaching
    // here means something unforeseen (a resource limit, a hostile anchor graph).
    // The contract is "never throws", so it becomes a diagnostic like the rest.
    return {
      diagnostics: [
        ...diagnostics,
        error("card/parse-error", `The YAML document could not be read: ${collapse(messageOf(e))}`, {
          location: locate(file),
        }),
      ],
    };
  }
}

/** Position of a character offset within the source, as a diagnostic location. */
function offsetLocation(
  lineCounter: LineCounter,
  offset: number,
  file?: string,
): DiagnosticLocation {
  if (offset < 0) return locate(file);
  const { line, col } = lineCounter.linePos(offset);
  return locate(file, line, col);
}

/* --------------------- JSON --------------------- */

function parseJsonText(text: string, file?: string): ParseResult {
  try {
    return { value: JSON.parse(text) as unknown, diagnostics: [] };
  } catch (e) {
    const raw = messageOf(e);
    return {
      diagnostics: [
        error("card/parse-error", sentence(collapse(raw)), {
          location: jsonErrorLocation(raw, text, file),
        }),
      ],
    };
  }
}

/**
 * Best-effort position recovery from a `JSON.parse` SyntaxError. The message is
 * engine-specific: V8 says "at position 8 (line 1 column 9)", SpiderMonkey says
 * "at line 1 column 9". We prefer the byte offset and derive line/column
 * ourselves so the numbers are consistent across hosts; when neither shape is
 * present (e.g. "Unexpected end of JSON input") the location carries the file only.
 */
function jsonErrorLocation(message: string, text: string, file?: string): DiagnosticLocation {
  const byOffset = /at position (\d+)/.exec(message);
  if (byOffset) {
    // Group 1 is \d+, so the capture exists and Number() cannot be NaN.
    const offset = Math.min(Number(byOffset[1]), text.length);
    const before = text.slice(0, offset);
    const lastBreak = before.lastIndexOf("\n");
    return locate(file, before.split("\n").length, offset - lastBreak);
  }
  const byLine = /line (\d+) column (\d+)/.exec(message);
  if (byLine) return locate(file, Number(byLine[1]), Number(byLine[2]));
  return locate(file);
}

/* --------------------- shared --------------------- */

/** Builds a location with only the keys we actually know, so equality stays clean. */
function locate(file?: string, line?: number, column?: number): DiagnosticLocation {
  const location: DiagnosticLocation = {};
  if (file !== undefined) location.file = file;
  if (line !== undefined) location.line = line;
  if (column !== undefined) location.column = column;
  return location;
}

/** Squashes newlines and runs of spaces — parser messages sometimes embed source. */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Parser messages arrive as fragments; diagnostics are sentences. */
function sentence(text: string): string {
  const trimmed = collapse(text);
  if (trimmed === "") return "The document could not be parsed.";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Anything can be thrown; only `Error` is guaranteed to carry a message. */
function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
