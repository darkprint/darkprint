import { Ticked } from "darkprint";

/** A version-bump reason, the component's original caller: a sentence naming a port. */
export const BumpReason = () => (
  <p className="max-w-md text-[13px] leading-relaxed text-muted">
    <Ticked text="Adds an optional `retries` input; a card pinned to the prior version still validates." />
  </p>
);

/** A node card's own spec prose, at the size `/nodes/<id>` renders it. */
export const CardSpec = () => (
  <p className="max-w-lg text-base leading-relaxed text-fg">
    <Ticked text="Read `diff` from the upstream port and write a patch to `output`. Never touch `acceptance_criteria`, whatever the router hands you." />
  </p>
);
