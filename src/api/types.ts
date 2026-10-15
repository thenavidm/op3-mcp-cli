/**
 * Response shapes.
 *
 * OP3's OpenAPI document declares no schemas at all, so every type here was
 * probed against the live API rather than generated. That means they are
 * descriptive, not guaranteed: fields are optional where a real response was
 * seen without them, and unknown extras are tolerated rather than rejected.
 */

/** One row from `/downloads/show/{showUuid}`. The richest thing OP3 returns. */
export type DownloadRow = {
  time: string;
  url?: string;
  /**
   * Privacy-preserving stable listener hash. This is what makes unique-listener,
   * retention and overlap analysis possible, and it is why those numbers are not
   * available from any of the pre-aggregated endpoints.
   *
   * It never leaves this process except as an aggregate. See `format/redact.ts`.
   */
  audienceId?: string;
  showUuid?: string;
  episodeId?: string;
  hashedIpAddress?: string;
  /** "app", "browser", "bot", "library" and similar. */
  agentType?: string;
  /** "Apple Podcasts", "Spotify", "Overcast". */
  agentName?: string;
  /** "mobile", "computer", "tablet", "smart speaker". */
  deviceType?: string;
  /** "Apple iPhone", "Android Phone". */
  deviceName?: string;
  countryCode?: string;
  continentCode?: string;
  regionCode?: string;
  regionName?: string;
  timezone?: string;
  metroCode?: string;
};

export type DownloadsResponse = {
  rows: DownloadRow[];
  count?: number;
  queryTime?: number;
  continuationToken?: string;
};

/** One row from `/hits`. The raw redirect log, shaped differently to a download. */
export type HitRow = {
  time: string;
  uuid?: string;
  hashedIpAddress?: string;
  method?: string;
  url?: string;
  userAgent?: string;
  range?: string;
  xpsId?: string;
  /** Cloudflare edge colo that served it, e.g. "BOS". */
  edgeColo?: string;
  continent?: string;
  country?: string;
  timezone?: string;
  regionCode?: string;
  region?: string;
  metroCode?: string;
};

export type HitsResponse = {
  rows: HitRow[];
  count?: number;
  queryTime?: number;
  continuationToken?: string;
};

export type EpisodeSummary = {
  /** OP3's own episode id, a 64-char hash. This is what filters accept. */
  id: string;
  title?: string;
  pubdate?: string;
  /** The `<guid>` from the RSS feed. */
  itemGuid?: string;
};

export type ShowInfoResponse = {
  showUuid: string;
  title?: string;
  podcastGuid?: string;
  statsPageUrl?: string;
  episodes?: EpisodeSummary[];
};

export type ShowDownloadCountsEntry = {
  /** Opaque per-day completeness bitmask. Not useful to a model; dropped on the way out. */
  days?: string;
  monthlyDownloads?: number;
  weeklyDownloads?: number[];
  weeklyAvgDownloads?: number;
  numWeeks?: number;
};

export type ShowDownloadCountsResponse = {
  asof?: string;
  showDownloadCounts?: Record<string, ShowDownloadCountsEntry>;
  queryTime?: number;
};

/** One episode as OP3's episode-download-counts answers it. The names are OP3's own, from its API docs. */
export type EpisodeDownloadCount = {
  /** The episode's item-level <guid>. */
  itemGuid?: string;
  title?: string;
  pubdate?: string;
  /** Cumulative downloads in the episode's first day (24 hours). */
  downloads1?: number;
  /** First three days (72 hours). */
  downloads3?: number;
  /** First seven days. */
  downloads7?: number;
  /** First thirty days. */
  downloads30?: number;
  /** All-time downloads. */
  downloadsAll?: number;
};

export type EpisodeDownloadCountsResponse = {
  showUuid?: string;
  showTitle?: string;
  episodes?: EpisodeDownloadCount[];
  /** ISO hour of the oldest download the counts include. */
  minDownloadHour?: string;
  /** ISO hour of the newest download the counts include. */
  maxDownloadHour?: string;
  queryTime?: number;
};

export type TopAppsForShowResponse = {
  showUuid?: string;
  appDownloads?: Record<string, number>;
  queryTime?: number;
};

export type TopAppsResponse = {
  appShares?: Record<string, number>;
  queryTime?: number;
};

export type TranscriptEpisode = {
  pubdate?: string;
  podcastGuid?: string;
  episodeItemGuid?: string;
  hasTranscripts?: boolean;
  dailyDownloads?: Record<string, number>;
};

export type RecentTranscriptsResponse = {
  rt?: {
    asof?: string;
    episodes?: TranscriptEpisode[];
  };
  queryTime?: number;
};
