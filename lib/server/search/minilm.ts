/* ============================================================
   The sentence encoder, driven directly.

   ── why this file exists ──
   `@huggingface/transformers` opens its Node build with
   `import sharp from "sharp"`. A TEXT feature-extraction pipeline
   therefore could not load unless an IMAGE library resolved first,
   and sharp is the one dependency in this tree that ships as
   twenty-four per-platform optional packages: npm installs only the
   host's, so a deployment built on a Mac for linux/arm64 had to
   stage `@img/sharp-linux-arm64` by hand. Every failure this repo
   has had around the encoder lived in that staging step — the
   `--no-save` install pruned by `vercel build`'s own `npm install`,
   the arch-specific exclude list, the build output whose
   `filePathMap` outlived the files it names.

   `onnxruntime-node` has no such problem: it ships every platform's
   binary in ONE package, so a plain `npm install` on any host leaves
   `bin/napi-v6/linux/arm64/libonnxruntime.so.1` on disk. Running the
   session ourselves removes sharp from the encoder's dependency
   graph, and with it the whole cross-compilation class.

   ── the vectors did not move ──
   This is a reimplementation of something 136 stored vectors already
   depend on, so it is byte-compatible rather than merely similar:
   measured against the library it replaces, cosine is 1.000000 on
   every probe including the empty string and a mixed
   accents/punctuation/CJK case. `MODEL_BLOB` pins the weights and
   `embeddedInput()` folds that sha into every stamp, but NEITHER
   pins this code — a tokenizer edit would change every query vector
   while leaving the stamp untouched, so the stored corpus would
   silently stop matching. `minilm.test.ts` holds golden vectors for
   exactly that reason.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The tokenizer's shape, only the parts read here. */
interface TokenizerFile {
  model: {
    vocab: Record<string, number>;
    unk_token: string;
    continuing_subword_prefix: string;
    max_input_chars_per_word: number;
  };
}

/**
 * BERT's own limit, and the reason the body is sliced two short of it.
 *
 * `tokenizer_config.json` gives `model_max_length: 512`, and the template wraps the body in
 * `[CLS]` and `[SEP]`, so 510 is what is left for text. Truncation rather than refusal:
 * `BLUEPRINT_DOCUMENT_BUDGET` already keeps documents well inside this, and a long query is
 * a query rather than an error.
 */
const MAX_BODY_TOKENS = 510;

/* Unicode general categories P (punctuation) and S (symbol), plus the ASCII ranges BERT
   treats as punctuation even where Unicode does not — `$`, `+`, `^` and friends are symbols
   to Unicode and splits to BERT. */
