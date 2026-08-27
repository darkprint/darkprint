import { Avatar } from "darkprint";

/** Real fixture authors (`lib/data/users.ts`), so the gradient hues and initials are the site's own. */
const ORIN = {
  username: "orin",
  displayName: "Orin Vasquez",
  avatarHue: 208,
  validator: false,
};

const LUPO = {
  username: "lupo",
  displayName: "Lupo Ferretti",
  avatarHue: 350,
  validator: true,
};

/** The size scale a bundle header, a comment row and a profile header each pick one rung of. */
export const Sizes = () => (
  <div className="flex items-end gap-4">
    <Avatar author={ORIN} size="sm" />
    <Avatar author={ORIN} size="md" />
    <Avatar author={ORIN} size="lg" />
    <Avatar author={ORIN} size="xl" />
  </div>
);

/** A validator's ring, and the size `ProfileHeader` renders it at, linking out to `/u/lupo`. */
export const Validator = () => <Avatar author={LUPO} size="xl" link />;
