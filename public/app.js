import { createDailyChart } from "./daily-chart.js?v=2";
const state = {
  language: localStorage.getItem("codex-meter-language") || preferredLanguage(),
  snapshot: null,
};

const copy = {
  zh: {
    connecting: "正在连接",
    connected: "实时已连接",
    disconnected: "连接已中断",
    eyebrow: "LIVE LOCAL TELEMETRY · 实时本地监测",
    headline: "你的 Codex 用量，<br />终于有数。",
    lede: "每个 token、当前模型、API 等值成本与本周剩余额度，在同一处持续刷新。",
    private: "数据只留在本机",
    remaining: "剩余额度",
    resets: "重置于",
    plan: "账户方案",
    todayTokens: "今日 TOKEN",
    activeModel: "当前模型",
    apiValue: "今日 API 等值",
    sessionTokens: "当前任务",
    detected: "已检测",
    estimate: "估算",
    dailyTrendKicker: "DAILY CONSUMPTION",
    dailyTrend: "每日消耗趋势",
    uncachedInput: "非缓存输入",
    cachedInput: "缓存输入",
    output: "输出",
    periodTotal: "近 14 天",
    cacheRate: "缓存输入占比",
    pricedCoverage: "可计价覆盖率",
    quotaKicker: "QUOTA INFERENCE",
    quotaEstimate: "账号总额度推算",
    mixEquivalent: "按本窗口实际用量结构约合",
    used: "已用",
    remainingTokens: "预计剩余 token",
    estimateRange: "估算区间",
    observedCredits: "本机已观测 credits",
    quotaDefaultCaveat: "总 token 不是固定值；不同模型和输入/输出类型消耗权重不同。",
    tokenMixKicker: "TOKEN COMPOSITION",
    tokenMix: "今日 Token 构成",
    total: "合计",
    reasoningSubset: "其中推理输出",
    modelBreakdownKicker: "MODEL BREAKDOWN",
    modelBreakdown: "今日模型分布",
    waitingData: "等待 Codex 用量数据…",
    footerPrivacy: "只读取本机 Codex 会话中的汇总计数字段，不读取、不保存、不上传提示词或回复正文。",
    pricingAsOf: "价格口径更新于",
    notInvoice: "美元金额为 API 公开价等值估算，并非订阅账单。",
    requests: "次模型响应",
    effort: "推理强度",
    session: "个会话",
    credits: "credits",
    lowConfidence: "低置信度",
    mediumConfidence: "中等置信度",
    noQuota: "暂无额度快照",
    partialHistory: "本机历史未覆盖完整额度窗口，此结果仅供趋势参考。",
    sharedPool: "额度百分比可能包含其他 Codex、ChatGPT Work、Excel 或 Workspace Agents 活动，因此推算值不是官方配额。",
    unknownModel: "存在无法匹配公开价格的模型 token",
    today: "今天",
  },
  en: {
    connecting: "Connecting",
    connected: "Live connection",
    disconnected: "Disconnected",
    eyebrow: "LIVE LOCAL TELEMETRY",
    headline: "Your Codex usage,<br />finally measurable.",
    lede: "Every token, active model, API-equivalent value, and remaining weekly quota—continuously refreshed.",
    private: "Data stays on this device",
    remaining: "Quota remaining",
    resets: "Resets",
    plan: "Plan",
    todayTokens: "TOKENS TODAY",
    activeModel: "ACTIVE MODEL",
    apiValue: "API VALUE TODAY",
    sessionTokens: "CURRENT TASK",
    detected: "Detected",
    estimate: "Estimate",
    dailyTrendKicker: "DAILY CONSUMPTION",
    dailyTrend: "Daily usage trend",
    uncachedInput: "Uncached input",
    cachedInput: "Cached input",
    output: "Output",
    periodTotal: "Last 14 days",
    cacheRate: "Cached input share",
    pricedCoverage: "Priced coverage",
    quotaKicker: "QUOTA INFERENCE",
    quotaEstimate: "Account quota estimate",
    mixEquivalent: "Equivalent at this window's actual usage mix",
    used: "used",
    remainingTokens: "estimated tokens left",
    estimateRange: "Estimate range",
    observedCredits: "Local observed credits",
    quotaDefaultCaveat: "Token capacity is not fixed; models and token types carry different weights.",
    tokenMixKicker: "TOKEN COMPOSITION",
    tokenMix: "Today's token mix",
    total: "total",
    reasoningSubset: "Reasoning output subset",
    modelBreakdownKicker: "MODEL BREAKDOWN",
    modelBreakdown: "Today's model mix",
    waitingData: "Waiting for Codex usage data…",
    footerPrivacy: "Reads aggregate counters from local Codex sessions only. Prompt and response text is never read, stored, or uploaded.",
    pricingAsOf: "Pricing basis updated",
    notInvoice: "USD is an API list-price equivalent, not a subscription invoice.",
    requests: "model responses",
    effort: "reasoning effort",
    session: "sessions",
    credits: "credits",
    lowConfidence: "low confidence",
    mediumConfidence: "medium confidence",
    noQuota: "No quota snapshot",
    partialHistory: "Local history does not cover the full quota window; use this estimate for trend context only.",
    sharedPool: "The percentage can include Codex, ChatGPT Work, Excel, or Workspace Agents activity, so this is not an official quota.",
    unknownModel: "Some tokens use a model without a matched public price",
    today: "Today",
  },
};

