/* ============================================================
   DarkPrint core — Attractor's edge condition expressions
   Spec §10. A parser and a validator, and deliberately nothing
   more.

   ── why a registry parses somebody else's expression language ──
   It did not have to until now. `ResolvedEdge.condition` carries
   the guard verbatim and nothing in DarkPrint reads the *value*,
   which is still true and is the point of the field. What was
   never true is that nobody had to read the *syntax*: Attractor
   grades its own `condition_syntax` rule ERROR (§7.2), and §7.1
   says the engine refuses to execute a pipeline carrying an
   error-severity diagnostic. So a blueprint DarkPrint called valid
   could be one the runner declines before the first node runs, and
   the whole Attractor-compatibility surface would have said
   nothing about it. This module closes that, and only that.

   ── it parses. It does not evaluate, and it must never learn to ──
   Read `lib/core/bundle/types.ts` on `ResolvedEdge.condition`
   before touching the API here. The rule stated there is that a
   guarded edge counts exactly as much as an unguarded one in every
   risk reading, always, because the guard is evaluated at run time
   on somebody else's machine against data DarkPrint never sees,
   and a check that cannot see the data cannot claim the branch is
   not taken.

   This is the first thing in the tree that understands a guard
   well enough to be tempted, so it is built so the temptation has
   nowhere to land. There is no context parameter and no outcome
   parameter, nothing here returns a boolean about an edge, and a
   caller holding a `ConditionClause` holds the key, the operator
   and the literal as TEXT with nothing to compare them against.
   An `evaluate(clause, context)` added here would put
   `condition="false"` one call away from deleting an edge out of a
   security walk, which is the exact trade `types.ts` refuses and
   `analysis/analyze.test.ts` holds two blueprints to.

   ── §10.7's FUTURE operators are REFUSED, and here is the bill ──
   `contains`, `matches`, `||`, `!`, `>`, `<`, `>=` and `<=` are
   listed in §10.7 as extensions a later version may add. The two
   costs are not symmetric.

   Refusing one Attractor later accepts costs a note on a file that
   will run: the author reads it, sees the section number, and
   publishes anyway, because nothing in this namespace blocks
   anything. Accepting one Attractor refuses today costs the thing
   this module was written to stop: DarkPrint calls the bundle
   clean, the author ships it, and the runner refuses the whole
   pipeline before the first node. §10.7 closes by telling
   implementations not to add these without updating the grammar,
   so today no conforming implementation has them.

   Refused, then. The message names §10.7 by number, so a reader
   can see that this is "not yet" rather than "never" and knows the
   fix is to rewrite the guard rather than to correct a typo.

   ── §10.2's grammar wins over §10.5's evaluator where they differ ──
   The two sections do not describe the same language, and the
   difference is not cosmetic:

     §10.2  Clause ::= Key Operator Literal, with Key one of
            `outcome`, `preferred_label`, `context.` + Path.
     §10.5  `evaluate_clause` falls through to "bare key: check if
            truthy"; `resolve_key` falls back to a direct context
            lookup for an unqualified key; `evaluate_condition`
            returns true for an empty condition and skips an empty
            clause.

   So `tests_pass`, `flag=on` and `""` all evaluate under §10.5 and
   none of the three parses under §10.2. This module follows §10.2,
   because §7.2 grades `condition_syntax` on the grammar, and
   because all three are worth a reader's attention on their own
   merits: §3.3 treats an empty condition as NO condition, so
   `condition=""` turns a guarded edge into an unconditional one
   that routing takes whenever the weights say so. Each of the
   three carries a message saying what a runner following §10.5
   would do with it, so the report stays true under either reading.

   ── the literal side is permissive on purpose ──
   §7.2 describes the rule it mirrors as "valid operators and
   keys". §10.5's `parse_literal` strips the quotes off a String
   and returns the rest of the text unexamined, and every
   comparison in §10.3 is a string comparison. So `0.8`, `-1`,
   `true` and `c:\build` are all admitted here: they are what
   §10.5 compares, and refusing them would be DarkPrint inventing a
   rule the rule it mirrors does not have. What is refused on that
   side is structural: nothing after the operator, or more than one
   thing.

   ── diagnostics, not exceptions ──
   Nothing here throws. `ConditionProblem` is shaped like
   `lib/core/diagnostics.ts` — a closed, greppable code union, one
   sentence of message, a hint that says what to write instead —
   and carries no `DiagnosticCode` and no `Severity` of its own.
   Both of those are the LINT layer's call: an offset into an
   attribute value is not a file position, and `attractor/lint.ts`
   is the only caller that knows which file and which edge the
   expression came off. See `checkEdgeConditions` there.
   ============================================================ */

