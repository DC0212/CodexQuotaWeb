# Codex Meter

A private, local-first dashboard for Codex token usage, active models, API-equivalent value, credits, remaining usage, and quota estimates.

> This is not an official OpenAI product. USD values are API list-price equivalents, not ChatGPT/Codex subscription invoices.

## Highlights

- Refreshes current-task and daily usage every two seconds
- Separates uncached input, cached input, output, and reasoning output
- Detects the active model and reasoning effort
- Estimates public API-equivalent USD value and Codex credits
- Reads Codex usage percentage, window, and reset time
- Estimates total and remaining token capacity using the observed usage mix
- Shows a 14-day trend and today's model mix
- Chinese and English UI
- Binds to `127.0.0.1`; data stays on the device

## Quick start

Requires [Node.js 18+](https://nodejs.org/). There are no runtime dependencies and no install step.

### Windows

Download and extract `codex-meter.zip`, then double-click `start.bat`.

### macOS / Linux

```bash
chmod +x start.command
./start.command
```

### Any platform

```bash
node src/server.js
```

Options:

```bash
node src/server.js --no-open
node src/server.js --port 7373
node src/server.js --days 30
node src/server.js --codex-home "/custom/path/.codex"
```

`CODEX_HOME` is respected. Otherwise the default is `~/.codex`.

## How the estimate works

`input_tokens` includes cached-input details:

```text
uncached input = input - cached input - cache-write input
API equivalent = uncached input × input rate
               + cached input × cached rate
               + cache-write input × cache-write rate
               + output × output rate
```

An account quota is not a fixed token bucket because models and token types carry different weights. Codex Meter converts it using the actual mix observed in the current quota window:

```text
estimated total credits = observed local credits / used percentage
mix-equivalent tokens    = observed local tokens × total credits / observed credits
```

The percentage is generally integer-valued, so the UI also shows a range based on ±0.5 percentage points.

## Limitations

- Codex, ChatGPT Work, ChatGPT for Excel, and Workspace Agents can share an agentic usage/credit pool. Local sessions cannot observe other products or cloud tasks, so this is not an official quota.
- Confidence is lower when local history does not cover the full usage window.
- Fast mode, long-context surcharges, and unpublished models may not be identifiable from local fields.
- Public pricing changes. The bundled rate card is current as of 2026-07-28.
- This tool does not read API billing or bypass official limits.

## Privacy

The parser only uses model/effort fields, aggregate token counters, and rate-limit percentages/window/reset timestamps. It does not return or store prompts, responses, file contents, credentials, or `auth.json`. The server listens on the local loopback interface by default.

## Sources

- [OpenAI API model price comparison](https://developers.openai.com/api/docs/models/compare)
- [OpenAI Codex rate card](https://help.openai.com/en/articles/20001106-codex-rate-card)

## Development

```bash
npm test
npm run check
```

Pushing a `v*` tag runs the release workflow and attaches ZIP and TAR.GZ downloads.

## License

MIT
