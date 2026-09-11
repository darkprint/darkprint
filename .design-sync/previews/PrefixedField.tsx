import { PrefixedField } from "darkprint";

/** `AccountForm`'s handle field: the account already has one. */
export const Filled = () => (
  <PrefixedField
    id="handle"
    prefix="darkprint.io/u/"
    value="orin"
    onChange={() => {}}
    label="Handle"
    placeholder="choose one"
    maxLength={32}
  />
);

/** `WelcomeForm`'s first run: no handle claimed yet, so the field shows only its placeholder. */
export const Empty = () => (
  <PrefixedField
    id="handle"
    prefix="darkprint.io/u/"
    value=""
    onChange={() => {}}
    label="Handle"
    placeholder="your-handle"
    maxLength={32}
  />
);
