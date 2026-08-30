/* ============================================================
   What each field of a card is FOR — written once.
   ------------------------------------------------------------
   The author asked for the same thing twice, about two different
   surfaces: "on click of the field, it shows the details (this
   should be applied also in the card skeleton provided in the
   blueprint)", and then "in the page of a given blueprint, it
   would be important that when clicking on the fields listed for
   a node, it opens the field providing more information (like in
   the node webpage card)".

   Two surfaces, one set of sentences. `/nodes/<id>`'s field table
   and the blueprint page's card skeleton draw the same 22 wire
   keys, and until this module existed the prose behind them was
   written twice — the `skill` row on the node page and step 3 of
   `/spec/card`'s figure already said the same sentence in two
   spellings, which is how the site learned that a second copy
   drifts before anyone notices.

   ── What belongs here, and what does not ──
   A note says what the field is for, at the level a reader means
   by "more information": the contract, the enforcement, and the
   thing that is easy to assume and wrong. It is **value
   independent**. What a *particular* card writes into the field is
   the renderer's job, because the two renderers have genuinely
   different material to work with: the node page resolves
   ontology terms, prices risk markers and links vocabulary chips
   per page, and the skeleton pane has a serializable string and a
   line range. Neither of those travels through the other.

   ── Client safe ──
   Same rule `./model.ts` holds: plain strings, **no imports**, no
   schema, no ontology lookup. `SkeletonPane` is a client
   component and pulls this table straight into the browser
   bundle, so anything reached from here would go with it.

   ── Honesty ──
   Doc 1 §0.1.3 puts execution on the reader's own machine. There
   is no runner here and no backend, so a sentence about what
   happens "when the graph runs" always names whose machine it
   runs on. Every claim about enforcement below names the
   diagnostic that does the enforcing, and the fields nothing
   checks say so rather than being left ambiguous.
   ============================================================ */

/**
 * One paragraph per wire key of doc 1 §3, keyed exactly as the YAML spells it.
 *
 * `phase` and not `phases`: the wire key is what both surfaces label their rows with, so
 * it is what they look a note up by. The engine's camelCase model (`riskMarkers`,
 * `ontologyVersion`) never appears on either surface and does not appear here either.
 *
 * There is no `requires_human` note, because there is no such key. It answered whether a
 * person acts at the node, one block below the `type` that answered the same question,
 * and the two could disagree in a document nothing refused. The sentence it carried is in
 * `type` now, where the answer is.
 *
 * There is no `ontology_version` note either, and for a different reason: nothing replaced
 * it. The note said the field let a term that had since moved be read the way it was meant,
 * and no reader ever asked for that — a release stores its whole scorecard, so no score is
 * recomputed against an older vocabulary. A card is read against the one living vocabulary
 * and says nothing about which.
 */
export const FIELD_NOTE: Record<string, string> = {
  /* --------------------- 3.1 identity --------------------- */

  id: "The key a blueprint pins. A DOT node carries `card=\"id@version\"`, and this string is the only way a graph and a card find each other. It may be namespaced, `berti/solver-a`, so two authors can publish a card under the same short name.",

  name: "What a person calls the node. The drawing prints it and every listing leads with it. Nothing in the engine joins on it: that is the `id`'s job, and the two are free to disagree.",

  type: "One `node-type` term from the vocabulary, exactly one. It says what kind of work the node is, it is the term the static analysis groups by when it reads the shape of a graph, and it is where a reader finds out whether a person acts here. A type under `human-in-the-loop`, such as `human-gate`, means the run holds until somebody acts; every other type means it passes through. Both are a design decision and neither is a result.",

  phase: "Which of the five phases the node stands in, any number of them. The phases describe a blueprint's shape. They do not put every node into one of them. Intake, retrieval and routing are real work that none of the five names, so declaring none is an answer. Nothing here reads an empty list as a defect.",

  /* --------------------- 3.2 behaviour --------------------- */

  action: "The operation, in one line, short enough to read off a drawing. It is prose for whoever opens the card. The agent is instructed by `spec`, not by this, and nothing in the engine parses it.",

  spec: "The natural-language payload given to the agent when someone instantiates the graph on their own machine. It must stand on its own, because the agent reading it never sees the rest of the graph. It must also respect the graph's isolation: if the text supplies information that an absent edge withholds, the isolation is false. One rule checks this field, `card/spec-too-thin`, and it only measures length.",

  model: "Which model the agent is instantiated with, written the way the provider writes the identifier. A default rather than a binding: a graph's `model_stylesheet` sets the model for every node matching a shape, an explicit field here outranks the sheet, and whoever runs the bundle outranks both. Absent on most cards, which means the node takes whatever the graph or the runner supplies.",

  agent: "A label the card's author chose for the agent behind the node. Nothing in the engine reads it.",

  skill: "Where the written procedure for this agent lives, as a path inside the repository you run from. It is only a pointer: no skill document travels in a DarkPrint bundle, and you write the file it names. A node whose `spec` field holds the whole instruction declares none.",

  tools: "`tool` capability terms from the vocabulary: what the node is permitted to do. This does not say which server supplies the capability; the `mcp` field answers that. A node can carry either field without the other.",

  mcp: "The MCP servers the node reaches, under the names they are registered with on the machine that runs the graph. Free text by design: an MCP server is a process somebody installed, and the vocabulary has no term for one.",

  params: "Nested configuration for the node, free-form but JSON-serializable. It travels with the card to whoever runs the graph; nothing in the engine interprets a key of it.",

  /* --------------------- 3.3 interfaces --------------------- */

  inputs: "The ports data arrives on, each with a name and an ontology `data-type`. The resolver checks every incoming edge against them: an edge whose source produces nothing this node accepts raises `bundle/type-mismatch`. This part of the interface is what a blueprint is checked against, not just described by.",

  outputs: "The ports data leaves on. An output type makes an edge into the next node meaningful. The next node's declared inputs and prohibitions are checked against it.",

  dependencies: "Cards this one expects to hear from, by id. This is the one card field that names topology, so it can point back at a line in the DOT on its own. The DOT still decides what is wired; this field says what the author expected to be wired.",

  cannot: "Data types that must never arrive, written as ontology term ids. The resolver checks every incoming edge against every entry and raises `bundle/prohibition-violated` when an edge can carry that type, or a narrower one. This is the half the engine holds the graph to.",

  will_not: "What the node undertakes never to do, in the author's own sentences. Nothing in the engine checks an entry here, and nothing can: no topology answers \"never opens a shell\". It is addressed to whoever reads the card and to the agent instantiated from it, which is why it is a field of its own rather than a second kind of entry inside `cannot`.",

  /* --------------------- 3.4 evaluation metadata --------------------- */

  risk_markers: "`risk-marker` terms the author declares against the node. The static analysis prices them into the blueprint's static risk-exposure reading. Declaring none is an answer, not an omission, and nothing infers a marker the card did not write.",

  notes: "The author's commentary on the card, addressed to whoever reads it. Nothing in the engine reads it and no check is made against it.",

  /* --------------------- 3.5 service fields --------------------- */

  version: "Semver of the card itself. A published version is never edited in place, so a pinned `id@version` means the same content forever and a change ships as a new version beside it.",

  author: "Who wrote the card. This is attribution. It is excluded from the card's digest, along with `provenance`. Two cards describing the same node are the same card, whoever typed them.",

  provenance: "Where the card came from when it did not start here, such as the bundle it was forked from or the document behind it. Free text, and excluded from the card's digest.",

};
