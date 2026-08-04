/* ============================================================
   The `audit` verb, as a workflow.

   Why a fan-out rather than a page-at-a-time loop: the defect
   this site actually has is not one bloated page, it is the same
   concept explained in four places. `/spec/topology` argues the
   absent edge three times on its own, then `/spec/card` and
   `/what-it-isnt` make it a fourth and fifth. The risk-marker
   arithmetic is written in full on `/ontology` and again in full
   on each of the ten marker term pages, which then link to
   `/spec/scoring` where it belongs. None of that is visible from
   inside a single route, so duplication is found across all
   routes at once, BEFORE any per-route proposal is written.

   Pass the routes to audit as `args`. Omit it for the full
   in-scope set.

     Workflow({
       scriptPath: '.claude/skills/content-reorg/workflows/audit.js',
       args: ['/spec/card', '/spec/scoring'],
     })

   Run `npm run build` ONCE before launching this. Every agent
   below measures off the prerendered HTML and none of them build:
   a build regenerates `public/bundles`, which is checked in, so
   parallel builds in one working directory race on a tracked
   directory as well as on `.next`.

   This writes specs to docs/content-reorg/<date>/ and changes no
   page. `apply` is a separate, human-approved step.
   ============================================================ */

export const meta = {
  name: 'content-reorg-audit',
  description: 'Audit darkprint routes for density and placement, and write per-route reorg specs',
  phases: [
    { title: 'Duplication', detail: 'concept to locations, across all routes at once' },
    { title: 'Audit', detail: 'one agent per route: measure, read rendered, propose' },
    { title: 'Verify', detail: 'adversarial guardrail pass per proposal' },
  ],
}

/* Benchmark routes are deliberately absent: `/`, `/blueprints`, `/blueprints/[slug]` are
   approved and serve as the density reference, per references/reading.md. */
const IN_SCOPE = [
  '/spec',
  '/spec/topology',
  '/spec/card',
  '/spec/ontology',
  '/spec/scoring',
  '/ontology',
  '/ontology/[...term]',
  '/nodes',
  '/nodes/[...id]',
  '/towards-a-dark-factory',
  '/towards-a-dark-factory/which-tasks',
  '/towards-a-dark-factory/the-climb',
  '/what-it-isnt',
  '/build',
  '/install',
  '/upload',
  '/u/[username]',
]

const routes = Array.isArray(args) && args.length > 0 ? args : IN_SCOPE

const SKILL = `Read these first, in full, and follow them:
- .claude/skills/content-reorg/SKILL.md
- .claude/skills/content-reorg/references/guardrails.md
- .claude/skills/content-reorg/references/measuring.md
- .claude/skills/content-reorg/references/reading.md`

/* --------------------- duplication --------------------- */

phase('Duplication')

const DUP_SCHEMA = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          concept: { type: 'string', description: 'the idea being restated, named in a few words' },
          owner: { type: 'string', description: 'the route that should own it, and why' },
          locations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                route: { type: 'string' },
                file: { type: 'string' },
                quoted: { type: 'string', description: 'verbatim text making the point here' },
                words: { type: 'number' },
                instances: { type: 'number', description: 'how many pages ship this, 1 unless it is a template' },
              },
              required: ['route', 'file', 'quoted', 'words', 'instances'],
            },
          },
          siteWideWords: { type: 'number', description: 'total words spent restating this, counting template instances' },
        },
        required: ['concept', 'owner', 'locations', 'siteWideWords'],
      },
    },
  },
  required: ['concepts'],
}

/* Three lenses rather than three identical sweeps: the same duplication is invisible to
   one angle and obvious to another. A definition restated reads differently from a
   disclaimer restated, and template boilerplate is a third thing entirely. */
