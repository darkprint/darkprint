import { SectionHeading } from "darkprint";

/* `/ontology`'s own h1. The lead is full column width by ruling, not `.prose-lane`: the
   author overruled the narrower measure twice, on the wrapped result, and the rule is
   "a SectionHeading lead reaches the right edge" — this cell is the thing that proves it. */
export const RegistryLead = () => (
  <SectionHeading
    as="h1"
    eyebrow="Ontology"
    title="The words a blueprint is written in"
    lead="One curated set of identifiers, plus whatever a bundle declares in its own namespace. A card may only name a term that resolves here. That is what makes an edge checkable."
  />
);

/** `SectionNodeCard`'s h2, the default level and size, with a `<code>` span inside the lead. */
export const NodeIsCard = () => (
  <SectionHeading
    eyebrow="One node, line by line"
    title="A node is a card, and the card is checkable"
    lead={
      <>
        This is <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[13px] text-fg">code-builder@1.0.0</code>{" "}
        as the archive stores it. Nine places on the card decide what the node is, what it
        does, the brief it is handed, which model it runs, what it may reach, what arrives
        and what must never arrive.
      </>
    }
  />
);

/** `/welcome`'s centred h1, the one caller that sets `align="center"`. */
export const ChooseHandle = () => (
  <SectionHeading
    as="h1"
    align="center"
    eyebrow="One step left"
    title="Choose your handle"
    lead="It is your address on the registry, and it goes inside every card you publish, so it is reserved to you for good."
  />
);