/** Which of §10.4's three resolutions a key selects. */
export type ConditionKeyKind = "outcome" | "preferred_label" | "context";

/** The two operators §10.2 admits. §10.7's are refused; see the header. */
export type ConditionOperator = "=" | "!=";

/** One `Key Operator Literal` clause, as written. */
export interface ConditionClause {
  /** The key exactly as it appears in the source, e.g. `context.loop_state`. */
  key: string;
  keyKind: ConditionKeyKind;
  operator: ConditionOperator;
  /** The literal with a String's quotes removed and its escapes resolved. */
  value: string;
  /** True when the literal was written as a quoted String rather than bare. */
  quoted: boolean;
  /** 0-based offset of the clause's first character within the condition source. */
  offset: number;
}

/** Stable names for what a condition can be wrong about. Namespaced by nothing: local. */
export type ConditionProblemCode =
  /** The attribute is present and holds no expression at all. */
  | "empty-expression"
  /** A `&&` with nothing on one side of it. */
  | "empty-clause"
  /** A `"` with no closing `"` before the end of the expression. */
  | "unterminated-string"
  /** A parenthesis. §10.2 has no grouping production at all. */
  | "parenthesis"
  /** A key on its own, where §10.2 requires `Key Operator Literal`. */
  | "bare-key"
  /** Several tokens, none of which is an operator. */
  | "missing-operator"
  /** An operator §10.2 does not have and §10.7 does not promise either. */
  | "unknown-operator"
  /** An operator §10.7 lists as a possible future extension. */
  | "future-operator"
  /** Nothing before the operator. */
  | "missing-key"
  /** A key that is not `outcome`, `preferred_label`, or `context.` + a Path. */
  | "unknown-key"
  /** Something before the operator that is not a single key token. */
  | "bad-key"
  /** Nothing after the operator. */
  | "missing-literal"
  /** Something after the operator that is not a single Literal. */
  | "bad-literal";

/**
 * One problem with an expression. Never thrown, always returned.
 *
 * No `severity` and no `DiagnosticCode`: see the header. `hint` is required rather than
 * optional, because every one of these has a concrete thing to write instead, and a
 * report with no fix in it is the shape `lint.ts` already refuses to emit.
 */
export interface ConditionProblem {
  code: ConditionProblemCode;
  /** One sentence, sentence-cased. States what is wrong. */
  message: string;
  /** What to write instead. */
  hint: string;
  /** 0-based offset of the first character this is about, within the condition source. */
  offset: number;
}

/** `clauses` is present only when `problems` is empty, exactly as `DotParseResult.graph` is. */
export interface ConditionParseResult {
  clauses?: readonly ConditionClause[];
  problems: readonly ConditionProblem[];
}

/* --------------------- the grammar's own character classes --------------------- */

/** `Identifier`, the unit of §10.2's `Path`. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The prefix that opens §10.2's third `Key` form. */
const CONTEXT_PREFIX = "context.";

/**
 * What a bare word may be made of.
 *
 * The union of `BareLiteral` (`[A-Za-z_][A-Za-z0-9_.:-]*`), §2.4's signed `Integer`, and
 * the `.` that joins a `Path`. Wider than any single production on purpose: a word is
 * lexed first and judged afterwards, so `context.loop-state` arrives as one token that
 * `classifyKey` can reject with a message about the Path rule, rather than as three
 * tokens that only produce "there is too much here".
 */
