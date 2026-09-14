/* ============================================================
   DarkPrint backend — the stored vector, encoded locally
   A sentence-encoder embedding of a blueprint document or a card
   document (`reembed.ts` builds both), compared by cosine distance
   against the same encoder's reading of a reader's task. This is
   the one module where the word "semantic" describes what the
   vector is; nothing shipped to a caller uses it.

   ── The encoder is optional at runtime ──
   The weights are vendored in this repository under `models/`, so
   a bare checkout carries them. They are not vendored through npm:
   `@huggingface/transformers` carries no `.onnx` file, and with
   `allowRemoteModels = false` a fresh install throws rather than
   encoding. The directory can still be absent (a sparse checkout,
   a deployment that did not trace it) and the package can be
   absent wherever `node_modules` is not installed, so an absent
   encoder answers `undefined` rather than a throw: `reembedRelease`
   writes nothing and the searchers rank on lexical coverage alone.
   ============================================================ */

import { createMiniLm, type MiniLm } from "./minilm";

/**
 * The width. `vector(384)` is declared in the schema and pgvector refuses a row of any other
 * length; 384 is `all-MiniLM-L6-v2`'s output width.
 */
export const EMBEDDING_DIMENSIONS = 384;

/**
 * The cosine-similarity floor a candidate must clear to be a hit on the strength of its
 * vector alone. A candidate that also matches a query word lexically is a hit whatever its
 * similarity.
 *
 * MiniLM is trained on symmetric sentence pairs and this is a short task against a mean-pooled
 * document of several hundred words, so honest matches land in the 0.15 to 0.50 band and
 * strangers below 0.10. See `LEXICAL_BOOST` for the measurement both constants were read off.
 */
export const MIN_SIMILARITY = 0.15;

/**
 * How much a full lexical coverage is worth beside the similarity.
 *
 * `score = similarity + LEXICAL_BOOST * coverage`. At 0.15 a task that names every content
 * word of a blueprint gains about what a strong paraphrase gains in similarity, so an exact
 * title still wins and a paraphrase that names nothing is not shut out.
 *
 * Measured over the seeded archive (nine blueprints under two owners, 58 card versions),
 * encoded by the vendored quantised weights, against the author's own smoke set
 * (`npm run eval:rag -- scripts/rag-eval.smoke.json`), with `MIN_SIMILARITY = 0.15`:
 *
 *     blueprints  top-1 8/8, top-3 8/8; expected similarity 0.15 to 0.55, median 0.39
 *     negatives   2/2 quiet: a restaurant booking scores 0.03 on three lexical strays,
 *                 a unit conversion answers nothing
 *     cards       top-1 3/5, top-3 4/5; the miss sits at rank 6 with similarity 0.17
 *
 * The table is a consistency check rather than a proof: the queries are the author's own,
 * and the held-out set is written by someone who has not seen them. Re-run the smoke set
 * after changing either number or either document template.
 */
export const LEXICAL_BOOST = 0.15;

/** The most hits a ranked search answers. A bound on the response, not a judgement about rank 21. */
export const MAX_HITS = 20;

/**
 * The encoder, and the model directory it is provisioned into.
 *
 * The id is a DIRECTORY NAME under `MODEL_ROOT` and not a Hub repository path, because
 * `allowRemoteModels` is turned off below and nothing is ever resolved against a network host.
 */
const MODEL_ID = "all-MiniLM-L6-v2";
const MODEL_ROOT = "models";

/* `MODEL_DTYPE = "q8"` stood here and is gone with the library that read it. It named the
   precision so the pipeline would pick `model_quantized.onnx` over an fp32 default; the
   session is opened on that path by name now, so there is nothing left to select. */

/** The text the width is proved against at load. Any text reaches the same 384 columns. */
const WIDTH_PROBE = "dimension probe";

/**
 * The exact bytes this repository vendors, frozen.
 *
 * The calibration behind `MIN_SIMILARITY` and `LEXICAL_BOOST` is a measurement of these
 * bytes, and every number in it moves if the file does. The width probe cannot catch a swap:
 * `model.onnx` and `model_quantized.onnx` are both 384 wide. `derivation.test.ts` digests
 * the file and compares it here, so a bad merge or a re-quantise fails before it ships
 * rather than hashing 23MB on every cold start.
 */
