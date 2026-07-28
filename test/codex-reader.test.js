import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CodexUsageReader } from "../src/codex-reader.js";

test("reads aggregate counters without needing conversation content", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-meter-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const sessions = path.join(root, "sessions", "2026", "07", "28");
  await fs.mkdir(sessions, { recursive: true });
  const now = new Date("2026-07-28T08:00:00.000Z");
  const resetAt = Math.floor(new Date("2026-08-04T00:00:00.000Z").getTime() / 1000);
  const rows = [
    {
      timestamp: "2026-07-28T07:00:00.000Z",
      type: "session_meta",
      payload: { id: "session-1", base_instructions: "must not be surfaced" },
    },
    {
      timestamp: "2026-07-28T07:00:01.000Z",
      type: "turn_context",
      payload: { model: "gpt-5.6-sol", effort: "high" },
    },
    {
      timestamp: "2026-07-28T07:01:00.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 100_000,
            cached_input_tokens: 80_000,
            output_tokens: 10_000,
            reasoning_output_tokens: 4_000,
            total_tokens: 110_000,
          },
        },
        rate_limits: {
          limit_id: "codex",
          primary: {
            used_percent: 10,
            window_minutes: 10080,
            resets_at: resetAt,
          },
          credits: { has_credits: false, unlimited: false, balance: null },
          plan_type: "plus",
        },
      },
    },
  ];
  await fs.writeFile(
    path.join(sessions, "rollout.jsonl"),
    rows.map((row) => JSON.stringify(row)).join("\n"),
  );

  const reader = new CodexUsageReader({
    codexHome: root,
    timeZone: "UTC",
    days: 3,
  });
  const snapshot = await reader.snapshot(now);

  assert.equal(snapshot.current.model, "gpt-5.6-sol");
  assert.equal(snapshot.current.effort, "high");
  assert.equal(snapshot.today.tokens.total, 110_000);
  assert.equal(snapshot.today.tokens.cached, 80_000);
  assert.equal(snapshot.today.value.usd, 0.44);
  assert.equal(snapshot.quota.usedPercent, 10);
  assert.equal(snapshot.quota.estimate.totalMixTokens, 1_100_000);
  assert.doesNotMatch(JSON.stringify(snapshot), /must not be surfaced/);
});