const WORD_CHAR = /[A-Za-z0-9_.:+-]/;

/** The characters an operator can be spelled with, `|` included so `||` gets a real message. */
const OPERATOR_CHAR = /[=!<>|]/;

/**
 * §10.7's list, with the name the spec gives each one.
 *
 * `!` is here as the spelling of NOT that a condition actually carries: nothing in the
 * corpus writes the word.
 */
const FUTURE_OPERATORS: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze([">", "numeric comparison"] as const),
  Object.freeze(["<", "numeric comparison"] as const),
  Object.freeze([">=", "numeric comparison"] as const),
  Object.freeze(["<=", "numeric comparison"] as const),
  Object.freeze(["||", "disjunction (OR)"] as const),
  Object.freeze(["!", "negation (NOT)"] as const),
]);

/** §10.7's two word-spelled operators, plus the two conjunctions written as words. */
const FUTURE_WORD_OPERATORS: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(["contains", "substring or set membership"] as const),
  Object.freeze(["matches", "regular-expression matching"] as const),
  Object.freeze(["or", "disjunction (OR)"] as const),
  Object.freeze(["not", "negation (NOT)"] as const),
]);

function futureOperatorName(spelling: string): string | undefined {
  for (const [op, name] of FUTURE_OPERATORS) if (op === spelling) return name;
  return undefined;
}

function futureWordOperatorName(spelling: string): string | undefined {
  const lowered = spelling.toLowerCase();
  for (const [op, name] of FUTURE_WORD_OPERATORS) if (op === lowered) return name;
  return undefined;
}

/* --------------------- tokens --------------------- */

type TokenKind = "word" | "string" | "operator" | "and" | "open" | "close" | "other";

interface CondToken {
  kind: TokenKind;
  /** The raw source text of the token. */
  text: string;
  /** A String's content, quotes off and escapes resolved; `text` for everything else. */
  value: string;
  /** 0-based offset of the token's first character. */
  offset: number;
}

/**
 * The escapes §2.4's String rule names.
 *
 * A switch rather than a lookup object because an object indexed by an arbitrary source
 * character answers for `constructor` and `__proto__` too, and a guard's literal is
 * attacker-adjacent text: it arrives from a `.dot` file somebody else wrote.
 */
function unescape(character: string): string {
  switch (character) {
    case "n":
      return "\n";
    case "t":
      return "\t";
    default:
      // `\"` and `\\` resolve to themselves, and an unknown escape drops the backslash,
      // which is what `dot/lexer.ts` does with the same input one layer up.
      return character;
  }
}

interface TokenizeResult {
  tokens: CondToken[];
  /** Offset of an opening `"` that never closed, if there was one. */
  unterminatedAt?: number;
}

function tokenize(src: string): TokenizeResult {
  const tokens: CondToken[] = [];
  let i = 0;

  const run = (kind: TokenKind, test: RegExp): void => {
    const start = i;
    while (i < src.length && test.test(src.charAt(i))) i += 1;
    const text = src.slice(start, i);
    tokens.push({ kind, text, value: text, offset: start });
  };

  while (i < src.length) {
    const c = src.charAt(i);

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }

    if (c === '"') {
      const start = i;
      i += 1;
      let value = "";
      let closed = false;
      while (i < src.length) {
        const ch = src.charAt(i);
        if (ch === "\\") {
          const next = i + 1 < src.length ? src.charAt(i + 1) : undefined;
          if (next === undefined) {
            i += 1;
            continue;
          }
          value += unescape(next);
          i += 2;
          continue;
        }
        i += 1;
        if (ch === '"') {
          closed = true;
          break;
        }
        value += ch;
      }
      if (!closed) return { tokens, unterminatedAt: start };
      tokens.push({ kind: "string", text: src.slice(start, i), value, offset: start });
      continue;
    }

    // `&&` before the operator run: a lone `&` is not an operator either, and falls to
    // `other` with the message that goes with an unexpected character.
    if (c === "&" && src.charAt(i + 1) === "&") {
      tokens.push({ kind: "and", text: "&&", value: "&&", offset: i });
      i += 2;
      continue;
    }

    if (c === "(" || c === ")") {
      tokens.push({ kind: c === "(" ? "open" : "close", text: c, value: c, offset: i });
      i += 1;
      continue;
    }

    if (OPERATOR_CHAR.test(c)) {
      run("operator", OPERATOR_CHAR);
      continue;
    }

    if (WORD_CHAR.test(c)) {
      run("word", WORD_CHAR);
      continue;
    }

    tokens.push({ kind: "other", text: c, value: c, offset: i });
    i += 1;
  }

  return { tokens };
}

