/**
 * The CLI adapter.
 *
 * What matters here is that the shell surface is derived from the tool defs
 * rather than described a second time, so the tests that count are the ones
 * asserting parity with ALL_TOOLS and the ones covering the argv shapes a
 * person actually types.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { flagsFor, parseArgs, isCliCommand, selectFields } from "../src/cli.js";
import { ALL_TOOLS } from "../src/tools/index.js";

describe("flagsFor", () => {
  it("derives a flag per schema key, kebab-cased", () => {
    const flags = flagsFor({ include_episodes: z.boolean().optional() });
    expect(flags[0]).toMatchObject({
      key: "include_episodes",
      flag: "--include-episodes",
      kind: "boolean",
    });
  });

  it("reads required from the absence of .optional()", () => {
    const flags = flagsFor({ identifier: z.string(), since: z.string().optional() });
    expect(flags.find((f) => f.key === "identifier")?.required).toBe(true);
    expect(flags.find((f) => f.key === "since")?.required).toBe(false);
  });

  it("treats .default() as optional, because Zod fills it in", () => {
    const flags = flagsFor({ limit: z.number().optional().default(25) });
    expect(flags[0]).toMatchObject({ kind: "number", required: false });
  });

  it("carries .describe() through as help", () => {
    const flags = flagsFor({ identifier: z.string().describe("The show.") });
    expect(flags[0]?.help).toBe("The show.");
  });

  it("finds the description whichever side of .optional() it was chained", () => {
    const outer = flagsFor({ a: z.string().optional().describe("outer") });
    const inner = flagsFor({ b: z.string().describe("inner").optional() });
    expect(outer[0]?.help).toBe("outer");
    expect(inner[0]?.help).toBe("inner");
  });

  it("exposes an enum's values as choices", () => {
    const flags = flagsFor({ bucket: z.enum(["day", "week", "month"]).optional() });
    expect(flags[0]).toMatchObject({ kind: "enum", choices: ["day", "week", "month"] });
  });

  it("marks a scalar array repeatable and an object array json", () => {
    const flags = flagsFor({
      identifiers: z.array(z.string()).optional(),
      windows: z.array(z.object({ start: z.string() })).optional(),
    });
    expect(flags.find((f) => f.key === "identifiers")).toMatchObject({
      kind: "string",
      repeatable: true,
    });
    expect(flags.find((f) => f.key === "windows")).toMatchObject({
      kind: "json",
      repeatable: true,
    });
  });

  it("keeps an enum array typeable rather than demanding JSON", () => {
    const flags = flagsFor({ dimensions: z.array(z.enum(["country", "region"])).optional() });
    expect(flags[0]).toMatchObject({ kind: "string", repeatable: true });
  });
});

describe("parseArgs", () => {
  const flags = flagsFor({
    identifier: z.string(),
    limit: z.number().optional(),
    include_episodes: z.boolean().optional(),
    episode_ids: z.array(z.string()).optional(),
    filters: z.object({ url: z.string() }).optional(),
    bucket: z.enum(["day", "week", "month"]).optional(),
  });

  it("accepts --flag value and --flag=value alike", () => {
    expect(parseArgs(["--identifier", "abc"], flags)).toEqual({ identifier: "abc" });
    expect(parseArgs(["--identifier=abc"], flags)).toEqual({ identifier: "abc" });
  });

  it("accepts the underscore spelling of a flag", () => {
    expect(parseArgs(["--include_episodes"], flags)).toEqual({ include_episodes: true });
  });

  it("treats a boolean as a bare switch", () => {
    expect(parseArgs(["--identifier", "abc", "--include-episodes"], flags)).toEqual({
      identifier: "abc",
      include_episodes: true,
    });
    expect(parseArgs(["--include-episodes=false"], flags)).toEqual({ include_episodes: false });
  });

  it("coerces numbers, and refuses ones that are not", () => {
    expect(parseArgs(["--limit", "25"], flags)).toEqual({ limit: 25 });
    expect(() => parseArgs(["--limit", "many"], flags)).toThrow(/expects a number/);
  });

  it("parses a json flag, and refuses malformed json", () => {
    expect(parseArgs(['--filters={"url":"https://x.com"}'], flags)).toEqual({
      filters: { url: "https://x.com" },
    });
    expect(() => parseArgs(["--filters", "{oops"], flags)).toThrow(/expects JSON/);
  });

  it("collects a repeatable flag into an array", () => {
    expect(parseArgs(["--episode-ids", "a", "--episode-ids", "b"], flags)).toEqual({
      episode_ids: ["a", "b"],
    });
  });

  it("checks an enum against its choices", () => {
    expect(() => parseArgs(["--bucket", "fortnight"], flags)).toThrow(/expects one of/);
  });

  it("fills the first required flag from a bare argument", () => {
    expect(parseArgs(["https://example.com/rss"], flags)).toEqual({
      identifier: "https://example.com/rss",
    });
  });

  it("wraps a bare argument when the required flag is repeatable", () => {
    const repeatable = flagsFor({ identifiers: z.array(z.string()) });
    expect(parseArgs(["https://example.com/rss"], repeatable)).toEqual({
      identifiers: ["https://example.com/rss"],
    });
  });

  it("refuses an unknown option rather than dropping it", () => {
    expect(() => parseArgs(["--nope", "x"], flags)).toThrow(/Unknown option/);
  });

  it("refuses a second bare argument", () => {
    expect(() => parseArgs(["one", "two"], flags)).toThrow(/Unexpected argument/);
  });
});

/**
 * Two paths under one head used to overwrite each other, so
 * `--select episodes.id,episodes.title` quietly returned only the title. Silent
 * data loss in a flag whose whole purpose is choosing what you keep.
 */
