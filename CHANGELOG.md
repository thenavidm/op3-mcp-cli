# Versions

| Component | Version | Checked |
|---|---|---|
| `@thenavidm/slipway` | 0.1.20 | 2026-10-05 |
| MCP TypeScript SDK, through Slipway | 2.3.0 | 2026-10-05 |
| `zod` | 4.6.5 | 2026-10-05 |
| OP3 API | 0.1.0 | 2026-08-31 |
| Node | >= 22 | 2026-10-05 |

## 2.0.0, 2026-10-05

Built on [Slipway](https://github.com/thenavidm/slipway) 0.1.20. The 22 tools keep their names and arguments and still only read, and every difference below was measured against 1.2.2, the last version on npm, before release.

- **`which <words>` finds a command**, and `agent-context` describes every command, flag and setting as JSON. In Codex 0.159.3, finding the command that compares listener retention between two periods and its flags took a median of 61,677 input tokens over the CLI instead of 84,242 (five runs each). Every 1.2.2 run read the general help, the command list and then the command's help, three requests that each carry the conversation so far; `which` answers with the command's help when one command fits well ahead of the rest, so 4 of five 2.0.0 runs needed two.
- **Each tool has a title.** 1.2.2 gave clients each tool's name as its title, `op3_listener_retention`. The title is now the first clause of the tool's description when that is short, "Cohort carry-over between two periods", and otherwise the name in words, "App share".
- **OP3's status picks the exit code.** A request OP3 rejects (400 or 422) exits 2 instead of 5, and so does an argument this server checks itself, such as a show identifier it cannot read. A removed resource (410) exits 3 instead of 5. 401 and 403 still exit 4, 404 3, 429 7, and a timeout or a server error 5. An unknown command exits 2 instead of 1, and 1 now means an unexpected error.
- **`install <client>`** adds the server to Claude Code, Codex, Claude Desktop, Cursor, VS Code or Gemini CLI in each one's own format.
- **A smaller tool list.** Each tool no longer repeats `$schema`, `additionalProperties` and an `execution` block saying it runs no background tasks, so the list is 6,721 o200k tokens instead of 7,521, and Claude Code 2.1.286 spends 9,031 tokens a message on it with every tool loaded instead of 9,784. An argument a tool does not take is still ignored.
- **Less to install and start.** npx installs 4 packages instead of 94: Slipway brings the MCP SDK's 2.x server package, which carries no web framework. The entry turns on Node's compile cache, and the server spends 170 ms of CPU before its first answer where 1.2.2 spent 200, and answers in 124 ms of wall time instead of 134 (median of 21 runs, taking turns on one Mac).
- **`doctor` checks what it checked**: the token against OP3's cheapest endpoint, the raw query endpoints on their own, and the limits in force. `op3-mcp --http` keeps `OP3_HTTP_PORT`, `OP3_HTTP_HOST`, `OP3_HTTP_TOKEN` and `--port`.
- **Docs.** README section 6 has the costs measured against 1.2.2, where it had 2026-09-27's, and `SKILL.md` lists `which` and exit code 1.

### Upgrading

Node 22 or later is required; 1.2.2 ran on 20. A script that read exit 5 as a rejected request or a refused argument should read 2, a removed resource 3, and an unknown command 2 where it was 1. An error's JSON keeps `error` and OP3's `status`, gains Slipway's `code` (`usage`, `auth`, `not_found`, `rate_limited`, `timeout`, `api`) and sometimes a `hint`, and moves OP3's `endpoint` and `detail` under `details`; 1.2.2's `type` is gone. `--http` now refuses to listen beyond this machine without `OP3_HTTP_TOKEN`, where 1.2.2 accepted `OP3_HTTP_HOST=0.0.0.0` on its own, and refuses a page from another site unless `OP3_HTTP_ALLOWED_ORIGINS` lists it. A missing argument's error is 16 tokens longer, for its code and a hint. `SKILL.md` is 40 tokens longer in Claude Code, because it lists `which` and exit code 1.

## 1.2.2, 2026-10-04

- **`npx -y @thenavidm/op3-mcp-cli` always starts the MCP server.** npx starts whichever binary the npm registry lists first when they share one file, and the registry does not keep the published order, so an MCP client set up with this README's install line could get `op3-cli` and its command list instead of a server. A third binary named after the package now always starts the server, and npx picks it by name.

## 1.2.1, 2026-09-27

**The version is right.** The server told MCP apps, and `--version` printed, 1.0.0 since 1.1.0, because the constant was never bumped. It now matches package.json, and a test keeps it that way.

## 1.2.0, 2026-09-27

**A CLI.** `op3-cli` runs every tool as a shell command, through the same tools, handlers and client the MCP server uses, so the two cannot drift. `--agent` prints JSON on one line, `--select` keeps the fields you name, and `op3-cli schema <command>` prints what an MCP app receives. Exit codes follow the house contract: 2 usage, 3 not found, 4 auth, 5 API, 7 rate limited.

**Renamed to op3-mcp-cli**, the name every server with a CLI carries. The old package is deprecated with a pointer here, and GitHub redirects the old repo address.

**A Claude Desktop extension**, attached to each release. It asks for an OP3 token, which is optional.

**The context cost is measured in Claude Code** in the README. The MCP tool list is otherwise unchanged from 1.1.0, apart from 2 spellings.

## 1.1.0, 2026-09-01

Tools are now exported as data. `ALL_TOOLS` is an array of
`{ name, description, schema, handler }`, and the handler takes its context as
a second argument rather than closing over one.

That is what lets a hosted connector reuse this package instead of
reimplementing it. Over stdio there is one context for the process. Hosted,
there is one per request, because each caller brings their own OP3 token, and a
context baked in at module load would hand every caller the first one's
credentials.

No tool, argument or output changed. Minor rather than patch because the export
surface grew.

## 1.0.1, 2026-08-31

README only, no code change.

The 1.0.0 package went out carrying a README that still said the package was
not published, with no badge row and the wrong License block. npm serves the
README from the tarball, frozen at publish time, so a fix pushed to GitHub does
nothing for the package page: it needs a new version.

Also replaced the one relative link in the README. Relative links resolve
against npmjs.com in the published copy and break there, so every link is now
an absolute GitHub URL.

Added `npm run check:published`, which compares the published tarball against
the working tree and fails when the two have drifted.

## 1.0.0, 2026-08-31

First release. 22 read-only tools over the OP3 API.

**Beyond wrapping the endpoints.** OP3's raw download row carries `audienceId`,
a privacy-preserving per-listener hash that none of its aggregated endpoints
expose. Counting distinct values of it over a window gives unique listeners,
new against returning, cohort retention and episode audience overlap, which is
the difference between reporting downloads and reporting people.

Also built on the raw rows: geography at four levels rather than a country
list, device breakdown across four dimensions, app share over any window rather
than OP3's fixed three months, an app benchmark indexed against OP3's global
mix, and an episode curve comparing an episode at equal age against the show's
own median.

**Found by probing the live API.** OP3's OpenAPI document declares no response
schemas, so every shape was probed rather than generated. Three of those probes
found bugs that would otherwise have shipped:

- `bots=true` is rejected with "Bad bots". The accepted value is `include`, and
  it does more than add bot rows: it also switches off OP3's deduplicating
  download calculation, so the same window returned 213 rows against 345.
- `/downloads/show/{uuid}` has no `desc` parameter. OP3 documents one on
  `/hits` only and silently ignores it here, so a `newest_first` option would
  have been a lie.
- The multi-show query rejects `showUuid=a,b` and needs a repeated key.

**A fourth thing worth knowing.** OP3 derives an episode id from the episode's
audio URL, so a host that regenerates those URLs leaves historical download rows
carrying ids absent from the feed listing. Across three shows checked, two
matched exactly and one had zero overlap. `op3_episode_curve` detects it and
explains it rather than returning silent zeros.

**Safety.** The OP3 API is read-only, so there is no write gating and no
`confirm` anywhere. What is guarded instead is cost, since the raw endpoints are
scans and an unbounded query hangs a client rather than failing it: bounded
windows, a row cap, a page cap, and a note on any result a cap cut short.

**Privacy.** `audienceId` and `hashedIpAddress` are aggregated inside the
process and never returned.

**Transport.** stdio and streamable HTTP. The HTTP transport is what makes
claude.ai possible, since claude.ai runs connectors from Anthropic's cloud and
cannot launch a local command.