/* --------------------- clauses --------------------- */

interface Segment {
  tokens: readonly CondToken[];
  /** Where the clause begins, or where it would have begun if it is empty. */
  offset: number;
}

/** Split on top-level `&&`. A `&&` inside a String is part of the String, not a separator. */
function splitClauses(tokens: readonly CondToken[]): Segment[] {
  const segments: Segment[] = [];
  let current: CondToken[] = [];
  let fallbackOffset = 0;

  for (const token of tokens) {
    if (token.kind !== "and") {
      current.push(token);
      continue;
    }
    segments.push({ tokens: current, offset: current[0]?.offset ?? fallbackOffset });
    current = [];
    fallbackOffset = token.offset + token.text.length;
  }
  segments.push({ tokens: current, offset: current[0]?.offset ?? fallbackOffset });
  return segments;
}

function problem(
  code: ConditionProblemCode,
  offset: number,
  message: string,
  hint: string,
): ConditionProblem {
  return { code, message, hint, offset };
}

/** `outcome`, `preferred_label`, or `context.` followed by a dotted `Path`. */
function classifyKey(key: string): ConditionKeyKind | undefined {
  if (key === "outcome") return "outcome";
  if (key === "preferred_label") return "preferred_label";
  if (!key.startsWith(CONTEXT_PREFIX)) return undefined;
  const path = key.slice(CONTEXT_PREFIX.length);
  if (path === "") return undefined;
  return path.split(".").every((part) => IDENTIFIER.test(part)) ? "context" : undefined;
}

/** The source text of a segment, for a message that quotes what the author wrote. */
function segmentText(segment: Segment): string {
  return segment.tokens.map((t) => t.text).join(" ");
}

interface ClauseResult {
  clause?: ConditionClause;
  problem?: ConditionProblem;
}

/**
 * One clause, reporting at most one problem.
 *
 * At most one on purpose: the checks are ordered by how much they explain, and a clause
 * with a `>=` in it has one thing wrong with it however many later rules also trip. The
 * same argument `lint.ts` makes for staying quiet about a block the parser already failed
 * on.
 */
