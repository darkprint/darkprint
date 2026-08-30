/* ============================================================
   The Attractor drift guard, driven offline.

   `scripts/check-attractor-drift.mjs` is the one thing standing
   between "the formats ARE compatible" and a claim that was true
   in March: `lib/core/attractor/reserved.ts` is a hand
   transcription of a document in strongdm/attractor, nothing in
   this repository re-reads it, and the script is what notices when
   it moves.

   ── what is tested here and what is not ──
   The NETWORK half is not tested and must not be. No suite in this
   tree performs real outbound I/O (`tests/server/t300/egress.test.ts`
   is a standing guard on exactly that), and a cell that fetched
   GitHub would fail offline, in a sandbox, and during somebody
   else's outage. The fetch, the three exit codes and the printed
   report are exercised by running the script, which is what CI
   does every Monday.

   What IS tested is everything that decides WHAT the script says:
   the two digests, the Appendix A table parser, the reader that
   lifts the transcribed sets back out of `reserved.ts`, and the
   pin itself being present and readable in the form the script's
   regexes expect. Those are the parts that can be silently wrong.

   ── why the parser has a cell of its own ──
   Its first version bounded `### Edge Attributes` at the next
   `###` heading. That heading does not exist — Edge Attributes is
   the last subsection of Appendix A — so the section ran to the
   end of the document and swallowed Appendix B's shape table and
   Appendix C's status fields. The guard then reported `Mdiamond`,
   `box`, `notes` and eleven others as new edge attributes: a
   confident, specific, entirely wrong answer, on a spec nobody had
   changed. It survived reading and died on the first falsifying
   run, which is why the boundary is asserted here against a
   fixture shaped like the real appendix rather than described in a
   comment.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  ATTRACTOR_EDGE_ATTRIBUTES,
  ATTRACTOR_GRAPH_ATTRIBUTES,
  ATTRACTOR_NODE_ATTRIBUTES,
  ATTRACTOR_SPEC_PIN,
} from "@/lib/core/attractor/reserved";

import {
  appendixAttributes,
  gitBlobSha,
  pinMember,
  readPin,
  sha256,
  transcribed,
} from "./check-attractor-drift.mjs";

/**
 * The real transcription's own text.
 *
 * Read through `readPin`'s default rather than with `readFileSync` here, so this suite
 * binds the script's idea of where the file is. A cell that opened its own copy would keep
 * passing after the script started reading a path that does not exist.
 */
const PIN = readPin() as Record<string, string>;

/**
 * Appendix A as the real document shapes it: three tables under `###` headings, the last
 * of them followed by a `##` heading and more tables that are NOT attributes.
 *
 * The trailing sections are the whole point of the fixture. `## Appendix B` tabulates
 * shapes with the same `| \`name\` |` row shape, and `## Appendix C` tabulates status
 * fields, so a parser that does not stop at the `##` boundary reads both as edge
 * attributes. Reduced to the smallest document that reproduces that, so a red here names
 * the boundary rule rather than the spec.
 */
const APPENDIX_FIXTURE = [
  "## Appendix A: Complete Attribute Reference",
  "",
  "### Graph Attributes",
  "",
  "| Key    | Type   |",
  "|--------|--------|",
  "| `goal` | String |",
  "",
  "### Node Attributes",
  "",
  "| Key      | Type   |",
  "|----------|--------|",
  "| `prompt` | String |",
  "| `shape`  | String |",
  "",
  "### Edge Attributes",
  "",
  "| Key         | Type   |",
  "|-------------|--------|",
  "| `condition` | String |",
  "",
  "---",
  "",
  "## Appendix B: Shape-to-Handler-Type Mapping",
  "",
  "| Shape      | Handler Type |",
  "|------------|--------------|",
  "| `Mdiamond` | `start`      |",
  "| `box`      | `codergen`   |",
  "",
  "## Appendix C: Status File Contract",
  "",
  "| Field     | Type   |",
  "|-----------|--------|",
  "| `outcome` | String |",
  "| `notes`   | String |",
  "",
].join("\n");

