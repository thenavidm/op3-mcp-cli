#!/usr/bin/env node
/**
 * Entry point.
 *
 * `op3-mcp`          stdio, which is what an MCP client launches
 * `op3-mcp --http`   HTTP, for running it somewhere always on
 * `op3-mcp <tool>`   run one tool from the shell, see cli.ts
 * `op3-mcp doctor`   check the setup and say what is actually wrong
 *
 * The shell surface is generated from the same `ALL_TOOLS` array the server
 * registers, so every tool is a command and neither surface can drift.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer, VERSION } from "./server.js";
import { loadConfig } from "./config.js";
import { httpOptionsFromEnv, startHttpServer } from "./transport/http.js";
import { isCliCommand, runCli } from "./cli.js";

const HELP = `op3-mcp ${VERSION}

Podcast analytics from OP3, the Open Podcast Prefix Project. 22 tools, all read-only.

  op3-mcp                     Run over stdio. This is what an MCP client launches.
  op3-mcp --http [--port=N]   Run over HTTP, for a machine that is always on.
  op3-mcp tools               List every tool as a shell command.
  op3-mcp <tool> [--flags]    Run one tool. Same names as the MCP surface.
  op3-mcp <tool> --help       What that tool takes.
  op3-mcp schema <tool>       The JSON schema an MCP client sees.
  op3-mcp doctor              Check the setup and report what is wrong.
  op3-mcp --version           Print the version.

  Every command prints JSON on --json, and errors as JSON on stderr.

Credentials:
  OP3_TOKEN                   Bearer token from https://op3.dev/api/keys
                              Optional. Without it the server uses OP3's shared
                              preview token, which works but is rate limited.
  OP3_API_KEY                 accepted as an alias for OP3_TOKEN

Options:
  OP3_REQUEST_TIMEOUT_MS      per-request deadline, default 45000
  OP3_MIN_REQUEST_INTERVAL_MS spacing between requests, default 150
  OP3_MAX_RETRIES             retries on 429 and 5xx, default 3
  OP3_MAX_ROWS                cap on rows any one analysis pulls, default 50000
  OP3_MAX_PAGES               cap on continuation pages, default 40
  OP3_CACHE_TTL_MS            response cache lifetime, default 300000, 0 disables
  OP3_USER_AGENT              sent on every request, default op3-mcp
  OP3_BASE_URL                OP3 API root, default https://op3.dev/api/1
  OP3_HTTP_PORT / _HOST / _TOKEN   for --http

https://github.com/thenavidm/op3-mcp-cli
`;

/**
 * Which name launched us.
 *
 * One file serves both binaries. `op3-mcp` with no arguments is an MCP client
 * starting a stdio server and must stay silent on stdout. `op3-cli` with no
 * arguments is a person who wants to know what they can type, so it lists the
 * commands instead of hanging on a transport that will never speak.
 */
function invokedAsCli(): boolean {
  const name = (process.argv[1] ?? "").split("/").pop() ?? "";
  return name.startsWith("op3-cli");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (invokedAsCli() && argv.length === 0) {
    process.exitCode = await runCli(["tools"]);
    return;
  }

  // Checked before --help and --version so `<tool> --help` reaches the tool.
  // A bare `--help` starts with a dash, so it falls through to the block below.
  if (isCliCommand(argv)) {
    process.exitCode = await runCli(argv);
    return;
  }

  // A word that is not a tool used to fall through and start the server, which
  // then sat waiting on stdin. Typing `op3-cli op3-get-shwo` looked like a hang
  // rather than a typo, and scripts saw a success exit code.
  // `doctor` belongs to the entry point rather than the tool list, and it is
  // the first thing someone types when nothing works. Rejecting it as an
  // unknown command sent them to the server binary to diagnose the CLI.
  const ENTRY_COMMANDS = new Set(["doctor", "help"]);

  if (
    invokedAsCli() &&
    command !== undefined &&
    !command.startsWith("-") &&
    !ENTRY_COMMANDS.has(command)
  ) {
    process.stderr.write(
      `${JSON.stringify({ error: `Unknown command '${command}'. Run \`op3-cli\` to list them.` }, null, 2)}\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (argv.includes("--help") || argv.includes("-h") || command === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (command === "doctor") {
    const { runDoctor } = await import("./doctor.js");
    process.exitCode = await runDoctor();
    return;
  }

  const config = loadConfig();
  const built = buildServer(config);

  // Warn, never block. A network check at startup would delay the handshake,
  // and the preview token works, so this is a nudge rather than a fault.
  if (config.usingPreviewToken) {
    process.stderr.write(
      "[op3-mcp] No OP3_TOKEN set, using OP3's shared preview token. It is rate limited and can be withdrawn. Get your own at https://op3.dev/api/keys\n",
    );
  }

  const shutdown = async (close?: () => Promise<void>): Promise<void> => {
    if (close) await close().catch(() => undefined);
    process.exit(0);
  };

  if (argv.includes("--http")) {
    const { close } = await startHttpServer(built, httpOptionsFromEnv(argv));
    process.on("SIGTERM", () => void shutdown(close));
    process.on("SIGINT", () => void shutdown(close));
    return;
  }

  const transport = new StdioServerTransport();
  await built.server.connect(transport);

  // Handled so `docker stop` and a client shutting down return promptly rather
  // than waiting out a grace period.
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((error: unknown) => {
  process.stderr.write(`[op3-mcp] ${(error as Error).message}\n`);
  process.exit(1);
});
