import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ELDORADO_ORIGIN = "https://www.eldorado.gg";
const DEFAULT_SWAGGER_HEADER = "Swager request";
const TALKJS_ORIGIN = "https://app.talkjs.com";

function getArgFlag(name) {
  return process.argv.includes(name);
}

function toTargetUrl(originalUrl) {
  // originalUrl includes any query string
  const stripped = originalUrl.replace(/^\/eldorado(?=\/|$)/, "");
  const pathname = stripped.startsWith("/") ? stripped : `/${stripped}`;
  return new URL(pathname, ELDORADO_ORIGIN);
}

function filteredRequestHeaders(req) {
  const headers = { ...req.headers };

  // Disallowed / hop-by-hop / problematic headers for proxying
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];
  delete headers["accept-encoding"];

  // We control auth cookie via token header
  delete headers.cookie;

  // Ensure required swagger header exists (per swagger.json)
  if (!headers.swagger) headers.swagger = DEFAULT_SWAGGER_HEADER;

  const idToken = headers["x-eldorado-id-token"];
  delete headers["x-eldorado-id-token"];
  if (typeof idToken === "string" && idToken.trim()) {
    headers.cookie = `__Host-EldoradoIdToken=${idToken.trim()}`;
  }

  return headers;
}

async function proxyToEldorado(req, res) {
  const targetUrl = toTargetUrl(req.originalUrl);

  const method = req.method?.toUpperCase?.() ?? "GET";
  const headers = filteredRequestHeaders(req);

  const hasBody = !["GET", "HEAD"].includes(method) && req.body && req.body.length > 0;
  const body = hasBody ? req.body : undefined;

  const upstream = await fetch(targetUrl, { method, headers, body, redirect: "manual" });

  res.status(upstream.status);

  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("content-type", ct);

  // Don’t forward set-cookie across origins; we handle auth via token → cookie server-side.
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}

function toTalkJsUrl(req) {
  // Expected: /talkjs/api/v0/:appId/say/:conversationId?sessionId=...
  const stripped = req.originalUrl.replace(/^\/talkjs(?=\/|$)/, "");
  const pathname = stripped.startsWith("/") ? stripped : `/${stripped}`;
  return new URL(pathname, TALKJS_ORIGIN);
}

function filteredTalkJsHeaders(req) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];
  delete headers["accept-encoding"];
  delete headers.cookie;

  // Pass through talkjs auth + metadata from client
  // Client should send: x-talkjs-authorization: "bearer ...", x-talkjs-client-build, x-talkjs-client-date
  const auth = headers["x-talkjs-authorization"];
  delete headers["x-talkjs-authorization"];
  if (typeof auth === "string" && auth.trim()) headers.authorization = auth.trim();

  return headers;
}

async function proxyToTalkJs(req, res) {
  const targetUrl = toTalkJsUrl(req);
  const method = req.method?.toUpperCase?.() ?? "GET";
  const headers = filteredTalkJsHeaders(req);
  const hasBody = !["GET", "HEAD"].includes(method) && req.body && req.body.length > 0;
  const body = hasBody ? req.body : undefined;

  const upstream = await fetch(targetUrl, { method, headers, body, redirect: "manual" });
  res.status(upstream.status);
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("content-type", ct);
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}

async function main() {
  const isDev = getArgFlag("--dev");

  const app = express();

  // Proxy needs raw body so we can forward exact payload
  app.use(
    "/eldorado",
    express.raw({ type: "*/*", limit: "25mb" }),
    (req, res, next) => {
      proxyToEldorado(req, res).catch(next);
    },
  );

  app.use(
    "/talkjs",
    express.raw({ type: "*/*", limit: "5mb" }),
    (req, res, next) => {
      proxyToTalkJs(req, res).catch(next);
    },
  );

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // In middleware mode, Vite starts a separate WS server for HMR (default 24678).
        // On Windows this port is commonly occupied; disabling HMR avoids noisy errors.
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "..", "dist");
    app.use(express.static(distDir));
    // SPA fallback (Express 5 / path-to-regexp v8 rejects app.get("*", ...))
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.sendFile(path.join(distDir, "index.html"), (err) => err && next(err));
    });
  }

  // Local defaults: dev 5173, production/preview 4173. Cloud hosts (Render, Fly, etc.) set PORT.
  const fallbackPort = isDev ? 5173 : 4173;
  const listenPort = process.env.PORT ? Number(process.env.PORT) : fallbackPort;
  app.listen(listenPort, () => {
    // Intentionally minimal: noisy logs make the UI harder to use.
    console.log(`Server listening on http://localhost:${listenPort}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

