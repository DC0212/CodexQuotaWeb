import assert from "node:assert/strict";
import test from "node:test";
import { calculateValue, normalizeUsage, resolveRate } from "../src/pricing.js";

test("separates cached input from uncached input", () => {
  const usage = normalizeUsage({
    input_tokens: 100_000,
    cached_input_tokens: 80_000,
    output_tokens: 10_000,
    reasoning_output_tokens: 4_000,
    total_tokens: 110_000,
  });

  assert.deepEqual(usage, {
    input: 100_000,
    uncached: 20_000,
    cached: 80_000,
    cacheWrite: 0,
    output: 10_000,
    reasoning: 4_000,
    total: 110_000,
  });
});

test("calculates GPT-5.6 Sol API-equivalent value and credits", () => {
  const value = calculateValue(
    {
      input_tokens: 100_000,
      cached_input_tokens: 80_000,
      output_tokens: 10_000,
      total_tokens: 110_000,
    },
    "gpt-5.6-sol",
  );

  assert.equal(value.priced, true);
  assert.equal(value.usd, 0.44);
  assert.equal(value.credits, 11);
});

test("resolves aliases and dated snapshots", () => {
  assert.equal(resolveRate("gpt-5.6").key, "gpt-5.6-sol");
  assert.equal(resolveRate("gpt-5.6-terra-2026-07-01").key, "gpt-5.6-terra");
  assert.equal(resolveRate("private-model"), null);
});
