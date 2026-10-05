/**
 * What the server tells a model before the first tool call.
 *
 * It sets three things a model cannot infer from the tool list: that downloads
 * and listeners are different quantities and which tools answer which, that the
 * cheap rolled-up tools should be preferred over the raw scans, and that episode
 * titles are third-party text. Getting that into context before the first tool
 * result is cheaper than correcting it after.
 */

import { INJECTION_NOTICE } from "./format/frame.js";

export const INSTRUCTIONS = `Podcast analytics from OP3, the Open Podcast Prefix Project (op3.dev). Every tool is a read; nothing here changes anything.

How to pick a tool:

- Start with op3_resolve_show or op3_get_show if you have a feed URL rather than a show uuid. Every other tool needs the uuid.
- For headline numbers, prefer the rolled-up tools: op3_show_downloads, op3_episode_downloads, op3_compare_shows. They answer in milliseconds because OP3 has already aggregated them.
- The audience, geography, app, device and trend tools read raw download rows instead. They are much slower and cost grows with the window, so pass the narrowest window that answers the question.
- op3_query_downloads and op3_query_hits are escape hatches. Reach for them only when no aggregating tool fits.
- If numbers come back as zero or a show cannot be found, run op3_verify_prefix before concluding anything. The usual cause is that the OP3 prefix is not on the feed, which is a setup problem rather than an analytics one.

Two things about the data that change how you should report it:

- A download is an app fetching a file. It is not a person. One listener whose app re-requests across several days is several downloads, so never describe a download count as an audience size. op3_audience_summary gives the actual unique-listener count and the ratio between the two.
- Episodes cannot be compared on total downloads, because older episodes have had longer to accumulate them. op3_episode_curve compares at equal age against the show's own median, which is the only fair comparison.

Rolled-up figures carry an "asof" date and are usually a day behind a live dashboard. Say so rather than presenting them as current.

Per-listener identifiers are never returned. Audience figures are aggregates computed inside the server.

${INJECTION_NOTICE}`;
