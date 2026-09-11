/* ============================================================
   T040 — the four published routes

       POST /api/validate/bundle    { dot, cardFiles, manifest, vocabulary?: string }
                                    -> 200 LoadBundleResult              | 400 413
       POST /api/validate/dot       { dot }     -> 200 { graph?, diagnostics }   | 400 413
       POST /api/validate/card      { source }  -> 200 { card?, diagnostics }    | 400 413
       POST /api/validate/ontology  { source }  -> 200 { terms?, diagnostics }   | 400 413

   ── why this file exists, and it is not a good reason ──
   Round 1 shipped 98 tests and **every one of them bound the
   module**: no `Response`, no `POST`, no status code anywhere under
   `tests/server/t040/**`. I named the gap in my own handback and
   offered to close it, and the round closed without it — so four
   paths, four request shapes and three status codes were held by
   the implementer's colocated file alone, which is exactly the
   arrangement this whole run exists to avoid. Six route mutations
   reddened zero blind tests and two were caught by nothing at all.

   ── the boundary, stated ──
   What the module already holds is not re-tested here. What is
   T040's at the ROUTE is the wire: which field of the body is read,
   what a malformed body gets, which status an over-limit submission
   gets, and whether the payload arrives unreshaped. Every test below
   is aimed at one of those and at nothing the module tests already
   cover.

   ── two rulings that constrain what may be asserted ──
   **D-40-20**: `Buffer.byteLength(JSON.stringify(input))` is
   normative as a NUMBER, not as a procedure, so a bounded
   short-circuiting walk is conforming. Nothing here pins how a size
   is computed — only which submissions are refused.
   **D-40-21**: `submissionOf` excludes `input.ontology`, and no
   route can set it, so every wire call gives the same number under
   either reading. There is nothing for a route test to distinguish
   and this file does not pretend otherwise.
   ============================================================ */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  LEAK_SENTINEL,
  LIMIT_PROBLEM_TYPE,
  PROBLEM_CONTENT_TYPE,
  ROUTES,
  ROUTE_NAMES,
  answerOf,
  asLoadBundleResult,
  bind,
  codesOf,
  errorsOf,
  okPayloadOf,
  problemOf,
  returning,
  routePatternFor,
  routeTable,
  type RouteName,
} from "./contract";
import {
  EIGHT_NODE_BUNDLE,
  LOCAL_TERM,
  NOT_A_CARD_YAML,
  UNPARSEABLE_LINE_2,
  UNROOTED_VOCABULARY_YAML,
  VOCABULARY_BUNDLE,
  caseFor,
} from "./fixtures";

const SHIPPED_VOCABULARY = "public/bundles/frontline-triage/ontology/extensions.yaml";

/** A well-formed body per published route, so every refusal case is one field away from valid. */
function validBody(name: RouteName): Record<string, unknown> {
  const { input } = caseFor(EIGHT_NODE_BUNDLE);
  switch (name) {
    case "bundle":
      return { dot: input.dot, cardFiles: input.cardFiles, manifest: input.manifest };
    case "dot":
      return { dot: input.dot };
    case "card":
      return { source: input.cardFiles[Object.keys(input.cardFiles).sort()[0]] };
    case "ontology":
      return { source: 'version: "0.1.0"\nterms: []\n' };
  }
}

/* ============================================================
   The table itself
   ============================================================ */

describe("the four published URLs are served", () => {
  for (const name of ROUTE_NAMES) {
    it(`${ROUTES[name].url} is matched by a route under app/api/validate/`, () => {
      expect(routePatternFor(ROUTES[name].path)).toBe(ROUTES[name].path);
    });
  }

  /* A floor rather than an exact set: an extra route is the implementation's business, a
     missing one is a failed criterion. Without it, a table that discovered nothing would let
     every `routePatternFor` above throw the same way a wrong path does. */
  it("discovers at least the four the contract publishes", () => {
    const patterns = routeTable().map((r) => r.pattern);
    for (const name of ROUTE_NAMES) expect(patterns).toContain(ROUTES[name].path);
  });
});

/* ============================================================
   200 — the payload, unreshaped
   ============================================================ */