describe("the two digests", () => {
  /* A known pair, taken from git itself: `printf 'hello' | git hash-object --stdin`. The
     git object id is not a bare sha1 of the content — the `blob <length>\0` header is part
     of what is hashed — so a plain `createHash("sha1")` answers something plausible,
     forty hex characters long, and wrong. Checked against a value git produced rather than
     against a shape. */
  it("hashes a blob the way git does", () => {
    expect(gitBlobSha(Buffer.from("hello", "utf8"))).toBe(
      "b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0",
    );
  });

  it("hashes content the way sha256sum does", () => {
    expect(sha256(Buffer.from("hello", "utf8"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  /* The premise both of the above rest on, and it fails outside them: the two functions
     must not answer the same thing. A single copy-paste in the module would give one
     algorithm two names, both cells above would still pass against their own literals, and
     the script would compare a sha1 against a sha256 pin forever. */
  it("gives one input two different answers", () => {
    const bytes = Buffer.from("hello", "utf8");
    expect(gitBlobSha(bytes)).not.toBe(sha256(bytes));
  });
});

describe("Appendix A's tables", () => {
  it("reads the three scopes", () => {
    const found = appendixAttributes(APPENDIX_FIXTURE) as Record<string, string[]>;
    expect(found.graph).toEqual(["goal"]);
    expect(found.node).toEqual(["prompt", "shape"]);
  });

  /* The regression, held as an exact equality rather than as an absence. `not.toContain`
     on one name would have passed against a parser that stopped one section too late but
     not two. */
  it("stops the edge table at the next heading, not at the next `###`", () => {
    const found = appendixAttributes(APPENDIX_FIXTURE) as Record<string, string[]>;
    expect(found.edge).toEqual(["condition"]);
  });

  /* A restructured document must be a finding rather than an empty result. `undefined` is
     what makes the script print "Appendix A could not be parsed"; an empty object would
     make it print "every attribute is already in the transcription", which is a claim
     about a table it never read. */
  it("answers undefined when the appendix is not in the shape it knows", () => {
    expect(appendixAttributes("# Attractor Specification\n\nNo appendix here.\n")).toBeUndefined();
    expect(
      appendixAttributes(APPENDIX_FIXTURE.replace("### Edge Attributes", "### Edge Config")),
    ).toBeUndefined();
  });

  /* And a heading with no rows under it, which is the other way a parse can succeed at
     finding nothing. */
  it("answers undefined when a table it found has no rows", () => {
    const empty = APPENDIX_FIXTURE.replace("| `condition` | String |", "");
    expect(appendixAttributes(empty)).toBeUndefined();
  });
});

describe("the transcribed sets, read back out of the source", () => {
  /* Read as TEXT and compared against the same module's own runtime export. This is the
     cell that keeps the drift report honest: the script never imports `reserved.ts` (it is
     a `.mjs` running against a bare checkout with no build step), so it lifts the three
     arrays out with a regex, and a regex that quietly stops matching would make every
     drift report say "already in the transcription" about a set it read as empty. */
  it.each([
    ["ATTRACTOR_GRAPH_ATTRIBUTES", ATTRACTOR_GRAPH_ATTRIBUTES],
    ["ATTRACTOR_NODE_ATTRIBUTES", ATTRACTOR_NODE_ATTRIBUTES],
    ["ATTRACTOR_EDGE_ATTRIBUTES", ATTRACTOR_EDGE_ATTRIBUTES],
  ])("%s matches the array the module exports", (constant, exported) => {
    expect(transcribed(PIN.source, constant)).toEqual([...exported]);
  });

  it("answers undefined for a constant that is not there", () => {
    expect(transcribed(PIN.source, "ATTRACTOR_NOT_A_SET")).toBeUndefined();
  });
});

describe("the pin", () => {
  /* The script reads these by regex out of a source file it never imports. So the shape is
     asserted from BOTH sides: the values the regex lifts have to equal the values the
     module exports. A cell on either alone passes while the two disagree, and the whole
     guard is the claim that they do not. */
  it.each(["rawUrl", "blob", "sha256", "bytes", "upstreamCommit", "movedOn", "verifiedOn"])(
    "`%s` is readable by the script and equal to what the module exports",
    (key) => {
      const declared = (ATTRACTOR_SPEC_PIN as unknown as Record<string, string>)[key];
      expect(declared, `ATTRACTOR_SPEC_PIN has no \`${key}\``).toBeTypeOf("string");
      expect(pinMember(PIN.source, key)).toBe(declared);
    },
  );

  it("names digests in the two forms the script compares", () => {
    expect(ATTRACTOR_SPEC_PIN.blob).toMatch(/^[0-9a-f]{40}$/);
    expect(ATTRACTOR_SPEC_PIN.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ATTRACTOR_SPEC_PIN.bytes).toMatch(/^\d+$/);
  });

  /* The URL is what the script fetches, so a typo in it turns every run into a
     "could not check" that reads like an outage. Held against the repository and the
     filename the header cites rather than as a whole-string equality, which would be this
     file restating the pin instead of checking it. */
  it("points at the file the transcription says it was copied from", () => {
    expect(ATTRACTOR_SPEC_PIN.rawUrl).toContain("strongdm/attractor");
    expect(ATTRACTOR_SPEC_PIN.rawUrl.endsWith("/attractor-spec.md")).toBe(true);
  });

  it("throws rather than guessing when a member is gone", () => {
    expect(() => pinMember("const X = { blob: 1 };", "blob")).toThrow(/no `blob`/);
  });

  /* An unpinned transcription is the state this whole guard exists to prevent, and it is
     reachable by deleting five lines. `readPin` refuses a source that does not declare the
     constant — the DECLARATION and not the name, because the docblock above it names the
     constant in prose and an `includes` on the bare name is satisfied by the explanation.
     Measured: renaming the export passed the first version of this check. */
  it("refuses a transcription with no pin at all", () => {
    expect(() => readPin("export const ATTRACTOR_GRAPH_ATTRIBUTES = [];\n")).toThrow(
      /no longer declares ATTRACTOR_SPEC_PIN/,
    );
    expect(() =>
      readPin(PIN.source.replace("export const ATTRACTOR_SPEC_PIN", "const OTHER_NAME")),
    ).toThrow(/no longer declares ATTRACTOR_SPEC_PIN/);
  });
});
