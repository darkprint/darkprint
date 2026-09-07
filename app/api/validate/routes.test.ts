/* ============================================================
   The four /api/validate handlers, driven as handlers.

   Collected because `vitest.config.ts` carries an `app/**` glob —
   added at T090 after that task reported its absence, and checked
   here rather than assumed, since an uncollected suite runs zero
   tests and reads as green.

   What this holds that `engine.test.ts` cannot: every status code
   in the published route block. 400 and 413 exist only at the
   transport layer, so a module-level suite can assert the refusal
   and not the response — and B-03's whole point is which of the
   three a given failure gets.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { POST as postBundle } from "./bundle/route";
import { POST as postCard } from "./card/route";
import { POST as postDot } from "./dot/route";
import { POST as postOntology } from "./ontology/route";

const ARCHIVE = readContent();

function post(body: unknown, url = "http://localhost/api/validate/bundle"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/validate/bundle", () => {
  it("answers 200 with the analysis for an archive bundle", async () => {
    const loaded = ARCHIVE[0];
    const response = await postBundle(
      post({
        manifest: loaded.bundle.manifest,
        dot: loaded.bundle.dot,
        cardFiles: loaded.bundle.cardFiles,
        vocabulary: contentVocabulary()?.text,
      }),
    );
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      analysis?: { autonomy: { autonomyClass: string }; security: { level: number } };
      diagnostics: { code: string }[];
    };
    expect(payload.analysis?.autonomy.autonomyClass).toBe(loaded.analysis.autonomy.autonomyClass);
    expect(payload.analysis?.security.level).toBe(loaded.analysis.security.level);
    expect(payload.diagnostics.map((d) => d.code)).toEqual(loaded.diagnostics.map((d) => d.code));
  });

  /**
   * The route's one piece of real work: `vocabulary` arrives as YAML source and the module
   * takes parsed terms. Asserted by outcome rather than by inspection — withholding the
   * document has to change the answer, or the joining is not happening.
   */
  it("parses the vocabulary source into the terms the bundle resolves against", async () => {
    const vocabulary = contentVocabulary();
    expect(vocabulary).toBeDefined();

    const loaded = ARCHIVE.find((b) =>
      b.bundle.dot.includes("lupo/") || JSON.stringify(b.bundle.cardFiles).includes("lupo/"),
    );
    expect(loaded, "no archive bundle uses a local term; this test would be vacuous")
      .toBeDefined();
    if (loaded === undefined || vocabulary === undefined) return;

    const shape = {
      manifest: loaded.bundle.manifest,
      dot: loaded.bundle.dot,
      cardFiles: loaded.bundle.cardFiles,
    };
    const withVocabulary = await (
      await postBundle(post({ ...shape, vocabulary: vocabulary.text }))
    ).json();
    const without = await (await postBundle(post(shape))).json();

    expect(JSON.stringify(withVocabulary)).not.toBe(JSON.stringify(without));
  });

  it("refuses a body that is not JSON with 400 problem+json", async () => {
    const request = new Request("http://localhost/api/validate/bundle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    const response = await postBundle(request);
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/problem+json");

    const problem = (await response.json()) as { type: string; instance: string };
    expect(problem.type).toBe("https://darkprint.io/problems/bad-request");
    expect(problem.instance).toBe("/api/validate/bundle");
  });

  it("refuses a missing dot with 400, naming the field and not its value", async () => {
    const response = await postBundle(post({ cardFiles: {}, manifest: {} }));
    expect(response.status).toBe(400);
    const problem = (await response.json()) as { detail: string };
    expect(problem.detail).toBe("`dot` must be a string.");
  });

  it("refuses an over-limit submission with 413 and the limit-exceeded type", async () => {
    /* The default `maxBytes` is the bound being tested, so the body has to actually exceed
       it. Built from a repeated literal rather than from any archive content. */
    const oversized = "x".repeat(2 * 1024 * 1024 + 1);
    const response = await postBundle(
      post({
        manifest: { slug: "p", title: "P", summary: "s", tags: [], ontologyVersion: "0.1.0" },
        dot: oversized,
        cardFiles: {},
      }),
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("content-type")).toBe("application/problem+json");

    const problem = (await response.json()) as { type: string; detail: string };
    expect(problem.type).toBe("https://darkprint.io/problems/limit-exceeded");
    expect(problem.detail).toBe(
      "validateBundle: the submission exceeds the limit of 2097152 bytes.",
    );
    /* The refusal must not carry the submission back. An oversized submission's own bytes
       are the last thing a refusal about size should hold. */
    expect(problem.detail).not.toContain("xxxx");
  });
});

describe("the three sibling routes", () => {
  it("returns the parsed graph beside the diagnostics", async () => {
    const response = await postDot(
      post({ dot: "digraph g { a -> b }" }, "http://localhost/api/validate/dot"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { graph?: { nodes: unknown[] }; diagnostics: [] };
    /* The reason the module returns `DotGraph` and not `lib/core`'s `Graph`: this is the
       assertion that would be impossible against `Graph`, whose members are methods and
       which serialises to `{}`. */
    expect(payload.graph?.nodes.length).toBe(2);
  });

  it("keeps a DOT parse failure at 200 with line and column", async () => {
    const response = await postDot(
      post({ dot: "digraph {{{ ->->" }, "http://localhost/api/validate/dot"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      graph?: unknown;
      diagnostics: { code: string; location?: { line?: number; column?: number } }[];
    };
    expect(payload.graph).toBeUndefined();
    const parseError = payload.diagnostics.find((d) => d.code === "dot/parse-error");
    expect(parseError?.location?.line).toBeTypeOf("number");
    expect(parseError?.location?.column).toBeTypeOf("number");
  });

  it("returns the card beside the diagnostics", async () => {
    const source = ARCHIVE[0].cardFiles[0]?.text;
    expect(source, "the archive bundle carries no card file").toBeDefined();

    const response = await postCard(
      post({ source }, "http://localhost/api/validate/card"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { card?: { id: string }; diagnostics: [] };
    expect(payload.card?.id).toBeTypeOf("string");
  });

  it("returns the terms beside the diagnostics", async () => {
    const vocabulary = contentVocabulary();
    expect(vocabulary).toBeDefined();
    if (vocabulary === undefined) return;

    const response = await postOntology(
      post({ source: vocabulary.text }, "http://localhost/api/validate/ontology"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { terms?: { id: string }[]; diagnostics: [] };
    expect(payload.terms?.map((t) => t.id)).toEqual(vocabulary.terms.map((t) => t.id));
  });

  it("names `source` rather than `text` in its refusal, which is the contract's field", async () => {
    /* The frontend mock sent `{ text }` to these two routes and the contract publishes
       `{ source }`. The contract wins, but a one-word difference reds a correct
       implementation, so it is asserted here rather than left to a reader to notice. */
    const response = await postCard(
      post({ text: "id: a" }, "http://localhost/api/validate/card"),
    );
    expect(response.status).toBe(400);
    const problem = (await response.json()) as { detail: string };
    expect(problem.detail).toBe("`source` must be a string.");
  });
});