function parseClause(segment: Segment): ClauseResult {
  const tokens = segment.tokens;
  if (tokens.length === 0) {
    return {
      problem: problem(
        "empty-clause",
        segment.offset,
        "A `&&` with no clause on one side of it.",
        "`ConditionExpr ::= Clause ( '&&' Clause )*` (§10.2), so every `&&` needs a clause on both sides. A runner following §10.5 skips the empty one, which makes the `&&` do nothing; delete it, or write the clause it was for.",
      ),
    };
  }

  // Every operator in the clause is judged before the first one is used to split it, so a
  // `>=` sitting after a legal `=` is still what gets reported.
  for (const token of tokens) {
    if (token.kind !== "operator") continue;
    if (token.value === "=" || token.value === "!=") continue;
    const future = futureOperatorName(token.value);
    if (future !== undefined) {
      return {
        problem: problem(
          "future-operator",
          token.offset,
          `\`${token.value}\` is listed in §10.7 as a possible future operator, and no conforming runner has it today.`,
          `§10.2 admits \`=\` and \`!=\` only. §10.7 names \`${token.value}\` as ${future} and tells implementations not to add it without changing the grammar first, so this guard has to be rewritten as an equality rather than corrected. A value a runner can compare exactly belongs in the context the guard reads.`,
        ),
      };
    }
    return {
      problem: problem(
        "unknown-operator",
        token.offset,
        `\`${token.value}\` is not an operator in Attractor's condition grammar.`,
        token.value === "=="
          ? "Write `=`. §10.2's `Operator ::= '=' | '!='`, and a doubled `=` is not one of them."
          : "§10.2's `Operator ::= '=' | '!='`. Nothing else is an operator, in this version or in §10.7's list of possible later ones.",
      ),
    };
  }

  const operatorIndex = tokens.findIndex((t) => t.kind === "operator");
  if (operatorIndex < 0) {
    const wordOperator = tokens.find(
      (t) => t.kind === "word" && futureWordOperatorName(t.value) !== undefined,
    );
    if (wordOperator !== undefined) {
      return {
        problem: problem(
          "future-operator",
          wordOperator.offset,
          `\`${wordOperator.value}\` is listed in §10.7 as a possible future operator, and no conforming runner has it today.`,
          `§10.2 admits \`=\` and \`!=\` joined by \`&&\`, and nothing else. §10.7 names \`${wordOperator.value.toLowerCase()}\` as ${futureWordOperatorName(wordOperator.value)} and tells implementations not to add it without changing the grammar first.`,
        ),
      };
    }
    if (tokens.length === 1 && tokens[0].kind === "word") {
      return {
        problem: problem(
          "bare-key",
          tokens[0].offset,
          `\`${tokens[0].value}\` is a key on its own, and §10.2 needs a comparison.`,
          "`Clause ::= Key Operator Literal`, so write `" +
            (classifyKey(tokens[0].value) === undefined
              ? `context.${tokens[0].value}=true`
              : `${tokens[0].value}=true`) +
            "` with the value you meant. §10.5's evaluator falls through to a truthiness check on a bare key, so a runner may well take this edge; §7.2 grades the rule on the grammar, and the two readings disagree about what happens when the key is absent.",
        ),
      };
    }
    return {
      problem: problem(
        "missing-operator",
        segment.offset,
        `\`${segmentText(segment)}\` is not \`Key Operator Literal\`: there is no operator in it.`,
        "§10.2's `Clause ::= Key Operator Literal`, with `Operator ::= '=' | '!='`.",
      ),
    };
  }

  const operator = tokens[operatorIndex];
  const keySide = tokens.slice(0, operatorIndex);
  const valueSide = tokens.slice(operatorIndex + 1);

  if (keySide.length === 0) {
    return {
      problem: problem(
        "missing-key",
        operator.offset,
        "The comparison has nothing on the left of its operator.",
        "§10.2's `Clause ::= Key Operator Literal`. The key is `outcome`, `preferred_label`, or `context.` followed by a dotted path.",
      ),
    };
  }
  if (keySide.length > 1 || keySide[0].kind !== "word") {
    return {
      problem: problem(
        "bad-key",
        keySide[0].offset,
        `\`${keySide.map((t) => t.text).join(" ")}\` is not a key.`,
        "`Key ::= 'outcome' | 'preferred_label' | 'context.' Path`, and `Path ::= Identifier ( '.' Identifier )*`. There is no indexing, no quoting and no expression on the left of the operator.",
      ),
    };
  }

  const key = keySide[0];
  const keyKind = classifyKey(key.value);
  if (keyKind === undefined) {
    return {
      problem: problem(
        "unknown-key",
        key.offset,
        `\`${key.value}\` is not one of the keys §10.2 admits.`,
        key.value.startsWith(CONTEXT_PREFIX)
          ? "`context.` has to be followed by `Path ::= Identifier ( '.' Identifier )*`, and an `Identifier` is `[A-Za-z_][A-Za-z0-9_]*`: no hyphens, no leading digit, no empty segment."
          : `The three keys are \`outcome\`, \`preferred_label\` and \`context.\` + a path, so write \`context.${key.value}\`. §10.4's resolver does fall back to a direct context lookup for an unqualified key, so a runner may resolve this; §7.2 grades the rule on §10.2's grammar, which has no such form.`,
      ),
    };
  }

  if (valueSide.length === 0) {
    return {
      problem: problem(
        "missing-literal",
        operator.offset + operator.text.length,
        "The comparison has nothing on the right of its operator.",
        "§10.2's `Literal ::= String | Integer | Boolean | BareLiteral`. Write the value the key is compared against, quoting it if it contains a space.",
      ),
    };
  }
  const literal = valueSide[0];
  if (valueSide.length > 1 || (literal.kind !== "word" && literal.kind !== "string")) {
    return {
      problem: problem(
        "bad-literal",
        literal.offset,
        `\`${valueSide.map((t) => t.text).join(" ")}\` is not a single literal.`,
        "§10.2's `Literal ::= String | Integer | Boolean | BareLiteral`. A value with a space or a character outside `[A-Za-z0-9_.:-]` in it has to be a double-quoted String.",
      ),
    };
  }

  return {
    clause: {
      key: key.value,
      keyKind,
      operator: operator.value === "=" ? "=" : "!=",
      value: literal.value,
      quoted: literal.kind === "string",
      offset: segment.offset,
    },
  };
}