const elements = Object.fromEntries(
  [
    "connection-pill",
    "last-updated",
    "quota-ring",
    "remaining-percent",
    "quota-window",
    "reset-time",
    "plan-type",
    "today-tokens",
    "today-requests",
    "active-model",
    "reasoning-effort",
    "today-value",
    "today-credits",
    "session-tokens",
    "session-value",
    "session-count",
    "usage-chart",
    "period-total",
    "cache-rate",
    "priced-rate",
    "confidence-badge",
    "total-quota-tokens",
    "scale-fill",
    "used-quota-label",
    "remaining-quota-tokens",
    "quota-range",
    "observed-credits",
    "quota-caveat",
    "token-donut",
    "donut-total",
    "mix-uncached",
    "mix-cached",
    "mix-output",
    "mix-reasoning",
    "model-list",
    "pricing-link",
    "error-toast",
    "language-toggle",
  ].map((id) => [id, document.getElementById(id)]),
);

const interactiveDailyChart = createDailyChart({
  getLanguage: () => state.language,
});

elements["language-toggle"].addEventListener("click", () => {
  state.language = state.language === "zh" ? "en" : "zh";
  localStorage.setItem("codex-meter-language", state.language);
  applyLanguage();
  if (state.snapshot) render(state.snapshot);
});

applyLanguage();
connect();

function connect() {
  const stream = new EventSource("/api/stream");
  stream.addEventListener("open", () => setConnection("connected"));
  stream.addEventListener("snapshot", (event) => {
    state.snapshot = JSON.parse(event.data);
    setConnection("connected");
    render(state.snapshot);
  });
  stream.addEventListener("monitor-error", (event) => {
    const payload = JSON.parse(event.data);
    showError(payload.message);
  });
  stream.onerror = () => setConnection("disconnected");
}

function render(snapshot) {
  const t = copy[state.language];
  const today = snapshot.today;
  const quota = snapshot.quota;
  const period = sumDaily(snapshot.daily);

  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  elements["last-updated"].textContent = formatRelative(snapshot.generatedAt);
  elements["today-tokens"].textContent = formatNumber(today.tokens.total);
  elements["today-requests"].textContent = `${formatInteger(today.requests)} ${t.requests}`;
  elements["active-model"].textContent = snapshot.current.modelLabel || snapshot.current.model;
  elements["reasoning-effort"].textContent = snapshot.current.effort
    ? `${t.effort}: ${snapshot.current.effort}`
    : "—";
  elements["today-value"].textContent = formatUsd(today.value.usd);
  elements["today-credits"].textContent = `${formatDecimal(today.value.credits)} ${t.credits}`;
  elements["session-tokens"].textContent = formatNumber(snapshot.currentSession.tokens.total);
  elements["session-value"].textContent = formatUsd(snapshot.currentSession.value.usd);
  elements["session-count"].textContent = `1 ${t.session}`;

  renderQuota(quota);
  interactiveDailyChart.render(snapshot.daily);
  renderTokenMix(today.tokens);
  renderModelMix(snapshot.modelMix);

  elements["period-total"].textContent = formatNumber(period.tokens.total);
  elements["cache-rate"].textContent = formatPercent(
    period.tokens.input ? period.tokens.cached / period.tokens.input * 100 : 0,
  );
  const pricedTokens = Math.max(0, period.tokens.total - period.value.unpricedTokens);
  elements["priced-rate"].textContent = formatPercent(
    period.tokens.total ? pricedTokens / period.tokens.total * 100 : 100,
  );
  elements["pricing-link"].textContent = snapshot.pricing.asOf;
  elements["pricing-link"].href = snapshot.pricing.apiSource;

  if (today.value.unpricedTokens > 0) showError(t.unknownModel);
}

