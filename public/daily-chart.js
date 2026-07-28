const localCopy = {
  zh: {
    selectedDay: "选中日期",
    dayTotal: "当日总 TOKEN",
    apiEquivalent: "API 等值",
    modelResponses: "模型响应",
    clickHint: "点击任意日期柱，可在这里查看明细。",
    activityKicker: "ACTIVE WINDOWS",
    activityTitle: "所选日期活跃时间段",
    activityRule: "连续 30 分钟无新增 token 则自动分段",
    sourceKicker: "PROJECT / CHAT",
    sourceTitle: "所选日期项目 / 对话用量",
    sourcePrivacy: "仅使用本地项目名和对话标题",
    footerPrivacy: "\u8bfb\u53d6\u6c47\u603b token \u8ba1\u6570\u53ca\u672c\u5730\u9879\u76ee\u540d\u3001\u5bf9\u8bdd\u6807\u9898\uff1b\u4e0d\u8bfb\u53d6\u3001\u4e0d\u4fdd\u5b58\u3001\u4e0d\u4e0a\u4f20\u63d0\u793a\u8bcd\u6216\u56de\u590d\u6b63\u6587\u3002",
    uncachedInput: "非缓存输入",
    cachedInput: "缓存输入",
    output: "输出",
    noActivity: "该日没有 Codex 使用记录",
    noSources: "该日没有可归属的项目或对话",
    singleMoment: "单次活动",
    ofDay: "占当日",
    requests: "次响应",
    tokens: "tokens",
  },
  en: {
    selectedDay: "Selected date",
    dayTotal: "TOTAL TOKENS",
    apiEquivalent: "API equivalent",
    modelResponses: "Model responses",
    clickHint: "Click a date column to inspect its details.",
    activityKicker: "ACTIVE WINDOWS",
    activityTitle: "Active periods on selected date",
    activityRule: "Split after 30 minutes without new tokens",
    sourceKicker: "PROJECT / CHAT",
    sourceTitle: "Usage by project and chat",
    sourcePrivacy: "Local project and chat labels only",
    footerPrivacy: "Reads aggregate token counters plus local project and chat labels. Prompt and response text is never read, stored, or uploaded.",
    uncachedInput: "Uncached input",
    cachedInput: "Cached input",
    output: "Output",
    noActivity: "No Codex activity on this date",
    noSources: "No project or chat attribution for this date",
    singleMoment: "Single activity",
    ofDay: "of day",
    requests: "responses",
    tokens: "tokens",
  },
};