describe("a well-formed submission answers 200 with the module's own payload", () => {
  /* **The route is a pass-through, and this is what says so.** Every property of the payload is
     already held against the module by the other eight files; asserting them again here would be
     eight files of duplication. What is only observable at the wire is whether the same bytes
     come back — a route that reshaped, renamed, pruned an absent optional to `null` or re-sorted
     the diagnostics would satisfy every module test and change what a caller receives. */
  it("bundle: byte-identical to validateBundle's answer for the same input", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(EIGHT_NODE_BUNDLE);

    const answer = await answerOf("bundle", validBody("bundle"));
    const payload = okPayloadOf(answer, ROUTES.bundle.url);

    const direct = returning(() => validateBundle(input), "validateBundle");
    expect(JSON.stringify(payload)).toBe(JSON.stringify(JSON.parse(JSON.stringify(direct))));
  });

  it("dot: the graph and the diagnostics, at 200", async () => {
    const answer = await answerOf("dot", validBody("dot"));
    const payload = okPayloadOf(answer, ROUTES.dot.url) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(["diagnostics", "graph"]);
    expect(payload.diagnostics).toEqual([]);
  });

  it("card: the card and the diagnostics, at 200", async () => {
    const answer = await answerOf("card", validBody("card"));
    const payload = okPayloadOf(answer, ROUTES.card.url) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(["card", "diagnostics"]);
    expect(errorsOf(payload.diagnostics as never)).toEqual([]);
  });

  it("ontology: the terms and the diagnostics, at 200", async () => {
    const answer = await answerOf("ontology", validBody("ontology"));
    const payload = okPayloadOf(answer, ROUTES.ontology.url) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(["diagnostics", "terms"]);
    expect(payload.diagnostics).toEqual([]);
  });

  /* B-03, at the transport. A bundle that resolves with errors is an ANSWER, and the status is
     what a caller's error handling branches on before it ever reads a body — so a route that
     mapped an error-severity diagnostic onto a 4xx would break the whole envelope while every
     module test stayed green. */
  it("answers 200 for a bundle whose DOT does not parse", async () => {
    const { input } = caseFor(EIGHT_NODE_BUNDLE);
    const answer = await answerOf("bundle", {
      dot: UNPARSEABLE_LINE_2,
      cardFiles: input.cardFiles,
      manifest: input.manifest,
    });

    const payload = asLoadBundleResult(
      okPayloadOf(answer, `${ROUTES.bundle.url} (unparseable dot)`),
      ROUTES.bundle.url,
    );
    expect(codesOf(payload.diagnostics)).toEqual(["dot/parse-error"]);
    expect(payload.blueprint).toBeUndefined();
  });

  it("answers 200 for a card document that is not a card", async () => {
    const answer = await answerOf("card", { source: NOT_A_CARD_YAML });
    const payload = okPayloadOf(answer, ROUTES.card.url) as Record<string, unknown>;

    expect(payload.card).toBeUndefined();
    expect(errorsOf(payload.diagnostics as never).length).toBeGreaterThan(0);
  });
});

/* ============================================================
   The bundle route parses `vocabulary`, which is the one argument
   the wire shape and the module signature do not share
   ============================================================ */

describe("POST /api/validate/bundle turns `vocabulary` source into `extensions`", () => {
  /* The upload flow sends `vocabulary?: **string**` and `validateBundle` takes
     `extensions?: readonly OntologyTerm[]`. The route is the only place that join happens, and
     it is the only part of D-40-02's ruling that no module test can reach.

     The oracle is the archive's own README, so this is the same discriminator AC1 uses, driven
     through the wire: dropping the parse moves the digest, the autonomy class, the security
     level and the diagnostic count all at once. */
  it("reproduces the build's figures when the vocabulary is sent", async () => {
    const { input, oracle } = caseFor(VOCABULARY_BUNDLE);
    const answer = await answerOf("bundle", {
      dot: input.dot,
      cardFiles: input.cardFiles,
      manifest: input.manifest,
      vocabulary: readFileSync(SHIPPED_VOCABULARY, "utf8"),
    });

    const payload = asLoadBundleResult(
      okPayloadOf(answer, `${ROUTES.bundle.url} (with vocabulary)`),
      ROUTES.bundle.url,
    );

    expect(errorsOf(payload.diagnostics)).toEqual([]);
    expect(payload.blueprint?.digest).toBe(oracle.digest);
    expect(payload.analysis?.autonomy.autonomyClass).toBe(oracle.autonomyClass);
    expect(payload.analysis?.security.level).toBe(oracle.securityLevel);
  });

  /* The other direction, so "the vocabulary is parsed" is held by a split rather than by one
     value. Without it, a route that ignores the field entirely satisfies nothing above and a
     route that always layers the archive's own extensions in satisfies everything above. */
  it("answers differently when the same bundle is sent without it", async () => {
    const { input, oracle } = caseFor(VOCABULARY_BUNDLE);
    const answer = await answerOf("bundle", {
      dot: input.dot,
      cardFiles: input.cardFiles,
      manifest: input.manifest,
    });

    const payload = asLoadBundleResult(
      okPayloadOf(answer, `${ROUTES.bundle.url} (no vocabulary)`),
      ROUTES.bundle.url,
    );

    const unknown = payload.diagnostics.filter((d) => d.code === "card/unknown-term");
    expect(unknown.length).toBeGreaterThan(0);
    expect(unknown[0].message).toContain(LOCAL_TERM);
    expect(payload.blueprint?.digest).not.toBe(oracle.digest);
  });

  /* A vocabulary that cannot be read is a defect in the SUBMISSION's content, not in the
     request — so it is a 200 carrying diagnostics, exactly like a card that will not parse.
     Answering 400 here would make one malformed document in a four-part upload discard the
     answer about the other three. */
  it("answers 200, not 400, when the vocabulary is well-formed YAML and not a vocabulary", async () => {
    const { input } = caseFor(EIGHT_NODE_BUNDLE);
    const answer = await answerOf("bundle", {
      dot: input.dot,
      cardFiles: input.cardFiles,
      manifest: input.manifest,
      vocabulary: UNROOTED_VOCABULARY_YAML,
    });

    expect(answer.status, `body: ${answer.body.slice(0, 300)}`).toBe(200);
  });
});

