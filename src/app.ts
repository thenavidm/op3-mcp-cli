/**
 * The OP3 app: everything Slipway needs to ship the MCP server and the CLI.
 *
 * This file only describes. It never starts anything, so `slipway check` and
 * tests can import it; `index.ts` is what runs.
 */

import { createRequire } from "node:module";
import { slipway, type DoctorCheck } from "@thenavidm/slipway";
import { OP3Client } from "./api/client.js";
import { OP3Error } from "./api/errors.js";
import { loadConfig, PREVIEW_TOKEN } from "./config.js";
import { INSTRUCTIONS } from "./instructions.js";
import { TOOLS } from "./tools/index.js";
import { makeContext, type AppContext } from "./tools/kit.js";

const require = createRequire(import.meta.url);
export const VERSION: string = (require("../package.json") as { version: string }).version;

const message = (error: unknown): string => (error instanceof OP3Error ? error.message : ((error as Error)?.message ?? String(error)));

/**
 * The checks 1.x's doctor ran. The preview token is advice rather than a fault:
 * the server is fully usable on it, so it never makes doctor fail. The two
 * network checks run every time, as they did, because the firehose can fail on
 * its own: a deadline that suits the rolled-up endpoints can be too short for a scan.
 */
async function doctor({ config, client }: AppContext): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [
    config.usingPreviewToken
      ? { name: "Token", ok: false, warn: true, detail: `OP3's shared preview token "${PREVIEW_TOKEN}": it works, but it is shared, rate limited and can be withdrawn`, fix: "Create your own at https://op3.dev/api/keys and set OP3_TOKEN." }
      : { name: "Token", ok: true, detail: "OP3_TOKEN is set" },
  ];
  try {
    const started = Date.now();
    const apps = await client.getTopApps();
    const count = Object.keys(apps.appShares ?? {}).length;
    checks.push({ name: "OP3 API", ok: count > 0, detail: count > 0 ? `${count} apps returned in ${Date.now() - started} ms` : "OP3 answered with no data, which is unexpected" });
  } catch (error) {
    checks.push({ name: "OP3 API", ok: false, detail: message(error) });
  }
  try {
    const started = Date.now();
    const hits = await client.getHitsPage({ start: "-1h", limit: 1 });
    checks.push({ name: "Raw queries", ok: true, detail: `${(hits.rows ?? []).length} row in ${Date.now() - started} ms; scans are far slower than the rolled-up queries` });
  } catch (error) {
    checks.push({ name: "Raw queries", ok: false, detail: message(error), fix: "Raise OP3_REQUEST_TIMEOUT_MS if this timed out." });
  }
  checks.push({ name: "Limits", ok: true, detail: `${config.baseUrl}, ${config.requestTimeoutMs} ms per request, ${config.minRequestIntervalMs} ms between requests, ${config.maxRows} rows and ${config.maxPages} pages per query, cache ${config.cacheTtlMs} ms` });
  return checks;
}

export type AppOptions = {
  /** Replace how handlers get their client, for tests that stub the network. */
  context?: (env: NodeJS.ProcessEnv) => AppContext;
};

export function createApp(options: AppOptions = {}) {
  return slipway<AppContext>({
    name: "op3",
    title: "OP3",
    version: VERSION,
    package: "@thenavidm/op3-mcp-cli",
    description: "Podcast analytics from OP3, the Open Podcast Prefix Project: downloads, audience, apps, geography and trends, all read-only.",
    instructions: INSTRUCTIONS,
    context:
      options.context ??
      ((env) => {
        const config = loadConfig(env);
        const client = new OP3Client(config);
        return { config, client, tools: makeContext(client, config) };
      }),
    // OP3's shared preview token works with no account, so the server is always usable.
    configured: () => true,
    secrets: (ctx) => (ctx.config.usingPreviewToken ? [] : [ctx.config.token]),
    tools: TOOLS,
    doctor,
    doctorNetwork: true,
    // 1.x said this on stderr at startup: a nudge, never a block.
    onServe: (ctx, log) => {
      if (ctx.config.usingPreviewToken) log.warn("No OP3_TOKEN set, using OP3's shared preview token. It is rate limited and can be withdrawn. Get your own at https://op3.dev/api/keys");
    },
    login: "OP3 works with no account, on its shared preview token, which is rate limited. For your own, create a key at https://op3.dev/api/keys and set OP3_TOKEN in your shell or your MCP client's environment, then run op3-cli doctor. This command does not open a browser or store anything.",
    settings: [
      { env: "OP3_TOKEN", description: "Bearer token from https://op3.dev/api/keys; without it the server uses OP3's shared preview token.", secret: true },
      { env: "OP3_API_KEY", description: "Another name for OP3_TOKEN, the word OP3's keys page uses.", secret: true, tuning: true },
      { env: "OP3_REQUEST_TIMEOUT_MS", description: "Each request's deadline; 45000 when unset.", tuning: true },
      { env: "OP3_MIN_REQUEST_INTERVAL_MS", description: "Spacing between requests; 150 when unset.", tuning: true },
      { env: "OP3_MAX_RETRIES", description: "Retries on 429 and server errors; 3 when unset.", tuning: true },
      { env: "OP3_MAX_ROWS", description: "Cap on rows any one analysis pulls; 50000 when unset.", tuning: true },
      { env: "OP3_MAX_PAGES", description: "Cap on continuation pages; 40 when unset.", tuning: true },
      { env: "OP3_CACHE_TTL_MS", description: "How long a response stays cached; 300000 when unset, 0 turns the cache off.", tuning: true },
      { env: "OP3_USER_AGENT", description: "Sent on every request; op3-mcp when unset.", tuning: true },
      { env: "OP3_BASE_URL", description: "OP3's API root; https://op3.dev/api/1 when unset.", tuning: true },
    ],
    links: { repository: "https://github.com/thenavidm/op3-mcp-cli" },
  });
}

export const app = createApp();
