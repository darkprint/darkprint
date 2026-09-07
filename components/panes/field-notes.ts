/* ============================================================
   What each field of a card is FOR, written once.

   Two surfaces draw the same 22 wire keys, `/nodes/<id>`'s field table and the blueprint
   page's card skeleton, and a sentence written twice drifts before anyone notices. A note
   says what the field is for: the contract, what checks it, and the thing that is easy to
   assume and wrong. It is value independent; what a particular card writes is the
   renderer's job.

   Client safe: plain strings and no imports. `SkeletonPane` is a client component and
   pulls this table into the browser bundle.

   Nothing on this site runs a graph, so a sentence about what happens when one runs names
   whose machine it runs on. Every claim about a check names the check, and the fields
   nothing checks say so.
   ============================================================ */

/**
 * One paragraph per wire key, keyed exactly as the YAML spells it (`phase`, not `phases`).
 * Whether a person acts at the node is answered by `type`, so there is no separate note
 * for it.
 */
export const FIELD_NOTE: Record<string, string> = {
  /* --------------------- identity --------------------- */

  id: "The key a blueprint pins. A DOT node carries `card=\"id@version\"`, and this string is the only way a graph and a card find each other. It may be namespaced, `berti/solver-a`, so two authors can publish a card under the same short name.",

  name: "What a person calls the node. The drawing prints it and every listing leads with it. Nothing matches on it: that is the `id`'s job, and the two are free to disagree.",

  type: "Exactly one `node-type` term from the vocabulary. It says what kind of work the node does and whether a person acts at it: a type under `human-in-the-loop`, such as `human-gate`, holds the run until somebody acts; every other type lets it pass. The static analysis groups nodes by this term. Either way it is the author's design choice; nothing here is measured.",

  phase: "Which of the five phases the node stands in, any number of them. The phases describe a blueprint's shape rather than placing every node in one. Intake, retrieval and routing are real work that none of the five names, so declaring none is a valid answer.",

  /* --------------------- behaviour --------------------- */

  action: "The operation, in one line, short enough to read off a drawing. It is prose for whoever opens the card. The agent is instructed by `spec`, and nothing parses this line.",

  spec: "The instructions handed to the agent when someone runs the graph on their own machine. They must stand on their own, because the agent never sees the rest of the graph. They must not carry what the graph withholds: if the text supplies information no edge brings to this node, the isolation the graph draws exists only on paper. One check reads this field, `card/spec-too-thin`, and it only measures length.",

  model: "Which model the agent is instantiated with, written the way the provider writes the identifier. A default rather than a binding: a graph's `model_stylesheet` sets the model for every node matching a shape, an explicit field here outranks the sheet, and whoever runs the blueprint outranks both. Absent on most cards, which means the node takes whatever the graph or the runner supplies.",

  agent: "A label the card's author chose for the agent behind the node. Nothing checks it.",

  skill: "Where the written procedure for this agent lives, as a path inside the repository you run from. It is only a pointer: no skill document travels in a DarkPrint bundle, and you write the file it names. A node whose `spec` field holds the whole instruction declares none.",

  tools: "`tool` capability terms from the vocabulary: what the node is permitted to do. This does not say which server supplies the capability; the `mcp` field answers that. A node can carry either field without the other.",

  mcp: "The MCP servers the node reaches, under the names they are registered with on the machine that runs the graph. Free text by design: an MCP server is a process somebody installed, and the vocabulary has no term for one.",

  params: "Nested configuration for the node, free-form but JSON-serializable. It travels with the card to whoever runs the graph; nothing on this site interprets a key of it.",

  /* --------------------- interfaces --------------------- */

  inputs: "The ports data arrives on, each with a name and a `data-type` term from the vocabulary. Every incoming edge is checked against them: an edge whose source produces nothing this node accepts is reported as `bundle/type-mismatch`.",

  outputs: "The ports data leaves on. An output type makes an edge into the next node meaningful. The next node's declared inputs and prohibitions are checked against it.",

  dependencies: "Cards this one expects to hear from, by id. This is the one card field that names topology, so it can point back at a line in the DOT on its own. The DOT still decides what is wired; this field says what the author expected to be wired.",

  cannot: "Data types that must never arrive, written as vocabulary term ids. Every incoming edge is checked against every entry, and an edge that can carry that type, or a narrower one, is refused as `bundle/prohibition-violated`. This is the half of the node's refusals that the checker enforces; `will_not` is the other half, which nothing checks automatically.",

  will_not: "What the node promises never to do, in the author's own sentences. Nothing checks an entry here, and nothing can: a promise like \"never opens a shell\" cannot be read off a graph. It is addressed to whoever reads the card and to the agent instantiated from it, which is why it is a field of its own rather than a second kind of entry inside `cannot`.",

  /* --------------------- evaluation metadata --------------------- */

  risk_markers: "`risk-marker` terms the author declares for the node. The static analysis subtracts each distinct marker's weight from the blueprint's static risk-exposure reading, once per blueprint however many nodes carry it. An empty list is a valid answer. Three markers are also read off the graph whether or not a card declares them: unbounded loops, unvalidated external access and criteria leaks.",

  notes: "The author's commentary on the card, addressed to whoever reads it. Nothing checks it.",

  /* --------------------- service fields --------------------- */

  version: "Semver of the card itself. A published version is never edited in place, so a pinned `id@version` means the same content forever and a change ships as a new version beside it.",

  author: "Who wrote the card. It is excluded from the card's digest, along with `provenance`. Two cards describing the same node are the same card, whoever typed them.",

  provenance: "Where the card came from when it did not start here, such as the blueprint it was forked from or the document behind it. Free text, and excluded from the card's digest.",
};
