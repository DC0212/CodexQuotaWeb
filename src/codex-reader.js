import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { calculateValue, normalizeUsage, PRICING_META, resolveRate } from "./pricing.js";
import {
  buildActivityWindows,
  buildSourceMix,
  enrichEvents,
  readThreadNames,
} from "./usage-breakdowns.js";

const DAY_MS = 86_400_000;

export class CodexUsageReader {
  constructor(options = {}) {
    this.codexHome =
      options.codexHome ||
      process.env.CODEX_HOME ||
      path.join(os.homedir(), ".codex");
    this.days = Number(options.days) || 14;
    this.timeZone =
      options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    this.cache = new Map();
  }

  async snapshot(now = new Date()) {
    const roots = [
      path.join(this.codexHome, "sessions"),
      path.join(this.codexHome, "archived_sessions"),
    ];
    const files = (await Promise.all(roots.map((root) => listJsonlFiles(root)))).flat();
    const livePaths = new Set(files);

    for (const cachedPath of this.cache.keys()) {
      if (!livePaths.has(cachedPath)) this.cache.delete(cachedPath);
    }

    const parsed = [];
    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        const cached = this.cache.get(file);
        if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
          parsed.push(cached.value);
          continue;
        }
        const value = await parseSessionFile(file, stat);
        this.cache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, value });
        parsed.push(value);
      } catch {
        // A session can be moved into the archive while it is being scanned.
      }
    }

    const threadNames = await readThreadNames(this.codexHome);
    return buildSnapshot(parsed, {
      now,
      days: this.days,
      timeZone: this.timeZone,
      codexHome: this.codexHome,
      threadNames,
    });
  }
}

export async function parseSessionFile(file, knownStat = null) {
  const stat = knownStat || (await fs.stat(file));
  const text = await fs.readFile(file, "utf8");
  const events = [];
  const rateSnapshots = [];
  const contexts = [];
  let sessionId = path.basename(file, ".jsonl");
  let sessionCwd = null;
  let currentModel = null;
  let currentEffort = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    if (row.type === "session_meta") {
      sessionId = row.payload?.id || row.payload?.session_id || sessionId;
      sessionCwd = row.payload?.cwd || sessionCwd;
      continue;
    }

    if (row.type === "turn_context") {
      currentModel = row.payload?.model || currentModel;
      currentEffort = row.payload?.effort || currentEffort;
      contexts.push({
        timestamp: safeIso(row.timestamp, stat.mtimeMs),
        model: currentModel,
        effort: currentEffort,
      });
      continue;
    }

    if (row.type !== "event_msg" || row.payload?.type !== "token_count") continue;

    const timestamp = safeIso(row.timestamp, stat.mtimeMs);
    const rawUsage = row.payload?.info?.last_token_usage;
    if (rawUsage) {
      events.push({
        timestamp,
        sessionId,
        model: currentModel || "unknown",
        effort: currentEffort,
        usage: normalizeUsage(rawUsage),
      });
    }

    if (row.payload?.rate_limits) {
      rateSnapshots.push({
        timestamp,
        sessionId,
        ...sanitizeRateLimits(row.payload.rate_limits),
      });
    }
  }

  return {
    file,
    sessionId,
    sessionCwd,
    mtimeMs: stat.mtimeMs,
    events,
    rateSnapshots,
    contexts,
  };
}

