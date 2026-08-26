import { AuthorChip } from "darkprint";

/* Avatar + name row. `app/nodes/[...id]/page.tsx` puts it beside a card's version
   and ref, so both cells below carry the same shape: a handle and a display name,
   never "foo". */

const orin = { username: "orin", displayName: "Orin Solace", avatarHue: 190, validator: true };
const juno = { username: "juno-reyes", displayName: "Juno Reyes", avatarHue: 24, validator: false };

/** The size scale. `xl` is a profile header's own size and sits outside this row's use. */
export const Sizes = () => (
  <div className="flex flex-col items-start gap-3">
    <AuthorChip author={orin} size="sm" />
    <AuthorChip author={orin} size="md" />
    <AuthorChip author={orin} size="lg" />
  </div>
);

/** The validator badge is the one thing that changes the row's shape, not only its colour. */
export const ValidatorBadge = () => (
  <div className="flex flex-col items-start gap-3">
    <AuthorChip author={orin} />
    <AuthorChip author={juno} />
  </div>
);
