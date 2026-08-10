# DarkPrint implementation plan

This plan is derived from `sol_feedback.md`. The existing mock is the intended product,
including fixture-backed capabilities that do not have services behind them yet. Product
importance is therefore never inferred from implementation status.

`pre-codex` is the immutable comparison baseline for this pass.

## Ordered implementation

1. **Lock positioning and nouns.** Make the product a registry of reusable,
   version-pinned agent-workflow blueprints. Use *Blueprint*, *Card*, *Registry*,
   *Validate*, and *Run* on first-visit surfaces. Describe the specification as
   reproducible and checkable, never the LLM result as deterministic.
2. **Lock the two loops.** Make `find → inspect → use → adapt locally → validate` and
   `goal → create → validate → publish` the two visible paths through the product.
3. **Make navigation task-oriented.** Keep Blueprints and Cards as the registry shelves;
   promote Create, Publish, and MCP as product workflows; group format education under
   Docs; keep the dark-factory material under Guides.
4. **Make Create honest.** Start with the user's goal and the DarkPrint authoring skill.
   Present the current three-control builder as an optional starter sandbox, not a general
   blueprint designer.
5. **Make artifact pages decision-oriented.** Lead with problem fit and limitations, then
   graph/contract, requirements, validation, version/provenance, and one canonical use
   action. Move schema teaching and raw source into supporting reference.
6. **Separate evidence by provenance.** Structural evidence, community assessment, and run
   evidence must be distinct. Missing and low-sample evidence are real product states and
   must not be replaced with values merely to complete a chart.
7. **Verify the loops.** Cover the new contracts with tests, run all repository gates, and
   inspect the finder and creator paths at desktop and mobile widths.
8. **Unify Learn.** Treat 00–06 as one ordered reading path, render the same highlighted
   rail at the bottom of every page, and use those names in the Learn menu.
9. **Make Ontology canonical.** Move the vocabulary index, motivation, extension model,
   concrete overlay and validation rules to `/spec/ontology`; permanently redirect the old
   `/ontology` index while preserving `/ontology/<term>` detail routes.
10. **Expose community support.** Put a GitHub-style Star control and count beside every
    blueprint and node-card title, with fixture provenance visible until a service exists.

## Product decisions adopted in this pass

These follow directly from the confirmed product direction and do not require a new policy:

- Blueprints, not autonomy, are the headline product.
- DarkPrint stores and statically checks files; a user's harness runs them locally.
- Human-gated workflows are first-class and autonomy remains descriptive.
- `Static risk exposure` is the public label for the structure-derived risk reading. It is
  not represented as a security audit.
- MCP remains top-level because agent-side registry discovery is one of the two intended
  registry interfaces. It is described separately from the authoring skill.
- Ontology is reference/governance material under Docs rather than a first-visit shelf.
- The documentation group is named **Learn**, ordered 00–06, and stop 03/page title is
  consistently **Ontology**.
- `/spec/ontology` is the canonical ontology index; `/ontology` is a compatibility URL.
- Stars are the chosen public support metaphor. The current counts remain visibly seeded
  and browser-local starring adds only the current browser's own selection.
- A blueprint page has one canonical **Use this blueprint** area. Individual source files
  remain available as evidence, not competing primary actions.

## Product decisions intentionally left open

Implementing any of these as settled behavior would invent product policy. Each needs an
explicit decision before its fixture state becomes a production contract.

1. Whether warnings block publication or only errors do.
2. Whether local adaptations become lineage-preserving forks or new artifacts with
   provenance.
3. Blueprint release/version rules, including how a current version is selected.
4. Which artifacts and reports may be private, and who can see them.
5. The separate trust signals, eligibility rules, weighting, revocation, and abuse controls
   behind identity, validation, reviews, reputation, usage, and verified runs.
6. Run normalization across model, provider, hardware, input size, harness version, sample
   size, freshness, and uncertainty.
7. Ontology proposal, review, ownership, conflict, promotion, and deprecation policy.
8. The MCP retrieval contract: result kinds, exact releases, excerpts, ranking,
   authorization, and provenance.
9. Licenses for published specifications and generated bundles.
10. The boundary for malicious instructions, declared tool reach, static warnings,
    moderation, and provenance.
11. Account and organization roles and their permission transitions.
12. The distinct semantics of browser download, MCP fetch, clone, fork, and run events.
13. Discovery ranking for the website and MCP, including whether any social signal affects
    the default order.
14. Report, hiding, appeal, suspension, and disputed-evidence moderation states.
15. Retention and deletion rules for immutable releases, drafts, comments, reports, and
    personal data.
16. The production star service: identity, deduplication, unstar semantics, migration of
    seeded counts, and whether historical `votes` become stars or remain a separate signal.

Until those decisions are made, the UI may show the existence and provenance of fixture
evidence, but must not imply a weighting, eligibility, ranking, or policy that has not been
defined.
