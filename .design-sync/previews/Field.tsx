import { Field } from "darkprint";

export const WithHint = () => (
  <Field id="handle" label="Handle" hint="Lowercase letters, digits and hyphens. This is the name your bundles are published under.">
    <input
      id="handle"
      defaultValue="orin"
      className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-fg"
    />
  </Field>
);

export const Bare = () => (
  <Field id="display-name" label="Display name">
    <input
      id="display-name"
      defaultValue="Orin Vale"
      className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-fg"
    />
  </Field>
);
