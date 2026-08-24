/* ============================================================
   T270 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── everything here is DERIVED from backend.md §T270 ──
   Nothing retypes the published block. A retyped list is a second
   author for one document and it keeps agreeing with itself after
   the document moves.

   ── and it is derived from the WHOLE section, rulings included ──
   D-180-06 is the ruling and its repair is what is copied here:
   *a ruling that never reaches the published block is a ruling
   the blind half cannot bind to.* That was not hypothetical here:
   at `fe79dc0` D-270-01 had withdrawn two verbs, moved `bump` off
   the offline list, restated `--declare` and withdrawn a
   criterion, while the block above it still published all five
   verbs, still marked `bump` local and still numbered six live
   criteria — nine divergences, each of which would have reddened
   a correct implementation. The block was amended at `10d5dde`
   and D-270-02 records it.

   **This file is why that cost one message instead of a round.**
   Because the readers below parse the whole section and let the
   rulings govern, the suite bound to the ruled surface while the
   block was still stale, and the divergence was reported as a
   list rather than discovered as a false charge. One divergence
   survives the amendment and `DIVERGENCES` still carries it: AC6's
   PROSE paragraph reads "`validate` and `bump` take no credential
   and reach nothing" one paragraph below a usage block that now
   marks `bump` a NETWORK verb.

   So this file parses BOTH and lets the RULING GOVERN, which is
   the standing rule (rulings are later and govern). The block's
   own reading is kept as `BLOCK_*` rather than discarded, and
   every place the two disagree is exported as `DIVERGENCES` so
   `document.test.ts` can report it against its owner instead of
   laundering it into a silent choice by this file.

   That ruling's other warning is why `clauseIn` blanks nested
   backticks before it matches: T180's first walker used a
   ``[^`]*`` body, stopped inside a form carrying backticks of its
   own, and SILENTLY DROPPED a form that was already ruled while
   acquiring the new ones. A derivation is only a derivation over
   the text it can read.

   ── why every derived set is asserted NON-EMPTY at the source ──
   A parser that matches nothing returns `[]`, and `[]` makes
   every `for...of` and every `it.each` over it vacuous — the suite
   reports passes for cells that do not exist. So each reader
   THROWS where it finds nothing, and says "broken test, not
   failed criterion". A count that reaches a cell is a count
   something refused to fake.

   ── what this file deliberately does NOT bind ──
   No error class: the section publishes none, and a blind suite
   that invents `CliError` and reds on its absence reports a defect
   against an implementer who followed the contract.

   No `io` shape and no per-verb function names: D-270-01 C11
   publishes `runCli(argv, io): Promise<number>` "plus per-verb
   functions" and names neither the second parameter's members nor
   a single verb function. Both are charged to the orchestrator.
   `runCli` is bound because it is published by name; nothing else
   on that barrel is.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* --------------------- the document --------------------- */

const BACKEND_MD = fileURLToPath(new URL("../../../backend.md", import.meta.url));

/**
 * §T270, from the heading to the next `### `.
 *
 * Matched with the trailing comma — `T270,` — so the heading cannot prefix-match a longer
 * one. A prefix that collapses two sections into one is a defect this project has paid for.
 */
function sectionOf(document: string, heading: string): string {
  const start = document.indexOf(`\n### ${heading}`);
  if (start === -1) {
    throw new Error(
      `backend.md carries no \`### ${heading}\` section.\n` +
        `  This suite derives its whole domain from that section rather than from a list ` +
        `typed here, so a missing heading is a BROKEN TEST and not a failed criterion. ` +
        `Report it; do not retype the block.`,
    );
  }
  const rest = document.slice(start + 1);
  const end = rest.indexOf("\n### ");
  return end === -1 ? rest : rest.slice(0, end);
}

export const SECTION: string = sectionOf(readFileSync(BACKEND_MD, "utf8"), "T270,");

/**
 * The section with every inline-code span replaced by same-length filler.
 *
 * Used only where a reader needs to find prose STRUCTURE — a sentence boundary, a clause
 * keyword — without a backtick inside a quoted identifier terminating it early. Readers that
 * want the identifiers themselves match against `SECTION` instead.
 */
