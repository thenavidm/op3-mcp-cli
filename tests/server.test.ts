/**
 * What a reader is trusting when they install this: that every tool is served
 * with a description and a schema, that the annotations tell a client the truth
 * about what it does, and that an OP3 failure keeps its meaning on the way out.
 */

import { describe, expect, it } from "vitest";
import { EXIT, SlipwayError } from "@thenavidm/slipway";
import { connect } from "@thenavidm/slipway/testing";
import { app } from "../src/app.js";
import { loadConfig, PREVIEW_TOKEN } from "../src/config.js";
import { ALL_TOOLS, TOOL_COUNT } from "../src/tools/index.js";
import { shortTitle, stripEmpty, toSlipway, truncationNote } from "../src/tools/kit.js";
import { NotFoundError, OP3Error } from "../src/api/errors.js";

describe("server", () => {
  it("serves every tool as a read, with the instructions that set the download and listener distinction", async () => {
    // That distinction is the one misreading that would make every answer wrong, so it has
    // to be in context before the first tool result rather than corrected after.
    const mcp = await connect(app, { env: {} });
    try {
      const tools = await mcp.listTools();
      expect(tools).toHaveLength(TOOL_COUNT);
      for (const tool of tools) expect(tool.annotations?.readOnlyHint).toBe(true);
      const instructions = (mcp.initialize as { instructions?: string }).instructions ?? "";
      expect(instructions).toMatch(/not a person/i);
      expect(instructions).toMatch(/third-party RSS feeds/i);
    } finally {
      await mcp.close();
    }
  });
});

describe("config", () => {
  it("falls back to OP3's preview token so the server works unconfigured", () => {
    const config = loadConfig({});
    expect(config.token).toBe(PREVIEW_TOKEN);
    expect(config.usingPreviewToken).toBe(true);
  });

  it("prefers a real token and stops flagging the preview", () => {
    const config = loadConfig({ OP3_TOKEN: "real-token" });
    expect(config.token).toBe("real-token");
    expect(config.usingPreviewToken).toBe(false);
  });

  it("reads OP3_API_KEY, the word OP3's keys page uses", () => {
    expect(loadConfig({ OP3_API_KEY: "from-the-keys-page" }).token).toBe("from-the-keys-page");
  });

  it("ignores a non-numeric setting rather than producing NaN", () => {
    expect(loadConfig({ OP3_MAX_ROWS: "lots" }).maxRows).toBe(50_000);
  });
});

describe("output shaping", () => {
  it("drops null and undefined so a model is not handed empty fields", () => {
    expect(stripEmpty({ a: 1, b: null, c: undefined, d: { e: null, f: 2 } })).toEqual({ a: 1, d: { f: 2 } });
  });

  it("keeps falsy values that carry meaning", () => {
    expect(stripEmpty({ downloads: 0, truncated: false, title: "" })).toEqual({ downloads: 0, truncated: false, title: "" });
  });
});

describe("errors keep their meaning", () => {
  const code = (error: unknown) => (toSlipway(error) as SlipwayError).exitCode;

  it("lets OP3's status pick the exit code, with the endpoint and OP3's own detail along", () => {
    const error = toSlipway(new OP3Error("boom", 500, "/x", "detail")) as SlipwayError;
    expect(error.exitCode).toBe(EXIT.api);
    expect(error.message).toBe("boom");
    expect(JSON.stringify(error)).toContain("/x");
    expect(code(new NotFoundError("missing", 404, "/shows/x"))).toBe(EXIT.notFound);
    expect(code(new OP3Error("limited", 429, "/x"))).toBe(EXIT.rateLimited);
    expect(code(new OP3Error("denied", 401, "/x"))).toBe(EXIT.auth);
    // 1.x gave 5 for a request OP3 rejects; the status now says it is the caller's to fix.
    expect(code(new OP3Error("rejected", 400, "/x"))).toBe(EXIT.usage);
  });

  it("calls this server's own argument checks usage errors, and leaves a real bug unexpected", () => {
    expect(code(new Error('"soon" is not a time OP3 understands.'))).toBe(EXIT.usage);
    expect(toSlipway(new TypeError("x is undefined"))).toBeInstanceOf(TypeError);
  });
});

describe("truncation notes", () => {
  it("says nothing when the pull was complete", () => {
    expect(truncationNote(false, undefined, 10)).toBeUndefined();
  });

  it("names the cap that stopped it and how to raise it", () => {
    expect(truncationNote(true, "maxRows", 100)).toMatch(/OP3_MAX_ROWS/);
    expect(truncationNote(true, "maxPages", 100)).toMatch(/OP3_MAX_PAGES/);
  });

  it("says the figures describe a sample, which is the part that matters", () => {
    expect(truncationNote(true, "maxRows", 100)).toMatch(/sample/i);
  });
});

describe("titles", () => {
  it("names each tool by what it answers, not by its name again", () => {
    for (const tool of ALL_TOOLS) {
      const title = shortTitle(tool);
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title).not.toBe(tool.name);
    }
  });
});