const PUNCTUATION = /^[!-/:-@[-`{-~]$|^\p{P}$|^\p{S}$/u;

/** The CJK blocks `BertNormalizer`'s `handle_chinese_chars` pads with spaces. */
function isCjk(codePoint: number): boolean {
  return (
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x20000 && codePoint <= 0x2a6df)
  );
}

/**
 * `BertNormalizer` with this model's settings: clean_text, handle_chinese_chars, lowercase.
 *
 * `strip_accents` is `null` in `tokenizer.json`, which in the reference implementation means
 * "follow `lowercase`" rather than "do not strip" — so accents go. Getting that backwards is
 * the single likeliest way to produce vectors that look plausible and match nothing, which
 * is why the golden test carries an accented probe.
 */
export function normalizeText(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0 || cp === 0xfffd) continue;
    if (cp === 9 || cp === 10 || cp === 13) {
      out += " ";
      continue;
    }
    if (cp < 32) continue;
    out += isCjk(cp) ? ` ${ch} ` : ch;
  }
  return out.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
}

/** `BertPreTokenizer`: split on whitespace, then cut every punctuation mark into its own token. */
export function preTokenize(text: string): string[] {
  const words: string[] = [];
  for (const chunk of text.split(/\s+/)) {
    if (chunk === "") continue;
    let current = "";
    for (const ch of chunk) {
      if (PUNCTUATION.test(ch)) {
        if (current !== "") words.push(current);
        words.push(ch);
        current = "";
      } else current += ch;
    }
    if (current !== "") words.push(current);
  }
  return words;
}

/**
 * WordPiece, greedy longest-match-first, `##` on every piece after the first.
 *
 * A word that cannot be covered falls to `[UNK]` WHOLE rather than keeping the pieces found
 * so far, which is the reference behaviour and not an optimisation: a partial cover would
 * put tokens into the sequence that the model was never trained to see there.
 */
function wordPiece(words: readonly string[], file: TokenizerFile): number[] {
  const { vocab, unk_token: unk, continuing_subword_prefix: prefix, max_input_chars_per_word: maxChars } = file.model;
  const ids: number[] = [];
  for (const word of words) {
    if (word.length > maxChars) {
      ids.push(vocab[unk]);
      continue;
    }
    const pieces: number[] = [];
    let start = 0;
    let covered = true;
    while (start < word.length) {
      let end = word.length;
      let found: string | undefined;
      while (start < end) {
        const candidate = (start === 0 ? "" : prefix) + word.slice(start, end);
        if (candidate in vocab) {
          found = candidate;
          break;
        }
        end -= 1;
      }
      if (found === undefined) {
        covered = false;
        break;
      }
      pieces.push(vocab[found]);
      start = end;
    }
    if (covered) ids.push(...pieces);
    else ids.push(vocab[unk]);
  }
  return ids;
}

/** The `[CLS] … [SEP]` sequence for one text, ready for the session. */
export function tokenize(text: string, file: TokenizerFile): number[] {
  const body = wordPiece(preTokenize(normalizeText(text)), file);
  return [file.model.vocab["[CLS]"], ...body.slice(0, MAX_BODY_TOKENS), file.model.vocab["[SEP]"]];
}

/** The subset of `onnxruntime-node` this module uses, written out so the import can be dynamic. */
interface OrtModule {
  Tensor: new (type: "int64", data: BigInt64Array, dims: number[]) => unknown;
  InferenceSession: {
    create: (path: string) => Promise<{
      inputNames: string[];
      outputNames: string[];
      run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: ArrayLike<number>; dims: number[] }>>;
    }>;
  };
}

/** What `embed.ts` asks of an encoder: one text in, one pooled and normalised vector out. */
export interface MiniLm {
  (text: string, options: { pooling: "mean"; normalize: boolean }): Promise<{ data: ArrayLike<number> }>;
}

/**
 * Open the vendored model. Throws when the package or the files are not there, which is the
 * condition `embed.ts` turns into `encoder: "absent"`.
 *
 * The specifier is a variable for the same reason it was before: an absent package must fail
 * at CALL time and degrade, not at module load, or a machine with no encoder cannot import
 * `lib/server/search` at all.
 */
export async function createMiniLm(modelRoot: string, modelId: string): Promise<MiniLm> {
  const specifier = "onnxruntime-node";
  const ort: OrtModule = await import(specifier);

  const dir = join(modelRoot, modelId);
  const file = JSON.parse(readFileSync(join(dir, "tokenizer.json"), "utf8")) as TokenizerFile;
  const session = await ort.InferenceSession.create(join(dir, "onnx", "model_quantized.onnx"));

  return async (text, options) => {
    const ids = tokenize(text, file);
    const dims = [1, ids.length];
    const tensor = (values: number[]) =>
      new ort.Tensor("int64", BigInt64Array.from(values, (v) => BigInt(v)), dims);

    const feeds: Record<string, unknown> = {
      input_ids: tensor(ids),
      attention_mask: tensor(ids.map(() => 1)),
    };
    /* Present on this model and on every BERT export, absent on some distilled ones. Fed only
       when the session asks for it, so a re-export without it does not throw here. */
    if (session.inputNames.includes("token_type_ids")) {
      feeds.token_type_ids = tensor(ids.map(() => 0));
    }

    const output = await session.run(feeds);
    const hidden = output[session.outputNames[0]];
    const [, sequence, width] = hidden.dims;

    /* Mean over the sequence, then L2. Every token is attended — nothing is padded, because
       one text is one session run — so the mask that a batched pooler would divide by is
       exactly `sequence`, and dividing by it here is the same arithmetic without the mask. */
    const pooled = new Float64Array(width);
    for (let t = 0; t < sequence; t += 1) {
      for (let d = 0; d < width; d += 1) pooled[d] += hidden.data[t * width + d];
    }
    for (let d = 0; d < width; d += 1) pooled[d] /= sequence;

    if (!options.normalize) return { data: Array.from(pooled) };
    let sum = 0;
    for (const value of pooled) sum += value * value;
    const norm = Math.sqrt(sum);
    /* A zero vector cannot be normalised and no text produces one; dividing by zero would
       hand pgvector a row of NaN, which it stores and then never matches. */
    if (norm === 0) return { data: Array.from(pooled) };
    return { data: Array.from(pooled, (value) => value / norm) };
  };
}
