import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ELDORADO_ORIGIN = "https://www.eldorado.gg";
const DEFAULT_SWAGGER_HEADER = "Swager request";
const TALKJS_ORIGIN = "https://app.talkjs.com";

/** Eldorado API validates XSRF (cookie + header). Cache bootstrap per session token. */
const xsrfCache = new Map();

function tokenCacheKey(idToken) {
  return crypto.createHash("sha256").update(idToken).digest("hex");
}

/** First name=value segment of a Set-Cookie line (before attributes). */
function parseSetCookiePair(setCookieLine) {
  const semi = setCookieLine.indexOf(";");
  const first = (semi === -1 ? setCookieLine : setCookieLine.slice(0, semi)).trim();
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const name = first.slice(0, eq).trim();
  let value = first.slice(eq + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  return { name, value };
}

function isXsrfCookieName(name) {
  return /xsrf|csrf|forgery|antiforgery|requestverification/i.test(name);
}

/**
 * Hit Eldorado HTML with the IdToken cookie so they issue XSRF cookies; mirror browser same-origin.
 */
async function getEldoradoXsrfBundle(idToken) {
  const key = tokenCacheKey(idToken);
  const now = Date.now();
  const ttl = 15 * 60 * 1000;
  const hit = xsrfCache.get(key);
  if (hit && hit.until > now) return hit.bundle;

  const trimmed = idToken.trim();
  const baseHeaders = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    Cookie: `__Host-EldoradoIdToken=${trimmed}`,
    Origin: ELDORADO_ORIGIN,
    Referer: `${ELDORADO_ORIGIN}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  };

  const tryUrls = [
    `${ELDORADO_ORIGIN}/`,
    `${ELDORADO_ORIGIN}/seller`,
    `${ELDORADO_ORIGIN}/seller/dashboard`,
  ];
  const cookiePairs = [];
  let xsrfHeaderVal = null;

  for (const url of tryUrls) {
    const res = await fetch(url, { headers: baseHeaders, redirect: "follow" });
    let lines = [];
    if (typeof res.headers.getSetCookie === "function") {
      const sc = res.headers.getSetCookie();
      if (Array.isArray(sc)) lines = sc;
    }
    if (lines.length === 0) {
      const single = res.headers.get("set-cookie");
      if (single) lines = [single];
    }

    for (const line of lines) {
      const pair = parseSetCookiePair(line);
      if (!pair || !isXsrfCookieName(pair.name)) continue;
      cookiePairs.push(`${pair.name}=${pair.value}`);
      try {
        xsrfHeaderVal = decodeURIComponent(pair.value.replace(/\+/g, " "));
      } catch {
        xsrfHeaderVal = pair.value;
      }
    }
    if (xsrfHeaderVal && cookiePairs.length) break;
  }

  const bundle =
    xsrfHeaderVal && cookiePairs.length
      ? { cookiePairs, xsrfHeaderVal }
      : null;

  if (bundle) xsrfCache.set(key, { until: now + ttl, bundle });
  return bundle;
}

function buildEldoradoUpstreamHeaders(req, idToken, xsrfBundle) {
  const headers = { ...req.headers };

  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];
  delete headers["accept-encoding"];
  delete headers.cookie;
  delete headers["x-eldorado-id-token"];

  // Do not send the SPA origin (e.g. onrender.com) to Eldorado — breaks CSRF / XSRF checks.
  headers.origin = ELDORADO_ORIGIN;
  headers.referer = `${ELDORADO_ORIGIN}/`;

  for (const hn of Object.keys(headers)) {
    const low = hn.toLowerCase();
    if (
      low.startsWith("sec-fetch-") ||
      low === "sec-purpose" ||
      low.startsWith("sec-ch-ua")
    ) {
      delete headers[hn];
    }
  }

  if (idToken) {
    const parts = [`__Host-EldoradoIdToken=${idToken}`];
    if (xsrfBundle?.cookiePairs?.length) {
      parts.push(...xsrfBundle.cookiePairs);
    }
    headers.cookie = parts.join("; ");
    if (xsrfBundle?.xsrfHeaderVal) {
      headers["x-xsrf-token"] = xsrfBundle.xsrfHeaderVal;
    }
  }

  if (!headers.swagger) headers.swagger = DEFAULT_SWAGGER_HEADER;
  return headers;
}

function getArgFlag(name) {
  return process.argv.includes(name);
}

function toTargetUrl(originalUrl) {
  // originalUrl includes any query string
  const stripped = originalUrl.replace(/^\/eldorado(?=\/|$)/, "");
  const pathname = stripped.startsWith("/") ? stripped : `/${stripped}`;
  return new URL(pathname, ELDORADO_ORIGIN);
}

async function proxyToEldorado(req, res) {
  const targetUrl = toTargetUrl(req.originalUrl);

  const method = req.method?.toUpperCase?.() ?? "GET";
  const rawId = req.headers["x-eldorado-id-token"];
  const idToken = typeof rawId === "string" ? rawId.trim() : "";

  let xsrfBundle = null;
  if (idToken) {
    try {
      xsrfBundle = await getEldoradoXsrfBundle(idToken);
    } catch (e) {
      console.error("Eldorado XSRF bootstrap failed:", e?.message || e);
    }
  }

  const headers = buildEldoradoUpstreamHeaders(req, idToken, xsrfBundle);

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