/* ============================================================
   Which field of the body is read
   ============================================================ */

describe("each route reads the field its published shape names", () => {
  /* A route reading `text` or `yaml` where the contract says `source` answers something for
     every request — a 400, or a diagnostic about an empty document — and the tests that only
     assert "a refusal came back" pass either way. So the discriminator is the POSITIVE case: a
     document the archive ships, sent under the published field name, must come back parsed.
     Nothing but reading the right field produces that. */
  it("card reads `source`", async () => {
    const answer = await answerOf("card", validBody("card"));
    const payload = okPayloadOf(answer, ROUTES.card.url) as Record<string, unknown>;
    expect(payload.card, "the archive's own card, sent as `source`, comes back parsed").toBeDefined();
  });

  it("ontology reads `source`", async () => {
    const answer = await answerOf("ontology", { source: readFileSync(SHIPPED_VOCABULARY, "utf8") });
    const payload = okPayloadOf(answer, ROUTES.ontology.url) as Record<string, unknown>;
    expect(payload.terms, "the archive's own vocabulary comes back as terms").toBeDefined();
    expect((payload.terms as unknown[]).length).toBeGreaterThan(0);
  });

  it("dot reads `dot`", async () => {
    const answer = await answerOf("dot", validBody("dot"));
    const payload = okPayloadOf(answer, ROUTES.dot.url) as Record<string, unknown>;
    expect(payload.graph, "an archive DOT sent as `dot` comes back as a graph").toBeDefined();
    expect(payload.diagnostics).toEqual([]);
  });

  /* The bundle route reads three fields, and a route that read two of them would answer a
     perfectly plausible result about a bundle nobody submitted. Each is dropped in turn from an
     otherwise valid body, so this is quantified over the shape rather than written per field. */
  for (const field of ["dot", "cardFiles", "manifest"] as const) {
    it(`bundle requires \`${field}\``, async () => {
      const body = validBody("bundle");
      delete body[field];
      const answer = await answerOf("bundle", body);
      expect(
        answer.status,
        `a submission missing \`${field}\` is not a submission; body: ${answer.body.slice(0, 200)}`,
      ).toBe(400);
    });
  }
});

/* ============================================================
   400 — a malformed request body
   ============================================================ */

/**
 * Bodies that are not a request, built by construction from the ways a body can be wrong rather
 * than from a list of cases someone thought of.
 *
 * `[]` appears three times deliberately: `typeof [] === "object"` and `[] !== null`, so the
 * obvious guard admits an array everywhere an object is required — at the body, at `cardFiles`
 * and at `manifest`. One of the six mutations this file was written against is exactly that.
 */
function malformedBodies(name: RouteName): [string, { raw?: string; body?: unknown }][] {
  const valid = validBody(name);
  const cases: [string, { raw?: string; body?: unknown }][] = [
    ["not JSON at all", { raw: "{ this is not json" }],
    ["an empty body", { raw: "" }],
    ["JSON null", { body: null }],
    ["a JSON array", { body: [valid] }],
    ["a JSON string", { body: "a body" }],
    ["a JSON number", { body: 7 }],
  ];
  if (name === "bundle") {
    cases.push(
      ["cardFiles as an array", { body: { ...valid, cardFiles: [] } }],
      ["cardFiles values that are not strings", { body: { ...valid, cardFiles: { "cards/a.yaml": 5 } } }],
      ["manifest as an array", { body: { ...valid, manifest: [] } }],
      ["dot as a number", { body: { ...valid, dot: 7 } }],
      ["vocabulary as an object", { body: { ...valid, vocabulary: { terms: [] } } }],
    );
  } else {
    const field = name === "dot" ? "dot" : "source";
    cases.push(
      [`${field} as a number`, { body: { [field]: 7 } }],
      [`${field} as an array`, { body: { [field]: [] } }],
      [`${field} absent`, { body: {} }],
      [`${field} as null`, { body: { [field]: null } }],
    );
  }
  return cases;
}