const SECTION_BLANKED: string = SECTION.replace(/`[^`\n]*`/g, (span) => " ".repeat(span.length));

/* --------------------- the command grammar, as the BLOCK writes it --------------------- */

export interface PublishedPositional {
  /** As written, angle brackets included: `<owner>/<slug>`, `<dir>`. */
  readonly text: string;
  readonly optional: boolean;
}

export interface PublishedFlag {
  /** With the dashes: `--version`. */
  readonly name: string;
  /** The placeholder as written: `<v>`. Empty for a flag the block writes bare. */
  readonly arg: string;
  readonly optional: boolean;
  /**
   * The other flags written as alternatives to this one inside one `[a | b]` group.
   * This is what makes `clone`'s `[--version <v> | --digest <d>]` a mutual exclusion
   * rather than two independent options, and the block is the only place that says so.
   */
  readonly exclusiveWith: readonly string[];
}

export interface PublishedCommand {
  readonly verb: string;
  /** The line as written, `darkprint ` included, trailing comment stripped. */
  readonly text: string;
  /** The `// …` note, or undefined. */
  readonly note?: string;
  readonly positionals: readonly PublishedPositional[];
  readonly flags: readonly PublishedFlag[];
}

/**
 * The indented usage block, parsed into commands.
 *
 * Anchored on lines beginning `darkprint ` rather than on a fence: the block is indented by
 * eight spaces and carries no fence, so there is no delimiter to match, and anchoring on the
 * command word means a re-indent cannot silently empty this.
 */
export function parseUsageBlock(section: string): PublishedCommand[] {
  const commands: PublishedCommand[] = [];

  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("darkprint ")) continue;

    const slash = line.indexOf("//");
    const note = slash === -1 ? undefined : line.slice(slash + 2).trim();
    const text = (slash === -1 ? line : line.slice(0, slash)).trim();

    const words = text.slice("darkprint ".length).trim();
    const verb = words.split(/\s+/)[0];
    if (verb === undefined || verb === "") continue;

    const { positionals, flags } = parseArguments(words.slice(verb.length).trim());
    commands.push({ verb, text, ...(note === undefined ? {} : { note }), positionals, flags });
  }

  if (commands.length === 0) {
    throw new Error(
      "backend.md §T270 publishes no `darkprint <verb>` usage line.\n" +
        "  Every command cell in this suite is quantified over that block, so an empty parse " +
        "reports a pass for each of them without running one. BROKEN TEST, not a failed " +
        "criterion: report the section, do not retype the block here.",
    );
  }
  return commands;
}

/**
 * Split an argument string into top-level `[...]` groups and bare tokens.
 *
 * `<…>` is deliberately NOT counted as depth. The block writes
 * `[--version <v> | --digest <d>]`, and treating `<` as an opener would leave the `|` at
 * depth 2 and lose the alternation this parser exists to find.
 */
function parseArguments(text: string): {
  positionals: PublishedPositional[];
  flags: PublishedFlag[];
} {
  const positionals: PublishedPositional[] = [];
  const flags: PublishedFlag[] = [];

  for (const { body, optional } of groupsIn(text)) {
    const alternatives = body
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part !== "");
    const names = alternatives
      .map((alt) => alt.match(/^(--[a-z-]+)/)?.[1])
      .filter((name): name is string => name !== undefined);

    for (const alternative of alternatives) {
      const flag = alternative.match(/^(--[a-z-]+)\s*(<[^>]*>)?$/);
      if (flag !== null) {
        flags.push({
          name: flag[1],
          arg: flag[2] ?? "",
          optional,
          exclusiveWith: names.filter((name) => name !== flag[1]),
        });
        continue;
      }
      positionals.push({ text: alternative, optional });
    }
  }

  return { positionals, flags };
}