function renderQuota(quota) {
  const t = copy[state.language];
  if (!quota.available) {
    elements["remaining-percent"].textContent = "—";
    elements["quota-ring"].style.setProperty("--used", "0");
    elements["confidence-badge"].textContent = t.noQuota;
    elements["total-quota-tokens"].textContent = "—";
    elements["quota-caveat"].textContent = t.quotaDefaultCaveat;
    return;
  }

  elements["remaining-percent"].textContent = `${formatDecimal(quota.remainingPercent, 0)}%`;
  elements["quota-ring"].style.setProperty("--used", String(quota.usedPercent));
  elements["quota-window"].textContent = quota.windowMinutes
    ? `${Math.round(quota.windowMinutes / 1440)} DAY WINDOW`
    : "USAGE WINDOW";
  elements["reset-time"].textContent = quota.resetsAt
    ? formatDateTime(quota.resetsAt)
    : "—";
  elements["plan-type"].textContent = quota.planType || "—";
  elements["used-quota-label"].textContent = `${formatDecimal(quota.usedPercent, 0)}%`;
  elements["scale-fill"].style.width = `${quota.usedPercent}%`;
  elements["confidence-badge"].textContent =
    quota.confidence === "medium" ? t.mediumConfidence : t.lowConfidence;
  elements["observed-credits"].textContent =
    `${formatDecimal(quota.observed?.value?.credits || 0)} ${t.credits}`;

  if (quota.estimate) {
    elements["total-quota-tokens"].textContent = formatNumber(quota.estimate.totalMixTokens);
    elements["remaining-quota-tokens"].textContent = formatNumber(
      quota.estimate.remainingMixTokens,
    );
    elements["quota-range"].textContent =
      `${formatNumber(quota.estimate.rangeTokens.low)} – ${formatNumber(quota.estimate.rangeTokens.high)}`;
  } else {
    elements["total-quota-tokens"].textContent = "—";
    elements["remaining-quota-tokens"].textContent = "—";
    elements["quota-range"].textContent = "—";
  }

  elements["quota-caveat"].textContent =
    quota.confidence === "medium" ? t.sharedPool : t.partialHistory;
}

function renderChart(daily) {
  const maximum = Math.max(1, ...daily.map((day) => day.tokens.total));
  elements["usage-chart"].replaceChildren(
    ...daily.map((day, index) => {
      const column = document.createElement("div");
      column.className = "chart-column";
      const height = Math.max(1.5, day.tokens.total / maximum * 100);
      column.style.height = `${height}%`;
      column.title =
        `${day.date}\n${formatInteger(day.tokens.total)} tokens\n${formatUsd(day.value.usd)}`;

      const uncached = segment("uncached", day.tokens.uncached, day.tokens.total);
      const cached = segment("cached", day.tokens.cached, day.tokens.total);
      const output = segment("output", day.tokens.output, day.tokens.total);
      const label = document.createElement("span");
      label.className = "chart-label";
      label.textContent =
        index === daily.length - 1
          ? copy[state.language].today
          : day.date.slice(5).replace("-", "/");
      column.append(uncached, cached, output, label);
      return column;
    }),
  );
}

function segment(className, value, total) {
  const node = document.createElement("i");
  node.className = className;
  node.style.height = `${total ? value / total * 100 : 0}%`;
  return node;
}