describe("a malformed request body is 400 and a problem document", () => {
  for (const name of ROUTE_NAMES) {
    it(`${ROUTES[name].url} refuses every shape of bad body with 400`, async () => {
      const wrong: string[] = [];
      for (const [label, spec] of malformedBodies(name)) {
        const answer = await answerOf(name, spec.body, { raw: spec.raw });
        if (answer.status !== 400) {
          wrong.push(`${label}: ${answer.status} ${answer.body.slice(0, 160)}`);
        }
      }
      expect(
        wrong,
        `B-03: "transport and auth failures use RFC 9457 problem+json", and the published block ` +
          `makes a malformed request body a 400. A 200 here means the route validated nothing ` +
          `and answered about a submission nobody sent; a 413 means a catch-all is mapping every ` +
          `throw onto the limit refusal, which is a different failure wearing its status.`,
      ).toEqual([]);
    });

    /* A set that can only be empty is not a measurement: if `malformedBodies` ever returned
       nothing, the assertion above would pass over it and report the property as held. */
    it(`${ROUTES[name].url} has bad-body cases to refuse`, () => {
      expect(malformedBodies(name).length).toBeGreaterThanOrEqual(10);
    });
  }

  it("the 400 carries all five RFC 9457 members and its own instance", async () => {
    const answer = await answerOf("dot", undefined, { raw: "{ not json" });
    problemOf(answer, { status: 400, path: ROUTES.dot.path }, `${ROUTES.dot.url} (bad body)`);
  });

  /* The two refusals are two problems, and a caller branching on `type` needs them to differ.
     Asserted as a comparison rather than by pinning the 400's URI, because the block publishes
     the 413's URI and not the 400's — pinning an unpublished one would be invented wording. */
  it("a 400 and a 413 do not share a problem type", async () => {
    const badBody = await answerOf("bundle", undefined, { raw: "{ not json" });
    const bad = problemOf(badBody, { status: 400, path: ROUTES.bundle.path }, "400");

    const over = await oversizedAnswer();
    const limit = problemOf(
      over,
      { status: 413, type: LIMIT_PROBLEM_TYPE, path: ROUTES.bundle.path },
      "413",
    );

    expect(bad.type).not.toBe(limit.type);
  });
});

/* ============================================================
   413 — an over-limit submission
   ============================================================ */

/**
 * A submission large enough to breach whatever `DEFAULT_ENGINE_LIMITS` is, without pinning it.
 *
 * The route takes no `limits` — nothing on the wire can set one — so the only way to reach the
 * refusal is to exceed the default, and the only honest way to do that is to be far past any
 * plausible value. The card count is the cheapest axis: `DEFAULT_ENGINE_LIMITS.maxCards` clears
 * the archive's 9, and 5000 cards is past anything a limit chosen for that could be.
 *
 * The sentinel goes in every field a careless refusal could quote.
 */
async function oversizedAnswer() {
  const cardFiles: Record<string, string> = {};
  for (let i = 0; i < 5000; i += 1) {
    cardFiles[`cards/${LEAK_SENTINEL}-${i}@1.0.0.yaml`] = `id: ${LEAK_SENTINEL}-${i}\n`;
  }
  return answerOf("bundle", {
    dot: `digraph g {\n  // ${LEAK_SENTINEL}\n  a -> b;\n}\n`,
    cardFiles,
    manifest: {
      slug: LEAK_SENTINEL,
      title: LEAK_SENTINEL,
      summary: LEAK_SENTINEL,
      tags: [LEAK_SENTINEL],
      ontologyVersion: "0.1.0",
    },
  });
}

