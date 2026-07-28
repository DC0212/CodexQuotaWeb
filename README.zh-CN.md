# CodexQuotaWeb

一个本地优先、实时刷新的 Codex 用量仪表盘。它从本机 Codex 会话记录中提取汇总计数，展示每日 token、当前模型、API 公开价等值、Codex credits、剩余额度和账号总额度推算。

> CodexQuotaWeb 是本地网页应用，不是云端网站，也不是原生桌面客户端。启动脚本会在本机运行一个只绑定 `127.0.0.1` 的轻量 Node.js 服务，浏览器只与该本地服务通信。

> 这不是 OpenAI 官方产品。美元金额是按公开 API 价格计算的等值估算，不是 ChatGPT/Codex 订阅账单。

## 它能做什么

- 每 2 秒刷新当前任务与今日 token
- 区分非缓存输入、缓存输入、输出和推理输出
- 最近 14 天趋势直接显示日期、总 token 及三类 token 构成
- 点击日期后展示当日明细、活跃时间段和价值估算
- 连续 30 分钟无新增 token 时自动划分使用时间段
- 在本地元数据可用时，按项目目录和对话标题归集 token
- 自动识别当前正在使用的模型与推理强度
- 按模型公开价估算 API 等值美元金额
- 按 Codex rate card 估算 credits
- 读取 Codex 的用量百分比、窗口长度和重置时间
- 按当前窗口真实 token 结构推算总额度与剩余 token
- 展示最近 14 天趋势和今日模型分布
- 中英文界面
- 响应式、柔和浅色的浏览器界面
- 只监听 `127.0.0.1`，数据不离开电脑

## 本地网页如何运行

1. `start.bat` 或 `start.command` 启动随工具提供的 Node.js 本地网页服务。
2. 服务只读取本机 Codex 数据目录中的汇总计数字段。
3. 浏览器打开 `http://127.0.0.1:7373`，并从该本地服务持续刷新仪表盘。

页面不会发布到互联网，不需要远程数据库，运行时也没有第三方软件包依赖。

## Windows 使用

1. 从 GitHub Releases 下载并解压 `codex-meter.zip`。
2. 安装 [Node.js 18 或更高版本](https://nodejs.org/)。
3. 双击 `start.bat`。
4. 浏览器会自动打开仪表盘。使用期间请保持命令窗口开启。

不需要执行 `npm install`，运行时没有第三方依赖。

## macOS / Linux 使用

安装 Node.js 18 或更高版本，然后：

```bash
chmod +x start.command
./start.command
```

也可以在任意平台运行：

```bash
node src/server.js
```

## 常用参数

```bash
node src/server.js --no-open
node src/server.js --port 7373
node src/server.js --days 30
node src/server.js --codex-home "/custom/path/.codex"
```

如设置了 `CODEX_HOME` 环境变量，工具会自动使用该目录；否则默认读取用户主目录下的 `.codex`。

## 统计口径

Codex 会话中的 `input_tokens` 包含缓存输入明细，因此：

```text
非缓存输入 = input_tokens - cached_input_tokens - cache_write_input_tokens
API 等值 = 非缓存输入 × 输入单价
         + 缓存输入 × 缓存输入单价
         + 缓存写入 × 缓存写入单价
         + 输出 × 输出单价
```

额度不是固定 token 包。不同模型、缓存输入、非缓存输入和输出消耗权重不同。仪表盘显示的“总额度 token”采用当前额度窗口中实际使用结构换算：

```text
估算总 credits = 本机窗口内已观测 credits ÷ 已用百分比
约当总 token  = 本机窗口内已观测 token × 估算总 credits ÷ 已观测 credits
```

百分比通常为整数，仪表盘用 ±0.5 个百分点给出估算区间。

## 重要限制

- Codex、ChatGPT Work、ChatGPT for Excel 和 Workspace Agents 可能共享同一 agentic usage/credit pool；本机记录无法观察其他产品或云端任务，因此总额度推算不是官方配额。
- 本机历史未覆盖完整 7 天窗口时，推算置信度会降低。
- Fast mode、超长上下文附加费以及未公开模型可能无法从本地字段准确识别。
- 公开价格会变化。当前价格口径更新于 2026-07-28。
- 该工具不会读取 API 账单，也不会绕过任何官方额度限制。

## 隐私与安全

服务端解析器只处理：

- `turn_context` 中的模型和推理强度
- `token_count` 中的汇总 token 数
- `rate_limits` 中的百分比、窗口和重置时间

提示词、回复、文件内容、账号凭据和 `auth.json` 均不会返回给浏览器、保存到数据库或上传到网络。服务默认只绑定本机回环地址。

## 数据与价格来源

- [OpenAI API 模型价格比较](https://developers.openai.com/api/docs/models/compare)
- [OpenAI Codex rate card](https://help.openai.com/en/articles/20001106-codex-rate-card)

## 开发与验证

```bash
npm test
npm run check
```

## 发布

推送 `v*` 标签后，GitHub Actions 会自动创建 Release，并附加可下载的 ZIP 和 TAR.GZ。

## License

MIT