export function buildSnapshot(parsedSessions, options) {
  const now = options.now instanceof Date ? options.now : new Date(options.now);
  const timeZone = options.timeZone || "UTC";
  const days = options.days || 14;
  const allEvents = enrichEvents(parsedSessions, options.threadNames).sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const allContexts = parsedSessions
    .flatMap((session) => session.contexts)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const allRates = parsedSessions
    .flatMap((session) => session.rateSnapshots)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const latestContext = allContexts.at(-1) || null;
  const latestEvent = allEvents.at(-1) || null;
  const latestRate = allRates.at(-1) || null;
  const todayKey = dateKey(now, timeZone);
  const todayEvents = allEvents.filter(
    (event) => dateKey(new Date(event.timestamp), timeZone) === todayKey,
  );

  const currentSessionId =
    latestEvent?.sessionId || parsedSessions.sort((a, b) => a.mtimeMs - b.mtimeMs).at(-1)?.sessionId;
  const currentSessionEvents = allEvents.filter(
    (event) => event.sessionId === currentSessionId,
  );

  const dailyKeys = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    dailyKeys.push(dateKey(new Date(now.getTime() - index * DAY_MS), timeZone));
  }
  const dailyMap = new Map(dailyKeys.map((key) => [key, emptyAggregate()]));
  const dailyEventsMap = new Map(dailyKeys.map((key) => [key, []]));
  for (const event of allEvents) {
    const key = dateKey(new Date(event.timestamp), timeZone);
    if (dailyMap.has(key)) {
      addEvent(dailyMap.get(key), event);
      dailyEventsMap.get(key).push(event);
    }
  }

  const today = aggregateEvents(todayEvents);
  today.activityWindows = buildActivityWindows(todayEvents);
  today.sources = buildSourceMix(todayEvents);
  const currentSession = aggregateEvents(currentSessionEvents);
  const window = buildWindowEstimate(allEvents, latestRate, now);
  const modelMix = buildModelMix(todayEvents);

  return {
    generatedAt: now.toISOString(),
    timeZone,
    source: {
      codexHomeDetected: Boolean(options.codexHome),
      sessionFiles: parsedSessions.length,
      privacy: "Only aggregate token, model, project label, thread title, and rate-limit fields are returned.",
    },
    current: {
      model: latestContext?.model || latestEvent?.model || "unknown",
      modelLabel:
        resolveRate(latestContext?.model || latestEvent?.model)?.label ||
        latestContext?.model ||
        latestEvent?.model ||
        "Unknown",
      effort: latestContext?.effort || latestEvent?.effort || null,
      sessionId: currentSessionId || null,
      lastActivityAt: latestEvent?.timestamp || latestContext?.timestamp || null,
    },
    today,
    currentSession,
    daily: [...dailyMap.entries()].map(([date, aggregate]) => {
      const dayEvents = dailyEventsMap.get(date) || [];
      return {
        date,
        ...finalizeAggregate(aggregate),
        activityWindows: buildActivityWindows(dayEvents),
        sources: buildSourceMix(dayEvents),
      };
    }),
    modelMix,
    quota: window,
    pricing: {
      ...PRICING_META,
      knownModels: Object.values(
        Object.fromEntries(
          modelMix
            .filter((item) => item.priced)
            .map((item) => [item.rateKey, { key: item.rateKey, label: item.label }]),
        ),
      ),
    },
  };
}

function buildWindowEstimate(events, rate, now) {
  if (!rate?.primary) {
    return {
      available: false,
      reason: "No Codex rate-limit snapshot was found in local sessions.",
    };
  }

  const usedPercent = clamp(Number(rate.primary.usedPercent) || 0, 0, 100);
  const remainingPercent = Math.max(0, 100 - usedPercent);
  const resetsAt = rate.primary.resetsAt
    ? new Date(Number(rate.primary.resetsAt) * 1000)
    : null;
  const windowMinutes = Number(rate.primary.windowMinutes) || null;
  const windowStart =
    resetsAt && windowMinutes
      ? new Date(resetsAt.getTime() - windowMinutes * 60_000)
      : null;
  const windowEvents = events.filter((event) => {
    const timestamp = new Date(event.timestamp);
    return (!windowStart || timestamp >= windowStart) && (!resetsAt || timestamp <= resetsAt);
  });
  const observed = aggregateEvents(windowEvents);
  const observedCredits = observed.value.credits;
  const canEstimate =
    usedPercent > 0 &&
    Number.isFinite(observedCredits) &&
    observedCredits > 0 &&
    observed.tokens.total > 0;

  let estimate = null;
  if (canEstimate) {
    const totalCredits = observedCredits / (usedPercent / 100);
    const totalMixTokens = observed.tokens.total * (totalCredits / observedCredits);
    const lowerPercent = Math.min(100, usedPercent + 0.5);
    const upperPercent = Math.max(0.1, usedPercent - 0.5);
    const lowerTokens =
      observed.tokens.total *
      ((observedCredits / (lowerPercent / 100)) / observedCredits);
    const upperTokens =
      observed.tokens.total *
      ((observedCredits / (upperPercent / 100)) / observedCredits);
    const currentRate = resolveRate(windowEvents.at(-1)?.model);

    estimate = {
      totalCredits,
      totalMixTokens,
      remainingMixTokens: totalMixTokens * (remainingPercent / 100),
      rangeTokens: { low: lowerTokens, high: upperTokens },
      equivalentAtCurrentModel: currentRate
        ? {
            model: currentRate.label,
            uncachedInputTokens:
              totalCredits / currentRate.credits.input * 1_000_000,
            cachedInputTokens:
              totalCredits / currentRate.credits.cached * 1_000_000,
            outputTokens:
              totalCredits / currentRate.credits.output * 1_000_000,
          }
        : null,
    };
  }

  const earliest = events.at(0)?.timestamp ? new Date(events[0].timestamp) : null;
  const coversWindowStart =
    !windowStart || (earliest && earliest.getTime() <= windowStart.getTime() + 10 * 60_000);

  return {
    available: true,
    planType: rate.planType,
    usedPercent,
    remainingPercent,
    windowMinutes,
    windowStart: windowStart?.toISOString() || null,
    resetsAt: resetsAt?.toISOString() || null,
    credits: rate.credits,
    observed,
    estimate,
    confidence: coversWindowStart ? "medium" : "low",
    caveat: coversWindowStart
      ? "Shared-pool activity outside local sessions can still affect the percentage."
      : "Local history does not cover the full quota window; treat this as a partial estimate.",
    sampledAt: rate.timestamp,
    secondsUntilReset: resetsAt
      ? Math.max(0, Math.round((resetsAt.getTime() - now.getTime()) / 1000))
      : null,
  };
}