describe("--select keeps every path, not the last one", () => {
  it("keeps both fields when two paths share a head", () => {
    const data = { episodes: [{ id: "ep1", title: "Pilot", pubdate: "2026-01-01" }] };
    expect(selectFields(data, ["episodes.id", "episodes.title"])).toEqual({
      episodes: [{ id: "ep1", title: "Pilot" }],
    });
  });

  it("groups at every depth", () => {
    expect(selectFields({ a: { b: { c: 1, d: 2, e: 3 } } }, ["a.b.c", "a.b.e"])).toEqual({
      a: { b: { c: 1, e: 3 } },
    });
  });

  it("mixes a scalar with nested paths", () => {
    expect(selectFields({ x: 1, y: { z: 2, w: 3 } }, ["x", "y.z", "y.w"])).toEqual({
      x: 1,
      y: { z: 2, w: 3 },
    });
  });
});

describe("parity with the MCP surface", () => {
  it("routes every tool name, in both spellings", () => {
    for (const tool of ALL_TOOLS) {
      expect(isCliCommand([tool.name])).toBe(true);
      expect(isCliCommand([tool.name.replace(/_/g, "-")])).toBe(true);
    }
  });

  it("builds flags for every tool without throwing", () => {
    for (const tool of ALL_TOOLS) {
      expect(() => flagsFor(tool.schema)).not.toThrow();
    }
  });

  it("gives every schema key a flag", () => {
    for (const tool of ALL_TOOLS) {
      expect(flagsFor(tool.schema)).toHaveLength(Object.keys(tool.schema).length);
    }
  });

  it("exposes every tool, because this connector has no writes to hide", () => {
    expect(ALL_TOOLS.every((t) => t.name.startsWith("op3_"))).toBe(true);
    expect(ALL_TOOLS.length).toBeGreaterThan(0);
  });

  it("leaves the server's own flags alone", () => {
    expect(isCliCommand(["--http"])).toBe(false);
    expect(isCliCommand(["--version"])).toBe(false);
    expect(isCliCommand([])).toBe(false);
  });
});

describe("documentation stays in step with the code", () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf-8");
  const names = (text: string): Set<string> => new Set(text.match(/OP3_[A-Z_]+/g) ?? []);

  /**
   * Four variables shipped undocumented, which is the kind of drift nobody
   * notices because both sides look complete on their own.
   */
  it("documents every environment variable the code reads", () => {
    const used = names(["config.ts", "transport/http.ts"].map((f) => read(`../src/${f}`)).join("\n"));
    const documented = names(read("../README.md"));
    expect([...used].filter((v) => !documented.has(v))).toEqual([]);
  });

  it("lists every environment variable in --help", () => {
    const used = names(["config.ts", "transport/http.ts"].map((f) => read(`../src/${f}`)).join("\n"));
    const helped = names(read("../src/index.ts"));
    // The help groups the three HTTP ones as `OP3_HTTP_PORT / _HOST / _TOKEN`.
    const shorthand = new Set(["OP3_HTTP_HOST", "OP3_HTTP_TOKEN"]);
    expect([...used].filter((v) => !helped.has(v) && !shorthand.has(v))).toEqual([]);
  });

  /**
   * A dead `#anchor` is the kind that ships quietly: the ship checklist's link
   * pass only greps http.
   */
  it.each(["../README.md", "../INSTALL.md"])("has no dead in-page anchors in %s", (file) => {
    const md = read(file);
    const slugs = new Set<string>();
    for (const [, heading] of md.matchAll(/^#{2,4} (.+)$/gm)) {
      const stripped = (heading as string).toLowerCase().replace(/[^\w\s-]/g, "");
      // GitHub keeps the trailing hyphen when a heading ends in an emoji.
      slugs.add(stripped.trim().replace(/\s+/g, "-"));
      slugs.add(stripped.replace(/\s+/g, "-"));
    }
    const dead = [...md.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)]
      .map((m) => m[1] as string)
      .filter((a) => !slugs.has(a));
    expect(dead).toEqual([]);
  });
});
