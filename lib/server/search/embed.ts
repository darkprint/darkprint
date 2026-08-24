/* ============================================================
   DarkPrint backend — the stored vector, encoded locally
   D-300-01, the owner's ruling, replacing D-200-01's provider
   clause and D-200-11's 3-gram derivation. The vector is now a
   SEMANTIC one — a sentence-encoder embedding of the document's
   purpose — and this module is the one place in the repository
   where that word is both true and permitted (D-200-34: say it
   only where the vector channel is what is being described).

   ── What the word buys, and what it does not ──
   It buys RECALL: a query sharing no literal token with a stored
   purpose can now reach it, which is AC1 and which the 3-gram
   derivation provably could not do. It does NOT buy RANK. A cosine
   similarity is still not explainable from the archive, so the
   honesty model is unchanged: lexical hits keep their rank and
   their `field:token` evidence, and a hit that only the vector
   channel found joins the TAIL carrying `similar:purpose`, which
   names the channel rather than asserting a score (D-300-04 D5).

   ── The encoder is OPTIONAL AT RUNTIME, and that is structural ──
   D-300-05. The weights are not vendored through npm — measured,
   not assumed: `@huggingface/transformers` is 9.5MB and carries no
   `.onnx` file at all, and with `allowRemoteModels = false` on a
   fresh install it throws rather than encoding. So the model
   directory is provisioned as an explicit operator step, and this
   module has to answer for the machine where it is absent.

   It answers with `undefined` rather than a throw, for `errors.ts`'s
   own convention: an absent encoder is a VALUE. `reembedRelease`
   then writes nothing and the searchers stay purely lexical, so a
   machine with no model directory serves exactly what it served
   before this task — narrower, never broken.
   ============================================================ */

/**
 * The width, and it is not this module's to choose (D-200-02).
 *
 * `vector(384)` is declared in `0003_search.up.sql` and pgvector refuses a row of any other
 * length. 384 is `all-MiniLM-L6-v2`'s output width, which is why D-300-01 could rule the
 * encoder a DROP-IN: the column was chosen at T200 for exactly this day, so the reversal
 * costs no migration and rewrites no row.
 */
export const EMBEDDING_DIMENSIONS = 384;

/**
 * The evidence a semantic-only hit carries, as a CONSTANT rather than a rendering
 * (D-300-04 D5).
 *
 * `purpose` names WHAT was compared — the document that D-300-01 pins as the subject of the
 * embedding — and the marker deliberately carries NO NUMBER. A score in the marker would
 * ship the unpublished relevance figure SEAM-88 refuses, inside the one field whose whole
 * contract is that a caller can check it; and it would make every hit's evidence unique,
 * which turns D-200-20's contiguity property vacuous by making every block a singleton.
 *
 * It satisfies both merged guards, checked against them rather than by eye: it matches
 * T200's `EVIDENCE_GRAMMAR` (`/^[A-Za-z][A-Za-z0-9_.-]*:.+$/`) and it does not match
 * `FORBIDDEN_WORD` (`/semantic/i`), which `similar:` was chosen over `semantic:` to avoid.
 */
export const SIMILAR_EVIDENCE = "similar:purpose";

/**
 * How many candidates the vector channel may contribute, before the cutoff.
 *
 * A bound rather than a judgement: the tail is disclosed, marked and ranked behind every
 * lexical hit, but it is still rows a caller did not ask for by name, and an unbounded
 * channel would let a vague query return the whole registry wearing a marker.
 */
export const SEMANTIC_K = 10;

