import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOWNLOAD_TOOLS } from "../src/tools/downloads.js";

// OP3's own answer for its documented example show, recorded on 2026-10-15 with the shared preview token.
const LIVE = JSON.parse(readFileSync(new URL("./fixtures/episode-download-counts.json", import.meta.url), "utf8"));

const tool = DOWNLOAD_TOOLS.find((t) => t.name === "op3_episode_downloads")!;
const ctx = (answer: unknown) =>
  ({
    resolveShow: async () => ({ showUuid: LIVE.showUuid, title: LIVE.showTitle }),
    client: { getEpisodeDownloadCounts: async () => answer },
  }) as never;

describe("op3_episode_downloads", () => {
  it("reads OP3's own field names, so every episode carries its counts", async () => {
    const out = (await tool.handler({ identifier: LIVE.showUuid, limit: 20 }, ctx(LIVE))) as Record<string, any>;
    const first = out.episodes[0];
    expect(first.itemGuid).toBe(LIVE.episodes[0].itemGuid);
    expect(first.firstDay).toBe(LIVE.episodes[0].downloads1);
    expect(first.firstThreeDays).toBe(LIVE.episodes[0].downloads3);
    expect(first.allTime).toBe(LIVE.episodes[0].downloadsAll);
    expect(out.downloadsFrom).toBe(LIVE.minDownloadHour);
    expect(out.downloadsTo).toBe(LIVE.maxDownloadHour);
    for (const e of out.episodes) expect(e.allTime).toEqual(expect.any(Number));
  });

  it("leaves a span OP3 did not report as null, never 0", async () => {
    const out = (await tool.handler({ identifier: LIVE.showUuid, limit: 20 }, ctx(LIVE))) as Record<string, any>;
    const young = LIVE.episodes.findIndex((e: Record<string, unknown>) => e.downloads7 === undefined);
    expect(young).toBeGreaterThanOrEqual(0);
    expect(out.episodes[young].firstSevenDays).toBeNull();
    expect(out.episodes[young].firstThirtyDays).toBeNull();
    const old = LIVE.episodes.findIndex((e: Record<string, unknown>) => e.downloads30 !== undefined);
    expect(out.episodes[old].firstThirtyDays).toBe(LIVE.episodes[old].downloads30);
    expect(out.note).toMatch(/null/);
  });
});
