# How a reader meets the page

The script counts words. It cannot see reading order, what sits above the fold, or how far
someone scrolls before they can act. That needs the rendered page and a set of rules about
what readers actually do.

---

## The browser pass

```bash
npm run dev        # then load http://localhost:3000<route>
```

Use the Chrome tools. For each in-scope route, record:

1. **Above the fold at 1440×900 and at 390×844.** What is the first sentence carrying an
   argument, as opposed to a label, an eyebrow or a crumb?
2. **Words before the first action.** How much must be read before the reader can click
   the thing the page exists to get them to?
3. **Scroll depth to the page's thesis.** If the load-bearing claim is on screen three,
   that is a placement defect regardless of length.
4. **The `<More>` inventory.** Every disclosure, its summary line, and whether the summary
   alone tells a reader whether opening it is worth it.
5. **Line length and rhythm.** A wall is a wall at any word count. Note paragraphs over
   ~5 lines at the rendered width.

Screenshot before and after. A class name is not evidence of where something draws —
PROJECT.md §4 records a popover that overflowed a phone viewport by 92px and shipped,
caught only by reading `getBoundingClientRect()`.

**Do not trigger dialogs.** Alerts block the extension.

---

## Rules this site's pages are read against

Established findings, not preferences. Confirm currency with a live fetch (below) rather
than treating this list as fixed.

**Readers scan before they read.** Web reading is dominated by scanning patterns — the
F-shape being the best known (Nielsen Norman Group). The practical consequence: the first
few words of a heading, a paragraph, and a list item do nearly all the work. Front-load
them. A paragraph whose subject arrives in its third clause is invisible to a scanner.

**Information scent decides whether someone continues** (Information Foraging Theory,
Pirolli & Card). A link, heading or summary must let a reader predict what is behind it.
This is why a `<More summary="Read more">` is worse than useless: it costs a decision and
returns no information. Every summary on this site should name what is inside it.

**Inverted pyramid.** Conclusion first, then support, then background. Journalism's rule,
and it holds harder on the web because readers leave. On a darkprint page: the claim the
page exists to make goes above the figure that proves it, not after the setup that
motivates it.

**Progressive disclosure works when the default is genuinely enough** (Nielsen). Folding is
not free — it is a choice imposed on the reader. It earns its place when the hidden content
is reference depth a minority needs, and fails when it hides something the visible text
depends on. See `guardrails.md` for where it is forbidden outright.

**One idea per section.** PROJECT.md's own rule, and it is the one that most often
diagnoses this site's pages: a section arguing three things reads as dense even when it is
short.

**Repetition across pages reads as padding.** A reader arriving from `/spec` who meets the
same definition again on `/spec/card` learns that this site restates itself, and starts
skimming. Cross-page duplication is the defect most invisible from any single page — which
is why the audit builds a concept→locations index before proposing per-route edits.

---

## Live sources

Run one fetch pass per audit, scoped to the archetype in question — not a generic search.

The in-scope routes fall into four archetypes; fetch guidance for the one you are working
on:

| Archetype | Routes | What to look up |
|---|---|---|
| Reference / spec | `/spec/*`, `/ontology*` | how technical reference pages are structured, scannability of definition lists, when tables beat prose |
| Essay / argument | `/towards-a-dark-factory/*` | long-form web reading, section pacing, where readers abandon |
| Registry template | `/nodes/[...id]`, `/ontology/[...term]` | detail-page patterns, repeated-boilerplate handling across generated pages |
| Task flow | `/build`, `/upload`, `/install` | step density, instructions above the control, wizard step length |

Prefer primary sources (Nielsen Norman Group, W3C/WAI, published research) over listicles.
Record what you fetched in the audit spec, with the URL and the date, so the next run can
tell fresh guidance from inherited assumptions.

If a fetched source contradicts something in this file, say so in the spec rather than
silently following either one.

---

## Scope

**Benchmark — already approved, do not edit. Use as the density reference:**
`/`, `/blueprints`, `/blueprints/[slug]`.

**In scope:** `/spec`, `/spec/topology`, `/spec/card`, `/spec/ontology`, `/spec/scoring`,
`/ontology`, `/ontology/[...term]`, `/nodes`, `/nodes/[...id]`,
`/towards-a-dark-factory` and its two children, `/build`, `/install`, `/upload`,
`/u/[username]`.

`/what-it-isnt` was removed from the site on the author's instruction, along with
`SectionWhatItIs`, `SectionIsolationRule`, `SectionAbsentEdge`, `SectionComponentRecap`
and `AbsentEdgeGraph`. Do not propose reinstating it; do check, when auditing `/upload`,
that the vocabulary-asymmetry paragraph relocated there is still open and verbatim.

**Exempt from prose targets, placement review only:** `/nodes` and `/ontology` are lists.
PROJECT.md §3.1 exempts them on purpose — page height measures scrolling, and a grid of 53
tiles is skimmed in seconds. They can still have real placement defects; a lead that puts
jargon before its definition is one.

`/install` (77 words) and `/u/[username]` (528) have no length problem. Placement only.