function renderTokenMix(tokens) {
  const total = Math.max(1, tokens.uncached + tokens.cached + tokens.output);
  const uncachedEnd = tokens.uncached / total * 100;
  const cachedEnd = uncachedEnd + tokens.cached / total * 100;
  elements["token-donut"].style.setProperty("--uncached", String(uncachedEnd));
  elements["token-donut"].style.setProperty("--cached", String(cachedEnd));
  elements["donut-total"].textContent = formatNumber(tokens.total);
  elements["mix-uncached"].textContent = formatNumber(tokens.uncached);
  elements["mix-cached"].textContent = formatNumber(tokens.cached);
  elements["mix-output"].textContent = formatNumber(tokens.output);
  elements["mix-reasoning"].textContent = formatNumber(tokens.reasoning);
}

function renderModelMix(models) {
  if (!models.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = copy[state.language].waitingData;
    elements["model-list"].replaceChildren(empty);
    return;
  }
  const maximum = Math.max(...models.map((item) => item.tokens.total), 1);
  elements["model-list"].replaceChildren(
    ...models.map((item) => {
      const row = document.createElement("div");
      row.className = "model-row";

      const name = document.createElement("div");
      name.className = "model-name";
      const strong = document.createElement("strong");
      strong.textContent = item.label;
      const small = document.createElement("small");
      small.textContent = `${formatInteger(item.requests)} ${copy[state.language].requests}`;
      name.append(strong, small);

      const bar = document.createElement("div");
      bar.className = "model-bar";
      const fill = document.createElement("i");
      fill.style.width = `${item.tokens.total / maximum * 100}%`;
      bar.append(fill);

      const values = document.createElement("div");
      values.className = "model-values";
      const total = document.createElement("b");
      total.textContent = formatNumber(item.tokens.total);
      const usd = document.createElement("small");
      usd.textContent = item.priced ? formatUsd(item.value.usd) : "unpriced";
      values.append(total, usd);

      row.append(name, bar, values);
      return row;
    }),
  );
}

function sumDaily(daily) {
  return daily.reduce(
    (sum, day) => {
      for (const key of Object.keys(sum.tokens)) sum.tokens[key] += day.tokens[key] || 0;
      sum.value.usd += day.value.usd || 0;
      sum.value.credits += day.value.credits || 0;
      sum.value.unpricedTokens += day.value.unpricedTokens || 0;
      return sum;
    },
    {
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
    },
  );
}

function applyLanguage() {
  const t = copy[state.language];
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const value = t[node.dataset.i18n];
    if (value) node.innerHTML = value;
  }
  elements["language-toggle"].textContent = state.language === "zh" ? "EN" : "中";
}

function setConnection(status) {
  const pill = elements["connection-pill"];
  pill.classList.toggle("waiting", status === "waiting");
  pill.classList.toggle("offline", status === "disconnected");
  const text = pill.querySelector("[data-i18n]");
  text.textContent =
    status === "connected"
      ? copy[state.language].connected
      : status === "disconnected"
        ? copy[state.language].disconnected
        : copy[state.language].connecting;
}

function showError(message) {
  elements["error-toast"].textContent = message;
  elements["error-toast"].classList.add("visible");
  clearTimeout(showError.timer);
  showError.timer = setTimeout(
    () => elements["error-toast"].classList.remove("visible"),
    5000,
  );
}

function formatNumber(value) {
  const number = Number(value) || 0;
  const locale = state.language === "zh" ? "zh-CN" : "en-US";
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })}M`;
  if (number >= 1_000) return `${(number / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })}K`;
  return Math.round(number).toLocaleString(locale);
}

function formatInteger(value) {
  return Math.round(Number(value) || 0).toLocaleString(
    state.language === "zh" ? "zh-CN" : "en-US",
  );
}

function formatDecimal(value, digits = 2) {
  return (Number(value) || 0).toLocaleString(
    state.language === "zh" ? "zh-CN" : "en-US",
    { maximumFractionDigits: digits },
  );
}

function formatUsd(value) {
  const digits = Number(value) >= 100 ? 0 : 2;
  return new Intl.NumberFormat(state.language === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}

function formatPercent(value) {
  return `${formatDecimal(value, 1)}%`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(state.language === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelative(value) {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000));
  if (state.language === "zh") return seconds < 3 ? "刚刚更新" : `${seconds} 秒前更新`;
  return seconds < 3 ? "Updated just now" : `Updated ${seconds}s ago`;
}

function preferredLanguage() {
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}
