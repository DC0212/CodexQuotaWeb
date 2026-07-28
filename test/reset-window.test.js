import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CodexUsageReader } from "../src/codex-reader.js";

test("uses the newest quota window after a reset instead of carrying old usage forward", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-meter-reset-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const sessions = path.join(root, "sessions");
  await fs.mkdir(sessions, { recursive: true });

  const oldResetAt = Math.floor(new Date("2026-08-03T00:00:00.000Z").getTime() / 1000);
  const newResetAt = Math.floor(new Date("2026-08-04T00:00:00.000Z").getTime() / 1000);
  await writeSession(path.join(sessions, "old.jsonl"), {
    id: "old",
    timestamp: "2026-07-27T12:00:00.000Z",
    tokens: 9_000_000,
    usedPercent: 50,
    resetsAt: oldResetAt,
  });
  await writeSession(path.join(sessions, "new.jsonl"), {
    id: "new",
    timestamp: "2026-07-28T01:00:00.000Z",
    tokens: 100_000,
    usedPercent: 1,
    resetsAt: newResetAt,
  });

  const reader = new CodexUsageReader({
    codexHome: root,
    timeZone: "UTC",
    days: 3,
  });
  const snapshot = await reader.snapshot(new Date("2026-07-28T02:00:00.000Z"));

  assert.equal(snapshot.quota.usedPercent, 1);
  assert.equal(snapshot.quota.observed.tokens.total, 100_000);
  assert.equal(snapshot.quota.estimate.totalMixTokens, 10_000_000);
});

async function writeSession(file, sample) {
  const rows = [
    {
      timestamp: sample.timestamp,
      type: "session_meta",
      payload: { id: sample.id },
    },
    {
      timestamp: sample.timestamp,
      type: "turn_context",
      payload: { model: "gpt-5.6-sol", effort: "high" },
    },
    {
      timestamp: sample.timestamp,
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: sample.tokens,
            cached_input_tokens: 0,
            output_tokens: 0,
            total_tokens: sample.tokens,
          },
        },
        rate_limits: {
          limit_id: "codex",
          primary: {
            used_percent: sample.usedPercent,
            window_minutes: 10080,
            resets_at: sample.resetsAt,
          },
          plan_type: "plus",
        },
      },
    },
  ];
  await fs.writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n"));
}
