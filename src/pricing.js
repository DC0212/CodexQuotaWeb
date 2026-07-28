const MILLION = 1_000_000;

/**
 * Rates are per 1M tokens.
 *
 * `usd` is the public API-equivalent list price. `credits` is the Codex
 * token-based rate card. They are intentionally kept as separate units.
 */
export const RATE_CARD = {
  "gpt-5.6-sol": {
    label: "GPT-5.6 Sol",
    aliases: ["gpt-5.6", "gpt-5.6-sol"],
    usd: { input: 5, cached: 0.5, cacheWrite: 6.25, output: 30 },
    credits: { input: 125, cached: 12.5, cacheWrite: 156.25, output: 750 },
  },
  "gpt-5.6-terra": {
    label: "GPT-5.6 Terra",
    aliases: ["gpt-5.6-terra"],
    usd: { input: 2.5, cached: 0.25, cacheWrite: 3.125, output: 15 },
    credits: { input: 62.5, cached: 6.25, cacheWrite: 78.125, output: 375 },
  },
  "gpt-5.6-luna": {
    label: "GPT-5.6 Luna",
    aliases: ["gpt-5.6-luna"],
    usd: { input: 1, cached: 0.1, cacheWrite: 1.25, output: 6 },
    credits: { input: 25, cached: 2.5, cacheWrite: 31.25, output: 150 },
  },
  "gpt-5.5": {
    label: "GPT-5.5",
    aliases: ["gpt-5.5", "gpt-5.5-codex"],
    usd: { input: 5, cached: 0.5, cacheWrite: 5, output: 30 },
    credits: { input: 125, cached: 12.5, cacheWrite: 125, output: 750 },
  },
  "gpt-5.5-cyber": {
    label: "GPT-5.5 Cyber",
    aliases: ["gpt-5.5-cyber"],
    usd: { input: 20, cached: 2, cacheWrite: 20, output: 120 },
    credits: { input: 500, cached: 50, cacheWrite: 500, output: 3000 },
  },
  "gpt-5.4": {
    label: "GPT-5.4",
    aliases: ["gpt-5.4", "gpt-5.4-codex"],
    usd: { input: 2.5, cached: 0.25, cacheWrite: 2.5, output: 15 },
    credits: { input: 62.5, cached: 6.25, cacheWrite: 62.5, output: 375 },
  },
  "gpt-5.4-mini": {
    label: "GPT-5.4 Mini",
    aliases: ["gpt-5.4-mini"],
    usd: { input: 0.75, cached: 0.075, cacheWrite: 0.75, output: 4.52 },
    credits: { input: 18.75, cached: 1.875, cacheWrite: 18.75, output: 113 },
  },
  "gpt-5.3-codex": {
    label: "GPT-5.3 Codex",
    aliases: ["gpt-5.3-codex", "gpt-5.3"],
    usd: { input: 1.75, cached: 0.175, cacheWrite: 1.75, output: 14 },
    credits: { input: 43.75, cached: 4.375, cacheWrite: 43.75, output: 350 },
  },
  "gpt-5.2": {
    label: "GPT-5.2",
    aliases: [
      "gpt-5.2",
      "gpt-5.2-codex",
      "gpt-5.1",
      "gpt-5.1-codex",
      "gpt-5.1-codex-max",
      "gpt-5-codex",
    ],
    usd: { input: 1.75, cached: 0.175, cacheWrite: 1.75, output: 14 },
    credits: { input: 43.75, cached: 4.375, cacheWrite: 43.75, output: 350 },
  },
};

export const PRICING_META = {
  asOf: "2026-07-28",
  apiSource: "https://developers.openai.com/api/docs/models/compare",
  codexSource: "https://help.openai.com/en/articles/20001106-codex-rate-card",
  notes: [
    "USD values are API-equivalent list-price estimates, not a ChatGPT subscription invoice.",
    "Fast mode and long-context surcharges are not inferred from local session logs.",
    "GPT-5.6 cache writes use the published 1.25x uncached-input rate.",
  ],
};

const aliasMap = new Map();
for (const [key, entry] of Object.entries(RATE_CARD)) {
  aliasMap.set(key, key);
  for (const alias of entry.aliases) aliasMap.set(alias.toLowerCase(), key);
}

export function resolveRate(model) {
  if (!model) return null;
  const normalized = String(model).trim().toLowerCase();
  const exact = aliasMap.get(normalized);
  if (exact) return { key: exact, ...RATE_CARD[exact] };

  // Snapshot suffixes keep their family price unless a more specific entry exists.
  for (const [alias, key] of [...aliasMap.entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (normalized.startsWith(`${alias}-20`)) {
      return { key, ...RATE_CARD[key] };
    }
  }
  return null;
}

export function normalizeUsage(usage = {}) {
  const input = nonNegative(usage.input_tokens);
  const cached = Math.min(input, nonNegative(usage.cached_input_tokens));
  const cacheWrite = Math.min(
    Math.max(0, input - cached),
    nonNegative(usage.cache_write_input_tokens),
  );
  const uncached = Math.max(0, input - cached - cacheWrite);
  const output = nonNegative(usage.output_tokens);
  const reasoning = Math.min(output, nonNegative(usage.reasoning_output_tokens));
  const total = nonNegative(usage.total_tokens) || input + output;

  return { input, uncached, cached, cacheWrite, output, reasoning, total };
}

export function calculateValue(usage, model) {
  const normalized = normalizeUsage(usage);
  const rate = resolveRate(model);
  if (!rate) {
    return {
      usd: null,
      credits: null,
      priced: false,
      rateKey: null,
      usage: normalized,
    };
  }

  return {
    usd: sumRate(normalized, rate.usd),
    credits: sumRate(normalized, rate.credits),
    priced: true,
    rateKey: rate.key,
    usage: normalized,
  };
}

function sumRate(usage, rates) {
  return (
    usage.uncached * rates.input +
    usage.cached * rates.cached +
    usage.cacheWrite * rates.cacheWrite +
    usage.output * rates.output
  ) / MILLION;
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
