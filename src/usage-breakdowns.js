import { promises as fs } from "node:fs";
import path from "node:path";
import { calculateValue } from "./pricing.js";

export async function readThreadNames(codexHome) {
  const names = new Map();
  try {
    const text = await fs.readFile(path.join(codexHome, "session_index.jsonl"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.replace(/^\uFEFF/, "").trim();
      if (!trimmed) continue;
      try {
        const row = JSON.parse(trimmed);
        const id = row.id || row.thread_id;
        const name = row.thread_name || row.title || row.name;
        if (id && name) names.set(id, String(name));
      } catch {
        // Ignore a partially-written index line while Codex is updating it.
      }
    }
  } catch {
    // Thread titles are optional; session IDs remain available as a fallback.
  }
  return names;
}

export function enrichEvents(parsedSessions, threadNames = new Map()) {
  const sessionMeta = new Map(
    parsedSessions.map((session) => [
      session.sessionId,
      {
        projectName: projectNameFromCwd(session.sessionCwd),
        threadName:
          threadNames.get(session.sessionId) ||
          `Chat ${shortSessionId(session.sessionId)}`,
      },
    ]),
  );

  return parsedSessions.flatMap((session) =>
    session.events.map((event) => ({
      ...event,
      projectName: sessionMeta.get(event.sessionId)?.projectName || "Projectless",
      threadName:
        sessionMeta.get(event.sessionId)?.threadName ||
        `Chat ${shortSessionId(event.sessionId)}`,
    })),
  );
}

export function buildActivityWindows(events, idleGapMinutes = 30) {
  if (!events.length) return [];
  const sorted = [...events].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
  const groups = [];
  let current = [sorted[0]];
  const idleGapMs = idleGapMinutes * 60_000;

  for (const event of sorted.slice(1)) {
    const previous = current.at(-1);
    if (Date.parse(event.timestamp) - Date.parse(previous.timestamp) > idleGapMs) {
      groups.push(current);
      current = [event];
    } else {
      current.push(event);
    }
  }
  groups.push(current);

  return groups.map((group) => {
    const startAt = group[0].timestamp;
    const endAt = group.at(-1).timestamp;
    return {
      startAt,
      endAt,
      durationMinutes: Math.max(
        0,
        Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000),
      ),
      ...summarize(group),
    };
  });
}

export function buildSourceMix(events) {
  const projectGroups = new Map();
  for (const event of events) {
    const projectName = event.projectName || "Projectless";
    if (!projectGroups.has(projectName)) {
      projectGroups.set(projectName, { events: [], threads: new Map() });
    }
    const project = projectGroups.get(projectName);
    project.events.push(event);
    if (!project.threads.has(event.sessionId)) {
      project.threads.set(event.sessionId, {
        sessionId: event.sessionId,
        threadName: event.threadName || `Chat ${shortSessionId(event.sessionId)}`,
        events: [],
      });
    }
    project.threads.get(event.sessionId).events.push(event);
  }

  return [...projectGroups.entries()]
    .map(([projectName, project]) => ({
      projectName,
      ...summarize(project.events),
      threads: [...project.threads.values()]
        .map((thread) => ({
          sessionId: thread.sessionId,
          threadName: thread.threadName,
          ...summarize(thread.events),
        }))
        .sort((left, right) => right.tokens.total - left.tokens.total),
    }))
    .sort((left, right) => right.tokens.total - left.tokens.total);
}

function summarize(events) {
  const result = {
    tokens: {
      input: 0,
      uncached: 0,
      cached: 0,
      cacheWrite: 0,
      output: 0,
      reasoning: 0,
      total: 0,
    },
    value: { usd: 0, credits: 0, unpricedTokens: 0 },
    requests: 0,
    sessions: new Set(),
  };

  for (const event of events) {
    for (const key of Object.keys(result.tokens)) {
      result.tokens[key] += Number(event.usage[key]) || 0;
    }
    const value = calculateValue(
      {
        input_tokens: event.usage.input,
        cached_input_tokens: event.usage.cached,
        cache_write_input_tokens: event.usage.cacheWrite,
        output_tokens: event.usage.output,
        reasoning_output_tokens: event.usage.reasoning,
        total_tokens: event.usage.total,
      },
      event.model,
    );
    if (value.priced) {
      result.value.usd += value.usd;
      result.value.credits += value.credits;
    } else {
      result.value.unpricedTokens += event.usage.total;
    }
    result.requests += 1;
    if (event.sessionId) result.sessions.add(event.sessionId);
  }

  return {
    tokens: result.tokens,
    value: result.value,
    requests: result.requests,
    sessions: result.sessions.size,
  };
}

function projectNameFromCwd(cwd) {
  if (!cwd) return "Projectless";
  const normalized = String(cwd).replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) || normalized || "Projectless";
}

function shortSessionId(id) {
  return String(id || "unknown").slice(0, 8);
}
