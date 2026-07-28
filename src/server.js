#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { CodexUsageReader } from "./codex-reader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(__dirname, "..", "public");
const args = parseArgs(process.argv.slice(2));
const reader = new CodexUsageReader({ codexHome: args.codexHome, days: args.days });
const clients = new Set();
let latestSnapshot = null;
let latestError = null;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/health") {
    return json(response, 200, {
      ok: !latestError,
      error: latestError?.message || null,
      generatedAt: latestSnapshot?.generatedAt || null,
    });
  }

  if (url.pathname === "/api/snapshot") {
    if (!latestSnapshot) await refresh();
    if (latestError && !latestSnapshot) {
      return json(response, 500, { error: latestError.message });
    }
    return json(response, 200, latestSnapshot);
  }

  if (url.pathname === "/api/stream") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.write("retry: 2000\n\n");
    clients.add(response);
    if (latestSnapshot) sendEvent(response, "snapshot", latestSnapshot);
    request.on("close", () => clients.delete(response));
    return;
  }

  return serveStatic(url.pathname, response);
});

server.on("clientError", (_error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

const port = await listenWithFallback(server, args.port, args.host);
const url = `http://${args.host === "0.0.0.0" ? "127.0.0.1" : args.host}:${port}`;

await refresh();
const timer = setInterval(refresh, args.interval);
timer.unref();

console.log("");
console.log("  Codex Meter is running");
console.log(`  ${url}`);
console.log(`  Reading aggregate usage from: ${reader.codexHome}`);
console.log("");
console.log("  Keep this window open. Press Ctrl+C to stop.");
console.log("");

if (args.open) openBrowser(url);

async function refresh() {
  try {
    latestSnapshot = await reader.snapshot();
    latestError = null;
    for (const client of clients) sendEvent(client, "snapshot", latestSnapshot);
  } catch (error) {
    latestError = error instanceof Error ? error : new Error(String(error));
    for (const client of clients) {
      sendEvent(client, "monitor-error", { message: latestError.message });
    }
  }
}

async function serveStatic(requestPath, response) {
  const relative = requestPath === "/" ? "index.html" : decodeURIComponent(requestPath.slice(1));
  const safePath = path.resolve(publicRoot, relative);
  if (!safePath.startsWith(`${publicRoot}${path.sep}`) && safePath !== publicRoot) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const info = await stat(safePath);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": contentType(safePath),
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'",
      "Referrer-Policy": "no-referrer",
    });
    createReadStream(safePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

function sendEvent(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function json(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function parseArgs(argv) {
  const config = {
    host: "127.0.0.1",
    port: 7373,
    interval: 2000,
    days: 14,
    codexHome: undefined,
    open: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--no-open") config.open = false;
    else if (item === "--host") config.host = argv[++index] || config.host;
    else if (item === "--port") config.port = positiveInt(argv[++index], config.port);
    else if (item === "--interval") {
      config.interval = Math.max(1000, positiveInt(argv[++index], config.interval));
    } else if (item === "--days") config.days = positiveInt(argv[++index], config.days);
    else if (item === "--codex-home") config.codexHome = argv[++index] || undefined;
  }
  return config;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function listenWithFallback(target, initialPort, host) {
  return new Promise((resolve, reject) => {
    let candidate = initialPort;
    const attempt = () => {
      const onError = (error) => {
        target.off("listening", onListening);
        if (error.code === "EADDRINUSE" && candidate < initialPort + 10) {
          candidate += 1;
          attempt();
        } else {
          reject(error);
        }
      };
      const onListening = () => {
        target.off("error", onError);
        resolve(candidate);
      };
      target.once("error", onError);
      target.once("listening", onListening);
      target.listen(candidate, host);
    };
    attempt();
  });
}

function openBrowser(url) {
  const platform = process.platform;
  const command =
    platform === "win32"
      ? { file: "cmd", args: ["/c", "start", "", url] }
      : platform === "darwin"
        ? { file: "open", args: [url] }
        : { file: "xdg-open", args: [url] };
  const child = spawn(command.file, command.args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function contentType(file) {
  const extension = path.extname(file);
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".ico": "image/x-icon",
    }[extension] || "application/octet-stream"
  );
}

function shutdown() {
  clearInterval(timer);
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