/* --------------------- the entry point --------------------- */

/**
 * Parse one edge `condition` expression against §10.2.
 *
 * Returns the clauses when the expression is well-formed and a list of problems when it
 * is not, never both and never an exception. Nothing in the result says whether the edge
 * would be taken, and nothing ever may: see the header, and `ResolvedEdge.condition`.
 *
 * The argument is the attribute value as the author wrote it, after the DOT parser has
 * taken the quotes off. An absent `condition` attribute is not this function's business
 * and must not be handed to it as `""`: §3.3 reads an empty condition as an unconditional
 * edge, so a caller that cannot tell "no guard" from "an empty guard" would report every
 * ordinary edge in the archive.
 */
export function parseCondition(source: string): ConditionParseResult {
  if (source.trim() === "") {
    return {
      problems: [
        problem(
          "empty-expression",
          0,
          "The `condition` attribute is present and holds no expression.",
          "`ConditionExpr ::= Clause ( '&&' Clause )*` (§10.2) needs at least one clause. §3.3 reads an empty condition as NO condition, so this edge is unconditional to a runner and routing takes it on weight like any other; write the guard, or drop the attribute so the file says what it means.",
        ),
      ],
    };
  }

  const { tokens, unterminatedAt } = tokenize(source);
  if (unterminatedAt !== undefined) {
    return {
      problems: [
        problem(
          "unterminated-string",
          unterminatedAt,
          "A quoted literal is opened and never closed.",
          "Close the `\"`. Inside a DOT attribute the quote also has to be escaped as `\\\"`, so an expression that looks right in isolation can arrive here truncated.",
        ),
      ],
    };
  }

  // Parentheses stop the walk rather than joining the per-clause reports. §10.2 has no
  // grouping production at all, so there is no reading of the rest of the expression that
  // is worth printing beside this: every clause inside the brackets would be reported for
  // the bracket that is in it.
  const bracket = tokens.find((t) => t.kind === "open" || t.kind === "close");
  if (bracket !== undefined) {
    const open = tokens.filter((t) => t.kind === "open").length;
    const close = tokens.filter((t) => t.kind === "close").length;
    return {
      problems: [
        problem(
          "parenthesis",
          bracket.offset,
          open === close
            ? "The expression groups with parentheses, and §10.2's grammar has no grouping."
            : "The expression has an unbalanced parenthesis.",
          "`ConditionExpr ::= Clause ( '&&' Clause )*`: clauses are AND-combined left to right (§10.3) and there is nothing to group. Write the clauses one after another joined by `&&`.",
        ),
      ],
    };
  }

  const clauses: ConditionClause[] = [];
  const problems: ConditionProblem[] = [];
  for (const segment of splitClauses(tokens)) {
    const result = parseClause(segment);
    if (result.problem !== undefined) problems.push(result.problem);
    else if (result.clause !== undefined) clauses.push(result.clause);
  }

  return problems.length > 0 ? { problems } : { clauses, problems: [] };
}
