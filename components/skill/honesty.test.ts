/* ============================================================
   The sentences `/skill` is not allowed to stop saying.

   The page hands a reader a document their own agent will run, and
   the two questions anybody then asks are "what does it do on my
   machine" and "where does my folder go". The answers are limit
   statements about the DarkPrint skill itself, and limit statements
   are what length passes lose. Each row is checked against the real
   render, in the open, and against the `<head>` description a search
   result or a shared link quotes.

   A row leaves this file only when the claim it guards has nothing
   left to guard, in the same commit, with the reason in the message.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SkillPage, { metadata as skillMetadata } from "@/app/skill/page";
import { openText } from "@/components/ui/visible-text";

const SKILL_PAGE = renderToStaticMarkup(createElement(SkillPage as never));
const SKILL_METADATA_DESCRIPTION = skillMetadata.description ?? "";

interface Claim {
  surface: string;
  /** What the sentence is for, in the failure message. */
  why: string;
  /** Verbatim, lowercased at compare time. A paraphrase is a different sentence. */
  says: string;
  html: string;
}

const CLAIMS: readonly Claim[] = [
  {
    surface: "/skill · the closing section",
    why: "the reader has just installed a document their agent will execute, and the page has to say what that document does to their machine: it writes, and nothing else runs because of it",
    says: "the darkprint skill writes files and runs nothing",
    html: SKILL_PAGE,
  },
  {
    surface: "/skill · the closing section",
    why: "the folder is the reader's work, and the page has to say that nothing carries it off the machine without their say-so; the validator call and the publish are both steps the skill asks for",
    says: "nothing leaves your machine on its own",
    html: SKILL_PAGE,
  },
  {
    surface: "/skill · the closing section",
    why: "publishing exists now, from the browser and with a key, so the limit is not that it cannot be done but that the skill does not do it: the reader does",
    says: "publishing is your step",
    html: SKILL_PAGE,
  },
  {
    surface: "/skill · metadata.description",
    why: "the same limit where a reader who never opens the page reads it: a search result, a shared link's preview card, a browser history entry",
    says: "runs nothing and sends nothing on its own",
    html: SKILL_METADATA_DESCRIPTION,
  },
];

describe("the surface the ledger is read off", () => {
  it("rendered a whole page, so no row below passes over an empty string", () => {
    expect(SKILL_PAGE.length).toBeGreaterThan(2000);
    expect(SKILL_METADATA_DESCRIPTION.length).toBeGreaterThan(80);
  });
});

describe("claims /skill may not stop making", () => {
  it.each(CLAIMS.map((c) => [`${c.surface} — "${c.says.slice(0, 48)}…"`, c] as const))(
    "%s",
    (_name, claim) => {
      expect(openText(claim.html).toLowerCase(), `${claim.why}. Surface: ${claim.surface}`).toContain(
        claim.says.toLowerCase(),
      );
    },
  );
});
