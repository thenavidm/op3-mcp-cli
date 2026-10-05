/**
 * The CLI, now built by Slipway from the same tools as the MCP server.
 *
 * Parsing, help and output shapes are Slipway's and tested there. These cover
 * what this repo promises: every tool is a command, a task is found by what it
 * does, OP3's errors keep their exit codes, and the docs stay in step with the
 * code. Every network call is answered here, so nothing leaves the test.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkApp, cli } from "@thenavidm/slipway/testing";
import { app } from "../src/app.js";
import { ALL_TOOLS } from "../src/tools/index.js";

const quiet = { OP3_MIN_REQUEST_INTERVAL_MS: "0", OP3_MAX_RETRIES: "0", OP3_CACHE_TTL_MS: "0" };
const SHOW = "0123456789abcdef0123456789abcdef";

/** OP3 answering every request with `status` and `body`. */
function answering(status: number, body: unknown = { error: "failure" }) {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

afterEach(() => vi.unstubAllGlobals());

describe("OP3 CLI on Slipway", () => {
  it("makes every tool a command, all of them reads, none needing confirmation", async () => {
    const context = JSON.parse((await cli(app, ["agent-context", "--brief"], { env: {} })).stdout);
    expect(context.commands.map((c: { command: string }) => c.command)).toEqual(ALL_TOOLS.map((tool) => tool.name.replace(/_/g, "-")));
    expect(context.commands.filter((c: { risk?: string }) => c.risk)).toEqual([]);
    expect(context.commands.filter((c: { requires_confirm?: boolean }) => c.requires_confirm)).toEqual([]);
  });

  it("finds the command for a task described in words", async () => {
    const first = (await cli(app, ["which", "downloads", "for", "a", "show"], { env: {} })).stdout.split("\n")[0];
    expect(first).toContain("op3-show-downloads");
  });

  it("reports a missing argument by its flag", async () => {
    const run = await cli(app, ["op3-get-show", "--agent"], { env: quiet });
    expect(run.code).toBe(2);
    expect(JSON.parse(run.stderr).error).toContain("--identifier");
  });

  it("keeps the exit codes scripts branch on", async () => {
    // 1.x gave 5 for 400; OP3's status now says the request was the caller's to fix.
    for (const [status, code] of [[400, 2], [401, 4], [403, 4], [404, 3], [429, 7], [500, 5]] as const) {
      answering(status);
      const run = await cli(app, ["op3-get-show", "--identifier", SHOW, "--agent"], { env: quiet });
      expect(run.code, `HTTP ${status}`).toBe(code);
    }
  });

  it("calls an argument it cannot read a usage error", async () => {
    const run = await cli(app, ["op3-show-downloads", "--show", "not a show", "--agent"], { env: quiet });
    expect(run.code).toBe(2);
  });

  it("passes slipway check", async () => {
    const report = await checkApp(app, { env: {} });
    expect(report.findings.filter((finding) => finding.level === "error")).toEqual([]);
  });
});

describe("documentation stays in step with the code", () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf-8");
  const names = (text: string): Set<string> => new Set((text.match(/OP3_[A-Z_]+/g) ?? []).filter((name) => !name.endsWith("_")));
  const source = (dir: string): string =>
    readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })
      .map((entry) => (entry.isDirectory() ? source(`${dir}${entry.name}/`) : entry.name.endsWith(".ts") ? read(`${dir}${entry.name}`) : ""))
      .join("\n");

  /** Every variable the server reads: this repo's code, and Slipway's as agent-context lists them. */
  const used = async (): Promise<Set<string>> => {
    const context = JSON.parse((await cli(app, ["agent-context"], { env: {} })).stdout);
    return new Set([...names(source("../src/")), ...context.settings.map((setting: { env: string }) => setting.env)]);
  };

  /**
   * Four variables once shipped undocumented, the kind of drift nobody notices
   * because both sides look complete on their own.
   */
  it("documents every environment variable the code reads", async () => {
    const documented = names(read("../README.md"));
    expect([...(await used())].filter((v) => !documented.has(v))).toEqual([]);
  });

  // Since Slipway 0.1.15 the help names the settings that connect an account and counts the
  // rest, which agent-context describes one by one.
  it("names every environment variable in --help or agent-context", async () => {
    const help = (await cli(app, ["--help"], { env: {} })).stdout;
    const context = JSON.parse((await cli(app, ["agent-context"], { env: {} })).stdout);
    const described = new Set(context.settings.map((setting: { env: string }) => setting.env));
    expect([...(await used())].filter((v) => !help.includes(v) && !described.has(v))).toEqual([]);
  });

  it.each(["../README.md", "../INSTALL.md"])("has no dead in-page anchors in %s", (file) => {
    if (!existsSync(new URL(file, import.meta.url))) return;
    const md = read(file).replace(/```[\s\S]*?```/g, "");
    // GitHub's slug keeps letters, marks, numbers and connector punctuation, so an
    // emoji's variation selector (U+FE0F) stays in the anchor and a link has to carry it.
    const slugs = new Set(
      [...md.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) =>
        (heading as string).trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, "").replace(/ /g, "-"),
      ),
    );
    const dead = [...md.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)].map((m) => decodeURIComponent(m[1] as string)).filter((a) => !slugs.has(a));
    expect(dead).toEqual([]);
  });
});
