import type { Author } from "@/lib/types";

export const AUTHORS = {
  mara: {
    username: "mara-veil",
    displayName: "Mara Veiga",
    avatarHue: 268,
    validator: true,
    bio: "Orchestration researcher. Builds closed-loop agent lines and breaks them for a living.",
  },
  kwame: {
    username: "k0bra",
    displayName: "Kwame Obasi",
    avatarHue: 172,
    validator: false,
    bio: "Backend engineer turned agent wrangler. Obsessed with mid-pipeline recovery.",
  },
  sol: {
    username: "sol-antczak",
    displayName: "Sol Antczak",
    avatarHue: 32,
    validator: true,
    bio: "Validator. Writes the static analyzers that grade autonomy so you don't have to trust the README.",
  },
  orin: {
    username: "orin",
    displayName: "Orin Vasquez",
    avatarHue: 208,
    validator: false,
    bio: "Turning natural-language goals into runnable blueprints for non-technical teams.",
  },
  lupo: {
    username: "lupo",
    displayName: "Lupo Ferretti",
    avatarHue: 350,
    validator: true,
    bio: "Ontologist. If it isn't a typed graph, it isn't a blueprint, it's a vibe.",
  },
  hachi: {
    username: "hachi",
    displayName: "Hana Ito",
    avatarHue: 120,
    validator: false,
    bio: "Reliability engineer. Runs blueprints a thousand times to see what falls off.",
  },
} satisfies Record<string, Author>;

export const AUTHOR_LIST: Author[] = Object.values(AUTHORS);

export function getAuthor(username: string): Author | undefined {
  return AUTHOR_LIST.find((a) => a.username === username);
}
