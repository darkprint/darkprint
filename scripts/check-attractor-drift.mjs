#!/usr/bin/env node
// Catches the Attractor specification moving underneath `lib/core/attractor/reserved.ts`.
//
// That file is a HAND TRANSCRIPTION of `attractor-spec.md` in somebody else's repository,
// and the whole DarkPrint compatibility claim rests on it: "attributes that are not in
// Attractor's reserved list are silently ignored" is what lets a DarkPrint DOT carry
// `card="id@version"` and still run. If upstream reserves a name DarkPrint already writes,
// that stops being true and nothing in this repository would notice, because nothing in
// this repository reads the spec. `lib/core` is isomorphic and network-free by contract,
// and a vitest cell that fetched a URL would fail on somebody else's outage — so the check
// lives here, out of the suite, and runs from CI.
//
// It compares the live file against the digests pinned in `ATTRACTOR_SPEC_PIN`, which sit
// beside the transcription they certify. Any difference is a reason to re-read the spec,
// not a verdict about what changed: a typo fix moves the digest exactly as much as a new
// reserved attribute does. So a drift prints what it can work out about WHICH names moved,
// clearly labelled as a starting point.
//
// Exit codes are three-valued on purpose. 0 unchanged, 1 drifted, 2 could not check — an
// unreachable GitHub must not read as a spec revision, which is the one wrong answer this
// script could give that would send somebody to re-verify a document nobody had touched.
//
// The pure halves — the two digests, Appendix A's tables, and the transcribed sets — are
// EXPORTED and driven by `scripts/check-attractor-drift.test.ts` against a fixture, with no
// network anywhere. That is not tidiness: the first version of `appendixAttributes` bounded
// `### Edge Attributes` at the next `###` heading, which does not exist, so the section ran
// to the end of the document and the guard reported `Mdiamond`, `box` and `notes` as new
// edge attributes. It took a falsifying run to see it, and a falsifying run needs a seam.

import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;
const RESERVED = join(ROOT, "lib/core/attractor/reserved.ts");
const RESERVED_REL = "lib/core/attractor/reserved.ts";

const UNCHANGED = 0;
const DRIFTED = 1;
const COULD_NOT_CHECK = 2;

/* --------------------- the pin, read out of the transcription --------------------- */

/**
 * One member of `ATTRACTOR_SPEC_PIN`, or a throw naming what was not found.
 *
 * Reading the pin out of the source rather than restating it here is the point: a copy in
 * this file would be a second thing to keep in step, and the day the two disagreed this
 * script would be checking a number nobody had verified. The regexes are deliberately
 * narrow (a quoted literal after the exact key) so a restructured file fails loudly rather
 * than matching something else.
 */
export function pinMember(source, key) {
  const match = source.match(new RegExp(`\\b${key}:\\s*"([^"]+)"`));
  if (match === null) {
    throw new Error(
      `${RESERVED_REL} has no \`${key}\` in ATTRACTOR_SPEC_PIN, or it is no longer a plain ` +
        `string literal. This script reads the pin by regex and cannot check anything ` +
        `without it. Restore the member, or update the regex here in the same change.`,
    );
  }
  return match[1];
}

export function readPin(source = readFileSync(RESERVED, "utf8")) {
  /* The DECLARATION and not the name. This first asked `source.includes("ATTRACTOR_SPEC_PIN")`,
     and a mutation that renamed the export passed: the docblock above the constant names it
     in prose, so the string was still in the file after the declaration had gone. A guard
     that reads its subject's own explanation of itself is satisfied by the explanation. */
  if (!source.includes("export const ATTRACTOR_SPEC_PIN")) {
    throw new Error(
      `${RESERVED_REL} no longer declares ATTRACTOR_SPEC_PIN. The transcription it certifies ` +
        `is still there, so this is an unpinned transcription: nothing is watching the spec ` +
        `it was copied from. Restore the pin or delete this check deliberately.`,
    );
  }
  return {
    source,
    rawUrl: pinMember(source, "rawUrl"),
    blob: pinMember(source, "blob"),
    sha256: pinMember(source, "sha256"),
    bytes: pinMember(source, "bytes"),
    upstreamCommit: pinMember(source, "upstreamCommit"),
    movedOn: pinMember(source, "movedOn"),
    verifiedOn: pinMember(source, "verifiedOn"),
  };
}

