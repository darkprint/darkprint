/* ============================================================
   The in-process executor: what it converts, and who may import it

   Two claims. The refusal sentences an agent reads over HTTP and
   over stdio are the same sentences, driven through `handleMethod`
   with both executors so the comparison is on the text the model
   gets. And nothing the bundler follows from `cli.ts` imports this
   module, because it reaches the database driver.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIMITS,
  RateLimitedError,
  createSlotCounter,
  enforceLimit,
  type LimitConfig,
} from "@/lib/server/limits";
import { McpRefusedError } from "@/lib/server/mcp";
import { localExecutor } from "./local";
import { handleMethod } from "./protocol";
import { NOT_FOUND_TEXT } from "./refusals";
import { httpExecutor } from "./tools";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** A refusal the store would raise, without a store: an admit hook that throws it. */
const refusing = localExecutor({} as never, { kind: "anonymous" }, async () => {
  throw new McpRefusedError("mcpReadCard");
});

/** The registry answering 404 to everything. */
const notFound = httpExecutor({
  baseUrl: "https://registry.test",
  fetch: (() => Promise.resolve(new Response("{}", { status: 404 }))) as typeof fetch,
});

const CALL = { name: "read_card", arguments: { ref: "nope@1.0.0" } };

async function text(executor: Parameters<typeof handleMethod>[2]): Promise<{ isError?: boolean; text: string }> {
  const result = (await handleMethod("tools/call", CALL, executor)) as {
    isError?: boolean;
    content: { text: string }[];
  };
  return { isError: result.isError, text: result.content[0]!.text };
}

describe("a refusal reads the same over both transports", () => {
  it("renders a store refusal and a 404 as one sentence, as tool results", async () => {
    const local = await text(refusing);
    const remote = await text(notFound);
    expect(local.isError).toBe(true);
    expect(remote.isError).toBe(true);
    expect(local.text).toBe(NOT_FOUND_TEXT);
    expect(remote.text).toBe(local.text);
    /* The verb's own operation name must not reach the model: it is the one part of the
       refusal that differs per verb and says nothing an agent can act on. */
    expect(local.text).not.toContain("mcpReadCard");
  });

  it("renders a rate limit with the instant, the wait and the key affordance, like the stdio server", async () => {
    /* A real refusal from the limits module, over a private counter and a one-request
       ceiling, so the error carries the verdict the executor reads. */
    const config: LimitConfig = {
      ...DEFAULT_LIMITS,
      read: { anonymous: { limit: 1, windowMs: 3_600_000 }, account: DEFAULT_LIMITS.read.account, key: DEFAULT_LIMITS.read.key },
    };
    const counter = createSlotCounter();
    const subject = { tier: "anonymous", ip: "203.0.113.9" } as const;
    await enforceLimit(subject, "read", { config, counter });
    let limited: RateLimitedError | undefined;
    try {
      await enforceLimit(subject, "read", { config, counter });
    } catch (err) {
      limited = err as RateLimitedError;
    }
    expect(limited).toBeInstanceOf(RateLimitedError);

    const throttled = localExecutor({} as never, { kind: "anonymous" }, async () => {
      throw limited;
    });
    const local = await text(throttled);
    expect(local.isError).toBe(true);
    expect(local.text).toContain("Rate limited by the DarkPrint registry.");
    expect(local.text).toContain(limited!.message);
    expect(local.text).toContain("from now");
    expect(local.text).toContain("DARKPRINT_API_KEY");

    /* The stdio server rendering the same document off the wire says the same thing. */
    const detail = limited!.message;
    const resetAt = /resets at (\S+)\./.exec(detail)?.[1];
    expect(resetAt).toBeDefined();
    const remote = httpExecutor({
      baseUrl: "https://registry.test",
      fetch: (() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: 429, detail, limit: 1, remaining: 0, resetAt, keysAvailable: true }), {
            status: 429,
          }),
        )) as typeof fetch,
    });
    expect((await text(remote)).text).toBe(local.text);
  });

  it("lets any other failure through with its own message", async () => {
    const broken = localExecutor({} as never, { kind: "anonymous" }, async () => {
      throw new Error("mcpReadCard: the MCP store failed.");
    });
    const local = await text(broken);
    expect(local.isError).toBe(true);
    expect(local.text).toBe("mcpReadCard: the MCP store failed.");
  });
});

describe("the bundled entry never reaches this module", () => {
  it("is imported by no file the bundler follows from cli.ts", () => {
    const shipped = readdirSync(HERE).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "local.ts",
    );
    expect(shipped).toContain("cli.ts");
    const offenders = shipped.filter((name) => /from\s+["']\.\/local["']/.test(readFileSync(join(HERE, name), "utf8")));
    expect(
      offenders,
      "`local.ts` reaches the database driver; a file the bin bundles must not import it.",
    ).toEqual([]);
  });
});