/**
 * The cosine-similarity floor a candidate must clear to join the tail, published WITH its
 * calibration because the number alone would not be honest (D-300-04 D3, D-300-06).
 *
 * ── The calibration, measured 2026-08-24 over the seeded corpus ──
 *
 * Nine blueprint purposes and 57 card versions built by `manifestText`/`cardText` below,
 * encoded by the ruled encoder, against nine paraphrase queries. Columns are how many of
 * the nine true targets a cutoff keeps, and how many of the 72 query-to-wrong-blueprint
 * pairs it admits:
 *
 *     tau 0.10 — keeps 9/9, admits 33/72 (45.8%)
 *     tau 0.15 — keeps 9/9, admits 21/72 (29.2%)
 *     tau 0.20 — keeps 8/9, admits 15/72 (20.8%)   <- ruled
 *     tau 0.25 — keeps 7/9, admits  8/72 (11.1%)
 *     tau 0.30 — keeps 5/9, admits  4/72 ( 5.6%)
 *     tau 0.35 — keeps 2/9, admits  1/72 ( 1.4%)
 *
 * cos(correct pair) runs min 0.157, median 0.308, max 0.613; cos(distractor pair) has
 * median 0.089 and p90 0.263. **The two distributions overlap and there is no clean gap**,
 * so every value here trades recall against tail noise and none of them is a natural
 * boundary. That is a property of the encoder rather than of this corpus: MiniLM is trained
 * on symmetric sentence pairs and this is a six-word query against a mean-pooled document
 * of several hundred words, which lands honest matches in the 0.15–0.35 band.
 *
 * ── Why 0.20 rather than the 0.35 this task was dispatched with ──
 *
 * 0.35 was ruled before the calibration existed and keeps TWO of the nine. It discards
 * `schema-forge-etl`, which the query *"reshape data between different table layouts"*
 * retrieves at RANK 1 and cosine 0.157 — a correct answer to exactly the paraphrase AC1 is
 * written about, thrown away by the cutoff.
 *
 * The asymmetry is the argument, and it is the ruling's operative sentence: **a false
 * negative fails AC1 outright; a false positive is a disclosed, marked, bounded tail row**
 * that carries `similar:purpose`, sits behind every lexical hit, and is capped by
 * `SEMANTIC_K`. Those two are not equally bad, and 0.35 priced them as though they were.
 *
 * ── A limit stated rather than left to surface as somebody's red ──
 *
 * The channel is not uniformly good. Over the 57-card corpus the query *"take in a new
 * request and understand what is being asked"* reaches `job-intake@1.0.0` at rank 26 and
 * cosine 0.129, and no cutoff rescues it — a cutoff filters, it does not reorder. AC1 is
 * stated over blueprints, so this is outside it, but it is a real bound on what the tail
 * can do and it belongs next to the number rather than in a defect report later.
 *
 * ── What this table is NOT ──
 *
 * The queries are this module's author's own, so the table is a CONSISTENCY CHECK: it
 * shows the constant is satisfiable, never that the reading is right. The independent
 * measurement is the acceptance suite, whose corpus was built without seeing these queries.
 */
export const SIMILAR_MIN = 0.2;

/**
 * The encoder, and the model directory it is provisioned into.
 *
 * `all-MiniLM-L6-v2` per D-300-01. The id is a DIRECTORY NAME under `MODEL_ROOT` and not a
 * Hub repository path, because `allowRemoteModels` is turned off below and nothing is ever
 * resolved against a network host — a Hub-shaped id here would read as though it might be.
 */
const MODEL_ID = "all-MiniLM-L6-v2";
const MODEL_ROOT = "models";

/** The shape this module uses, written out rather than imported. See `load()`. */
interface Encoder {
  (text: string, options: { pooling: "mean"; normalize: boolean }): Promise<{
    data: ArrayLike<number>;
  }>;
}

interface TransformersModule {
  env: {
    allowRemoteModels: boolean;
    allowLocalModels: boolean;
    localModelPath: string;
  };
  pipeline: (task: "feature-extraction", model: string) => Promise<Encoder>;
}

/**
 * Loaded at most once per process, absent or present.
 *
 * The PROMISE is memoised rather than the result, so concurrent callers share one load
 * instead of racing several ONNX sessions into memory — a publish and a query can arrive
 * together and the model is ~90MB of weights either way. Measured on the ruled encoder:
 * 207ms warm, and 16ms per document once it is up.
 *
 * A failed load is memoised too, and deliberately. Absence here is a missing directory on
 * disk, which does not heal between two calls in one process; retrying it would pay the
 * failure on every publish and every query for a machine that is simply not provisioned.
 */
let loading: Promise<Encoder | undefined> | undefined;

