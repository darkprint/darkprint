# Measuring

`scripts/measure-prose.ts`, wired as `npm run measure:prose`. It reads the prerendered
HTML in `.next/server/app`, so **a build must be current** or the numbers describe an old
tree.

```bash
npm run build
npm run measure:prose                  # all templates, ranked site-wide
npm run measure:prose -- /spec/card    # one route, section by section
npm run measure:prose -- --json        # machine-readable
```

## The two numbers

- **`total`** — every prose word a page carries.
- **`open`** — the same, minus the body of every closed `<details>`. The `<summary>` line
  counts, because that is what a reader sees without acting.

Report both, always. They answer different questions:

| Pattern | Reading |
|---|---|
| `total` falls, `open` unchanged | Nothing a reader experiences was cut |
| `open` falls much faster than `total` | Content was folded, not removed — check every folded block against the ledger |
| Both fall together | Text left the site; the ledger check has to be exact |

## What is excluded, and why

Per PROJECT.md §3.1, prose only:

- `<script> <style> <svg> <pre> <template> <noscript>`
- anything under `role="listbox"`
- code lines drawn as `class="whitespace-pre"` spans outside a `<pre>`
- `aria-hidden="true"` elements — state glyphs (◐ ◌ ◈ ✓ ▸) and line-number gutters

**The listing trap has two instances.** §3.1 warns that a `<pre>`-based filter misses the
pane listings, because `components/panes/SourcePane.tsx` draws its rows as
`<div role="option">` with `whitespace-pre` rather than inside a `<pre>`. That is the
`role="listbox"` rule. But `components/home/nodecard/YamlListing.tsx` draws the same shape
on `/spec/card` and carries **no role at all**, so the listbox rule never reached it and
383 words of `code-builder@1.0.0.yaml` were being counted as prose — a third of the page.
The class is the hook the two components share, so it is stripped directly.

Every exclusion is printed under the page's numbers so a surprising figure can be checked
rather than trusted. The glyph rule matters more than it sounds: a whitespace-splitting
counter scores each ◐ as a word, and across the build that was 4,309 words of punctuation.

`scripts/measure-prose.test.ts` pins all of this, including the sibling-stripping bug that
made `/spec/card` report 101 words. Run it before trusting a change to the script.

## What it deliberately cannot see

Prerendered HTML is a page's **initial** state.

- **`/build`** is a seven-step wizard. Its 440 words are one step of seven.
- **`/upload`** is a staged validator. Same.

Both are flagged in the report rather than quietly under-counted. Reorganising either
means measuring in the browser, step by step. Every other route is SSG and fully present.

It also does not see: reading order, what sits above the fold, line length, or how far a
reader scrolls before they can act. Those need `references/reading.md`.

## Rank by site-wide words

The default report sorts by `per page × instances`, because that is what a template edit
moves. Per-page length is misleading on this site:

```
site-wide  per page   open    ×  template
    45262       854    854   53  /nodes/[...id]
    13200       264    264   50  /ontology/[...term]
    13095      1455    869    9  /blueprints/[slug]
     3168       528    528    6  /u/[username]
     2648      2648   2648    1  /nodes
     2052      2052   2052    1  /ontology
     1263      1263    830    1  /spec/card
     1252      1252    761    1  /towards-a-dark-factory/which-tasks
   ------
    89594 words of prose across 133 pages
```

Two templates carry two-thirds of the prose this site serves. `/spec/card`, the worst page
by per-page length, is 1.4%. A 200-word cut on `/nodes/[...id]` is worth fifty times a
200-word cut anywhere that ships once.

Note `/nodes/[...id]` has `open` equal to `total`: nothing on it is folded at all.
`/blueprints/[slug]` is third and is **out of scope** — the author has approved it.

## Do not trust estimates, and re-measure before citing

An audit that estimated every route from source put `/build` at 1,800 words against the
440 a visitor is served, because it counted all seven steps out of the source rather than
what is handed over. On the same run `/install` came out at 76 against 77. The error is
not a consistent bias you can correct for, which is the reason to measure rather than
adjust.

Recorded numbers go stale too, and the difference is not always an error. PROJECT.md §3.1
records the landing at 216; it measures 305 today. Both are correct: `3cfe0da` moved the
Download, Compose and Upload panels onto the landing after §3.1 was written. Before
treating a gap like that as a mistake, check the log for what moved.

And the instrument itself can be the thing that is wrong. Every figure in this file was
restated once already, because the strip pass was removing each matched element **and
every later sibling sharing its tag**. It threw nothing and read as plausible;
`/blueprints/[slug]` simply reported 539 words a page instead of 1,455, which moved it
from fifth place to third. A number that is quietly wrong ranks the work wrongly, so a
figure that surprises you is a reason to read `removed` and re-derive it by hand.

**Numbers in a spec come from the script, on a current build.** If you are writing a word
count you did not measure, measure it.