/** Top-level `[...]` groups and the bare tokens between them, in written order. */
function groupsIn(text: string): { body: string; optional: boolean }[] {
  const out: { body: string; optional: boolean }[] = [];
  let depth = 0;
  let current = "";

  /**
   * Rejoin a `--flag` with the `<arg>` that follows it.
   *
   * Bare text is split on whitespace, which is right for `[<dir>] --declare <version>`'s two
   * INDEPENDENT arguments and wrong for the two halves of one. Without this, `--declare
   * <version>` parsed as a flag taking NOTHING plus a stray required positional `<version>` —
   * measured, not foreseen: `clone`'s `--version <v>` sits inside a `[...]` group whose body
   * is never split, so the two forms went down different paths and only the bracketed one was
   * right. Found by printing the parse, which is the only thing that finds this.
   */
  const pair = (tokens: string[]): string[] => {
    const joined: string[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const next = tokens[i + 1];
      if (token.startsWith("--") && next !== undefined && next.startsWith("<")) {
        joined.push(`${token} ${next}`);
        i += 1;
        continue;
      }
      joined.push(token);
    }
    return joined;
  };

  const flush = (optional: boolean): void => {
    const tokens = optional
      ? [current]
      : pair(current.split(/\s+/).filter((token) => token.trim() !== ""));
    for (const token of tokens) {
      const trimmed = token.trim();
      if (trimmed !== "") out.push({ body: trimmed, optional });
    }
    current = "";
  };

  for (const ch of text) {
    if (ch === "[") {
      if (depth === 0) {
        flush(false);
        depth = 1;
        continue;
      }
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        flush(true);
        continue;
      }
    }
    current += ch;
  }
  flush(false);
  return out;
}

/** Every command the BLOCK publishes, including ones a ruling has since withdrawn. */
export const BLOCK_COMMANDS: readonly PublishedCommand[] = parseUsageBlock(SECTION);

/** The verbs the BLOCK marks `// local, no network`. */
export const BLOCK_LOCAL_ONLY: readonly string[] = BLOCK_COMMANDS.filter(
  (command) => command.note?.includes("no network") === true,
).map((command) => command.verb);

/* --------------------- what the RULINGS have since changed --------------------- */

/**
 * A clause matched against the section, with the identifiers still readable.
 *
 * `expected` is the floor: a reader whose clause has moved must say so rather than answer
 * with an empty set, because an empty set here is what silently deletes cells downstream.
 */
function clauseIn(pattern: RegExp, what: string): RegExpMatchArray {
  const match = SECTION.match(pattern);
  if (match === null) {
    throw new Error(
      `backend.md §T270 no longer carries the clause this suite reads ${what} from.\n` +
        `  pattern: ${pattern}\n` +
        `  This suite derives ${what} rather than typing it, so a moved clause is a BROKEN ` +
        `TEST and not a failed criterion. Report the section; do not hard-code the answer.`,
    );
  }
  return match;
}

/**
 * The verbs D-270-01 withdrew, DERIVED from the ruling rather than typed.
 *
 * The ruling's sentence: *"`publish` and `report` are WITHDRAWN from T270"*. Read here
 * because the block still publishes both, and a suite quantified over the block would build
 * cells for two verbs no implementer is going to write — which is the "would red a correct
 * tree" the ruling itself forbids for AC5.
 */
export const WITHDRAWN_VERBS: readonly string[] = (() => {
  /* Deliberately tolerant of the emphasis around it. The first version of this pattern
     required `**` immediately before `WITHDRAWN`, and the ruling writes the emphasis around
     the whole clause label instead — so it matched nothing and this reader THREW against a
     correctly-amended document. Caught by running the parser rather than by reading it, which
     is the only thing that would have caught it. */
  const match = clauseIn(/`([a-z]+)` and `([a-z]+)` are (?:\*\*)?WITHDRAWN/i, "the withdrawn verbs");
  const verbs = [match[1], match[2]].filter((verb): verb is string => verb !== undefined);
  if (verbs.length === 0) {
    throw new Error(
      "backend.md §T270's withdrawal clause matched but named no verb.\n" +
        "  BROKEN TEST: the clause's shape has changed. Report the section.",
    );
  }
  return verbs;
})();

/**
 * The criteria D-270-01 withdrew, by number.
 *
 * *"AC5 is withdrawn with them"*. Read as a number so `CRITERIA` can drop it positionally,
 * which is the only join available: the criteria line numbers them and the ruling names them
 * by that number.
 */
export const WITHDRAWN_CRITERIA: readonly number[] = (() => {
  const found = [...SECTION_BLANKED.matchAll(/AC(\d)\b[^.]{0,40}?\bis withdrawn/gi)].map((match) =>
    Number(match[1]),
  );
  if (found.length === 0) {
    throw new Error(
      "backend.md §T270 carries no `AC<n> is withdrawn` clause.\n" +
        "  D-270-01 withdrew one and the criteria line still numbers six. If the line has " +
        "since been amended, this reader is stale. BROKEN TEST: report the section.",
    );
  }
  return [...new Set(found)];
})();

