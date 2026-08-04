# Guardrails

These fail the build. They are not review comments.

Before proposing edits to a route, run the checks in **Finding what applies** below. Do not
work from this file's summaries alone — the ledger changes, and a stale copy of it is how a
claim goes missing.

---

## 1. The honesty ledger

`components/site/honesty.test.ts` holds sentences the site may not stop making. Each entry
is tagged:

- **`open`** — must be readable **without opening a disclosure**. The comparison is
  `openText()`, which drops the body of every `<details>` lacking an `open` attribute.
- **`present`** — must be somewhere in the rendered markup.

Both compare **verbatim, lowercased**. A paraphrase is a different sentence and fails.

### What counts as losing an `open` claim

All four of these fail, and all four have been proposed by agents cutting these pages:

| Move | Why it fails |
|---|---|
| Delete the sentence | Obvious, and still the most common |
| Reword it | The ledger compares the string, not the meaning |
| Wrap it in `<More>` / a closed `<details>` | `openText()` drops the body |
| Promote it into the `<summary>` in shortened form | The summary survives, but the string no longer matches |

### What does **not** rescue a cut claim

An `open` claim is not saved by any of these, though each has been offered as
justification:

- The same idea appearing **on another page**. The ledger is held over *this* surface.
- A **figure** that draws it, or a caption that resolves it. `openText` reads text.
- A **`title` attribute** or tooltip. `plainText` strips attributes, and no reader hovers.
- A **near-identical sentence elsewhere on the same page**. Verbatim means verbatim.
- The words being **still in the HTML**. That is precisely the failure mode PROJECT.md
  §3.1 documents: the words stay, every word count passes, the reader never sees them.

### Never move the guard

Do not add a ledger entry, delete one, change a `where` tag, or relax an assertion so that
a proposed edit passes. The ledger removal rule in PROJECT.md exists for a statement that
has **stopped being true** — a feature shipped, a limit lifted. It is not a way to make
room for a cut.

If an edit requires touching a guard, the edit is wrong. Choose different text.

---

## 2. Limit statements not in the ledger

The ledger is a floor, not the whole set. Any sentence saying a thing is **seeded, not
built, not measured, or not checked** is a limit statement and gets ledger treatment even
if no test names it:

- `◐ seeded` markers — glyph **and** word, per doc 2 §0.4.
- `ComingSoonBadge` — the badge **and** its accompanying sentence. A badge is not a
  sentence.
- "nothing here runs", "no runner", "no endpoint", "no ballot", "not built", "nothing
  checks it".

These qualify something printed beside them. Moving the qualifier away from the qualified
thing is the same defect as folding it, whatever the word count says.

### The cross-page rescue does not work here either

§1 says "the same idea appearing on another page" does not rescue a **ledger** claim.
Agents read that as a rule about the ledger and helped themselves to it everywhere else:
in the verification run, **every** proposal reached for "`/nodes/code-builder` owns it" or
"`/spec` says it too" to justify cutting prose sitting *beside* a limit statement, and
three of five converged on the same sentence that way.

So the rule is wider than §1's wording. **"Another page says it" is not a reason to cut a
sentence adjacent to a limit statement, whether or not the sentence is in the ledger.** A
qualifier works by sitting next to the thing it qualifies; a reader on this page does not
visit the other one, and the sentence beside the qualifier is often what makes the
qualifier legible.

That costs real cuts, and it is meant to. When the two are genuinely separable, say so in
the spec and quote both, so the author can see what you saw.

**When in doubt, leave it open and cut somewhere else.** The site has 84,000 words. There
is always other text.

---

## 3. Autonomy is descriptive (PROJECT.md §1, doc 2 §1.1)

`components/build/path.test.ts` and `components/site/autonomy-surfaces.test.ts` enforce:

**Forbidden strings** in reader-visible copy:

```
out of 4          out of four        score of 4
fully autonomous  not autonomous     more autonomous   less autonomous
maximum autonomy  highest level
falls short       fall short         shortfall         room for improvement
should automate   penalty            penalis           penaliz            downgrade
```

**No autonomy ordinal on any user-facing surface.** The class *name* is what a reader sees
(assisted / supervised / conditional / closed-loop). Never "level 3", never "3 of 4".

**Two scales that must never blur:** the 1–5 organisational ladder is a number; the
autonomy class is a name. Copy that mixes them is wrong even if no forbidden string
appears.

**Nothing framing a human node as a shortfall.** A person's node is violet, never the
alarm colour.

---

## 4. The em-dash rule (doc 2 §2.5)

New copy in the guarded trees must not use an em dash **as a pause**. Enforced over:

```
components/home   components/hero    components/spec     components/howto
components/viz    components/explain components/site     components/gallery
```

plus `components/build/*` copy files, `components/blueprint/ForkAction.tsx`,
`lib/core/analysis/autonomy.ts`, `lib/format.ts`.

This bites on **copy you write during a reorg** — a new `<More summary="…">` string in a
guarded tree is new copy in a guarded tree. A baseline run breached this exact rule by
writing a summary with a pause dash in it.

Other trees carry pre-existing em dashes on purpose; they are a pending copy edit, not a
licence to add more.

---

## 5. Structural facts a reorg can break

- **Derived counts.** Sequence membership, labels and counts come from
  `components/spec/sequence.ts` and `components/howto/route.ts`. Never re-type a count. A
  pager once read "in four parts" against a five-item rail.
- **`SPEC_LAYERS` stays three.** The site says "three layers" in many places.
  `/spec/scoring` is a fifth entry in the *sequence*, not a fourth *layer*.
- **Anchors are load-bearing.** `components/site/anchors.test.ts` holds ids that other
  pages link. `/spec#scoring` is still a bookmark target.
- **`ssr.test.ts` asserts rendered content**, including that the card stage carries every
  line of the YAML. Folding a listing can break it.
- **Scene label guards.** `components/viz/scene-labels.test.ts` fails if a file drawing a
  `<FlowScene>` is not in its roster; moving a figure between files touches this.

---

## Finding what applies

Run these before proposing edits to `<route>`:

```bash
# every ledger claim, with its surface and where-tag
grep -n 'surface:\|says:\|where:' components/site/honesty.test.ts

# what the route actually renders, and what is already folded
npm run measure:prose -- <route>

# limit statements on this surface
grep -rn 'seeded\|not built\|ComingSoon\|nothing .* runs\|no runner\|no ballot' <files>

# does the tree you are editing carry the em-dash rule?
grep -n 'COPY_TREES' -A 12 components/build/path.test.ts
```

Then, for each edit, state in the spec which guardrail it comes near and why it does not
trip it. An edit whose guardrail line reads "n/a" has not been checked.
