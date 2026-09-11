import { describe, expect, it } from "vitest";

import { formatForFilename, parseDocument, type CardFormat } from "./parse";

const MINIMAL_YAML = `id: solver-a
name: Solver A
type: agent
version: 1.0.0
action: Draft a candidate solution for the sub-task
inputs:
  - { name: task, type: text }
outputs:
  - { name: draft, type: json }
`;

const MINIMAL_OBJECT = {
  id: "solver-a",
  name: "Solver A",
  type: "agent",
  version: "1.0.0",
  action: "Draft a candidate solution for the sub-task",
  inputs: [{ name: "task", type: "text" }],
  outputs: [{ name: "draft", type: "json" }],
};

describe("formatForFilename", () => {
  it.each<[string, CardFormat]>([
    ["cards/solver-a@1.0.0.json", "json"],
    ["SOLVER.JSON", "json"],
    ["  solver.json  ", "json"],
    [".json", "json"],
    ["cards/solver-a@1.0.0.yaml", "yaml"],
    ["solver.yml", "yaml"],
    ["solver.YAML", "yaml"],
    ["solver", "yaml"],
    ["", "yaml"],
    ["notes.json.bak", "yaml"],
    ["json", "yaml"],
    ["a/b.json/c.yaml", "yaml"],
  ])("%s -> %s", (filename, expected) => {
    expect(formatForFilename(filename)).toBe(expected);
  });
});

describe("parseDocument — YAML happy paths", () => {
  it("parses the minimal card of §4", () => {
    const result = parseDocument(MINIMAL_YAML, "yaml");
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toEqual(MINIMAL_OBJECT);
  });

  it("keeps nested structures and scalar types intact", () => {
    const result = parseDocument(
      `params:
  retries: 3
  temperature: 0.2
  enabled: true
  missing: null
  backoff:
    kind: exponential
    steps: [1, 2, 4]
`,
      "yaml",
    );
    expect(result.value).toEqual({
      params: {
        retries: 3,
        temperature: 0.2,
        enabled: true,
        missing: null,
        backoff: { kind: "exponential", steps: [1, 2, 4] },
      },
    });
  });

  it("returns a non-mapping document verbatim — shape is validate.ts's problem", () => {
    expect(parseDocument("- a\n- b\n", "yaml").value).toEqual(["a", "b"]);
    expect(parseDocument("just a string\n", "yaml").value).toBe("just a string");
  });
});

describe("parseDocument — YAML failures", () => {
  it("reports a real syntax error with 1-based line and column", () => {
    const result = parseDocument("id: a\n\tname: b\n", "yaml", "cards/a.yaml");
    expect(result.value).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    const [d] = result.diagnostics;
    expect(d.code).toBe("card/parse-error");
    expect(d.severity).toBe("error");
    expect(d.location).toEqual({ file: "cards/a.yaml", line: 2, column: 1 });
  });

  it("points at the right line for an unterminated flow sequence", () => {
    const result = parseDocument("id: solver-a\nname: [unclosed\ntype: agent\n", "yaml");
    expect(result.value).toBeUndefined();
    expect(result.diagnostics[0].location).toEqual({ line: 3, column: 1 });
  });

  it("rejects duplicate keys — a card that says two things about one field", () => {
    const result = parseDocument("id: a\nid: b\n", "yaml");
    expect(result.value).toBeUndefined();
    expect(result.diagnostics[0].message).toBe("Map keys must be unique.");
  });

  it("rejects a multi-document stream", () => {
    const result = parseDocument("id: a\n---\nid: b\n", "yaml");
    expect(result.value).toBeUndefined();
    expect(result.diagnostics[0].code).toBe("card/parse-error");
  });

  it("keeps the message a single sentence with no embedded source excerpt", () => {
    const result = parseDocument("id: a\n\tname: b\n", "yaml");
    const message = result.diagnostics[0].message;
    expect(message).toBe("Tabs are not allowed as indentation.");
    expect(message).not.toContain("\n");
    expect(message).not.toContain("at line");
  });
});