/**
 * The verbs AC6's offline clause actually covers, DERIVED from the ruling.
 *
 * *"AC6's offline clause applies to `validate` alone"*. The block still marks `bump`
 * `// local, no network`, and D-270-01 C8 makes `bump` a NETWORK verb — it fetches the
 * previous through provenance and the files routes. An AC6 cell that ran `bump` with the
 * network down would red a correct implementation, so this reader governs `BLOCK_LOCAL_ONLY`.
 */
export const LOCAL_ONLY_VERBS: readonly string[] = (() => {
  const match = clauseIn(/AC6's offline clause applies to `([a-z]+)` alone/, "the offline verbs");
  return [match[1]];
})();

/* --------------------- the reconciled surface: what a cell may assume --------------------- */

/** Every published verb the rulings have not withdrawn. */
export const COMMANDS: readonly PublishedCommand[] = BLOCK_COMMANDS.filter(
  (command) => !WITHDRAWN_VERBS.includes(command.verb),
);

export const VERBS: readonly string[] = COMMANDS.map((command) => command.verb);

/** Live verbs that reach the registry — every live verb AC6's offline clause does not cover. */
export const NETWORKED_VERBS: readonly string[] = VERBS.filter(
  (verb) => !LOCAL_ONLY_VERBS.includes(verb),
);

if (VERBS.length === 0) {
  throw new Error(
    "backend.md §T270's rulings withdraw every verb its block publishes.\n" +
      "  BROKEN TEST: one of the two readers is wrong. Report the section.",
  );
}

/**
 * The numbered acceptance criteria the rulings have not withdrawn.
 *
 * Split on `(n)` rather than on `;`, because a criterion may carry a semicolon of its own and
 * the numbering is what the section actually guarantees is one-per-criterion. Each entry
 * keeps its ORIGINAL number, so a red cites the criterion the document numbers rather than an
 * index this file assigned after dropping one.
 */
export const CRITERIA: readonly { readonly n: number; readonly text: string }[] = (() => {
  const line = SECTION.match(/^- \*\*Acceptance criteria:\*\*(.*)$/m)?.[1];
  if (line === undefined) {
    throw new Error(
      "backend.md §T270 carries no `- **Acceptance criteria:**` line.\n" +
        "  This suite reports one red per criterion and derives the count from that line. " +
        "BROKEN TEST: report the section.",
    );
  }
  const parts = line
    .split(/\((\d)\)/)
    .slice(1)
    .reduce<{ n: number; text: string }[]>((acc, part, index, all) => {
      if (index % 2 === 1) return acc;
      const text = (all[index + 1] ?? "").replace(/^[\s;]+|[\s;.]+$/g, "");
      if (text !== "") acc.push({ n: Number(part), text });
      return acc;
    }, []);

  /* Two independent signals for the same fact, and the union is taken deliberately.
     `WITHDRAWN_CRITERIA` reads the RULING's prose; this reads the criteria LINE's own
     strikethrough, which is where the withdrawal is written locally. Either alone is one
     phrasing away from silently readmitting a criterion nobody is going to implement — and a
     readmitted criterion becomes a cell that reds a correct implementation. */
  const struck = (n: number, text: string): boolean =>
    WITHDRAWN_CRITERIA.includes(n) || /^~~\s*withdrawn/i.test(text);

  const live = parts.filter((criterion) => !struck(criterion.n, criterion.text));
  if (live.length === 0) {
    throw new Error(
      "backend.md §T270's acceptance-criteria line parses to zero live criteria.\n" +
        `  parsed ${parts.length}, withdrawn ${JSON.stringify(WITHDRAWN_CRITERIA)}. ` +
        "BROKEN TEST: report the section.",
    );
  }
  return live;
})();

/** Every `D-…-nn` the section cites, deduplicated, in document order. */
export const RULINGS: readonly string[] = [
  ...new Set(SECTION.match(/\bD-[A-Z0-9]+-[0-9]+[A-Z]?\b/g) ?? []),
];

/* --------------------- where the block and the rulings disagree --------------------- */

export interface Divergence {
  /** What the two halves disagree about. */
  readonly subject: string;
  /** What the published block still says. */
  readonly block: string;
  /** What the governing ruling says instead. */
  readonly ruling: string;
}

/**
 * Every place the block and the rulings contradict each other, computed rather than listed.
 *
 * These are DOCUMENT defects with the orchestrator as owner, not module defects, which is
 * why they live here and are reported by `document.test.ts` alone: folding them into a
 * criterion's cell would charge an implementer for a sentence it does not own.
 *
 * The list is computed from the two parses, so it empties itself the moment the block is
 * amended. Nothing here has to be deleted by hand, which is the property a hand-written list
 * of known divergences would not have.
 */
/**
 * The verbs AC6's own PROSE paragraph names as taking no credential.
 *
 * A third statement of the offline set, independent of the usage block's `//` notes and of
 * the ruling's clause — and the one that has been stale twice. Read so `DIVERGENCES` can
 * compare all three rather than two: the block and the criteria line were amended in place
 * while this sentence still reads *"`validate` and `bump` take no credential and reach
 * nothing"*, which is the opposite of what the block one paragraph above it now says.
 *
 * Returns `[]` rather than throwing when the paragraph is gone: unlike the readers above,
 * nothing is quantified over this, so its absence deletes no cell. It only stops being able
 * to report a contradiction, and a divergence reader that throws when the divergence is
 * FIXED would be the worst possible shape for it.
 */
export function ac6ProseVerbsIn(section: string): string[] {
  const paragraph = section.match(/\*\*AC6 defines which verbs are local[^\n]*/)?.[0];
  if (paragraph === undefined) return [];
  /* `takes?` — the singular matters. Narrowed to one verb the sentence naturally becomes
     "`validate` TAKES no credential", and a reader matching only the plural would answer []
     for it. That is accidentally right for the amendment and WRONG for the case that matters:
     a prose naming `bump` ALONE is a divergence, and the plural-only reader called it clean.
     Found by the instrument cell, not by reading. */
  const sentence = paragraph.match(/:\s*(.*?takes? no credential)/)?.[1];
  if (sentence === undefined) return [];
  return [...sentence.matchAll(/`([a-z]+)`/g)].map((match) => match[1]);
}

export const AC6_PROSE_VERBS: readonly string[] = ac6ProseVerbsIn(SECTION);

export const DIVERGENCES: readonly Divergence[] = [
  ...WITHDRAWN_VERBS.filter((verb) => BLOCK_COMMANDS.some((command) => command.verb === verb)).map(
    (verb) => ({
      subject: `the \`${verb}\` verb`,
      block: `the usage block still publishes \`darkprint ${verb}\``,
      ruling: `D-270-01 withdrew it from T270`,
    }),
  ),
  ...BLOCK_LOCAL_ONLY.filter((verb) => !LOCAL_ONLY_VERBS.includes(verb)).map((verb) => ({
    subject: `\`${verb}\`'s offline status`,
    block: `the usage block still marks \`${verb}\` \`// local, no network\``,
    ruling: `AC6's offline clause applies to \`${LOCAL_ONLY_VERBS.join(", ")}\` alone`,
  })),
  ...AC6_PROSE_VERBS.filter((verb) => !LOCAL_ONLY_VERBS.includes(verb)).map((verb) => ({
    subject: `AC6's prose paragraph`,
    block: `it still says \`${verb}\` takes no credential and reaches nothing`,
    ruling: `AC6's offline clause applies to \`${LOCAL_ONLY_VERBS.join(", ")}\` alone, and the ` +
      `usage block one paragraph above now marks \`${verb}\` a NETWORK verb`,
  })),
  /* A withdrawn criterion diverges only if the line still states it AS A CRITERION. The
     amended line keeps the numbering and strikes the text — `(3) ~~withdrawn with `publish`~~`
     — which is a correct amendment, not a divergence: the number is preserved so the four
     that survive keep the numbers the rest of the document cites them by. So the test is
     whether live text follows the number, not whether the number is present. */
  ...WITHDRAWN_CRITERIA.filter((n) => {
    const line = SECTION.match(/^- \*\*Acceptance criteria:\*\*(.*)$/m)?.[1] ?? "";
    const text = line.split(new RegExp(`\\(${n}\\)`))[1]?.split(/\(\d\)/)[0]?.trim() ?? "";
    return text !== "" && !/^~~\s*withdrawn/i.test(text);
  }).map((n) => ({
    subject: `acceptance criterion ${n}`,
    block: `the criteria line still states (${n}) as a live criterion`,
    ruling: `D-270-01/02 withdrew AC${n}`,
  })),
];

/* --------------------- what a rendering may carry --------------------- */

/**
 * The section's rendering clause, quoted from the document so a red cites it.
 *
 * A NEGATIVE whitelist, and the one clause in this section that is fully testable today
 * whatever the transport turns out to be. Held as the sentence rather than as a list this
 * file invents, so a failure says where the rule comes from.
 */
export const RENDERING_CLAUSE: string = clauseIn(
  /\*\*Admissible message forms:\*\*([^\n]*)/,
  "the rendering clause",
)[1].trim();

/**
 * The content classes the clause forbids, DERIVED from it rather than listed.
 *
 * The floor is four because the clause names four. A parse finding fewer has stopped reading
 * the sentence, which is a QUIETLY NARROWED leak scan — D-180-06's exact recorded failure.
 */
export const FORBIDDEN_IN_RENDERING: readonly string[] = (() => {
  const found = ["credential", "endpoint", "stack", "driver", "HTTP body"].filter((word) =>
    RENDERING_CLAUSE.includes(word),
  );
  if (found.length < 4) {
    throw new Error(
      `backend.md §T270's rendering clause names only ${found.length} of the content classes ` +
        `this suite reads from it (${JSON.stringify(found)}).\n` +
        `  clause: ${JSON.stringify(RENDERING_CLAUSE)}\n` +
        `  A shortened list is a quietly narrowed leak scan. BROKEN TEST: report the section.`,
    );
  }
  return found;
})();

/* --------------------- a pin over the derived surface --------------------- */

/**
 * A digest over exactly the derived fields and nothing else.
 *
 * Prose moves freely underneath it; a verb, a flag, a criterion or the rendering clause
 * cannot. Deliberately not `sha256Hex` from `@/lib/core`: that would make the pin depend on
 * the engine this suite also tests, so one broken hash would move the pin and the subject
 * together and neither cell could tell which had moved.
 */
export const PIN: string = JSON.stringify({
  commands: COMMANDS.map((command) => ({
    verb: command.verb,
    positionals: command.positionals,
    flags: command.flags,
  })),
  localOnly: LOCAL_ONLY_VERBS,
  criteria: CRITERIA.map((criterion) => criterion.n),
  rendering: FORBIDDEN_IN_RENDERING,
});

/* --------------------- binding the module --------------------- */

/**
 * The barrel, and the one line that moves if the entry point is ruled elsewhere.
 *
 * D-270-01 C1 grants `packages/mcp/src/cli.ts`, `packages/mcp/package.json` and
 * `packages/mcp/tsconfig.json` to T270 for the dispatcher extension ONLY — one distributable,
 * `darkprint <verb>` — while `Owns:` stays `packages/cli/**`. So the CLI's own code is under
 * `packages/cli/` and the granted files route to it. The bin shim is out of blind scope in
 * writing (C11, D-220-09's construction), which is why nothing here drives a process.
 */
export const CLI = "@/packages/cli/src/index";

/**
 * The one name C11 publishes on that barrel.
 *
 * *"`runCli(argv: readonly string[], io): Promise<number>` plus per-verb functions"* — the
 * per-verb functions are not named and `io`'s members are not published, so neither is bound
 * here. Both are charged to the orchestrator rather than guessed: a blind suite that invents
 * `io.stdout` and reds on its absence reports a defect against an implementer who followed
 * the contract.
 */
export const RUN_CLI = "runCli";

/** `argv` and `io`. Stated as the block's parameter list rather than counted in prose. */
export const RUN_CLI_ARITY = 2;

/**
 * `io`, published by D-270-03 (1) after this suite charged that it was unwritable without one.
 *
 * *"`io` is `{ out(text: string): void; err(text: string): void }` — `runCli` and every verb
 * render through `io` alone; nothing under `packages/cli/src/**` writes to
 * `process.stdout`/`process.stderr` except the bin shim that passes the real streams."*
 *
 * A cell asserting `io.out` was REFUSED here until that ruling existed, and the refusal is
 * the point: a blind suite that invents an interface and reds on its absence charges an
 * implementer who followed the contract. It is sanctioned now because it is published now.
 */
export interface CliIo {
  out(text: string): void;
  err(text: string): void;
}

/** An `io` that records everything written through it, so a cell can read what was rendered. */
export function recordingIo(): CliIo & {
  readonly out_: string[];
  readonly err_: string[];
  all(): string;
} {
  const out_: string[] = [];
  const err_: string[] = [];
  return {
    out_,
    err_,
    out: (text) => void out_.push(text),
    err: (text) => void err_.push(text),
    /* Both channels joined. The rendering clause forbids a credential, an endpoint, a stack
       and a driver or HTTP body from the RENDERING — it does not say which stream, and a leak
       scan reading only `out` would miss every one written to `err`, which is where a CLI puts
       its refusals. */
    all: () => [...out_, ...err_].join("\n"),
  };
}

/**
 * The per-verb function names, which are the verb names.
 *
 * D-270-03 (2)-(3): the per-verb functions take parsed inputs and return DATA, `runCli` alone
 * renders, and they are *"EXPORTED FROM THE BARREL so the blind suite binds them by name and
 * reds on absence rather than inventing synonyms."* Only `validate(dir)`'s parameter spelling
 * is published; the rest are the implementer's, so nothing here pins an argument list beyond
 * the one the ruling writes.
 *
 * Derived from the live verbs rather than typed, so a withdrawn verb cannot be bound and a
 * newly published one is bound without editing this line.
 */
export const VERB_FUNCTIONS: readonly string[] = VERBS;

/**
 * Bind one named export off the CLI barrel, LAST inside a cell.
 *
 * Reds with the clause that publishes the name, so a failure says where the expectation comes
 * from rather than merely that a test wanted something.
 */
export async function bindVerb(name: string): Promise<(...args: never[]) => unknown> {
  const barrel = await loadCli();
  const value = barrel[name];
  if (typeof value !== "function") {
    throw new Error(
      `\`${name}\` is not exported as a function from \`${CLI}\`.\n` +
        `  backend.md §T270 D-270-03 (2)-(3) publishes the per-verb functions as barrel ` +
        `exports so this suite binds them BY NAME and reds on absence "rather than inventing ` +
        `synonyms". Exported names seen: ` +
        `${Object.keys(barrel).filter((key) => typeof barrel[key] === "function").join(", ") || "(none)"}.`,
    );
  }
  return value as (...args: never[]) => unknown;
}

/**
 * Where `validate` looks for a local vocabulary, ruled by D-270-04 (3).
 *
 * BOTH spellings: the wizard's flat `extensions.(yaml|yml|json)` and `ontology/extensions.yaml`,
 * which is `exportBundle`'s own output path. C6 promises the wizard's accepted layout AND that
 * clone's output folder is validatable, and those two facts name different paths — so this is
 * a union rather than a precedence. Both present and byte-identical is fine; both present and
 * DIFFERENT is a `Diagnostic` naming both paths, never a silent winner and no new error class.
 */
export const FLAT_VOCABULARY_NAME = /^extensions\.(ya?ml|json)$/i;
export const NESTED_VOCABULARY_PATH = "ontology/extensions.yaml";

let cliModule: Promise<Record<string, unknown>> | undefined;

/**
 * Load the CLI barrel, dynamically and LAST inside a cell.
 *
 * Dynamic because these tests were written in a worktree branched before `packages/cli`
 * existed — `ls packages/cli` answered "No such file or directory" at the moment this file
 * was created. A static top-level import of an absent module fails the whole FILE at
 * collection, reporting one red where the protocol asks for one per acceptance criterion and
 * hiding every criterion behind the first missing module.
 *
 * Bound LAST inside a cell — after the premises are built AND asserted — because an early
 * bind masks every setup line below it while being correct about its own subject. The tell is
 * a red in 0ms where work was expected.
 */
export async function loadCli(): Promise<Record<string, unknown>> {
  cliModule ??= import(/* @vite-ignore */ CLI).then(
    (module: Record<string, unknown>) => module,
    (cause: unknown) => {
      throw new Error(
        `T270's CLI barrel did not load from \`${CLI}\`.\n` +
          `  backend.md §T270 owns \`packages/cli/**\` and publishes ${VERBS.length} live ` +
          `verb(s) (${VERBS.join(", ")}) behind \`${RUN_CLI}\`. If the entry point lives ` +
          `under another path, \`CLI\` in this file is the one line to move.\n` +
          `  cause: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    },
  );
  return cliModule;
}