const LENSES = [
  {
    key: 'definitions',
    prompt:
      'Concepts, definitions and theses: any idea, term or argument defined or argued on more than one route. Include jargon introduced before it is defined anywhere the reader has been.',
  },
  {
    key: 'disclaimers',
    prompt:
      'Limit statements: seeded markers, not-built notices, "nothing is measured" statements, and honesty disclaimers restated across routes or repeated within one page. Note precisely where each one currently sits and whether it is already inside a disclosure - some of these may NOT be moved, see guardrails.md.',
  },
  {
    key: 'templates',
    prompt:
      'Per-instance boilerplate: text in a route template that ships on every instance and says something site-wide rather than something about this instance. Multiply by instance count. /nodes/[...id] ships 53 times and /ontology/[...term] 50 times, so this lens carries the largest numbers on the site.',
  },
]

const dupRuns = await parallel(
  LENSES.map((l) => () =>
    agent(
      `${SKILL}

Working in /Users/alessandro/Github/darkprint.

Build a concept-to-locations index across these routes:
${routes.join(', ')}

Your lens for this sweep: ${l.prompt}

Run \`npm run measure:prose\` first for the real numbers, and follow route files into components/ and content/ where the copy actually lives.

Quote verbatim. A concept you cannot quote in two places is not duplication, it is a hunch - leave it out. Set instances to the number of pages that ship each location (1 for a normal route, 53 for /nodes/[...id], 50 for /ontology/[...term], 9 for /blueprints/[slug], 6 for /u/[username]).`,
      { label: `dup:${l.key}`, phase: 'Duplication', schema: DUP_SCHEMA }
    )
  )
)

const duplication = dupRuns
  .filter(Boolean)
  .flatMap((r) => r.concepts)
  .sort((a, b) => b.siteWideWords - a.siteWideWords)

log(`${duplication.length} restated concepts found across ${routes.length} routes`)

/* Only what touches a given route needs to reach that route's auditor. */
function dupFor(route) {
  return duplication.filter((c) => c.locations.some((l) => l.route === route))
}

/* --------------------- audit + verify --------------------- */

phase('Audit')

const SPEC_SCHEMA = {
  type: 'object',
  properties: {
    route: { type: 'string' },
    baseline: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        open: { type: 'number' },
        instances: { type: 'number' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: { heading: { type: 'string' }, total: { type: 'number' }, open: { type: 'number' } },
            required: ['heading', 'total', 'open'],
          },
        },
      },
      required: ['total', 'open', 'instances', 'sections'],
    },
    diagnosis: { type: 'array', items: { type: 'string' }, description: 'concrete, quoting text and naming sections' },
    proposedOutline: { type: 'array', items: { type: 'string' } },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'file and section' },
          lever: { type: 'string', description: 'cut | relocate | collapse | compress' },
          quotedTextAffected: { type: 'string' },
          detail: { type: 'string' },
          movesTo: { type: 'string', description: 'for relocate: where it lands. Empty otherwise.' },
          guardrailCheck: { type: 'string', description: 'which guardrail this comes near and why it does not trip it' },
          wordsAffected: { type: 'number' },
        },
        required: ['target', 'lever', 'quotedTextAffected', 'detail', 'movesTo', 'guardrailCheck', 'wordsAffected'],
      },
    },
    ledgerClaims: {
      type: 'array',
      description: 'every honesty-ledger claim on this surface, and its fate under this proposal',
      items: {
        type: 'object',
        properties: {
          says: { type: 'string' },
          where: { type: 'string', description: 'open | present' },
          fate: { type: 'string', description: 'must read: untouched, verbatim, in the open' },
        },
        required: ['says', 'where', 'fate'],
      },
    },
    target: {
      type: 'object',
      properties: { total: { type: 'number' }, open: { type: 'number' } },
      required: ['total', 'open'],
    },
    sourcesFetched: { type: 'array', items: { type: 'string' }, description: 'URLs consulted this run, with dates' },
  },
  required: ['route', 'baseline', 'diagnosis', 'proposedOutline', 'edits', 'ledgerClaims', 'target', 'sourcesFetched'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    route: { type: 'string' },
    verdict: { type: 'string', description: 'SAFE | UNSAFE' },
    violations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          guardrail: { type: 'string' },
          editTarget: { type: 'string' },
          how: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['guardrail', 'editTarget', 'how', 'evidence'],
      },
    },
    weakEdits: { type: 'array', items: { type: 'string' }, description: 'edits that are safe but poorly justified' },
  },
  required: ['route', 'verdict', 'violations', 'weakEdits'],
}

