import { Id } from "darkprint";

/**
 * `Id` is always inline in prose, quoting a term id or a field name out of the schema
 * (`OntologyCatalog`, `/spec/topology`). It takes a string rather than markup so a page
 * cannot nest a link inside an identifier, which is the whole reason it exists as its
 * own component rather than a bare `<code>`.
 */
export const InProse = () => (
  <p className="max-w-xl text-sm leading-relaxed text-muted">
    There are 4 roots below, not one. <Id>agent</Id> and <Id>tool</Id> stand on their own;{" "}
    <Id>human-in-the-loop</Id> and <Id>evaluative</Id> are abstract categories that exist to be
    asked about and that no card ever declares directly.
  </p>
);

/** A field name quoted the same way, off a card's own wire keys. */
export const FieldNames = () => (
  <p className="max-w-xl text-sm leading-relaxed text-muted">
    A card&apos;s <Id>phase</Id> names one of the five, several of them, or none. One name looks
    free, but it is not: a node <Id>type</Id> attribute means <Id>card</Id> and <Id>digest</Id>{" "}
    travel inside the file a runner instantiates.
  </p>
);