describe("an over-limit submission is 413, with the published problem type", () => {
  it("answers 413 rather than 400, and names the limit-exceeded type", async () => {
    const answer = await oversizedAnswer();

    const p = problemOf(
      answer,
      { status: 413, type: LIMIT_PROBLEM_TYPE, path: ROUTES.bundle.path },
      `${ROUTES.bundle.url} (over limit)`,
    );

    /* `detail` is the one member with room in it for the module's own admissible message. The
       wording is the module's and is pinned there; what is checked at the wire is that nothing
       of the submission travels with it. Asserted over the WHOLE response text rather than over
       `detail` alone, because a problem document may carry extension members (RFC 9457 §3.2)
       and a leak into one of those is the same leak. */
    expect(
      answer.body.includes(LEAK_SENTINEL),
      `an oversized submission's own bytes are the last thing a refusal about size should carry; ` +
        `body: ${answer.body.slice(0, 300)}`,
    ).toBe(false);
    expect(String(p.detail)).toMatch(/exceeds the limit of \d+ /);
  });

  it("serves the 413 as problem+json", async () => {
    const answer = await oversizedAnswer();
    expect(answer.contentType).toContain(PROBLEM_CONTENT_TYPE);
  });
});

/* ============================================================
   A throw that is not a limit is not a 413
   ============================================================ */

describe("only a limit refusal becomes a 413", () => {
  /* **A wrapper that catches every throw and answers 413 is UNREACHABLE against a route that
     validates its body, and that was measured rather than assumed.** Replacing the
     `instanceof LimitExceededError` branch with a catch-all in a correct reference reds
     nothing in this file — because a body that fails a shape check is REFUSED BY RETURN, not by
     a throw, so nothing but a limit ever reaches the catch, and `lib/core`'s `loadBundle` is
     documented "Never throws". So it is an equivalent mutant *given a conforming route*, and it
     becomes a real defect only in combination with a route that does not validate — which is
     the half held directly, by five separate mutations: `cardFiles` as an array, `cardFiles`
     values unchecked, `manifest` not required, and either sibling reading the wrong field. The
     nearest case a request can actually exercise is the malformed-and-oversized one above.

     The assertions below are the reachable half, quantified over all four routes and every
     malformed shape: a catch-all installed on one route and not the others is the same defect
     on a smaller surface. */
  it("no malformed body anywhere answers 413", async () => {
    const wrong: string[] = [];
    for (const name of ROUTE_NAMES) {
      for (const [label, spec] of malformedBodies(name)) {
        const answer = await answerOf(name, spec.body, { raw: spec.raw });
        if (answer.status === 413) {
          wrong.push(`${ROUTES[name].url} / ${label}`);
        }
      }
    }
    expect(
      wrong,
      `413 says "the submission is too large". A route answering it for a body that is not JSON ` +
        `is telling a caller to send less of something it never managed to read, and the caller ` +
        `cannot tell that from a real limit refusal.`,
    ).toEqual([]);
  });

  /* **A body that is BOTH malformed and oversized is 400, not 413.** The two refusals have an
     order, and this is the only case that shows it: a route that validated nothing and left the
     module to throw answers 413 for this submission, because the card count breaches before
     anything looks at the manifest. A route that validates first answers 400.

     It is here because the "swallows every throw" mutation is otherwise **unreachable** — see
     the note on that describe block. This reaches the half of the risk that a request can
     actually exercise. */
  it("refuses a body that is malformed AND oversized with 400", async () => {
    const cardFiles: Record<string, string> = {};
    for (let i = 0; i < 5000; i += 1) cardFiles[`cards/x-${i}@1.0.0.yaml`] = `id: x-${i}\n`;

    const answer = await answerOf("bundle", {
      dot: "digraph g {\n  a -> b;\n}\n",
      cardFiles,
      manifest: [],
    });

    expect(
      answer.status,
      `the submission is over any plausible card limit AND its manifest is an array. 400 says ` +
        `the request was never a request; 413 says it was read and measured, which it was not. ` +
        `body: ${answer.body.slice(0, 200)}`,
    ).toBe(400);
  });

  /* And the whole status surface is closed: three codes are published and a fourth means
     something reached the transport that nobody designed for. A 500 here is the shape where a
     wrapper stopped catching rather than caught too much — the opposite mutation, and the one
     the assertion above cannot see. */
  it("answers only 200, 400 or 413 across every case in this file", async () => {
    const seen = new Map<number, number>();
    for (const name of ROUTE_NAMES) {
      const good = await answerOf(name, validBody(name));
      seen.set(good.status, (seen.get(good.status) ?? 0) + 1);
      for (const [, spec] of malformedBodies(name)) {
        const answer = await answerOf(name, spec.body, { raw: spec.raw });
        seen.set(answer.status, (seen.get(answer.status) ?? 0) + 1);
      }
    }
    const over = await oversizedAnswer();
    seen.set(over.status, (seen.get(over.status) ?? 0) + 1);

    expect([...seen.keys()].sort((a, b) => a - b)).toEqual([200, 400, 413]);
  });
});