/* Pipeline, not a barrier: a route's proposal goes straight into its own verification as
   soon as it lands, instead of every route waiting for the slowest one. */
const results = await pipeline(
  routes,
  (route) =>
    agent(
      `${SKILL}

Working in /Users/alessandro/Github/darkprint. Run the **audit** verb for **${route}**. Propose only; change no files.

Concepts already known to be restated across the site, touching this route:
${JSON.stringify(dupFor(route), null, 2)}

Where this route duplicates a concept another route owns, prefer cut-to-a-pointer over rewriting it here.

Do all of this:
1. \`npm run measure:prose -- ${route}\` for the baseline. Numbers come from the script, never from your estimate. **Do NOT run \`npm run build\`** - a current build already exists, and building regenerates the checked-in \`public/bundles\` while other agents are reading it.
2. Read the route file and follow it into components/ and content/ for the real copy.
3. Read the rendered page (npm run dev, Chrome) per references/reading.md: above the fold at both widths, words before the first action, scroll depth to the thesis, the disclosure inventory.
4. One live-source fetch for this route's archetype, per references/reading.md. Record URLs and dates in sourcesFetched.
5. Read components/site/honesty.test.ts and list EVERY claim whose surface is this route in ledgerClaims. Each fate must be "untouched, verbatim, in the open" - if an edit would change that, replace the edit.

Set route to exactly "${route}".`,
      { label: `audit:${route}`, phase: 'Audit', schema: SPEC_SCHEMA }
    ),
  (spec, route) =>
    spec === null
      ? null
      : agent(
          `${SKILL}

You are the adversarial guardrail pass. Try to KILL this proposal for ${route}. Default to UNSAFE when uncertain.

${JSON.stringify(spec, null, 2)}

Read the real sources yourself - components/site/honesty.test.ts, components/build/path.test.ts, the route file, and anything the edits touch. Do not trust the proposal's own guardrailCheck fields; they are the claim under test.

Check every one of these:
- Does any edit cut, fold, paraphrase, or summarise an "open" ledger claim? All four fail.
- Does any edit rely on the claim surviving on another page, in a figure, in a caption, in a title attribute, or inside a summary? None of those rescue it.
- Does the proposal edit, relax, or add to any test or ledger entry so a cut passes? That alone is UNSAFE.
- Does it damage a seeded marker, a ComingSoonBadge sentence, or any not-built statement?
- Does new copy introduce a FORBIDDEN string, an autonomy ordinal, or an em dash used as a pause inside a guarded tree?
- Does it re-type a derived count, break an anchor other pages link, or make SPEC_LAYERS anything other than three?

Set route to exactly "${route}".`,
          { label: `verify:${route}`, phase: 'Verify', schema: VERDICT_SCHEMA }
        ).then((v) => ({ spec, verdict: v })),
)

const done = results.filter(Boolean).filter((r) => r.verdict !== null)
const safe = done.filter((r) => r.verdict.verdict === 'SAFE')
const unsafe = done.filter((r) => r.verdict.verdict !== 'SAFE')

log(`${safe.length} routes SAFE, ${unsafe.length} need rework`)

/* Ranked by what a template edit actually moves, not by per-page length. */
const index = done
  .map((r) => ({
    route: r.spec.route,
    instances: r.spec.baseline.instances,
    siteWideNow: r.spec.baseline.total * r.spec.baseline.instances,
    siteWideAfter: r.spec.target.total * r.spec.baseline.instances,
    openNow: r.spec.baseline.open,
    openAfter: r.spec.target.open,
    verdict: r.verdict.verdict,
    violations: r.verdict.violations.length,
  }))
  .sort((a, b) => b.siteWideNow - b.siteWideAfter - (a.siteWideNow - a.siteWideAfter))

return { index, specs: done, duplication, unsafeCount: unsafe.length }