export function createDailyChart({ getLanguage }) {
  let selectedDate = null;
  const element = (id) => document.getElementById(id);
  const elements = {
    chart: element("usage-chart"),
    detailDate: element("detail-date"),
    detailTotal: element("detail-total"),
    detailUncachedValue: element("detail-uncached-value"),
    detailUncachedBar: element("detail-uncached-bar"),
    detailUncachedPercent: element("detail-uncached-percent"),
    detailCachedValue: element("detail-cached-value"),
    detailCachedBar: element("detail-cached-bar"),
    detailCachedPercent: element("detail-cached-percent"),
    detailOutputValue: element("detail-output-value"),
    detailOutputBar: element("detail-output-bar"),
    detailOutputPercent: element("detail-output-percent"),
    detailUsd: element("detail-usd"),
    detailRequests: element("detail-requests"),
    activityList: element("activity-window-list"),
    sourceList: element("source-list"),
  };

  return { render };

  function render(daily = []) {
    applyLocalLanguage();
    if (!daily.length) return;
    if (!selectedDate || !daily.some((day) => day.date === selectedDate)) {
      selectedDate = daily.at(-1)?.date || null;
    }

    const maximum = Math.max(1, ...daily.map((day) => day.tokens.total));
    elements.chart.replaceChildren(
      ...daily.map((day) => createDateColumn(day, maximum, daily)),
    );

    const selected = daily.find((day) => day.date === selectedDate) || daily.at(-1);
    renderDayDetail(selected);
    renderActivityWindows(selected);
    renderSources(selected);
  }

  function createDateColumn(day, maximum, daily) {
    const t = strings();
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chart-column${day.date === selectedDate ? " selected" : ""}`;
    button.dataset.date = day.date;
    button.setAttribute(
      "aria-label",
      `${formatFullDate(day.date)}, ${formatInteger(day.tokens.total)} ${t.tokens}`,
    );
    button.title =
      `${formatFullDate(day.date)}\n` +
      `${t.uncachedInput}: ${formatInteger(day.tokens.uncached)}\n` +
      `${t.cachedInput}: ${formatInteger(day.tokens.cached)}\n` +
      `${t.output}: ${formatInteger(day.tokens.output)}\n` +
      `Total: ${formatInteger(day.tokens.total)}`;

    const total = document.createElement("span");
    total.className = "chart-total-label";
    total.textContent = formatCompact(day.tokens.total);

    const stack = document.createElement("span");
    stack.className = "chart-stack";
    stack.style.height = `${Math.max(day.tokens.total ? 4 : 1, day.tokens.total / maximum * 100)}%`;
    stack.append(
      segment("uncached", day.tokens.uncached, day.tokens.total),
      segment("cached", day.tokens.cached, day.tokens.total),
      segment("output", day.tokens.output, day.tokens.total),
    );

    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = formatShortDate(day.date);

    button.append(total, stack, label);
    button.addEventListener("click", () => {
      selectedDate = day.date;
      render(daily);
    });
    return button;
  }

  function renderDayDetail(day) {
    const total = Math.max(
      1,
      day.tokens.uncached + day.tokens.cached + day.tokens.output,
    );
    elements.detailDate.textContent = formatFullDate(day.date);
    elements.detailTotal.textContent = formatInteger(day.tokens.total);
    setDetailMetric(
      "Uncached",
      day.tokens.uncached,
      day.tokens.uncached / total * 100,
    );
    setDetailMetric(
      "Cached",
      day.tokens.cached,
      day.tokens.cached / total * 100,
    );
    setDetailMetric(
      "Output",
      day.tokens.output,
      day.tokens.output / total * 100,
    );
    elements.detailUsd.textContent = formatUsd(day.value.usd);
    elements.detailRequests.textContent = formatInteger(day.requests);
  }

  function setDetailMetric(name, value, percent) {
    elements[`detail${name}Value`].textContent = formatInteger(value);
    elements[`detail${name}Bar`].style.width = `${Math.max(0, percent)}%`;
    elements[`detail${name}Percent`].textContent = formatPercent(percent);
  }

  function renderActivityWindows(day) {
    const t = strings();
    const windows = day.activityWindows || [];
    if (!windows.length) {
      elements.activityList.replaceChildren(emptyState(t.noActivity));
      return;
    }

    const maximum = Math.max(...windows.map((window) => window.tokens.total), 1);
    elements.activityList.replaceChildren(
      ...windows.map((window) => {
        const row = document.createElement("article");
        row.className = "activity-window";

        const time = document.createElement("div");
        time.className = "activity-time";
        const timeLabel = document.createElement("strong");
        timeLabel.textContent = formatTimeRange(window.startAt, window.endAt);
        const duration = document.createElement("small");
        duration.textContent =
          window.durationMinutes > 0
            ? `${window.durationMinutes} min`
            : t.singleMoment;
        time.append(timeLabel, duration);

        const visual = document.createElement("div");
        visual.className = "activity-visual";
        const track = createStackedTrack(window.tokens);
        track.style.width = `${Math.max(8, window.tokens.total / maximum * 100)}%`;
        const breakdown = document.createElement("small");
        breakdown.textContent =
          `${t.uncachedInput} ${formatCompact(window.tokens.uncached)} · ` +
          `${t.cachedInput} ${formatCompact(window.tokens.cached)} · ` +
          `${t.output} ${formatCompact(window.tokens.output)}`;
        visual.append(track, breakdown);

        const value = document.createElement("div");
        value.className = "activity-value";
        const total = document.createElement("strong");
        total.textContent = formatCompact(window.tokens.total);
        const share = document.createElement("small");
        share.textContent =
          `${formatPercent(day.tokens.total ? window.tokens.total / day.tokens.total * 100 : 0)} ${t.ofDay}`;
        value.append(total, share);

        row.append(time, visual, value);
        return row;
      }),
    );
  }

  function renderSources(day) {
    const t = strings();
    const sources = day.sources || [];
    if (!sources.length) {
      elements.sourceList.replaceChildren(emptyState(t.noSources));
      return;
    }

    elements.sourceList.replaceChildren(
      ...sources.map((project) => {
        const section = document.createElement("section");
        section.className = "source-project";

        const heading = document.createElement("div");
        heading.className = "source-project-heading";
        const name = document.createElement("strong");
        name.textContent = project.projectName;
        const total = document.createElement("span");
        total.textContent = formatCompact(project.tokens.total);
        heading.append(name, total);

        const threadList = document.createElement("div");
        threadList.className = "source-thread-list";
        threadList.append(
          ...project.threads.map((thread) => {
            const row = document.createElement("div");
            row.className = "source-thread";
            const label = document.createElement("div");
            label.className = "source-thread-label";
            const title = document.createElement("strong");
            title.textContent = thread.threadName;
            const meta = document.createElement("small");
            meta.textContent =
              `${thread.requests} ${t.requests} · ` +
              `${t.uncachedInput} ${formatCompact(thread.tokens.uncached)} · ` +
              `${t.cachedInput} ${formatCompact(thread.tokens.cached)} · ` +
              `${t.output} ${formatCompact(thread.tokens.output)}`;
            label.append(title, meta);
            const visual = createStackedTrack(thread.tokens);
            const value = document.createElement("b");
            value.textContent = formatCompact(thread.tokens.total);
            row.append(label, visual, value);
            return row;
          }),
        );

        section.append(heading, threadList);
        return section;
      }),
    );
  }

  function createStackedTrack(tokens) {
    const total = Math.max(1, tokens.uncached + tokens.cached + tokens.output);
    const track = document.createElement("div");
    track.className = "stacked-track";
    track.append(
      segment("uncached", tokens.uncached, total),
      segment("cached", tokens.cached, total),
      segment("output", tokens.output, total),
    );
    return track;
  }

  function segment(className, value, total) {
    const node = document.createElement("i");
    node.className = `${className}${value > 0 ? " has-value" : ""}`;
    node.style.setProperty("--share", `${total ? value / total * 100 : 0}%`);
    return node;
  }

  function emptyState(message) {
    const node = document.createElement("div");
    node.className = "day-empty-state";
    node.textContent = message;
    return node;
  }

  function applyLocalLanguage() {
    const t = strings();
    for (const [key, value] of Object.entries(t)) {
      for (const node of document.querySelectorAll(`[data-i18n="${key}"]`)) {
        node.textContent = value;
      }
    }
  }

  function strings() {
    return localCopy[getLanguage() === "zh" ? "zh" : "en"];
  }

  function locale() {
    return getLanguage() === "zh" ? "zh-CN" : "en-US";
  }

  function formatShortDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat(locale(), {
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function formatFullDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat(locale(), {
      month: "short",
      day: "numeric",
      weekday: "short",
    }).format(date);
  }

  function formatTimeRange(startAt, endAt) {
    const formatter = new Intl.DateTimeFormat(locale(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const start = formatter.format(new Date(startAt));
    const end = formatter.format(new Date(endAt));
    return start === end ? start : `${start}–${end}`;
  }

  function formatCompact(value) {
    const number = Number(value) || 0;
    if (number >= 1_000_000_000) return `${trim(number / 1_000_000_000)}B`;
    if (number >= 1_000_000) return `${trim(number / 1_000_000)}M`;
    if (number >= 1_000) return `${trim(number / 1_000)}K`;
    return formatInteger(number);
  }

  function trim(value) {
    return value.toLocaleString(locale(), { maximumFractionDigits: 1 });
  }

  function formatInteger(value) {
    return Math.round(Number(value) || 0).toLocaleString(locale());
  }

  function formatPercent(value) {
    return `${(Number(value) || 0).toLocaleString(locale(), {
      maximumFractionDigits: 1,
    })}%`;
  }

  function formatUsd(value) {
    return new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: Number(value) >= 100 ? 0 : 2,
    }).format(Number(value) || 0);
  }
}
