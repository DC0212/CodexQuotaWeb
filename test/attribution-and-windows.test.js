import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CodexUsageReader } from "../src/codex-reader.js";

test("groups activity windows and attributes tokens to project and chat title", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-meter-sources-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const sessions = path.join(root, "sessions");
  await fs.mkdir(sessions, { recursive: true });

  const sessionId = "thread-alpha-12345678";
  await fs.writeFile(
    path.join(root, "session_index.jsonl"),
    JSON.stringify({
      id: sessionId,
      thread_name: "Build the reporting dashboard",
      updated_at: "2026-07-28T14:15:00.000Z",
    }),
  );

  const rows = [
    {
      timestamp: "2026-07-28T09:00:00.000Z",
      type: "session_meta",
      payload: { id: sessionId, cwd: "/work/ProjectAlpha" },
    },
    {
      timestamp: "2026-07-28T09:00:00.000Z",
      type: "turn_context",
      payload: { model: "gpt-5.6-sol", effort: "high" },
    },
    tokenRow("2026-07-28T09:00:00.000Z", 100, 50, 10),
    tokenRow("2026-07-28T09:25:00.000Z", 200, 100, 20),
    tokenRow("2026-07-28T14:00:00.000Z", 300, 150, 30),
    tokenRow("2026-07-28T14:15:00.000Z", 400, 200, 40),
  ];
  await fs.writeFile(
    path.join(sessions, "rollout.jsonl"),
    rows.map((row) => JSON.stringify(row)).join("\n"),
  );

  const reader = new CodexUsageReader({
    codexHome: root,
    timeZone: "UTC",
    days: 1,
  });
  const snapshot = await reader.snapshot(new Date("2026-07-28T16:00:00.000Z"));
  const day = snapshot.daily[0];

  assert.equal(day.activityWindows.length, 2);
  assert.equal(day.activityWindows[0].startAt, "2026-07-28T09:00:00.000Z");
  assert.equal(day.activityWindows[0].endAt, "2026-07-28T09:25:00.000Z");
  assert.equal(day.activityWindows[0].tokens.total, 330);
  assert.equal(day.activityWindows[1].tokens.total, 770);
  assert.equal(day.sources.length, 1);
  assert.equal(day.sources[0].projectName, "ProjectAlpha");
  assert.equal(day.sources[0].threads[0].threadName, "Build the reporting dashboard");
  assert.equal(day.sources[0].threads[0].tokens.total, 1100);
});

function tokenRow(timestamp, input, cached, output) {
  return {
    timestamp,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        last_token_usage: {
          input_tokens: input,
          cached_input_tokens: cached,
          output_tokens: output,
          total_tokens: input + output,
        },
      },
    },
  };
}