async function load(): Promise<Encoder | undefined> {
  try {
    /* The specifier is a VARIABLE, and both halves of that are load-bearing.
       
       At runtime it makes the dependency optional: a static import of an absent package
       throws at module load, which would take down `lib/server/search` entirely on a
       machine with no encoder rather than degrading to the lexical path D-300-05 requires.
       
       At compile time it is what lets this module typecheck and lint TODAY, while the
       dependency line is still the owner's open decision under D-300-05 — TypeScript does
       not resolve a non-literal specifier, so the shape above is the contract and the
       import cannot claim a package that is not in `package.json` yet. */
    const specifier = "@huggingface/transformers";
    const mod: TransformersModule = await import(specifier);

    /* AC5 BY CONSTRUCTION rather than by observation, and this is the whole reason the
       criterion is assertable. With this flag off the library cannot reach the Hub even on
       a cache miss, so "no network egress at query or publish" is a property of the
       configuration a test can drive, not a claim about whether some cache happened to be
       warm when the suite ran. Verified against the real package: on a fresh install it
       throws `file was not found locally` rather than fetching. */
    mod.env.allowRemoteModels = false;
    mod.env.allowLocalModels = true;
    mod.env.localModelPath = MODEL_ROOT;

    return await mod.pipeline("feature-extraction", MODEL_ID);
  } catch {
    /* Swallowed, and it is the one place in this module that swallows anything. The two
       reachable causes — the package is not installed, the model directory is not
       provisioned — are the SAME condition from a caller's point of view: there is no
       encoder on this machine. `withSearchStore` seals real faults; this is not one. */
    return undefined;
  }
}

function encoder(): Promise<Encoder | undefined> {
  loading ??= load();
  return loading;
}

/**
 * The semantic vector of a document, or `undefined` where no encoder is provisioned.
 *
 * ASYNC, which the 3-gram derivation was not (D-300-06 F2). Model load and inference are
 * both asynchronous and no amount of arranging makes them otherwise; `embed` is named in no
 * published signature block and is not on the barrel, so the shape was free to move, and
 * the change was ruled before either half wrote against it.
 *
 * Mean-pooled and L2-NORMALISED, because the index is `vector_cosine_ops` (D-200-02).
 * Normalising at the encoder rather than after keeps one definition of the vector's length,
 * and `<=>` over unit vectors is the cosine distance the HNSW index was built for. Measured
 * at 1.000000049 rather than exactly 1, which is float32 and not a defect — pgvector stores
 * float4 and the index is unaffected.
 *
 * ── There is no zero-vector case any more, and the old branch is gone ──
 *
 * The 3-gram derivation embedded a text with no letters to all zeros, because it had no
 * 3-grams to count. A transformer has no such state: `""` and `"   ---   "` both encode the
 * CLS/SEP pair and come back with all 384 components non-zero at unit length — measured,
 * not reasoned. So an empty document is no longer a special case to guard, it is an
 * ordinary point that happens to be near other empty documents, and a caller who published
 * an empty summary gets a legal row rather than a throw exactly as before.
 */
export async function embed(text: string): Promise<number[] | undefined> {
  const extract = await encoder();
  if (extract === undefined) return undefined;

  const output = await extract(text, { pooling: "mean", normalize: true });
  const vector = Array.from(output.data);

  /* A width mismatch is NOT the absent-encoder case and is not degraded into it. It means
     the provisioned directory holds a different model, and the alternative to a throw here
     is a pgvector insert that fails further away with a message about a column. Loud, with
     the number, because the operator can only fix what the message names. */
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `The encoder in ${MODEL_ROOT}/${MODEL_ID} produced ${vector.length} dimensions, ` +
        `but \`release_embedding.embedding\` and \`card_version_embedding.embedding\` are ` +
        `\`vector(${EMBEDDING_DIMENSIONS})\` (D-200-02) and pgvector refuses any other width. ` +
        `That directory holds a model this schema cannot store.`,
    );
  }
  return vector;
}

/**
 * Whether this process can encode at all, without encoding anything.
 *
 * The searchers ask before building a query vector: with no encoder there is no tail, and
 * the lexical path should not pay a model load to find that out on every request.
 */
export async function encoderAvailable(): Promise<boolean> {
  return (await encoder()) !== undefined;
}