function buildModelMix(events) {
  const groups = new Map();
  for (const event of events) {
    const key = event.model || "unknown";
    if (!groups.has(key)) groups.set(key, emptyAggregate());
    addEvent(groups.get(key), event);
  }
  return [...groups.entries()]
    .map(([model, aggregate]) => {
      const rate = resolveRate(model);
      return {
        model,
        label: rate?.label || model,
        rateKey: rate?.key || null,
        priced: Boolean(rate),
        ...finalizeAggregate(aggregate),
      };
    })
    .sort((a, b) => b.tokens.total - a.tokens.total);
}

function aggregateEvents(events) {
  const aggregate = emptyAggregate();
  for (const event of events) addEvent(aggregate, event);
  return finalizeAggregate(aggregate);
}

function emptyAggregate() {
  return {
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
}

function addEvent(aggregate, event) {
  const usage = event.usage;
  for (const key of Object.keys(aggregate.tokens)) {
    aggregate.tokens[key] += Number(usage[key]) || 0;
  }
  const value = calculateValue(
    {
      input_tokens: usage.input,
      cached_input_tokens: usage.cached,
      cache_write_input_tokens: usage.cacheWrite,
      output_tokens: usage.output,
      reasoning_output_tokens: usage.reasoning,
      total_tokens: usage.total,
    },
    event.model,
  );
  if (value.priced) {
    aggregate.value.usd += value.usd;
    aggregate.value.credits += value.credits;
  } else {
    aggregate.value.unpricedTokens += usage.total;
  }
  aggregate.requests += 1;
  if (event.sessionId) aggregate.sessions.add(event.sessionId);
}

function finalizeAggregate(aggregate) {
  return {
    tokens: { ...aggregate.tokens },
    value: { ...aggregate.value },
    requests: aggregate.requests,
    sessions: aggregate.sessions.size,
  };
}

function sanitizeRateLimits(rate) {
  const primary = rate.primary
    ? {
        usedPercent: nullableNumber(rate.primary.used_percent),
        windowMinutes: nullableNumber(rate.primary.window_minutes),
        resetsAt: nullableNumber(rate.primary.resets_at),
      }
    : null;
  const secondary = rate.secondary
    ? {
        usedPercent: nullableNumber(rate.secondary.used_percent),
        windowMinutes: nullableNumber(rate.secondary.window_minutes),
        resetsAt: nullableNumber(rate.secondary.resets_at),
      }
    : null;
  const credits = rate.credits
    ? {
        hasCredits: Boolean(rate.credits.has_credits),
        unlimited: Boolean(rate.credits.unlimited),
        balance: nullableNumber(rate.credits.balance),
      }
    : null;
  return {
    limitId: rate.limit_id || null,
    limitName: rate.limit_name || null,
    primary,
    secondary,
    credits,
    planType: rate.plan_type || null,
    rateLimitReachedType: rate.rate_limit_reached_type || null,
  };
}

async function listJsonlFiles(root) {
  const found = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) await visit(fullPath);
        else if (entry.isFile() && entry.name.endsWith(".jsonl")) found.push(fullPath);
      }),
    );
  }
  await visit(root);
  return found;
}

function dateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function safeIso(value, fallbackMs) {
  const parsed = Date.parse(value);
  return new Date(Number.isFinite(parsed) ? parsed : fallbackMs).toISOString();
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