const MODEL_SHA256 = "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1";
const MODEL_BYTES = 22_972_370;

/** The vendored weights, relative to the repository root. Exported so the pin has a subject. */
export const MODEL_FILE = `${MODEL_ROOT}/${MODEL_ID}/onnx/model_quantized.onnx`;

/** The frozen identity of `MODEL_FILE`, and the model half of `embeddedInput`'s stamp. */
export const MODEL_BLOB = Object.freeze({ sha256: MODEL_SHA256, bytes: MODEL_BYTES });

/** The shape this module uses. `createMiniLm` returns exactly it. */
type Encoder = MiniLm;

/**
 * Loaded at most once per process, absent or present.
 *
 * The PROMISE is memoised rather than the result, so concurrent callers share one load
 * instead of racing several ONNX sessions into memory. A failed load is memoised too:
 * absence is a missing directory on disk, which does not heal between two calls in one
 * process, and retrying would pay the failure on every publish and every query.
 */
let loading: Promise<Encoder | undefined> | undefined;

/** Why the last load answered "absent", for the health route. Message only, never a stack. */
let failure: string | undefined;

async function load(): Promise<Encoder | undefined> {
  let extract: Encoder;
  try {
    /* `createMiniLm` reads the vendored files and opens an ONNX session; it reaches no
       network by construction rather than by configuration, which is what the library it
       replaced needed three `env` flags to promise. `tests/server/t300/egress.test.ts`
       watches the socket layer either way. */
    extract = await createMiniLm(MODEL_ROOT, MODEL_ID);
  } catch (err) {
    /* `onnxruntime-node` is not installed, or the model directory is not provisioned: the
       same condition from a caller's point of view. Only the load is inside this block; the
       width probe below stays outside it, because an ABSENT encoder degrades and a WRONG
       one must not be able to masquerade as absent. The reason is kept for /api/health,
       because a deployment that silently ranks by words alone is the failure this module
       has already had once. */
    failure = err instanceof Error ? err.message : String(err);
    console.error(`darkprint: the sentence encoder did not load: ${failure}`);
    return undefined;
  }

  const probe = await extract(WIDTH_PROBE, { pooling: "mean", normalize: true });
  if (probe.data.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `The encoder in ${MODEL_ROOT}/${MODEL_ID} produced ${probe.data.length} dimensions, ` +
        `but \`release_embedding.embedding\` and \`card_version_embedding.embedding\` are ` +
        `\`vector(${EMBEDDING_DIMENSIONS})\` and pgvector refuses any other width. ` +
        `That directory holds a model this schema cannot store.`,
    );
  }
  return extract;
}

function encoder(): Promise<Encoder | undefined> {
  loading ??= load();
  return loading;
}

/**
 * The vector of a document, or `undefined` where no encoder is provisioned.
 *
 * Mean-pooled and L2-normalised, because the index is `vector_cosine_ops`: `<=>` over unit
 * vectors is exactly the cosine distance, and `1 - distance` is the similarity the ranking
 * reads. An empty text is an ordinary unit vector, not a special case.
 */
export async function embed(text: string): Promise<number[] | undefined> {
  const extract = await encoder();
  if (extract === undefined) return undefined;
  const output = await extract(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Whether this process can encode at all, without encoding anything.
 *
 * The first call pays the model load (about half a second warm, two seconds cold on a
 * laptop); every later call in the process answers from the memoised promise.
 */
export async function encoderAvailable(): Promise<boolean> {
  return (await encoder()) !== undefined;
}

/** The same answer, spelled the way `Results.encoder` reports it. */
export async function encoderState(): Promise<"present" | "absent"> {
  return (await encoderAvailable()) ? "present" : "absent";
}

/** The load error's message when the encoder is absent, `undefined` when it loaded. */
export async function encoderFailure(): Promise<string | undefined> {
  return (await encoderAvailable()) ? undefined : failure;
}
