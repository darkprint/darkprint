/* ============================================================
   The card as an object, before it is the file.

   The author, 2026-08-08: "Show in a first instance the graphics of a card with some
   fields drawn from the actual yaml card and then, scrolling it gets substituted with the
   actual yaml."

   So this is the first instance: a card, drawn as a card, with five of its fields taken
   off the same document `CardWalk` lists one crossfade later. Nothing here is written by
   hand — `readFields` parses the archive's own YAML, and a field the card does not declare
   simply does not appear rather than rendering a placeholder.

   ── It does not print YAML syntax, and that is a rule rather than a taste ──
   `beats.test.ts` fails any beat whose readable text matches `phase:`, `cannot:`,
   `model:` and friends, because a landing that lists a card's keys is the landing
   re-explaining `/spec/card`. The exemption granted for beat 2's `<pre>` is for one
   verbatim artefact and does not extend here.

   That constraint improves the drawing. A card is not its file: the file has keys and
   colons, the card has a name, a role and a handful of stated facts. So the fields are
   drawn as a label above a value — the register `.label` already carries everywhere else
   on the site — and the colon never appears. What a reader sees first is the object; what
   they see after the swap is its source.

   ── Why `cannot` is the last row and the only coloured one ──
   It is the field the whole site is built on: what must never reach this node. Copper is
   the node card's own accent (`--color-copper-line`, and `SkeletonPane` spends it for
   exactly this), so the one row a reader should carry away from a card is the one row that
   is not grey.
   ============================================================ */

import { cx } from "@/lib/format";

/** One row of the face: what the field is called, and what this card says. */
interface Field {
  label: string;
  value: string;
  /** The prohibition, which is the one row drawn in the card's own accent. */
  accent?: boolean;
}

/**
 * Five fields, read off the document rather than described.
 *
 * A deliberately small parser: these are top-level scalars and one top-level list, and
 * pulling in a YAML library to read five keys on a file the site has already validated
 * would be weight for nothing. Anything it cannot find is omitted, so a card that stops
 * declaring a field loses a row instead of printing an empty one.
 */
export function readFields(source: string): Field[] {
  const scalar = (key: string): string | undefined => {
    const m = new RegExp(`^${key}:[ \\t]*(.+)$`, "m").exec(source);
    const raw = m?.[1]?.trim();
    if (raw === undefined || raw.length === 0) return undefined;
    return raw.replace(/^["']|["']$/g, "");
  };

  /* `cannot` is a block list, so it is counted rather than quoted: the face has one line
     per field and the longest prohibition on the starter card does not fit in one. The
     count is the fact a reader needs here — that there are things this node may not be
     handed — and the listing after the swap spells them out. */
  const cannotBlock = /^cannot:\n((?:[ \t]+-[ \t].*\n?)+)/m.exec(source)?.[1] ?? "";
  const cannotCount = cannotBlock.split("\n").filter((l) => /^\s+-\s/.test(l)).length;

  const out: Field[] = [];
  const push = (label: string, value: string | undefined, accent?: boolean) => {
    if (value !== undefined) out.push({ label, value, ...(accent === true ? { accent } : {}) });
  };

  push("role", scalar("title") ?? scalar("id"));
  push("type", scalar("type"));
  push("phase", scalar("phase"));
  push("model", scalar("model"));
  if (cannotCount > 0) {
    push(
      "must never receive",
      `${cannotCount} ${cannotCount === 1 ? "kind of data" : "kinds of data"}`,
      true,
    );
  }
  return out;
}

export function CardFace({ source, cardRef }: { source: string; cardRef: string }) {
  const fields = readFields(source);

  return (
    /* The same shell the listing wears one crossfade later — a hairline on plain ground,
       the same radius, the same padding — so the swap reads as one object changing its
       skin rather than as two figures trading places. */
    <figure className="flex flex-col gap-4 rounded-xl border border-line bg-void p-4 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-dim">
        <span className="text-muted">{cardRef}</span>
        <span>one node, as a card</span>
      </figcaption>

      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="flex min-w-0 flex-col gap-1.5">
            <dt className="label">{field.label}</dt>
            <dd
              className={cx(
                "min-w-0 break-words font-mono text-sm",
                field.accent === true ? "text-copper-line" : "text-fg",
              )}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