describe("parseDocument — YAML warnings", () => {
  it("surfaces a warning without losing the value", () => {
    const result = parseDocument("%YAML 1.3\n---\nid: a\n", "yaml");
    expect(result.value).toEqual({ id: "a" });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toEqual({
      code: "card/parse-error",
      severity: "warning",
      message: "Unsupported YAML version 1.3.",
      location: { line: 1, column: 7 },
    });
  });
});

describe("parseDocument — JSON", () => {
  it("parses a well-formed document", () => {
    const result = parseDocument(JSON.stringify(MINIMAL_OBJECT), "json");
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toEqual(MINIMAL_OBJECT);
  });

  it("recovers line and column from the engine's position", () => {
    const result = parseDocument('{\n  "id": "a",\n  "name" "b"\n}\n', "json", "cards/a.json");
    expect(result.value).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    const location = result.diagnostics[0].location;
    expect(location?.file).toBe("cards/a.json");
    expect(location?.line).toBe(3);
    expect(location?.column).toBeGreaterThan(1);
  });

  it("puts a first-line error on line 1", () => {
    const result = parseDocument('{"a" 1}', "json");
    expect(result.diagnostics[0].location).toEqual({ line: 1, column: 6 });
  });

  it("degrades to a file-only location when the engine gives no position", () => {
    const result = parseDocument("[1,2,", "json", "cards/a.json");
    expect(result.value).toBeUndefined();
    expect(result.diagnostics[0].location).toEqual({ file: "cards/a.json" });
  });

  it("keeps the message on one line", () => {
    const result = parseDocument('{\n  "a": 1,\n  "b": \n}\n', "json");
    expect(result.diagnostics[0].message).not.toContain("\n");
    expect(result.diagnostics[0].message.endsWith(".")).toBe(true);
  });

  it("accepts a bare JSON scalar — shape is validate.ts's problem", () => {
    expect(parseDocument("42", "json").value).toBe(42);
    expect(parseDocument("null", "json").value).toBeNull();
  });
});

describe("parseDocument — the empty document", () => {
  it.each<[string, CardFormat]>([
    ["yaml empty", "yaml"],
    ["json empty", "json"],
  ])("%s", (_label, format) => {
    const result = parseDocument("", format, "cards/a.yaml");
    expect(result.value).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("card/parse-error");
    expect(result.diagnostics[0].message).toBe("The document is empty.");
    expect(result.diagnostics[0].location).toEqual({ file: "cards/a.yaml", line: 1, column: 1 });
  });

  it("treats whitespace and comments-only alike for YAML", () => {
    expect(parseDocument("   \n\t\n", "yaml").value).toBeUndefined();
  });
});

describe("parseDocument — locations omit what they do not know", () => {
  it("leaves `file` out entirely when none was given", () => {
    const result = parseDocument("", "yaml");
    expect(result.diagnostics[0].location).toEqual({ line: 1, column: 1 });
    expect(Object.keys(result.diagnostics[0].location ?? {})).toEqual(["line", "column"]);
  });
});

describe("parseDocument never throws", () => {
  const hostile: string[] = [
    "",
    "   ",
    "\u0000",
    "{",
    "}",
    "[",
    "]",
    ":",
    "- - - -",
    "a: *missing",
    "&a [*a]",
    "!!binary |\n  not base64 at all",
    "a:\n b:\n  c:\n   d: [",
    '"unterminated',
    "\t\t\t",
    "key: |\n  value\n\tbad",
    "@invalid",
    "%TAG",
  ];

  it.each(hostile)("survives %j as YAML", (src) => {
    const result = parseDocument(src, "yaml", "cards/a.yaml");
    expect(Array.isArray(result.diagnostics)).toBe(true);
    for (const d of result.diagnostics) expect(d.code).toBe("card/parse-error");
  });

  it.each(hostile)("survives %j as JSON", (src) => {
    const result = parseDocument(src, "json", "cards/a.json");
    expect(Array.isArray(result.diagnostics)).toBe(true);
    for (const d of result.diagnostics) expect(d.code).toBe("card/parse-error");
  });

  it("survives a document that is only comments", () => {
    const result = parseDocument("# nothing here\n", "yaml");
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toBeNull();
  });
});
