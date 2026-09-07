/* ============================================================
   darkprint mcp: the tools, executed in-process
   The remote endpoint runs inside the registry, so it calls the
   verbs directly and renders the same JSON the GET routes answer.
   This module reaches the database driver and MUST NOT be imported
   by `cli.ts`, `server.ts` or anything the bundler follows from
   them; `local.test.ts` holds that line.

   A refusal and a rate limit are rendered here, where the spend
   happens, so a tool result over HTTP reads the same as one over
   stdio and the model can act on either.
   ============================================================ */

import type { Db } from "@/lib/db";
import { RateLimitedError, rateLimitContext } from "@/lib/server/limits";
import {
  McpRefusedError,
  isMcpHarness,
  mcpFetchRelease,
  mcpFindBlueprints,
  mcpFindCards,
  mcpGetBlueprint,
  mcpProvenance,
  mcpReadCard,
} from "@/lib/server/mcp";
import type { Actor } from "@/lib/server/policy";
import { attractorPipeline, pipelineFromFiles } from "../../cli/src/index";
import { optionalBool, optionalInt, optionalStr, str } from "./args";
import type { ToolExecutor } from "./protocol";
import { rateLimitText } from "./rate-limit";
import { NOT_FOUND_TEXT } from "./refusals";

/**
 * Every tool, run against the database as `actor`.
 *
 * `admit` runs before each tool and is where the caller's read is spent; it sits inside the
 * conversion below so a refused spend reaches the model as the same sentence the stdio
 * server prints for a 429, rather than as the limits module's bare detail.
 */
export function localExecutor(
  db: Db,
  actor: Actor,
  admit: () => Promise<void> = async () => {},
): ToolExecutor {
  return async (name, args) => {
    try {
      await admit();
      return await run(db, actor, name, args);
    } catch (err) {
      if (err instanceof McpRefusedError) throw new Error(NOT_FOUND_TEXT);
      if (err instanceof RateLimitedError) {
        const context = rateLimitContext(err);
        throw new Error(
          rateLimitText({
            detail: err.message,
            ...(context === undefined
              ? {}
              : {
                  limit: context.verdict.limit,
                  remaining: context.verdict.remaining,
                  resetAt: context.verdict.resetAt.toISOString(),
                }),
            keysAvailable: true,
          }),
        );
      }
      throw err;
    }
  };
}

async function run(
  db: Db,
  actor: Actor,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "find_blueprints": {
      const limit = optionalInt(args, "limit");
      const includeForks = optionalBool(args, "include_forks");
      return JSON.stringify(
        await mcpFindBlueprints(db, actor, str(args, "task"), {
          ...(limit === undefined ? {} : { limit }),
          ...(includeForks === undefined ? {} : { includeForks }),
        }),
      );
    }

    case "find_cards": {
      const limit = optionalInt(args, "limit");
      return JSON.stringify(
        await mcpFindCards(db, actor, str(args, "task"), limit === undefined ? {} : { limit }),
      );
    }

    case "get_blueprint": {
      const digest = optionalStr(args, "digest");
      const harness = optionalStr(args, "harness");
      return JSON.stringify(
        await mcpGetBlueprint(db, actor, str(args, "owner"), str(args, "slug"), {
          ...(digest === undefined ? {} : { digest }),
          ...(isMcpHarness(harness) ? { harness } : {}),
        }),
      );
    }

    case "read_card":
      return await mcpReadCard(db, actor, str(args, "ref"));

    case "inspect_provenance":
      return JSON.stringify(await mcpProvenance(db, actor, str(args, "owner"), str(args, "slug")));

    case "fetch_release": {
      const files = await mcpFetchRelease(
        db,
        actor,
        str(args, "owner"),
        str(args, "slug"),
        str(args, "digest"),
      );
      return JSON.stringify({ files: files.map((file) => file.path) });
    }

    case "export_pipeline": {
      const owner = str(args, "owner");
      const slug = str(args, "slug");
      const digest = str(args, "digest");
      const exported = await mcpFetchRelease(db, actor, owner, slug, digest);
      const files: Record<string, string> = {};
      for (const file of exported) files[file.path] = file.text;
      return attractorPipeline(pipelineFromFiles(files, slug), `${owner}/${slug}@${digest}`).dot;
    }

    default:
      throw new Error(`Unknown tool \`${name}\`.`);
  }
}
