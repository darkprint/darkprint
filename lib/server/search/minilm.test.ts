/* ============================================================
   The encoder's output, pinned.

   ── the gap this closes ──
   `embeddedInput()` stamps every stored vector with the sha256 of
   `MODEL_FILE`, so a swapped model invalidates the corpus loudly.
   Nothing stamps THIS CODE. A tokenizer edit — an accent rule
   inverted, a punctuation class widened, `[CLS]` dropped — changes
   every query vector while leaving all 136 stored stamps valid, and
   the corpus silently stops matching queries that used to hit. The
   symptom is a ranking that gets worse, which is precisely the
   failure this repository has already shipped once.

   So the vectors are golden values. They were taken from the
   implementation on the day it replaced `@huggingface/transformers`,
   against which it measured cosine 1.000000 on every probe below.

   The probes are chosen to cover the normaliser's decisions rather
   than to be representative text: an accented word (`strip_accents`
   is null in `tokenizer.json`, which means "follow lowercase", and
   reading it as "do not strip" is the likeliest silent break), an em
   dash and a comma (punctuation is split into its own tokens), CJK
   (padded with spaces), and the empty string (which is not a special
   case — it is `[CLS] [SEP]` and yields an ordinary unit vector).
   ============================================================ */

import { describe, expect, it } from "vitest";

import { EMBEDDING_DIMENSIONS } from "./embed";
import { createMiniLm, normalizeText, preTokenize } from "./minilm";

const MODEL_ROOT = "models";
const MODEL_ID = "all-MiniLM-L6-v2";

/** Four decimal places: enough to catch a tokenizer change, loose enough for float drift. */
const PLACES = 4;

const GOLDEN = [
  { text: "dimension probe", head: [-0.038015, -0.024963, 0.018238, 0.03821], sum: 0.610527 },
  { text: "merge gate", head: [0.00952, -0.03015, -0.078671, -0.011265], sum: 0.372971 },
  { text: "", head: [-0.09369, 0.037654, 0.005246, 0.00088], sum: 0.686064 },
  {
    text: "café naïve RÉSUMÉ — punctuation, 日本語",
    head: [-0.044215, 0.031614, 0.091642, -0.005872],
    sum: 0.116046,
  },
];

describe("the normaliser's decisions, which a golden vector can only fail as a whole", () => {
  it("strips accents, because `strip_accents: null` follows `lowercase`", () => {
    expect(normalizeText("Café NAÏVE RÉSUMÉ")).toBe("cafe naive resume");
  });

  it("pads CJK so each character is its own word", () => {
    expect(preTokenize(normalizeText("a日本b"))).toEqual(["a", "日", "本", "b"]);
  });

  it("cuts punctuation into its own tokens, symbols included", () => {
    expect(preTokenize(normalizeText("merge-gate, now!"))).toEqual([
      "merge", "-", "gate", ",", "now", "!",
    ]);
  });

  it("drops control characters and folds every whitespace run", () => {
    /* `\u0000` escaped rather than written raw: `tests/no-raw-control-bytes.test.ts` refuses a
       NUL in source, and it caught this line. */
    expect(preTokenize(normalizeText("a\u0000b\t\n  c"))).toEqual(["ab", "c"]);
  });
});

describe("the encoder answers the vectors the stored corpus was built against", () => {
  it.each(GOLDEN)("$text", async ({ text, head, sum }) => {
    const encode = await createMiniLm(MODEL_ROOT, MODEL_ID);
    const { data } = await encode(text, { pooling: "mean", normalize: true });
    const vector = Array.from(data);

    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
    for (const [i, expected] of head.entries()) {
      expect(vector[i], `component ${i} of ${JSON.stringify(text)}`).toBeCloseTo(expected, PLACES);
    }
    /* The sum is the cheap whole-vector check: the four components above would survive a
       change that only moved the tail, and 136 stored vectors depend on the whole of it. */
    expect(vector.reduce((total, value) => total + value, 0)).toBeCloseTo(sum, PLACES);
  });

  it("returns a unit vector, which is what `vector_cosine_ops` is indexed for", async () => {
    const encode = await createMiniLm(MODEL_ROOT, MODEL_ID);
    const { data } = await encode("a unit vector", { pooling: "mean", normalize: true });
    const norm = Math.sqrt(Array.from(data).reduce((total, value) => total + value * value, 0));
    expect(norm).toBeCloseTo(1, 6);
  });
});
