/* ============================================================
   darkprint mcp: the tools, executed over HTTP
   The stdio server runs on a reader's machine and reaches the
   registry the way any client does, one GET per tool, so the
   answer has one author whether it is reached here or in-process.
   `export_pipeline` is the one tool that makes more than one call:
   no single route hands over a whole bundle, so it assembles the
   release from the listing and files routes and compiles it with
   the same compiler `darkprint export --attractor` uses.
   ============================================================ */

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-117): export_pipeline reads SEAM-91's release address and SEAM-19's file address

import {
  attractorPipeline,
  fetchFile,
  fetchFileList,
  pipelineFromFiles,
} from "../../cli/src/index";
import { optionalBool, optionalInt, optionalStr, str } from "./args";
import type { ToolExecutor } from "./protocol";
import { request, type RegistryOptions } from "./registry";

const segment = encodeURIComponent;

/** A query string from the pairs whose value is present. */
function query(pairs: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(pairs)) {
    if (value !== undefined) params.set(key, value);
  }
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

/** Every tool, as one GET (or, for the compiler, a listing plus one GET per file). */
export function httpExecutor(options: RegistryOptions): ToolExecutor {
  return async (name, args) => {
    switch (name) {
      case "find_blueprints": {
        const limit = optionalInt(args, "limit");
        const forks = optionalBool(args, "include_forks");
        return request(
          options,
          `/api/mcp/blueprints/find${query({
            task: str(args, "task"),
            limit: limit === undefined ? undefined : String(limit),
            forks: forks === true ? "all" : undefined,
          })}`,
        );
      }

      case "find_cards": {
        const limit = optionalInt(args, "limit");
        return request(
          options,
          `/api/mcp/cards/find${query({
            task: str(args, "task"),
            limit: limit === undefined ? undefined : String(limit),
          })}`,
        );
      }

      case "get_blueprint":
        return request(
          options,
          `/api/mcp/blueprints/${segment(str(args, "owner"))}/${segment(str(args, "slug"))}/bundle` +
            query({ digest: optionalStr(args, "digest"), harness: optionalStr(args, "harness") }),
        );

      case "read_card": {
        /* Each path segment is encoded separately: a namespaced id spans two segments, so
           encoding the whole ref would turn its `/` into `%2F` and address nothing. */
        const ref = str(args, "ref").split("/").map(segment).join("/");
        return request(options, `/api/mcp/cards/${ref}`);
      }

      case "inspect_provenance":
        return request(
          options,
          `/api/mcp/blueprints/${segment(str(args, "owner"))}/${segment(str(args, "slug"))}/provenance`,
        );

      case "fetch_release":
        return request(
          options,
          `/api/mcp/releases/${segment(str(args, "owner"))}/${segment(str(args, "slug"))}` +
            `/d/${segment(str(args, "digest"))}`,
        );

      case "export_pipeline": {
        const owner = str(args, "owner");
        const slug = str(args, "slug");
        const digest = str(args, "digest");

        const paths = await fetchFileList(options, owner, slug, digest);
        const files: Record<string, string> = {};
        for (const path of paths) {
          files[path] = await fetchFile(options, owner, slug, digest, path);
        }
        /* `<owner>/<slug>@<digest>` is what a refusal names, and every part of it is the
           caller's own argument. */
        return attractorPipeline(pipelineFromFiles(files, slug), `${owner}/${slug}@${digest}`).dot;
      }

      default:
        throw new Error(`Unknown tool \`${name}\`.`);
    }
  };
}
