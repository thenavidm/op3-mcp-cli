/**
 * Shared plumbing every tool uses, now on Slipway.
 *
 * Tool modules keep describing themselves with a Zod shape and a handler. This
 * adapter turns each into a Slipway tool, so the MCP server, the CLI, the
 * annotations and the error mapping come from the framework rather than a copy
 * kept in this repo. Every OP3 endpoint is a read, so every tool is one: a
 * client deciding what to auto-approve can trust that nothing here changes
 * anything.
 */

import { ApiError, AuthError, NotFoundError, RateLimitError, SlipwayError, TimeoutError, UsageError, httpError, toolkit, z, type Tool } from "@thenavidm/slipway";
import type { ZodRawShape } from "zod";
import { ToolContext } from "./context.js";
import type { OP3Client } from "../api/client.js";
import type { Config } from "../config.js";
import { AuthenticationError, NetworkError, OP3Error, RateLimitError as OP3RateLimitError, TimeoutError as OP3TimeoutError, ValidationError } from "../api/errors.js";

/** What Slipway builds once per environment: the client, and the context a handler receives. */
export type AppContext = { config: Config; client: OP3Client; tools: ToolContext };

/** Drop null and undefined so a model is not handed a wall of empty fields. */
export function stripEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripEmpty(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      out[k] = stripEmpty(v);
    }
    return out as T;
  }
  return value;
}

/**
 * An OP3 error as the Slipway error that carries its exit code: the HTTP status
 * picks it, and the endpoint and OP3's own detail ride along. A plain Error is
 * one of this server's own argument checks ("not a time OP3 understands"), so
 * it is a usage error; anything else is unexpected.
 */
export function toSlipway(error: unknown): unknown {
  if (error instanceof SlipwayError) return error;
  if (error instanceof OP3Error) {
    const options = { ...(error.status ? { status: error.status } : {}), details: { endpoint: error.endpoint, ...(error.detail ? { detail: error.detail } : {}) } };
    if (error.status) return httpError(error.status, error.message, options);
    if (error instanceof AuthenticationError) return new AuthError(error.message, options);
    if (error instanceof OP3RateLimitError) return new RateLimitError(error.message, options);
    if (error instanceof ValidationError) return new UsageError(error.message, options);
    if (error instanceof OP3TimeoutError) return new TimeoutError(error.message, options);
    if (error instanceof NetworkError) return new ApiError(error.message, options);
    return new ApiError(error.message, options);
  }
  if (error instanceof Error && error.constructor === Error) return new UsageError(error.message);
  return error;
}

export type ToolDef = {
  name: string;
  description: string;
  schema: ZodRawShape;
  /**
   * Deps arrive as the second argument rather than being closed over.
   *
   * That is what lets the same definitions serve two very different hosts. Run
   * over stdio there is one context for the process. Run as a hosted connector
   * there is one per request, because each caller brings their own OP3 token,
   * and a context baked in at module load would hand every caller the first
   * one's credentials.
   */
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

/**
 * Build the context a handler receives.
 *
 * `buildServer` used to construct this inline, which meant the CLI had to
 * duplicate the constructor call and would quietly diverge the day the context
 * grew a third argument. Both surfaces now come through here, so there is one
 * definition of what a handler is handed.
 */
export function makeContext(client: OP3Client, config: Config): ToolContext {
  return new ToolContext(client, config);
}

export { ToolContext };

const kit = toolkit<AppContext>();

/**
 * A tool's title for the command list and `which`: its description's first
 * clause, "A show's headline download numbers", when that is short. 1.x used the
 * tool's name, which the CLI then printed twice on every line.
 */
export function shortTitle(def: ToolDef): string {
  const clause = def.description.split(/[.:;](?:\s|$)|\n/)[0]!.trim();
  if (clause && clause.length <= 60) return clause;
  const words = def.name.replace(/^op3_/, "").split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One OP3 tool as a Slipway tool: a read, with nulls dropped from what it returns. */
export function toTool(def: ToolDef): Tool<AppContext> {
  return kit.defineTool({
    name: def.name,
    title: shortTitle(def),
    description: def.description,
    input: z.object(def.schema),
    risk: "read",
    handler: async (args, ctx) => {
      try {
        return stripEmpty(await def.handler(args as Record<string, unknown>, ctx.tools));
      } catch (error) {
        throw toSlipway(error);
      }
    },
  });
}

/**
 * The note attached to any result built from a capped pull.
 *
 * A truncated result that does not say so turns every rate computed from it
 * into a quiet lie, so this is not decoration.
 */
export function truncationNote(
  truncated: boolean,
  stoppedBy: string | undefined,
  rows: number,
): string | undefined {
  if (!truncated) return undefined;
  return stoppedBy === "maxRows"
    ? `Stopped at the ${rows}-row cap before the window was covered, so these figures describe a sample rather than the whole window. Narrow the window, or raise OP3_MAX_ROWS.`
    : `Stopped at the page cap after ${rows} rows before the window was covered, so these figures describe a sample rather than the whole window. Narrow the window, or raise OP3_MAX_PAGES.`;
}
