/**
 * The version an MCP app and the User-Agent see is the one on npm. It said
 * 1.0.0 through 1.1.0 and 1.2.0 because nothing compared them.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERSION as SERVER } from "../src/app.js";
import { VERSION as CLIENT } from "../src/api/client.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

describe("version", () => {
  it("matches package.json everywhere it is written", () => {
    expect(SERVER).toBe(pkg.version);
    expect(CLIENT).toBe(pkg.version);
  });
});