/* --------------------- the two digests --------------------- */

/**
 * The git object id of a blob, so the pin is checkable by hand.
 *
 * Git hashes `blob <byte length>\0` followed by the content, which is why this is not a
 * bare sha1 of the file. Written out rather than shelled out to `git hash-object`: the
 * bytes are in memory here and were never a file on disk, and a subprocess would need one.
 */
export function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/* --------------------- what changed, as far as this can tell --------------------- */

/**
 * The attribute names Appendix A tabulates, by scope.
 *
 * Returns `undefined` when the appendix cannot be found in the shape this parser knows,
 * which is itself a finding: the document was restructured, and a silent empty result
 * would print "no new attributes" about a table this script never read. Appendix A is
 * three markdown tables under `### Graph Attributes` / `### Node Attributes` / `### Edge
 * Attributes`, each row opening `| \`name\` |`.
 */
export function appendixAttributes(text) {
  const scopes = { graph: "Graph Attributes", node: "Node Attributes", edge: "Edge Attributes" };
  const found = {};
  for (const [scope, heading] of Object.entries(scopes)) {
    const at = text.indexOf(`### ${heading}`);
    if (at === -1) return undefined;
    /* Bounded at the next heading of ANY level, not the next `###`. `### Edge Attributes`
       is the last subsection of Appendix A, so a `\n### ` search runs off the end and the
       section swallows Appendix B's shape table and Appendix C's status fields — which is
       exactly what the first version of this did, and it reported `Mdiamond`, `box` and
       `notes` as new edge attributes. Measured, not reasoned: the falsifying run printed
       all fourteen. */
    const rest = text.slice(at + heading.length);
    const nextHeading = rest.search(/\n#{2,3} /);
    const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
    const names = [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
    if (names.length === 0) return undefined;
    found[scope] = names;
  }
  return found;
}

/** The transcribed set for one scope, read out of the source the same way the pin is. */
export function transcribed(source, constant) {
  const at = source.indexOf(`export const ${constant}`);
  if (at === -1) return undefined;
  const close = source.indexOf("]);", at);
  if (close === -1) return undefined;
  return [...source.slice(at, close).matchAll(/^\s*"([^"]+)",/gm)].map((m) => m[1]);
}

/**
 * The report a person acts on, printed only when a drift is already established.
 *
 * Deliberately one-directional in each column. A name Appendix A tabulates and the
 * transcription does not have is a candidate NEW reserved attribute, which is the case
 * that breaks compatibility. The other direction is not symmetric and is not an error: the
 * transcription carries eight names on purpose that Appendix A never tabulated, read out
 * of the handler pseudocode, so listing them as "missing upstream" every time would train
 * a reader to ignore this output.
 */
function reportNames(text, source) {
  const upstream = appendixAttributes(text);
  if (upstream === undefined) {
    console.log(
      "  Appendix A could not be parsed in the shape this script knows (three tables under",
    );
    console.log(
      "  `### Graph Attributes` / `### Node Attributes` / `### Edge Attributes`). That is a",
    );
    console.log("  structural change to the document, so read all of it rather than a diff.");
    return;
  }

  const sets = {
    graph: transcribed(source, "ATTRACTOR_GRAPH_ATTRIBUTES"),
    node: transcribed(source, "ATTRACTOR_NODE_ATTRIBUTES"),
    edge: transcribed(source, "ATTRACTOR_EDGE_ATTRIBUTES"),
  };

  let anything = false;
  for (const scope of ["graph", "node", "edge"]) {
    const ours = sets[scope];
    if (ours === undefined) {
      console.log(`  Could not read the transcribed ${scope} set out of ${RESERVED_REL}.`);
      anything = true;
      continue;
    }
    const added = upstream[scope].filter((name) => !ours.includes(name));
    if (added.length === 0) continue;
    anything = true;
    console.log(`  Appendix A tabulates ${scope} attributes the transcription does not have:`);
    for (const name of added) console.log(`    ${name}`);
  }

  if (!anything) {
    console.log("  Every attribute Appendix A tabulates is already in the transcription, so the");
    console.log("  change is elsewhere in the document. The eight names read out of the handler");
    console.log("  pseudocode (§3.5, §4.8, §4.10, §4.11) are NOT in Appendix A and are the part a");
    console.log("  table diff cannot check. Read those sections.");
  }
}

/* --------------------- the check --------------------- */

async function main() {
  let pin;
  try {
    pin = readPin();
  } catch (err) {
    console.log(err instanceof Error ? err.message : String(err));
    return COULD_NOT_CHECK;
  }

  let bytes;
  try {
    const response = await fetch(pin.rawUrl, {
      headers: { accept: "text/plain" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      console.log(`Could not read ${pin.rawUrl}: the host answered ${response.status}.`);
      console.log("This is NOT a drift report. Nothing was compared.");
      return COULD_NOT_CHECK;
    }
    bytes = Buffer.from(await response.arrayBuffer());
  } catch (cause) {
    console.log(`Could not reach ${pin.rawUrl}.`);
    console.log(`  ${cause instanceof Error ? cause.message : String(cause)}`);
    console.log("This is NOT a drift report. Nothing was compared.");
    return COULD_NOT_CHECK;
  }

  const actual = { blob: gitBlobSha(bytes), sha256: sha256(bytes), bytes: String(bytes.length) };
  if (actual.blob === pin.blob && actual.sha256 === pin.sha256) {
    console.log(
      `attractor-spec.md unchanged at ${pin.sha256.slice(0, 12)}… ` +
        `(${actual.bytes} bytes, upstream ${pin.upstreamCommit.slice(0, 7)} of ${pin.movedOn}). ` +
        `${RESERVED_REL} last read against it on ${pin.verifiedOn}.`,
    );
    return UNCHANGED;
  }

  console.log("The Attractor specification has moved.");
  console.log("");
  console.log(`  source   ${pin.rawUrl}`);
  console.log(`  pinned   sha256 ${pin.sha256}`);
  console.log(`           blob   ${pin.blob}  (${pin.bytes} bytes)`);
  console.log(`  live     sha256 ${actual.sha256}`);
  console.log(`           blob   ${actual.blob}  (${actual.bytes} bytes)`);
  console.log("");
  reportNames(bytes.toString("utf8"), pin.source);
  console.log("");
  console.log(`RE-VERIFY ${RESERVED_REL}. It is a hand transcription of that document, and`);
  console.log("DarkPrint's whole Attractor compatibility claim rests on its three reserved sets");
  console.log("being complete: a name Attractor starts reading that DarkPrint already writes stops");
  console.log("being silently ignored and starts configuring somebody's run. Check the sets, the");
  console.log("Identifier rule, the keyword list and the boundary ids against the new document,");
  console.log("then update ATTRACTOR_SPEC_PIN's digests AND `verifiedOn` in the same change.");
  console.log("");
  console.log(`  git log --oneline ${pin.upstreamCommit}..main -- attractor-spec.md`);
  console.log("  https://github.com/strongdm/attractor/commits/main/attractor-spec.md");
  console.log("");
  console.log("Moving the digests without reading the diff is the removal of this check, not its");
  console.log("satisfaction.");
  return DRIFTED;
}

/**
 * Run only when this file IS the command, so the test can import the parsers above without
 * the module reaching the network on import. `realpathSync` on both sides because the
 * scripts in this repository are invoked through several spellings of the same path.
 */
function isEntryPoint() {
  const argv = process.argv[1];
  if (argv === undefined) return false;
  try {
    return realpathSync(argv) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) process.exitCode = await main();
