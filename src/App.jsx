import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ─── CONSTANTS ───

const RANKS = [
  "Bronze I","Bronze II","Bronze III",
  "Silver I","Silver II","Silver III",
  "Gold I","Gold II","Gold III",
  "Platinum I","Platinum II","Platinum III",
  "Diamond I","Diamond II","Diamond III",
  "Champion I","Champion II","Champion III",
  "Grand Champion I","Grand Champion II","Grand Champion III",
  "Supersonic Legend"
];
const RANK_SHORT = {
  "Bronze I":"B1","Bronze II":"B2","Bronze III":"B3",
  "Silver I":"S1","Silver II":"S2","Silver III":"S3",
  "Gold I":"G1","Gold II":"G2","Gold III":"G3",
  "Platinum I":"P1","Platinum II":"P2","Platinum III":"P3",
  "Diamond I":"D1","Diamond II":"D2","Diamond III":"D3",
  "Champion I":"C1","Champion II":"C2","Champion III":"C3",
  "Grand Champion I":"GC1","Grand Champion II":"GC2","Grand Champion III":"GC3",
  "Supersonic Legend":"SSL"
};
const RANK_COLORS = {
  "Bronze":"#cd7f32","Silver":"#c0c0c0","Gold":"#ffd700",
  "Platinum":"#40e0d0","Diamond":"#b9f2ff","Champion":"#dda0dd",
  "Grand Champion":"#ff6b6b","Supersonic":"#ff4500",
};
const getRankColor = (rank) => {
  if (!rank) return "#6b7084";
  for (const [key, color] of Object.entries(RANK_COLORS)) {
    if (rank.startsWith(key)) return color;
  }
  return "#6b7084";
};

const PLAYLISTS = ["1v1","2v2","3v3"];

const DELIVERY_TIMES = [
  { value: "Instant", label: "Instant" },
  { value: "Minute5", label: "5 Minutes" },
  { value: "Minute20", label: "20 Minutes" },
  { value: "Hour1", label: "1 Hour" },
  { value: "Hour2", label: "2 Hours" },
  { value: "Hour3", label: "3 Hours" },
  { value: "Hour5", label: "5 Hours" },
  { value: "Hour8", label: "8 Hours" },
  { value: "Hour12", label: "12 Hours" },
  { value: "Day1", label: "1 Day" },
  { value: "Day2", label: "2 Days" },
  { value: "Day3", label: "3 Days" },
  { value: "Day7", label: "7 Days" },
  { value: "Day14", label: "14 Days" },
  { value: "Day28", label: "28 Days" },
];

const RANK_TIERS = [
  { id: "bronze", label: "Bronze", ranks: ["Bronze I","Bronze II","Bronze III"] },
  { id: "silver", label: "Silver", ranks: ["Silver I","Silver II","Silver III"] },
  { id: "gold", label: "Gold", ranks: ["Gold I","Gold II","Gold III"] },
  { id: "platinum", label: "Platinum", ranks: ["Platinum I","Platinum II","Platinum III"] },
  { id: "diamond", label: "Diamond", ranks: ["Diamond I","Diamond II","Diamond III"] },
  { id: "champion", label: "Champion", ranks: ["Champion I","Champion II","Champion III"] },
  { id: "grandchamp", label: "Grand Champion", ranks: ["Grand Champion I","Grand Champion II","Grand Champion III"] },
  { id: "ssl", label: "SSL", ranks: ["Supersonic Legend"] },
];

const DEFAULT_SOLO_MSG = `Yo, I'm currently top 10 in the world and I offer solo queue boosting. I use settings that have never gotten anyone banned & has almost no risk of getting you banned. Just being transparent, I do use a bot, but when I solo queue with it I take a lot of precautions (fatigue, reaction delay, full humanization, human-like cam, randomization, etc.). It's a really high-end/private bot, not some cheap public one.`;

const DEFAULT_DUO_MSG = `Yo, I'm currently top 10 in the world and I offer duo queue boosting. I'll just queue with you on my main and hard carry, so nothing ever touches your account. When duo queueing there is no risk as epic does not care/punish if you team up with bots.`;

const DEFAULT_SETTINGS = {
  authToken: "",
  eldoradoEmail: "",
  eldoradoPassword: "",
  discordWebhook: "",
  // Auto-offer per boostingCategoryId (since seller "received" DTO has no rank details)
  boostingCategoryPrices: {},
  defaultBoostOfferPrice: "",
  minAutoOfferPrice: "",
  talkjsAppId: "49mLECOW",
  talkjsAuthorization: "",
  talkjsSessionId: "",
  talkjsNymId: "",
  talkjsDebug: false,
  soloMessage: DEFAULT_SOLO_MSG,
  duoMessage: DEFAULT_DUO_MSG,
  autoOffer: true,
  autoMessage: true,
  notificationsEnabled: true,
  pollInterval: 30,
  deliveryTime: "Hour12",
  currency: "USD",
  offerOnSolo: true,
  offerOnDuo: true,
  playlists: { "1v1": true, "2v2": true, "3v3": true },
  disabledRanks: {},
};
const DEFAULT_PRICES = {};
const DEFAULT_STATS = { totalOrders: 0, totalRevenue: 0, totalProfit: 0, offersPlaced: 0, ordersAccepted: 0, messagesSent: 0 };

const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£" };

// ─── UTILS ───

function loadData(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveData(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error(e); }
}

async function sendDiscord(webhookUrl, title, description, fields, color = 0x00d4aa) {
  if (!webhookUrl) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title, description,
          fields: fields || [],
          color,
          timestamp: new Date().toISOString(),
          footer: { text: "Eldorado RL Manager" },
        }],
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Discord webhook error:", e);
    return false;
  }
}

function formatCurrency(amount, currency = "USD") {
  return `${CURRENCY_SYMBOLS[currency] || "$"}${Number(amount).toFixed(2)}`;
}

function exportToCSV(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── ELDORADO API ───
// Auth: AWS Cognito → __Host-EldoradoIdToken cookie
// All requests need "swagger" header. See: eldorado.gg/seller-api
// NOTE: Browser CORS blocks direct calls to eldorado.gg. For local dev,
// route through a proxy (e.g. local Express/CORS proxy). In production,
// run the API layer server-side or as an Electron app.

async function eldoradoFetch(endpoint, token, options = {}) {
  // Browser-safe: call our local proxy which injects Cookie + swagger header server-side.
  const url = `/eldorado${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "swagger": "Swager request",
        ...(token ? { "x-eldorado-id-token": token } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("json") ? await res.json() : null;
  } catch (e) {
    console.error(`Eldorado API error [${endpoint}]:`, e);
    throw e;
  }
}

// Fetch incoming boosting requests (cursor-paginated)
async function fetchBoostRequests(token, filter = "ActiveRequests", pageSize = 50, cursor = null) {
  let qs = `?filter=${filter}&pageSize=${pageSize}`;
  if (cursor) qs += `&cursorValue=${encodeURIComponent(cursor)}&pageDirection=Next`;
  return eldoradoFetch(`/api/boostingOffers/me/boostingRequests/received${qs}`, token);
}

async function fetchBoostingRequestDetails(token, boostingRequestId) {
  return eldoradoFetch(`/api/boostingOffers/boostingRequests/${boostingRequestId}`, token);
}

async function talkJsSay({ appId, conversationId, sessionId, authorization, nymId, text, idempotencyKey }) {
  const url = `/talkjs/api/v0/${encodeURIComponent(appId)}/say/${encodeURIComponent(conversationId)}/?sessionId=${encodeURIComponent(sessionId)}`;
  const body = {
    idempotencyKey,
    entityTree: [text],
    received: false,
    custom: {},
    nymId,
    attachment: null,
    location: null,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-talkjs-authorization": authorization,
      "x-talkjs-client-build": "eldorado-manager",
      "x-talkjs-client-date": new Date().toISOString(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TalkJS ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function talkJsInitChatbox({
  appId,
  nymId,
  syncPlease,
  authToken,
  sessionId,
  userId,
}) {
  const chatboxId = `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 20);
  const url =
    `/talkjs/app/${encodeURIComponent(appId)}` +
    `/user/${encodeURIComponent(nymId)}` +
    `/chatbox/${encodeURIComponent(chatboxId)}` +
    `?syncPlease=${encodeURIComponent(syncPlease)}` +
    `&localSettings=` +
    `&authToken=${encodeURIComponent(authToken)}` +
    `&clientHeight=800` +
    `&sessionId=${encodeURIComponent(sessionId)}` +
    `&thirdparties=` +
    `&id=${encodeURIComponent(userId || "")}`;

  const res = await fetch(url, { method: "GET", headers: { "Accept": "text/html,*/*" } });
  const html = await res.text();
  if (!res.ok) throw new Error(`TalkJS init ${res.status}: ${html}`);
  return html;
}

function extractTalkJsInternalConversationIdFromHtml(html) {
  if (!html) return null;
  // Common patterns: .../say/<20hex>/ or JSON bootstrap containing conversationId
  const m1 = html.match(/\/say\/([0-9a-f]{20})\//i);
  if (m1) return m1[1];
  const m2 = html.match(/"conversationId"\s*:\s*"([0-9a-f]{20})"/i);
  if (m2) return m2[1];
  // Fallback: pick a unique 20-hex token if present (TalkJS often embeds it in inline JS)
  const all = [...html.matchAll(/\b([0-9a-f]{20})\b/ig)].map(m => m[1]);
  const uniq = [...new Set(all)];
  if (uniq.length === 1) return uniq[0];
  return null;
}

function base64EncodeUtf8(jsonString) {
  // Browser-safe base64 for UTF-8
  return btoa(unescape(encodeURIComponent(jsonString)));
}

function buildTalkJsSyncPlease({ sellerUserId, nymId, externalConversationId }) {
  const payload = {
    me: {
      __sync: false,
      id: sellerUserId,
      internalId: nymId,
    },
    externalConversationId,
  };
  return base64EncodeUtf8(JSON.stringify(payload));
}

async function talkJsSayWithRetry(args, { retryOnConversationNotFound = true, maxAttempts = 3 } = {}) {
  try {
    return await talkJsSay(args);
  } catch (e) {
    const msg = String(e?.message || "");
    if (retryOnConversationNotFound && msg.includes("conversation_not_found")) {
      // TalkJS can return conversation_not_found if the conversation hasn't been initialized yet.
      // Retry a few times with backoff.
      let lastErr = e;
      for (let attempt = 2; attempt <= maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 400 * attempt));
        try {
          return await talkJsSay(args);
        } catch (e2) {
          lastErr = e2;
          const msg2 = String(e2?.message || "");
          if (!msg2.includes("conversation_not_found")) break;
        }
      }
      throw lastErr;
    }
    throw e;
  }
}

async function talkJsSendAutoMessage({
  settings,
  boostingRequestId,
  preferredConversationId,
  text,
  sellerUserId,
}) {
  const tried = [];
  const authTokenOnly = String(settings.talkjsAuthorization || "").replace(/^bearer\s+/i, "");
  const baseArgs = {
    appId: settings.talkjsAppId,
    sessionId: settings.talkjsSessionId,
    authorization: settings.talkjsAuthorization,
    nymId: settings.talkjsNymId,
    text,
    idempotencyKey: `eld-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };

  // Initialize TalkJS mapping for this external conversation id.
  let internalConversationId = null;
  if (sellerUserId && preferredConversationId && authTokenOnly) {
    try {
      const syncPlease = buildTalkJsSyncPlease({
        sellerUserId,
        nymId: settings.talkjsNymId,
        externalConversationId: preferredConversationId,
      });
      const html = await talkJsInitChatbox({
        appId: settings.talkjsAppId,
        nymId: settings.talkjsNymId,
        syncPlease,
        authToken: authTokenOnly,
        sessionId: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
        userId: sellerUserId,
      });
      internalConversationId = extractTalkJsInternalConversationIdFromHtml(html);
      if (settings.talkjsDebug) {
        console.log("[TalkJS] init htmlLen=", html?.length || 0, "internalConversationId=", internalConversationId);
      }
    } catch (e) {
      if (settings.talkjsDebug) console.warn("[TalkJS] init failed:", e);
      /* best effort */
    }
  }

  // 1) Try the conversation id we were given (usually from Eldorado)
  if (internalConversationId) {
    tried.push(internalConversationId);
    return await talkJsSayWithRetry({ ...baseArgs, conversationId: internalConversationId });
  }

  if (preferredConversationId) {
    try {
      tried.push(preferredConversationId);
      return await talkJsSayWithRetry({ ...baseArgs, conversationId: preferredConversationId });
    } catch (e) {
      const msg = String(e?.message || "");
      // 2) Fallback: Eldorado's boostingRequest details sometimes expose a different TalkJS conversation id
      // (the one that the TalkJS UI uses in /say/:conversationId).
      if (msg.includes("conversation_not_found")) {
        const full = await fetchBoostingRequestDetails(settings.authToken, boostingRequestId);
        const altId =
          full?.sellerDetails?.talkJsConversationId ||
          full?.talkJsConversationId ||
          null;
        if (altId && altId !== preferredConversationId) {
          tried.push(altId);
          return await talkJsSayWithRetry({ ...baseArgs, conversationId: altId });
        }
      }
      throw new Error(`TalkJS say failed (tried: ${tried.join(", ")}): ${e.message}`);
    }
  }

  // 3) Last resort: try to discover id from request details
  const full = await fetchBoostingRequestDetails(settings.authToken, boostingRequestId);
  const discovered =
    full?.sellerDetails?.talkJsConversationId ||
    full?.talkJsConversationId ||
    null;
  if (!discovered) throw new Error("No TalkJS conversation id (preferred or discovered)");
  tried.push(discovered);
  return await talkJsSayWithRetry({ ...baseArgs, conversationId: discovered });
}

function getDescriptionValue(details, label) {
  const arr = details?.descriptionValues;
  if (!Array.isArray(arr)) return null;
  const found = arr.find(v => String(v?.label || "").trim().toLowerCase() === String(label).trim().toLowerCase());
  return found?.value ?? null;
}

function parseBoostingRequestDetails(detailResp) {
  const d = detailResp?.boostingRequestDetails;
  const fromRank = getDescriptionValue(d, "Current Rank");
  const toRank = getDescriptionValue(d, "Desired Rank");
  const queueType = getDescriptionValue(d, "Queue type"); // e.g. "Doubles (2v2)"
  const completionMethod = getDescriptionValue(d, "Completion Method"); // e.g. "Solo"

  let playlist = null;
  if (typeof queueType === "string") {
    const q = queueType.toLowerCase();
    if (q.includes("1v1")) playlist = "1v1";
    else if (q.includes("2v2")) playlist = "2v2";
    else if (q.includes("3v3")) playlist = "3v3";
    else if (q.includes("hoops")) playlist = "hoops";
  }

  let type = null;
  if (typeof completionMethod === "string") {
    const cm = completionMethod.toLowerCase();
    if (cm.includes("solo")) type = "Solo Queue";
    else if (cm.includes("duo")) type = "Duo Queue";
  }

  return { fromRank, toRank, playlist, type, queueType, completionMethod };
}

// Place a boosting offer on a request
async function placeOffer(token, boostingRequestId, priceAmount, currency, deliveryTime) {
  return eldoradoFetch("/api/boostingOffers", token, {
    method: "POST",
    body: JSON.stringify({
      details: {
        boostingRequestId,
        guaranteedDeliveryTime: deliveryTime,
        pricing: {
          quantity: 1,
          minQuantity: 1,
          pricePerUnit: { amount: priceAmount, currency },
        },
      },
    }),
  });
}

// Update an existing boosting offer
async function updateOffer(token, offerId, boostingRequestId, priceAmount, currency, deliveryTime) {
  return eldoradoFetch(`/api/boostingOffers/${offerId}/update`, token, {
    method: "PUT",
    body: JSON.stringify({
      boostingRequestId,
      guaranteedDeliveryTime: deliveryTime,
      pricing: {
        quantity: 1,
        minQuantity: 1,
        pricePerUnit: { amount: priceAmount, currency },
      },
    }),
  });
}

// Delete a boosting offer
async function deleteOffer(token, offerId) {
  return eldoradoFetch(`/api/boostingOffers/${offerId}/delete`, token, { method: "DELETE" });
}

// Create a TalkJS conversation for messaging a buyer
async function createConversation(token, boostingRequestId) {
  return eldoradoFetch(
    `/api/boostingOffers/boostingRequests/${boostingRequestId}/createConversationForSeller`,
    token,
    { method: "POST" },
  );
}

// Mark a boosting request as viewed
async function markRequestViewed(token, boostingRequestId) {
  return eldoradoFetch(
    `/api/boostingOffers/boostingRequests/${boostingRequestId}/viewer`,
    token,
    { method: "PUT" },
  );
}

// Subscribe to a boosting category for notifications
async function subscribeToBoosting(token, gameId, boostingCategoryId) {
  return eldoradoFetch("/api/boostingOffers/me/boostingSubscription/create", token, {
    method: "POST",
    body: JSON.stringify({ boostingId: { gameId, boostingCategoryId } }),
  });
}

// Get active subscriptions
async function getSubscriptions(token) {
  return eldoradoFetch("/api/boostingOffers/me/boostingSubscriptions", token);
}

// Get seller orders (cursor-paginated)
async function getOrders(token, pageSize = 50, cursor = null) {
  // Try to avoid server-side defaults that may hide orders.
  // (swagger.json shows many optional filters; leaving most blank should return all.)
  let qs = `?pageSize=${pageSize}&ignorePendingReviewOrders=false&displayFilter=DisplaySellingOrders&orderGroup=Regular`;
  if (cursor) qs += `&cursorValue=${encodeURIComponent(cursor)}&pageDirection=Next`;
  return eldoradoFetch(`/api/orders/me/seller/orders${qs}`, token);
}

function normalizeOrder(raw) {
  const created =
    raw?.createdDate ||
    raw?.state?.createdDate ||
    raw?.deliveryStartedDate ||
    (Array.isArray(raw?.stateLogs) ? raw.stateLogs[0]?.createdDate : null) ||
    null;

  const stateStr = raw?.state?.state || raw?.state || raw?.orderState || raw?.status || "";
  const status = String(stateStr || "").toLowerCase();

  const revenue =
    (typeof raw?.totalPriceInUsersCurrency?.amount === "number" ? raw.totalPriceInUsersCurrency.amount : null) ??
    (typeof raw?.totalPrice?.amount === "number" ? raw.totalPrice.amount : null) ??
    0;

  return {
    id: raw?.id ?? raw?.orderId,
    date: created,
    revenue,
    status: status === "completed" ? "completed" : status || "completed",
    deliveryTime: raw?.deliveryTime ?? null,
    // Best-effort pass-throughs (may be undefined for non-boosting orders)
    playlist:
      raw?.orderOfferDetails?.offerTitle ||
      raw?.orderOfferDetails?.gameCategoryTitle ||
      raw?.orderOfferDetails?.gameId ||
      raw?.orderOfferDetails?.category ||
      "",
    fromRank: raw?.fromRank ?? raw?.userRequestDetails?.fromRank,
    toRank: raw?.toRank ?? raw?.userRequestDetails?.toRank,
    type: raw?.type ?? raw?.userRequestDetails?.type,
    _raw: raw,
  };
}

// Mark order as delivered
async function deliverOrder(token, orderId) {
  return eldoradoFetch(`/api/orders/me/${orderId}/deliver`, token, { method: "PUT" });
}

// Cancel order with reason
async function cancelOrder(token, orderId, reason) {
  return eldoradoFetch(`/api/orders/me/${orderId}/cancel`, token, {
    method: "POST",
    body: JSON.stringify(reason),
  });
}

// Get unread notification count
async function getUnreadNotifications(token) {
  return eldoradoFetch("/api/notifications/me/unreadCount", token);
}

// Go online/offline
async function switchOnline(token) {
  return eldoradoFetch("/api/offerUser/me/switchOnline", token, { method: "PUT" });
}
async function switchOffline(token) {
  return eldoradoFetch("/api/offerUser/me/switchOffline", token, { method: "PUT" });
}

// Check seller API eligibility
async function checkEligibility(token) {
  return eldoradoFetch("/api/orders/me/sellerApiEligibility", token);
}

// ─── ICONS ───

const Icon = ({ type, size = 18, style: s }) => {
  const props = { width: size, height: size, strokeWidth: 1.7, fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" {...props}/><rect x="14" y="3" width="7" height="7" rx="1.5" {...props}/><rect x="3" y="14" width="7" height="7" rx="1.5" {...props}/><rect x="14" y="14" width="7" height="7" rx="1.5" {...props}/></>,
    prices: <><line x1="12" y1="1" x2="12" y2="23" {...props}/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" {...props}/></>,
    monitor: <><circle cx="11" cy="11" r="8" {...props}/><line x1="21" y1="21" x2="16.65" y2="16.65" {...props}/></>,
    messages: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...props}/></>,
    settings: <><circle cx="12" cy="12" r="3" {...props}/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" {...props}/></>,
    logs: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" {...props}/></>,
    analytics: <><path d="M18 20V10M12 20V4M6 20v-6" {...props}/></>,
    history: <><circle cx="12" cy="12" r="10" {...props}/><polyline points="12 6 12 12 16 14" {...props}/></>,
    check: <><polyline points="20 6 9 17 4 12" {...props}/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" {...props}/><line x1="6" y1="6" x2="18" y2="18" {...props}/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...props}/><path d="M13.73 21a2 2 0 0 1-3.46 0" {...props}/></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" {...props}/><polyline points="17 21 17 13 7 13 7 21" {...props}/><polyline points="7 3 7 8 15 8" {...props}/></>,
    play: <><polygon points="5 3 19 12 5 21 5 3" {...props}/></>,
    pause: <><rect x="6" y="4" width="4" height="16" {...props}/><rect x="14" y="4" width="4" height="16" {...props}/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...props}/></>,
    trash: <><polyline points="3 6 5 6 21 6" {...props}/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...props}/></>,
    refresh: <><polyline points="23 4 23 10 17 10" {...props}/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" {...props}/></>,
    discord: <><path d="M9.5 14.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm5 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z" {...props}/><path d="M5.5 16s1.5 2 6.5 2 6.5-2 6.5-2" {...props}/><path d="M18.5 8s-1.5-2-6.5-2-6.5 2-6.5 2" {...props}/></>,
    inbox: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" {...props}/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" {...props}/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13" {...props}/><polygon points="22 2 15 22 11 13 2 9 22 2" {...props}/></>,
    clock: <><circle cx="12" cy="12" r="10" {...props}/><polyline points="12 6 12 12 16 14" {...props}/></>,
    target: <><circle cx="12" cy="12" r="10" {...props}/><circle cx="12" cy="12" r="6" {...props}/><circle cx="12" cy="12" r="2" {...props}/></>,
    search: <><circle cx="11" cy="11" r="8" {...props}/><line x1="21" y1="21" x2="16.65" y2="16.65" {...props}/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...props}/><polyline points="7 10 12 15 17 10" {...props}/><line x1="12" y1="15" x2="12" y2="3" {...props}/></>,
    arrowUp: <><line x1="12" y1="19" x2="12" y2="5" {...props}/><polyline points="5 12 12 5 19 12" {...props}/></>,
    arrowDown: <><line x1="12" y1="5" x2="12" y2="19" {...props}/><polyline points="19 12 12 19 5 12" {...props}/></>,
    trendUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" {...props}/><polyline points="17 6 23 6 23 12" {...props}/></>,
    trendDown: <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" {...props}/><polyline points="17 18 23 18 23 12" {...props}/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" {...props}/></>,
    command: <><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" {...props}/></>,
    globe: <><circle cx="12" cy="12" r="10" {...props}/><line x1="2" y1="12" x2="22" y2="12" {...props}/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {...props}/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...props}/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" {...props}/><circle cx="12" cy="12" r="3" {...props}/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" {...props}/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...props}/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" {...props}/></>,
    award: <><circle cx="12" cy="8" r="7" {...props}/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" {...props}/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...props}/><circle cx="9" cy="7" r="4" {...props}/><path d="M23 21v-2a4 4 0 0 0-3-3.87" {...props}/><path d="M16 3.13a4 4 0 0 1 0 7.75" {...props}/></>,
    chevDown: <><polyline points="6 9 12 15 18 9" {...props}/></>,
    chevRight: <><polyline points="9 18 15 12 9 6" {...props}/></>,
    minus: <><line x1="5" y1="12" x2="19" y2="12" {...props}/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" {...props}/><line x1="5" y1="12" x2="19" y2="12" {...props}/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" {...props}/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {...props}/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" {...props}/></>,
    terminal: <><polyline points="4 17 10 11 4 5" {...props}/><line x1="12" y1="19" x2="20" y2="19" {...props}/></>,
  };
  return <svg viewBox="0 0 24 24" style={{ width: size, height: size, minWidth: size, display: "block", ...s }}>{icons[type] || null}</svg>;
};

// ─── UI COMPONENTS ───

const GlassCard = ({ children, title, sub, action, glow, style: s, className, animate = true }) => (
  <div style={{
    background: glow
      ? "linear-gradient(135deg, rgba(0,212,170,.08) 0%, rgba(255,255,255,.04) 50%, rgba(0,212,170,.04) 100%)"
      : "linear-gradient(145deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.03) 50%, rgba(255,255,255,.04) 100%)",
    backdropFilter: `blur(${glow ? "44px" : "var(--glass-blur)"})`,
    WebkitBackdropFilter: `blur(${glow ? "44px" : "var(--glass-blur)"})`,
    border: `1px solid ${glow ? "rgba(0,212,170,.22)" : "rgba(255,255,255,.13)"}`,
    borderRadius: "var(--radius-lg)",
    padding: "22px 24px",
    position: "relative",
    overflow: "hidden",
    transition: "all .3s var(--ease-out)",
    boxShadow: glow
      ? "0 8px 32px rgba(0,0,0,.3), 0 0 24px rgba(0,212,170,.08), inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 .5px rgba(255,255,255,.05)"
      : "0 8px 32px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 .5px rgba(255,255,255,.05)",
    animation: animate ? "fadeInUp .4s var(--ease-out) both" : "none",
    ...s,
  }}>
    {/* Top edge highlight — iOS glass refraction */}
    <div style={{ position: "absolute", top: 0, left: "5%", right: "5%", height: 1, background: glow ? "linear-gradient(90deg, transparent, rgba(0,212,170,.6), transparent)" : "linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent)", pointerEvents: "none" }}/>
    {(title || action) && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: sub ? 4 : 16 }}>
        {title && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-.2px" }}>{title}</h3>}
        {action}
      </div>
    )}
    {sub && <p style={{ color: "var(--text-faint)", fontSize: 12, margin: "0 0 16px", lineHeight: 1.5 }}>{sub}</p>}
    {children}
  </div>
);

const AnimatedNumber = ({ value, prefix = "", suffix = "", color }) => {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const target = typeof value === "number" ? value : parseFloat(value) || 0;
    const start = prevRef.current;
    const diff = target - start;
    if (diff === 0) return;
    const duration = 600;
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(step);
      else prevRef.current = target;
    };
    requestAnimationFrame(step);
  }, [value]);
  const formatted = Number.isInteger(value) ? Math.round(display) : display.toFixed(2);
  return <span style={{ color: color || "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 700, animation: "countUp .4s var(--ease-out)" }}>{prefix}{formatted}{suffix}</span>;
};

const StatCard = ({ label, value, icon, accent, prefix = "", suffix = "" }) => {
  const numVal = typeof value === "string" ? parseFloat(value) || 0 : value;
  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.03) 50%, rgba(255,255,255,.04) 100%)",
      backdropFilter: "blur(var(--glass-blur))",
      WebkitBackdropFilter: "blur(var(--glass-blur))",
      border: "1px solid rgba(255,255,255,.13)",
      borderRadius: "var(--radius-lg)",
      padding: "18px 20px",
      display: "flex", alignItems: "flex-start", gap: 14,
      position: "relative", overflow: "hidden",
      transition: "all .3s var(--ease-out)",
      boxShadow: "0 8px 32px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 .5px rgba(255,255,255,.05)",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}30`; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,.3), 0 0 24px ${accent}15, inset 0 1px 0 rgba(255,255,255,.14)`; e.currentTarget.style.transform = "translateY(-2px)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.11)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 .5px rgba(255,255,255,.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Top shimmer highlight */}
      <div style={{ position: "absolute", top: 0, left: "5%", right: "5%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent)", pointerEvents: "none" }}/>
      <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(circle at top right, ${accent}14, transparent)`, pointerEvents: "none" }}/>
      <div style={{
        width: 42, height: 42, borderRadius: "var(--radius-md)",
        background: `${accent}12`,
        backdropFilter: "blur(8px)",
        border: `1px solid ${accent}20`,
        display: "flex", alignItems: "center", justifyContent: "center", color: accent,
        flexShrink: 0,
      }}>
        <Icon type={icon} size={20}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.5px", lineHeight: 1.1 }}>
          <AnimatedNumber value={numVal} prefix={prefix} suffix={suffix} color="var(--text-primary)"/>
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ value, onChange, label, sub }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
    <div>
      <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{label}</span>
      {sub && <div style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
    <div onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12, cursor: "pointer", transition: "all .25s var(--ease-out)",
      background: value ? "var(--accent)" : "var(--bg-hover)",
      border: `1px solid ${value ? "var(--accent)" : "var(--border-strong)"}`,
      display: "flex", alignItems: "center", padding: 2,
      boxShadow: value ? "0 0 12px var(--accent-glow)" : "none",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 9, transition: "all .25s var(--ease-spring)",
        background: value ? "#fff" : "var(--text-muted)",
        transform: value ? "translateX(20px)" : "translateX(0)",
        boxShadow: "0 1px 3px rgba(0,0,0,.3)",
      }}/>
    </div>
  </div>
);

const Input = ({ label, value, onChange, type = "text", placeholder, rows, mono, disabled, icon }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, letterSpacing: ".6px", textTransform: "uppercase" }}>{label}</label>}
    <div style={{ position: "relative" }}>
      {icon && <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }}><Icon type={icon} size={16}/></div>}
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled} style={{
          width: "100%", padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
          color: "var(--text-primary)", fontSize: 14, fontFamily: mono ? "var(--font-mono)" : "inherit", resize: "vertical", outline: "none", boxSizing: "border-box",
          opacity: disabled ? 0.5 : 1, transition: "border-color .2s, box-shadow .2s",
        }}/>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{
          width: "100%", padding: icon ? "10px 14px 10px 38px" : "10px 14px", background: "var(--bg-input)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
          color: "var(--text-primary)", fontSize: mono ? 13 : 14, fontFamily: mono ? "var(--font-mono)" : "inherit", outline: "none", boxSizing: "border-box",
          opacity: disabled ? 0.5 : 1, transition: "border-color .2s, box-shadow .2s",
        }}/>
      )}
    </div>
  </div>
);

const Button = ({ children, onClick, variant = "primary", icon, small, disabled, style: s }) => {
  const styles = {
    primary: { background: "linear-gradient(135deg, #00d4aa, #00b894)", color: "#0a0b0e", border: "none", boxShadow: "0 2px 12px rgba(0,212,170,.25)" },
    secondary: { background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" },
    danger: { background: "var(--red-subtle)", color: "var(--red)", border: "1px solid rgba(248,113,113,.15)" },
    ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-default)" },
    active: { background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border-accent)" },
    glow: { background: "linear-gradient(135deg, #00d4aa, #00b894)", color: "#0a0b0e", border: "none", boxShadow: "0 4px 20px rgba(0,212,170,.35), 0 0 40px rgba(0,212,170,.15)" },
  };
  return (
    <button disabled={disabled} onClick={onClick} style={{
      ...styles[variant], padding: small ? "6px 12px" : "10px 20px", borderRadius: "var(--radius-md)", cursor: disabled ? "not-allowed" : "pointer",
      fontSize: small ? 12 : 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7,
      opacity: disabled ? 0.5 : 1, transition: "all .2s var(--ease-out)", letterSpacing: ".3px", whiteSpace: "nowrap",
      ...s,
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.1)"; } }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "brightness(1)"; }}
    >
      {icon && <Icon type={icon} size={small ? 13 : 15}/>}{children}
    </button>
  );
};

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, letterSpacing: ".6px", textTransform: "uppercase" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      width: "100%", padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
      color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit", outline: "none", appearance: "none", cursor: "pointer",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7084' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
      transition: "border-color .2s",
    }}>
      {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
    </select>
  </div>
);

const Badge = ({ children, color, variant = "default" }) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: "var(--radius-full)", letterSpacing: ".3px",
    color, background: `${color}15`, border: `1px solid ${color}20`,
  }}>{children}</span>
);

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  const colors = { success: "var(--accent)", error: "var(--red)", info: "var(--blue)" };
  const bg = { success: "rgba(0,212,170,.12)", error: "var(--red-subtle)", info: "var(--blue-subtle)" };
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, padding: "14px 22px", borderRadius: "var(--radius-lg)",
      background: bg[type] || "var(--bg-elevated)", backdropFilter: "blur(20px)",
      border: `1px solid ${colors[type] || "var(--border-default)"}40`,
      color: colors[type] || "var(--text-primary)", fontSize: 13, fontWeight: 500, zIndex: 10000,
      display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-xl)",
      animation: "slideToast .35s var(--ease-spring)",
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center",
        background: `${colors[type] || "var(--text-muted)"}20`,
      }}>
        <Icon type={type === "success" ? "check" : type === "error" ? "x" : "bell"} size={14}/>
      </div>
      {message}
    </div>
  );
};

const EmptyState = ({ icon, title, sub }) => (
  <div style={{ textAlign: "center", padding: "48px 20px" }}>
    <div style={{ color: "var(--text-disabled)", marginBottom: 12 }}><Icon type={icon} size={48}/></div>
    <p style={{ color: "var(--text-faint)", fontSize: 14, margin: 0, fontWeight: 500 }}>{title}</p>
    {sub && <p style={{ color: "var(--text-disabled)", fontSize: 12, margin: "6px 0 0" }}>{sub}</p>}
  </div>
);

// Mini sparkline chart component
const Sparkline = ({ data, color = "var(--accent)", width = 100, height = 32 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi,"")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi,"")})`}/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// ─── COMMAND PALETTE ───

const CommandPalette = ({ open, onClose, onNavigate, pages }) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef();
  useEffect(() => { if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  const commands = useMemo(() => {
    const nav = pages.map(p => ({ id: `nav-${p.id}`, label: p.label, sub: `Go to ${p.label}`, icon: p.icon, action: () => { onNavigate(p.id); onClose(); } }));
    const actions = [
      { id: "export-logs", label: "Export Logs", sub: "Download logs as CSV", icon: "download", action: () => { onNavigate("logs"); onClose(); } },
      { id: "export-prices", label: "Export Prices", sub: "Download pricing as CSV", icon: "download", action: () => { onNavigate("prices"); onClose(); } },
    ];
    return [...nav, ...actions];
  }, [pages]);

  const filtered = query ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.sub.toLowerCase().includes(query.toLowerCase())) : commands;

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)", zIndex: 9998, animation: "fadeIn .15s ease" }}/>
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 520, maxWidth: "90vw",
        background: "var(--bg-card)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-xl)", zIndex: 9999, overflow: "hidden", animation: "scaleIn .2s var(--ease-spring)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
          <Icon type="search" size={18} style={{ color: "var(--text-muted)" }}/>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a command or search..."
            style={{ flex: 1, background: "none", border: "none", color: "var(--text-primary)", fontSize: 15, outline: "none" }}
            onKeyDown={e => { if (e.key === "Escape") onClose(); if (e.key === "Enter" && filtered[0]) filtered[0].action(); }}
          />
          <kbd style={{ fontSize: 10, color: "var(--text-faint)", background: "var(--bg-hover)", padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border-default)" }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", padding: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No results found</div>
          ) : filtered.map(c => (
            <div key={c.id} onClick={c.action} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: "var(--radius-md)", cursor: "pointer",
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                <Icon type={c.icon} size={16}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{c.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ─── PAGES ───

const DashboardPage = ({ stats, settings, logs, monitorActive, currency, orders }) => {
  const cs = CURRENCY_SYMBOLS[currency] || "$";
  const recentOrders = (orders || []).slice(-7);
  const revenueData = recentOrders.map(o => o.revenue || 0);
  const ordersData = recentOrders.map(() => 1);
  // build sparkline from stats history
  const fakeSparkline = [3, 5, 4, 7, 6, 8, stats.offersPlaced || 2];
  const revSparkline = [20, 35, 28, 45, 38, 55, stats.totalRevenue || 10];

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Offers Placed" value={stats.offersPlaced} icon="send" accent="#00d4aa"/>
        <StatCard label="Orders Won" value={stats.ordersAccepted} icon="award" accent="var(--purple)"/>
        <StatCard label="Messages Sent" value={stats.messagesSent} icon="messages" accent="var(--blue)"/>
        <StatCard label="Revenue" value={stats.totalRevenue} icon="prices" accent="var(--amber)" prefix={cs}/>
        <StatCard label="Profit" value={stats.totalProfit} icon="zap" accent="var(--green)" prefix={cs}/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Bot Status */}
        <GlassCard title="Bot Status" glow={monitorActive}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", marginBottom: 16,
            background: monitorActive ? "var(--accent-subtle)" : "var(--red-subtle)",
            border: `1px solid ${monitorActive ? "rgba(0,212,170,.12)" : "rgba(248,113,113,.12)"}`,
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: 5,
              background: monitorActive ? "var(--accent)" : "var(--red)",
              boxShadow: monitorActive ? "0 0 12px var(--accent-glow)" : "none",
              animation: monitorActive ? "pulse 2s infinite" : "none",
            }}/>
            <span style={{ fontSize: 14, fontWeight: 600, color: monitorActive ? "var(--accent)" : "var(--red)" }}>
              {monitorActive ? "Scanning for new requests" : "Monitor stopped"}
            </span>
          </div>
          {[
            ["Auto Offer", settings.autoOffer],
            ["Auto Message", settings.autoMessage],
            ["Discord Alerts", settings.notificationsEnabled && !!settings.discordWebhook],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{l}</span>
              <Badge color={v ? "var(--accent)" : "var(--red)"}>{v ? "Active" : "Off"}</Badge>
            </div>
          ))}
        </GlassCard>

        {/* Recent Activity */}
        <GlassCard title="Recent Activity" action={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkline data={fakeSparkline} color="var(--accent)" width={64} height={24}/>
          </div>
        }>
          {logs.length === 0 ? (
            <EmptyState icon="activity" title="No activity yet" sub="Start the monitor to begin tracking"/>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
              {[...logs].reverse().slice(0, 15).map((l, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12,
                  animation: `fadeIn .3s ease ${i * .03}s both`,
                }}>
                  <span style={{ color: "var(--text-disabled)", fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 65 }}>{l.time}</span>
                  <span style={{
                    color: l.type === "offer" ? "var(--accent)" : l.type === "order" ? "var(--purple)" : l.type === "message" ? "var(--blue)" : l.type === "error" ? "var(--red)" : "var(--text-muted)"
                  }}>{l.message}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

    </div>
  );
};

const MonitorPage = ({ settings, setSettings, prices, logs, addLog, stats, setStats, showToast, monitorActive, setMonitorActive }) => {
  const [feed, setFeed] = useState([]);
  const [pollError, setPollError] = useState(null);
  const pollRef = useRef(null);
  const seenRef = useRef(new Set());
  const cutoffRef = useRef(null); // ignore requests created before this time
  const detailCacheRef = useRef(new Map()); // boostingRequestId -> parsed details
  const pollInFlightRef = useRef(false);
  const monitorActiveRef = useRef(false);

  useEffect(() => {
    monitorActiveRef.current = monitorActive;
  }, [monitorActive]);

  const isRankEnabled = useCallback((rank) => {
    const tier = RANK_TIERS.find(t => t.ranks.includes(rank));
    return tier ? settings.disabledRanks?.[tier.id] !== true : true;
  }, [settings.disabledRanks]);

  const calculatePrice = useCallback((fromRank, toRank, type) => {
    const fi = RANKS.indexOf(fromRank);
    const ti = RANKS.indexOf(toRank);
    if (fi < 0 || ti < 0 || ti <= fi) return null;
    let total = 0;
    for (let i = fi; i < ti; i++) {
      const p = prices[`${RANKS[i]}|${RANKS[i + 1]}`];
      if (!p) return null;
      total += parseFloat(p);
    }
    if (type === "Duo Queue") total *= 1.3;
    return Math.round(total * 100) / 100;
  }, [prices]);

  const processRequest = useCallback(async (req) => {
    // NOTE: swagger.json BoostingRequestListItemSellerDTO does NOT include ranks/playlist/type.
    // We treat these as "custom" items and display best-effort labels.
    const { id, boostingCategoryId, boostingCategoryTitle, gameId, createdDate, buyerUsername } = req || {};
    const time = new Date().toLocaleTimeString();

    // Check if we already processed this request
    if (seenRef.current.has(id)) return;
    seenRef.current.add(id);

    const displayName = boostingCategoryTitle || `Boosting request ${String(id || "").slice(0, 8)}`;
    const subtitle = buyerUsername ? `Buyer: ${buyerUsername}` : (gameId ? `Game: ${gameId}` : "Boosting");

    // Hydrate details (undocumented endpoint used by Eldorado web UI)
    let parsed = detailCacheRef.current.get(id) || null;
    if (!parsed) {
      try {
        const full = await fetchBoostingRequestDetails(settings.authToken, id);
        parsed = parseBoostingRequestDetails(full);
        detailCacheRef.current.set(id, parsed);
      } catch (e) {
        parsed = null;
      }
    }

    const fromRank = parsed?.fromRank || null;
    const toRank = parsed?.toRank || null;
    const playlist = parsed?.playlist || null;
    const type = parsed?.type || null;

    const isStandardBoost =
      fromRank && toRank &&
      RANKS.includes(fromRank) && RANKS.includes(toRank) &&
      (type === "Solo Queue" || type === "Duo Queue");

    if (!isStandardBoost) {
      const detailHint = fromRank && toRank ? `${fromRank} → ${toRank}` : (parsed?.queueType || parsed?.completionMethod || "Custom");
      setFeed(prev => [{ ...req, offered: false, reason: "Manual", isCustom: true, customLabel: displayName, subLabel: `${subtitle} • ${detailHint}`, time }, ...prev].slice(0, 50));
      addLog(`Request detected: ${displayName} — manual (missing rank details)`, "offer");
      return;
    }

    // Check rank filters
    if (!isRankEnabled(fromRank) || !isRankEnabled(toRank)) {
      setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: false, reason: "Rank disabled", time }, ...prev].slice(0, 50));
      addLog(`Skipped: rank disabled (${RANK_SHORT[fromRank]} → ${RANK_SHORT[toRank]})`, "offer");
      return;
    }

    // Check type filters
    if (type === "Solo Queue" && !settings.offerOnSolo) {
      setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: false, reason: "Solo disabled", time }, ...prev].slice(0, 50));
      return;
    }
    if (type === "Duo Queue" && !settings.offerOnDuo) {
      setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: false, reason: "Duo disabled", time }, ...prev].slice(0, 50));
      return;
    }

    // Check playlist filters
    // Default-deny: if it's not in our enabled playlist map, we don't auto-offer.
    const playlistSetting = playlist ? settings.playlists?.[playlist] : null;
    if (!playlist || playlistSetting !== true) {
      setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: false, reason: "Playlist disabled", time }, ...prev].slice(0, 50));
      return;
    }

    // Calculate price from your rank table
    const price = calculatePrice(fromRank, toRank, type);
    if (!price) {
      setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: false, reason: "No price set", time }, ...prev].slice(0, 50));
      addLog(`Skipped: no price for ${RANK_SHORT[fromRank]} → ${RANK_SHORT[toRank]}`, "offer");
      return;
    }

    const minPrice = settings.minAutoOfferPrice === "" ? null : (parseFloat(settings.minAutoOfferPrice) || null);
    if (settings.autoOffer && minPrice != null && Number.isFinite(minPrice) && price < minPrice) {
      setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: false, reason: `Min $${minPrice}`, price, time }, ...prev].slice(0, 50));
      addLog(`Skipped: $${price.toFixed(2)} below min $${minPrice} (${RANK_SHORT[fromRank]} → ${RANK_SHORT[toRank]})`, "offer");
      return;
    }

    if (settings.autoOffer) {
      try {
        await placeOffer(settings.authToken, id, price, settings.currency, settings.deliveryTime);
        if (settings.autoMessage) {
          try {
            let conversationId = null;
            const convo = await createConversation(settings.authToken, id);
            const msgText = type === "Duo Queue" ? (settings.duoMessage || "") : (settings.soloMessage || "");
            conversationId = convo?.talkJsConversationId || null;
            if (!conversationId) {
              addLog(`TalkJS convo missing. createConversation response: ${JSON.stringify(convo)}`, "error");
              throw new Error("No TalkJS conversation id");
            }

            if (!settings.talkjsAuthorization || !settings.talkjsSessionId || !settings.talkjsNymId || !settings.talkjsAppId) {
              throw new Error("Missing TalkJS settings (appId/auth/sessionId/nymId)");
            }

            if (msgText) {
              await talkJsSendAutoMessage({
                settings,
                boostingRequestId: id,
                preferredConversationId: conversationId,
                sellerUserId: convo?.sellerUserId || null,
                text: msgText,
              });
              addLog("Auto-message sent via TalkJS", "message");
            }
          } catch (e) {
            addLog(`Auto-message failed (${typeof conversationId === "string" ? conversationId : "no-conversationId"}): ${e.message}`, "error");
          }
        }
        setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: true, price, time }, ...prev].slice(0, 50));
        setStats(prev => ({ ...prev, offersPlaced: prev.offersPlaced + 1 }));
        addLog(`Auto-offered $${price.toFixed(2)} on ${RANK_SHORT[fromRank]} → ${RANK_SHORT[toRank]} (${type}, ${playlist})`, "offer");
      } catch (e) {
        setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: false, reason: `API Error: ${e.message}`, time }, ...prev].slice(0, 50));
        addLog(`Failed to place offer: ${e.message}`, "error");
      }
    } else {
      setFeed(prev => [{ ...req, fromRank, toRank, playlist, type, offered: false, reason: "Auto-offer off", price, time }, ...prev].slice(0, 50));
      addLog(`Detected: ${RANK_SHORT[fromRank]} → ${RANK_SHORT[toRank]} ($${price.toFixed(2)}) — auto-offer disabled`, "offer");
    }
  }, [settings, prices, addLog, setStats, isRankEnabled, calculatePrice]);

  const pollOnce = useCallback(async () => {
    if (!monitorActiveRef.current) return;
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      setPollError(null);
      const data = await fetchBoostRequests(settings.authToken);
      // swagger.json: CursorBasedPagedResult<T> { results, cursor, nextPageCursor, ... }
      const requests = Array.isArray(data)
        ? data
        : (data?.results || data?.requests || data?.data || []);
      const cutoffMs = cutoffRef.current ?? 0;
      let shown = 0;
      for (const req of requests) {
        const created = req?.createdDate ? Date.parse(req.createdDate) : NaN;
        if (cutoffMs) {
          // Default-deny: if we can't parse createdDate, treat it as old to avoid backfilling.
          if (!Number.isFinite(created) || created < cutoffMs) {
            if (req?.id) seenRef.current.add(req.id);
            continue;
          }
        }
        await processRequest(req);
        shown++;
      }
      if (!requests.length) addLog("Boosting poll: 0 results (no ActiveRequests right now)", "system");
      else if (shown === 0 && cutoffMs) addLog("Boosting poll: only older requests (ignored by 5-min lookback)", "system");
    } catch (e) {
      setPollError(e.message);
      addLog(`Poll error: ${e.message}`, "error");
    } finally {
      pollInFlightRef.current = false;
    }
  }, [settings.authToken, processRequest, addLog]);

  // Polling loop
  useEffect(() => {
    if (!monitorActive || !settings.authToken) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    // Immediate first poll
    pollOnce();

    // Set up interval
    pollRef.current = setInterval(pollOnce, (settings.pollInterval || 30) * 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [monitorActive, settings.authToken, settings.pollInterval, pollOnce]);

  const startMonitor = () => {
    if (!settings.authToken) { showToast("Set your Eldorado Id Token in Settings first", "error"); return; }
    seenRef.current.clear();
    cutoffRef.current = Date.now() - 5 * 60 * 1000; // only show requests from last 5 minutes
    setMonitorActive(true);
    addLog("Monitor started — scanning for new requests", "system");
    showToast("Monitor started", "success");
  };
  const stopMonitor = () => {
    setMonitorActive(false);
    setPollError(null);
    addLog("Monitor stopped", "system");
    showToast("Monitor stopped", "info");
  };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* Status bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", marginBottom: 16,
        background: monitorActive ? "rgba(0,212,170,.06)" : "var(--glass-bg)",
        backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))",
        border: `1px solid ${monitorActive ? "rgba(0,212,170,.2)" : "var(--glass-border)"}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: monitorActive ? "var(--shadow-glow)" : "none",
        transition: "all .3s var(--ease-out)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "var(--radius-md)",
            background: monitorActive ? "var(--accent-medium)" : "var(--bg-hover)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: monitorActive ? "breathe 3s infinite" : "none",
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: 6,
              background: monitorActive ? "var(--accent)" : "var(--text-faint)",
              animation: monitorActive ? "pulse 2s infinite" : "none",
            }}/>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: monitorActive ? "var(--accent)" : "var(--text-muted)" }}>
              {monitorActive ? "Scanning for new boosting requests" : "Monitor is stopped"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              {monitorActive ? `Polling every ${settings.pollInterval}s — ${feed.length} requests processed` : "Hit start to begin auto-offering"}
            </div>
          </div>
        </div>
        {monitorActive
          ? <Button onClick={stopMonitor} variant="danger" icon="pause">Stop Monitor</Button>
          : <Button onClick={startMonitor} variant="glow" icon="play">Start Monitor</Button>
        }
      </div>

      {/* Poll error banner */}
      {pollError && (
        <div style={{
          padding: "12px 18px", marginBottom: 14, borderRadius: "var(--radius-md)",
          background: "var(--red-subtle)", border: "1px solid rgba(248,113,113,.2)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Icon type="alert" size={16} color="var(--red)"/>
          <span style={{ fontSize: 13, color: "var(--red)", flex: 1 }}>{pollError}</span>
          <Button onClick={pollOnce} variant="ghost" small>Retry</Button>
        </div>
      )}

      {/* How it works */}
      <GlassCard title="How It Works" sub="Fully automated pipeline — runs every poll cycle." style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {[
            { icon: "monitor", title: "1. Scan", desc: "Polls API for new requests", color: "var(--accent)" },
            { icon: "target", title: "2. Match", desc: "Checks your pricing", color: "var(--purple)" },
            { icon: "send", title: "3. Offer", desc: "Places your offer", color: "var(--blue)" },
            { icon: "messages", title: "4. Message", desc: "Sends intro message", color: "var(--amber)" },
            { icon: "discord", title: "5. Notify", desc: "Pings Discord", color: "var(--pink)" },
          ].map((s, i) => (
            <div key={s.title} style={{
              padding: "16px 14px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
              border: "1px solid rgba(255,255,255,.06)", textAlign: "center",
              transition: "all .2s var(--ease-out)", position: "relative", overflow: "hidden",
              animation: `fadeInUp .4s var(--ease-out) ${i * .05}s both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.color}30`; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ color: s.color, marginBottom: 8, display: "flex", justifyContent: "center" }}><Icon type={s.icon} size={20}/></div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <GlassCard title="Queue & Playlist" sub="Which request types trigger auto-offers.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { key: "solo", label: "Solo", sub: "Queue", enabled: settings.offerOnSolo, color: "var(--accent)", icon: "zap", toggle: v => setSettings(p => ({ ...p, offerOnSolo: v })) },
                { key: "duo", label: "Duo", sub: "Queue", enabled: settings.offerOnDuo, color: "var(--purple)", icon: "users", toggle: v => setSettings(p => ({ ...p, offerOnDuo: v })) },
              ].map(f => (
                <div key={f.key} onClick={() => f.toggle(!f.enabled)}
                  style={{
                    padding: "14px", borderRadius: "var(--radius-md)", cursor: "pointer",
                    background: f.enabled ? `color-mix(in srgb, ${f.color} 8%, transparent)` : "var(--bg-elevated)",
                    border: `1px solid ${f.enabled ? `color-mix(in srgb, ${f.color} 20%, transparent)` : "var(--border-subtle)"}`,
                    transition: "all .2s var(--ease-out)",
                    opacity: f.enabled ? 1 : 0.4,
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", background: `${f.enabled ? f.color : "var(--text-disabled)"}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon type={f.icon} size={16} color={f.enabled ? f.color : "var(--text-disabled)"}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: f.enabled ? f.color : "var(--text-disabled)" }}>{f.label} {f.sub}</div>
                    <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{f.enabled ? "Active" : "Disabled"}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".5px", padding: "6px 0 2px" }}>Playlists</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { key: "1v1", icon: "target" },
                { key: "2v2", icon: "users" },
                { key: "3v3", icon: "globe" },
              ].map(({ key: p, icon }) => {
                const enabled = settings.playlists?.[p] !== false;
                return (
                  <div key={p} onClick={() => setSettings(prev => ({ ...prev, playlists: { ...prev.playlists, [p]: !enabled } }))}
                    style={{
                      padding: "10px 12px", borderRadius: "var(--radius-md)", cursor: "pointer",
                      background: enabled ? "color-mix(in srgb, var(--blue) 8%, transparent)" : "var(--bg-elevated)",
                      border: `1px solid ${enabled ? "color-mix(in srgb, var(--blue) 20%, transparent)" : "var(--border-subtle)"}`,
                      transition: "all .2s var(--ease-out)",
                      opacity: enabled ? 1 : 0.4,
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: `${enabled ? "var(--blue)" : "var(--text-disabled)"}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon type={icon} size={14} color={enabled ? "var(--blue)" : "var(--text-disabled)"}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? "var(--blue)" : "var(--text-disabled)" }}>{p}</div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{enabled ? "Active" : "Disabled"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Rank Ranges" sub="Which rank tiers to accept boost requests for.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {RANK_TIERS.map(tier => {
              const enabled = settings.disabledRanks?.[tier.id] !== true;
              const tierColor = getRankColor(tier.ranks[0]);
              const tierIcons = { bronze: "shield", silver: "shield", gold: "star", platinum: "award", diamond: "zap", champion: "trendUp", grandchamp: "trendUp", ssl: "star" };
              return (
                <div key={tier.id} onClick={() => setSettings(prev => ({
                  ...prev,
                  disabledRanks: { ...prev.disabledRanks, [tier.id]: enabled }
                }))}
                style={{
                  padding: "10px 12px", borderRadius: "var(--radius-md)", cursor: "pointer",
                  background: enabled ? `${tierColor}12` : "var(--bg-elevated)",
                  border: `1px solid ${enabled ? `${tierColor}30` : "var(--border-subtle)"}`,
                  transition: "all .2s var(--ease-out)",
                  opacity: enabled ? 1 : 0.4,
                  display: "flex", alignItems: "center", gap: 10,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: `${enabled ? tierColor : "var(--text-disabled)"}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon type={tierIcons[tier.id] || "shield"} size={14} color={enabled ? tierColor : "var(--text-disabled)"}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? tierColor : "var(--text-disabled)" }}>{tier.label}</div>
                    <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{enabled ? "Active" : "Disabled"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Live Feed */}
      <GlassCard title="Live Feed" sub="Real-time detection and offers." glow={monitorActive && feed.length > 0}>
        {feed.length === 0 ? (
          <EmptyState icon="inbox" title={monitorActive ? "Waiting for requests..." : "Start the monitor to see incoming requests"} sub="Requests will appear here in real time"/>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {feed.map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                animation: `slideInRight .3s var(--ease-out) ${i * .05}s both`,
              }}>
                <Badge color={f.isCustom ? "var(--purple)" : f.offered ? "var(--accent)" : "var(--amber)"}>{f.isCustom ? "Custom" : f.offered ? "Offered" : f.reason || "Skipped"}</Badge>
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", minWidth: 0 }}>
                  {f.isCustom ? (
                    <>
                      <span style={{ color: "var(--purple)", fontWeight: 600 }}>{f.customLabel}</span>
                      <span style={{ color: "var(--text-faint)", marginLeft: 8, fontSize: 11 }}>{f.subLabel || "Boosting"}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: getRankColor(f.fromRank), fontWeight: 600 }}>{RANK_SHORT[f.fromRank] || f.fromRank}</span>
                      <span style={{ color: "var(--text-disabled)", margin: "0 6px" }}>→</span>
                      <span style={{ color: getRankColor(f.toRank), fontWeight: 600 }}>{RANK_SHORT[f.toRank] || f.toRank}</span>
                      <span style={{ color: "var(--text-faint)", marginLeft: 8, fontSize: 11 }}>{f.playlist}</span>
                    </>
                  )}
                </span>
                {f.price && <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>${f.price}</span>}
                {f.isCustom && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--radius-full)", background: "var(--amber-subtle)", color: "var(--amber)", border: "1px solid rgba(251,191,36,.2)" }}>Manual</span>}
                <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>{f.time}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

const PricesPage = ({ prices, setPrices, showToast, currency, settings, setSettings }) => {
  const cs = CURRENCY_SYMBOLS[currency] || "$";
  const getPrice = (from, to) => prices[`${from}|${to}`] || "";
  const setPrice = (from, to, val) => {
    const k = `${from}|${to}`;
    const next = { ...prices };
    if (val === "" || val === "0") delete next[k]; else next[k] = val;
    setPrices(next);
  };
  const handleSave = () => { saveData("eld_prices", prices); showToast("Prices saved", "success"); };
  const filledCount = RANKS.slice(0, -1).filter((r, i) => !!getPrice(r, RANKS[i + 1])).length;
  const totalRanks = RANKS.length - 1;
  const pct = Math.round((filledCount / totalRanks) * 100);

  const handleExport = () => {
    const data = RANKS.slice(0, -1).map((r, i) => {
      const to = RANKS[i + 1];
      const solo = getPrice(r, to);
      return { From: r, To: to, "Solo Price": solo || "Not set", "Duo Price": solo ? (parseFloat(solo) * 1.3).toFixed(2) : "Not set" };
    });
    exportToCSV(data, "eldorado-prices.csv");
    showToast("Prices exported to CSV", "success");
  };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Set solo queue prices per rank step. Duo queue is automatically +30%.</p>
          {/* Progress bar */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 6, background: "var(--bg-hover)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%", borderRadius: 3,
                background: pct === 100 ? "var(--accent)" : "linear-gradient(90deg, var(--accent), var(--purple))",
                transition: "width .5s var(--ease-out)",
                boxShadow: pct === 100 ? "0 0 8px var(--accent-glow)" : "none",
              }}/>
            </div>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: pct === 100 ? "var(--accent)" : "var(--text-muted)", fontWeight: 600 }}>{filledCount}/{totalRanks}</span>
          </div>
        </div>
        <Button onClick={handleExport} variant="ghost" icon="download" small>Export CSV</Button>
        <Button onClick={handleSave} icon="save">Save Prices</Button>
      </div>

      <GlassCard title={`Solo Queue Prices`} sub="Duo queue prices are calculated as solo + 30%.">
        <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
          {RANKS.slice(0, -1).map((fromRank, i) => {
            const toRank = RANKS[i + 1];
            const fromTier = RANK_TIERS.find(t => t.ranks.includes(fromRank));
            const toTier = RANK_TIERS.find(t => t.ranks.includes(toRank));
            const isDisabled = (fromTier && settings.disabledRanks?.[fromTier.id] === true) || (toTier && settings.disabledRanks?.[toTier.id] === true);
            const val = getPrice(fromRank, toRank);
            const duoPrice = val ? (parseFloat(val) * 1.3).toFixed(2) : "—";
            return (
              <div key={fromRank} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)",
                animation: `fadeIn .3s ease ${i * .02}s both`,
                opacity: isDisabled ? 0.3 : 1, pointerEvents: isDisabled ? "none" : "auto",
                transition: "opacity .2s",
              }}>
                <span style={{ minWidth: 140, fontSize: 13, fontWeight: 600, color: val ? getRankColor(fromRank) : "var(--text-disabled)" }}>{fromRank}</span>
                <span style={{ color: "var(--text-disabled)", fontSize: 12 }}>→</span>
                <span style={{ minWidth: 140, fontSize: 13, fontWeight: 600, color: val ? getRankColor(toRank) : "var(--text-disabled)" }}>{toRank}</span>
                <div style={{ flex: 1 }}/>
                <span style={{ fontSize: 11, color: "var(--text-faint)", width: 80, textAlign: "right" }}>duo: {cs}{duoPrice}</span>
                <div style={{ position: "relative", width: 120 }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", fontSize: 13 }}>{cs}</span>
                  <input type="number" step="0.01" min="0" placeholder="—" value={val}
                    onChange={e => setPrice(fromRank, toRank, e.target.value)}
                    style={{
                      width: "100%", padding: "7px 10px 7px 24px", background: "var(--bg-input)", border: `1px solid ${val ? "var(--border-default)" : "var(--border-subtle)"}`,
                      borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box",
                      transition: "border-color .2s",
                    }}/>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard title="Price Calculator" sub="Estimate total cost for multi-rank boosts." style={{ marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Select label="From" value={prices._calcFrom || "Grand Champion I"} onChange={v => setPrices({ ...prices, _calcFrom: v })} options={RANKS.slice(0, -1)}/>
          <Select label="To" value={prices._calcTo || "Grand Champion III"} onChange={v => setPrices({ ...prices, _calcTo: v })} options={RANKS}/>
        </div>
        {(() => {
          const from = prices._calcFrom || "Grand Champion I";
          const to = prices._calcTo || "Grand Champion III";
          const fi = RANKS.indexOf(from); const ti = RANKS.indexOf(to);
          if (ti <= fi) return <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>Target rank must be higher than source.</p>;
          let total = 0; let missing = [];
          for (let i = fi; i < ti; i++) {
            const p = getPrice(RANKS[i], RANKS[i + 1]);
            if (!p) missing.push(`${RANKS[i]} → ${RANKS[i+1]}`);
            else total += parseFloat(p);
          }
          if (missing.length) return <p style={{ color: "var(--amber)", fontSize: 13, margin: 0 }}>Missing prices: {missing.join(", ")}</p>;
          return (
            <div style={{ display: "flex", gap: 32 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Solo Queue</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{cs}{total.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Duo Queue (+30%)</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--purple)", fontFamily: "var(--font-mono)" }}>{cs}{(total * 1.3).toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Rank Steps</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{ti - fi}</div>
              </div>
            </div>
          );
        })()}
      </GlassCard>
    </div>
  );
};

const AnalyticsPage = ({ stats, orders, currency }) => {
  const cs = CURRENCY_SYMBOLS[currency] || "$";
  const dailyData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en", { weekday: "short" });
      const dayOrders = (orders || []).filter(o => {
        const od = new Date(o.date);
        return od.toDateString() === d.toDateString();
      });
      days.push({ label, orders: dayOrders.length, revenue: dayOrders.reduce((s, o) => s + (o.revenue || 0), 0) });
    }
    return days;
  }, [orders]);

  const maxRev = Math.max(...dailyData.map(d => d.revenue), 1);
  const maxOrd = Math.max(...dailyData.map(d => d.orders), 1);

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <GlassCard style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Total Revenue</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
            <AnimatedNumber value={stats.totalRevenue} prefix={cs}/>
          </div>
          <Sparkline data={dailyData.map(d => d.revenue)} color="var(--accent)" width={90} height={24}/>
        </GlassCard>
        <GlassCard style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Total Profit</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--green)" }}>
            <AnimatedNumber value={stats.totalProfit} prefix={cs}/>
          </div>
          <Sparkline data={dailyData.map(d => d.revenue * 0.7)} color="var(--green)" width={90} height={24}/>
        </GlassCard>
        <GlassCard style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Offers Placed</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--purple)" }}>
            <AnimatedNumber value={stats.offersPlaced}/>
          </div>
          <Sparkline data={dailyData.map(d => d.orders)} color="var(--purple)" width={90} height={24}/>
        </GlassCard>
        <GlassCard style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Orders Won</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--blue)" }}>
            <AnimatedNumber value={stats.ordersAccepted}/>
          </div>
          <Sparkline data={dailyData.map(d => Math.max(d.orders - 1, 0))} color="var(--blue)" width={90} height={24}/>
        </GlassCard>
      </div>

      {/* Bar chart - revenue */}
      <GlassCard title="Revenue (Last 7 Days)" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, padding: "10px 0" }}>
          {dailyData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{d.revenue > 0 ? `${cs}${d.revenue.toFixed(0)}` : ""}</span>
              <div style={{
                width: "100%", maxWidth: 40,
                height: `${Math.max((d.revenue / maxRev) * 100, 4)}%`,
                background: `linear-gradient(180deg, var(--accent), rgba(0,212,170,.3))`,
                borderRadius: "var(--radius-sm) var(--radius-sm) 2px 2px",
                transition: "height .5s var(--ease-out)",
                animation: `fadeInUp .5s var(--ease-out) ${i * .06}s both`,
              }}/>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Orders bar chart */}
      <GlassCard title="Orders (Last 7 Days)">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100, padding: "10px 0" }}>
          {dailyData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{d.orders > 0 ? d.orders : ""}</span>
              <div style={{
                width: "100%", maxWidth: 40,
                height: `${Math.max((d.orders / maxOrd) * 100, 4)}%`,
                background: `linear-gradient(180deg, var(--purple), rgba(139,92,246,.3))`,
                borderRadius: "var(--radius-sm) var(--radius-sm) 2px 2px",
                animation: `fadeInUp .5s var(--ease-out) ${i * .06}s both`,
              }}/>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

const OrderHistoryPage = ({ orders, showToast, currency }) => {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState(-1);
  const cs = CURRENCY_SYMBOLS[currency] || "$";

  const filteredOrders = useMemo(() => {
    let o = [...(orders || [])];
    if (search) {
      const q = search.toLowerCase();
      o = o.filter(ord => ord.playlist?.toLowerCase().includes(q) || ord.fromRank?.toLowerCase().includes(q) || ord.toRank?.toLowerCase().includes(q) || ord.status?.toLowerCase().includes(q));
    }
    o.sort((a, b) => {
      const av = a[sortField]; const bv = b[sortField];
      if (typeof av === "number") return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
    return o;
  }, [orders, search, sortField, sortDir]);

  const handleExport = () => {
    if (!orders?.length) { showToast("No orders to export", "error"); return; }
    exportToCSV(orders, "eldorado-orders.csv");
    showToast("Orders exported to CSV", "success");
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d * -1);
    else { setSortField(field); setSortDir(-1); }
  };

  const SortHeader = ({ field, children }) => (
    <th onClick={() => toggleSort(field)} style={{
      padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
      textTransform: "uppercase", letterSpacing: ".5px", cursor: "pointer", userSelect: "none",
      borderBottom: "1px solid var(--border-default)", whiteSpace: "nowrap",
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {children}
        {sortField === field && <Icon type={sortDir > 0 ? "arrowUp" : "arrowDown"} size={12}/>}
      </span>
    </th>
  );

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1 }}><Input placeholder="Search orders..." value={search} onChange={setSearch} icon="search"/></div>
        <Button onClick={handleExport} variant="ghost" icon="download">Export CSV</Button>
      </div>
      <GlassCard>
        {filteredOrders.length === 0 ? (
          <EmptyState icon="inbox" title={search ? "No matching orders" : "No orders yet"} sub="Completed orders will appear here"/>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader field="date">Date</SortHeader>
                  <SortHeader field="playlist">Playlist</SortHeader>
                  <SortHeader field="fromRank">From</SortHeader>
                  <SortHeader field="toRank">To</SortHeader>
                  <SortHeader field="type">Type</SortHeader>
                  <SortHeader field="revenue">Revenue</SortHeader>
                  <SortHeader field="deliveryTime">Delivery</SortHeader>
                  <SortHeader field="status">Status</SortHeader>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, i) => (
                  <tr key={o.id || i} style={{ animation: `fadeIn .3s ease ${i * .02}s both` }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border-subtle)" }}>
                      {o.date ? new Date(o.date).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>{o.playlist}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: getRankColor(o.fromRank), fontWeight: 600, fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border-subtle)" }}>{RANK_SHORT[o.fromRank] || o.fromRank}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: getRankColor(o.toRank), fontWeight: 600, fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border-subtle)" }}>{RANK_SHORT[o.toRank] || o.toRank}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}><Badge color={o.type === "Solo Queue" ? "var(--accent)" : "var(--purple)"}>{o.type || "Solo"}</Badge></td>
                    <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border-subtle)" }}>{cs}{(o.revenue || 0).toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border-subtle)" }}>{o.deliveryTime ? (DELIVERY_TIMES.find(d => d.value === o.deliveryTime)?.label || o.deliveryTime) : "—"}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <Badge color={o.status === "completed" ? "var(--accent)" : o.status === "in-progress" ? "var(--amber)" : "var(--text-muted)"}>{o.status || "completed"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

const MessagesPage = ({ settings, setSettings, showToast }) => {
  const [autoReplies, setAutoReplies] = useState([]);
  const [newTrigger, setNewTrigger] = useState("");
  const [newReply, setNewReply] = useState("");
  const [msgTab, setMsgTab] = useState("solo");

  useEffect(() => { setAutoReplies(loadData("eld_autoreplies", [])); }, []);

  const addReply = () => {
    if (!newTrigger || !newReply) return;
    const next = [...autoReplies, { id: Date.now(), trigger: newTrigger, reply: newReply }];
    setAutoReplies(next);
    saveData("eld_autoreplies", next);
    setNewTrigger(""); setNewReply("");
    showToast("Auto-reply added", "success");
  };
  const removeReply = (id) => {
    const next = autoReplies.filter(r => r.id !== id);
    setAutoReplies(next);
    saveData("eld_autoreplies", next);
  };

  const msgKey = msgTab === "solo" ? "soloMessage" : "duoMessage";
  const defaultMsg = msgTab === "solo" ? DEFAULT_SOLO_MSG : DEFAULT_DUO_MSG;

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <GlassCard title="First Message" sub="Sent to buyers when your offer is placed. Set a different message for each queue type." style={{ marginBottom: 14 }}>
        {/* Solo / Duo tab switcher */}
        <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", marginBottom: 14, border: "1px solid var(--border-subtle)" }}>
          {[
            { id: "solo", label: "Solo Queue", icon: "zap", color: "var(--accent)" },
            { id: "duo", label: "Duo Queue", icon: "users", color: "var(--purple)" },
          ].map(t => (
            <div key={t.id} onClick={() => setMsgTab(t.id)} style={{
              flex: 1, padding: "10px 16px", borderRadius: "var(--radius-sm)", cursor: "pointer",
              background: msgTab === t.id ? "var(--glass-bg-strong)" : "transparent",
              border: msgTab === t.id ? "1px solid var(--glass-border)" : "1px solid transparent",
              boxShadow: msgTab === t.id ? "0 2px 8px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.06)" : "none",
              transition: "all .2s var(--ease-out)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <Icon type={t.icon} size={14} color={msgTab === t.id ? t.color : "var(--text-faint)"}/>
              <span style={{ fontSize: 13, fontWeight: 600, color: msgTab === t.id ? t.color : "var(--text-faint)", transition: "color .2s" }}>{t.label}</span>
            </div>
          ))}
        </div>
        <Input value={settings[msgKey] || ""} onChange={v => setSettings(p => ({ ...p, [msgKey]: v }))} rows={7} placeholder={`Your ${msgTab} queue intro message...`}/>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => { saveData("eld_settings", settings); showToast("Saved", "success"); }} icon="save">Save</Button>
          <Button onClick={() => setSettings(p => ({ ...p, [msgKey]: defaultMsg }))} variant="ghost" icon="refresh">Reset Default</Button>
        </div>
      </GlassCard>

      <GlassCard title="Auto-Reply Rules" sub="When a buyer's message contains the trigger, auto-reply with your response." style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
          <Input label="Trigger (keyword)" value={newTrigger} onChange={setNewTrigger} placeholder="e.g. how long"/>
          <Input label="Auto Reply" value={newReply} onChange={setNewReply} placeholder="e.g. Usually done within 24h"/>
          <div style={{ paddingBottom: 16 }}><Button onClick={addReply} icon="zap">Add Rule</Button></div>
        </div>
        {autoReplies.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {autoReplies.map((r, i) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                animation: `fadeIn .3s ease ${i * .05}s both`,
              }}>
                <span style={{ flex: 1, fontSize: 13 }}>
                  <span style={{ color: "var(--amber)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>"{r.trigger}"</span>
                  <span style={{ color: "var(--text-disabled)", margin: "0 10px" }}>→</span>
                  <span style={{ color: "var(--text-secondary)" }}>{r.reply}</span>
                </span>
                <Button small variant="ghost" onClick={() => removeReply(r.id)} icon="trash"/>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard title="Discord Webhook" sub="Test your webhook connection.">
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 14,
          background: settings.discordWebhook ? "var(--accent-subtle)" : "var(--bg-elevated)",
          border: `1px solid ${settings.discordWebhook ? "var(--border-accent)" : "var(--border-subtle)"}`,
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 4,
            background: settings.discordWebhook ? "var(--accent)" : "var(--text-faint)",
          }}/>
          <span style={{ fontSize: 13, color: settings.discordWebhook ? "var(--text-secondary)" : "var(--text-faint)" }}>
            {settings.discordWebhook ? `Connected: ...${settings.discordWebhook.slice(-24)}` : "No webhook configured — set one in Settings"}
          </span>
        </div>
        <Button onClick={async () => {
          if (!settings.discordWebhook) { showToast("Set webhook in Settings first", "error"); return; }
          const ok = await sendDiscord(settings.discordWebhook, "Test Notification", "Eldorado RL Manager webhook is working.", [{ name: "Status", value: "Connected", inline: true }]);
          showToast(ok ? "Webhook sent successfully" : "Webhook failed — check URL", ok ? "success" : "error");
        }} icon="discord" variant="secondary">Send Test Ping</Button>
      </GlassCard>
    </div>
  );
};

const SettingsPage = ({ settings, setSettings, showToast }) => {
  const handleSave = () => { saveData("eld_settings", settings); showToast("Settings saved", "success"); };
  const handleReset = () => { setSettings(DEFAULT_SETTINGS); saveData("eld_settings", DEFAULT_SETTINGS); showToast("Settings reset to defaults", "success"); };
  const u = (k, v) => setSettings(p => ({ ...p, [k]: v }));

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <GlassCard title="Eldorado API" sub="Paste your Cognito Id Token (used as __Host-EldoradoIdToken)" glow={!!settings.authToken}>
          <Input label="Id Token" value={settings.authToken} onChange={v => u("authToken", v)} placeholder="Paste your IdToken JWT" type="password" mono icon="shield"/>
          <Input label="Poll Interval (seconds)" value={settings.pollInterval} onChange={v => u("pollInterval", parseInt(v) || 30)} type="number" placeholder="30"/>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: settings.authToken ? "var(--accent-subtle)" : "var(--red-subtle)",
            borderRadius: "var(--radius-md)", border: `1px solid ${settings.authToken ? "var(--border-accent)" : "rgba(248,113,113,.12)"}`,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: settings.authToken ? "var(--accent)" : "var(--red)" }}/>
            <span style={{ fontSize: 12, color: settings.authToken ? "var(--accent)" : "var(--red)" }}>{settings.authToken ? "Token set" : "No token"}</span>
          </div>
        </GlassCard>

        <GlassCard title="Discord Webhook">
          <Input label="Webhook URL" value={settings.discordWebhook} onChange={v => u("discordWebhook", v)} placeholder="https://discord.com/api/webhooks/..." mono icon="link"/>
          <Toggle label="Enable notifications" sub="New offers, orders, and messages" value={settings.notificationsEnabled} onChange={v => u("notificationsEnabled", v)}/>
        </GlassCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <GlassCard title="Automation" sub="Automations that run when the monitor is active.">
          <Toggle label="Auto-Offer on new requests" sub="Place offers when a matching request is found" value={settings.autoOffer} onChange={v => u("autoOffer", v)}/>
          <Toggle label="Auto-Send first message" sub="Send intro message when offer is placed" value={settings.autoMessage} onChange={v => u("autoMessage", v)}/>
          <Select label="Guaranteed Delivery Time" value={settings.deliveryTime} onChange={v => u("deliveryTime", v)}
            options={DELIVERY_TIMES}/>
          <div style={{
            padding: "8px 14px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)",
            fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5,
          }}>
            Sent with your offers. Don't overpromise — Eldorado tracks real delivery times. Min: 20 min, Max: 7 days.
          </div>
        </GlassCard>

        <GlassCard title="Boosting Auto-Offer" sub="Auto-offer uses boostingCategoryId (rank details aren’t provided by the API).">
          <Input
            label="Default auto-offer price (USD)"
            value={settings.defaultBoostOfferPrice ?? ""}
            onChange={v => u("defaultBoostOfferPrice", v === "" ? "" : String(parseFloat(v) || ""))}
            type="number"
            placeholder="Leave blank to disable auto-offer"
            mono
          />
          <Input
            label="Minimum auto-offer price (USD)"
            value={settings.minAutoOfferPrice ?? ""}
            onChange={v => u("minAutoOfferPrice", v === "" ? "" : String(parseFloat(v) || ""))}
            type="number"
            placeholder="Skip offers below this amount"
            mono
          />
          <div style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5, marginTop: 6 }}>
            If set, the monitor will submit an offer on new requests using this price. For more control, we can add per-category pricing UI next.
          </div>
        </GlassCard>

        <GlassCard title="TalkJS (Auto-Message)" sub="Needed to auto-send messages after placing an offer. Paste values from your browser Network request.">
          <Input label="TalkJS App ID" value={settings.talkjsAppId} onChange={v => u("talkjsAppId", v)} placeholder="49mLECOW" mono/>
          <Input label="TalkJS Authorization" value={settings.talkjsAuthorization} onChange={v => u("talkjsAuthorization", v)} placeholder="bearer <token>" type="password" mono/>
          <Input label="TalkJS Session ID" value={settings.talkjsSessionId} onChange={v => u("talkjsSessionId", v)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" mono/>
          <Input label="TalkJS Nym ID" value={settings.talkjsNymId} onChange={v => u("talkjsNymId", v)} placeholder="14515989324c6c92619e_n" mono/>
          <Toggle label="TalkJS debug logs" sub="Logs init details to browser console" value={settings.talkjsDebug} onChange={v => u("talkjsDebug", v)}/>
          <div style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5, marginTop: 6 }}>
            Keep these private. They grant chat access for your account.
          </div>
        </GlassCard>

        <GlassCard title="Preferences">
          <Select label="Currency" value={settings.currency} onChange={v => u("currency", v)} options={[
            { value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }, { value: "GBP", label: "GBP (£)" },
          ]}/>
        </GlassCard>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Button onClick={handleSave} variant="glow" icon="save">Save All Settings</Button>
        <Button onClick={handleReset} variant="ghost" icon="refresh">Reset Defaults</Button>
      </div>
    </div>
  );
};

const LogsPage = ({ logs, setLogs, showToast }) => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    let l = [...logs].reverse();
    if (filter !== "all") l = l.filter(log => log.type === filter);
    if (search) l = l.filter(log => log.message.toLowerCase().includes(search.toLowerCase()));
    return l;
  }, [logs, filter, search]);

  const handleExport = () => {
    if (!logs.length) { showToast("No logs to export", "error"); return; }
    exportToCSV(logs.map(l => ({ Time: l.time, Type: l.type, Message: l.message })), "eldorado-logs.csv");
    showToast("Logs exported", "success");
  };

  const logTypes = ["all", "offer", "order", "message", "error", "system"];
  const logColors = { offer: "var(--accent)", order: "var(--purple)", message: "var(--blue)", error: "var(--red)", system: "var(--text-muted)" };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1 }}><Input placeholder="Search logs..." value={search} onChange={setSearch} icon="search"/></div>
        <div style={{ display: "flex", gap: 4, paddingBottom: 16 }}>
          {logTypes.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: "6px 12px", borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 600,
              background: filter === t ? (t === "all" ? "var(--accent-medium)" : `${logColors[t]}20`) : "var(--bg-hover)",
              color: filter === t ? (t === "all" ? "var(--accent)" : logColors[t]) : "var(--text-faint)",
              border: "1px solid transparent", cursor: "pointer", fontFamily: "inherit",
              textTransform: "capitalize", transition: "all .15s",
              borderColor: filter === t ? (t === "all" ? "var(--border-accent)" : `${logColors[t]}30`) : "transparent",
            }}>{t}</button>
          ))}
        </div>
        <Button onClick={handleExport} variant="ghost" icon="download" small style={{ marginBottom: 16 }}>Export</Button>
        {logs.length > 0 && <Button small variant="danger" onClick={() => { setLogs([]); showToast("Logs cleared", "info"); }} icon="trash" style={{ marginBottom: 16 }}>Clear</Button>}
      </div>

      <GlassCard title={`Activity Log — ${filteredLogs.length} entries`}>
        {filteredLogs.length === 0 ? (
          <EmptyState icon="activity" title={search || filter !== "all" ? "No matching logs" : "No logs yet"} sub="Activity will appear here"/>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 550, overflowY: "auto" }}>
            {filteredLogs.map((l, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, padding: "8px 4px", borderBottom: "1px solid var(--border-subtle)", fontSize: 12,
                animation: `fadeIn .2s ease ${Math.min(i, 20) * .015}s both`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ color: "var(--text-disabled)", fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 68, flexShrink: 0 }}>{l.time}</span>
                <Badge color={logColors[l.type] || "var(--text-faint)"}>{l.type}</Badge>
                <span style={{ color: "var(--text-secondary)", flex: 1 }}>{l.message}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

// ─── MAIN APP ───

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [orders, setOrders] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monitorActive, setMonitorActive] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(null);

  const showToast = (message, type = "info") => setToast({ message, type });
  const addLog = useCallback((message, type = "system") => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!settings.authToken) { showToast("Set Id Token in Settings first", "error"); return; }
    try {
      const resp = await getOrders(settings.authToken, 50, null);
      const results = Array.isArray(resp?.results) ? resp.results : [];
      const normalized = results.map(normalizeOrder);
      setOrders(normalized);
      saveData("eld_orders", normalized);
      addLog(`Orders refreshed: ${normalized.length} result(s)`, normalized.length ? "order" : "system");
      showToast(`Orders loaded: ${normalized.length}`, "success");
    } catch (e) {
      addLog(`Orders refresh error: ${e.message}`, "error");
      showToast(`Orders error: ${e.message}`, "error");
    }
  }, [settings.authToken, addLog]);

  useEffect(() => {
    setSettings(loadData("eld_settings", DEFAULT_SETTINGS));
    setPrices(loadData("eld_prices", DEFAULT_PRICES));
    setLogs(loadData("eld_logs", []));
    setStats(loadData("eld_stats", DEFAULT_STATS));
    setOrders((loadData("eld_orders", []) || []).map(o => (o && o._raw ? o : normalizeOrder(o))));
    setLoading(false);
  }, []);

  useEffect(() => { if (!loading) saveData("eld_logs", logs.slice(-200)); }, [logs, loading]);
  useEffect(() => { if (!loading) saveData("eld_stats", stats); }, [stats, loading]);
  useEffect(() => { if (!loading) saveData("eld_orders", orders); }, [orders, loading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(o => !o); }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "monitor", label: "Monitor", icon: "monitor" },
    { id: "analytics", label: "Analytics", icon: "analytics" },
    { id: "orders", label: "Orders", icon: "history" },
    { id: "prices", label: "Prices", icon: "prices" },
    { id: "messages", label: "Messages", icon: "messages" },
    { id: "settings", label: "Settings", icon: "settings" },
    { id: "logs", label: "Logs", icon: "logs" },
  ];

  const pageDescriptions = {
    dashboard: "Overview of your operation",
    monitor: `Polls every ${settings.pollInterval}s — auto-offers on matching requests`,
    analytics: "Revenue, profit, and performance insights",
    orders: "Full order history with search and export",
    prices: "Set your per-rank pricing",
    messages: "First message & auto-reply rules",
    settings: "API, webhook, automation controls",
    logs: "Full activity history and audit trail",
  };

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-deep)", flexDirection: "column", gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, var(--accent), #00b894)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "breathe 2s infinite",
      }}>
        <span style={{ fontWeight: 800, fontSize: 20, color: "#0a0b0e" }}>E</span>
      </div>
      <div style={{ color: "var(--text-faint)", fontSize: 13, fontWeight: 500 }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-deep)", fontFamily: "var(--font-sans)", color: "var(--text-primary)", overflow: "hidden", position: "relative" }}>
      {/* Ambient background effects — iOS 26 depth lighting */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-15%", right: "5%", width: 900, height: 900, background: "radial-gradient(circle, rgba(0,212,170,.18) 0%, rgba(0,180,148,.07) 30%, transparent 60%)", filter: "blur(50px)", animation: "float 20s ease-in-out infinite" }}/>
        <div style={{ position: "absolute", bottom: "-10%", left: "-8%", width: 800, height: 800, background: "radial-gradient(circle, rgba(139,92,246,.15) 0%, rgba(99,52,206,.06) 30%, transparent 60%)", filter: "blur(50px)", animation: "float 25s ease-in-out infinite reverse" }}/>
        <div style={{ position: "absolute", top: "20%", left: "30%", width: 700, height: 700, background: "radial-gradient(circle, rgba(96,165,250,.1) 0%, rgba(96,165,250,.03) 35%, transparent 55%)", filter: "blur(60px)", animation: "float 18s ease-in-out infinite 2s" }}/>
        <div style={{ position: "absolute", top: "55%", right: "15%", width: 600, height: 600, background: "radial-gradient(circle, rgba(244,114,182,.08) 0%, transparent 50%)", filter: "blur(60px)", animation: "float 22s ease-in-out infinite 4s" }}/>
      </div>

      {/* Sidebar */}
      <div style={{
        width: 220, minWidth: 220,
        background: "linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.02) 100%)",
        backdropFilter: "blur(44px)", WebkitBackdropFilter: "blur(44px)",
        borderRight: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column",
        position: "relative", zIndex: 2,
        boxShadow: "inset -1px 0 0 rgba(255,255,255,.06), 4px 0 32px rgba(0,0,0,.25)",
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, #00d4aa, #00b894)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 16, color: "#0a0b0e",
            boxShadow: "0 2px 12px rgba(0,212,170,.3)",
            animation: "float 6s ease-in-out infinite",
          }}>E</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-.3px", color: "var(--text-primary)" }}>Eldorado</div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".8px", textTransform: "uppercase", fontWeight: 500 }}>RL Manager</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "var(--text-disabled)", letterSpacing: ".8px", textTransform: "uppercase", fontWeight: 600, padding: "8px 12px 6px", marginBottom: 2 }}>Navigation</div>
          {NAV.map((n, i) => {
            const active = page === n.id;
            const hovered = sidebarHover === n.id;
            return (
              <div key={n.id} onClick={() => setPage(n.id)}
                onMouseEnter={() => setSidebarHover(n.id)}
                onMouseLeave={() => setSidebarHover(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  borderRadius: "var(--radius-md)", cursor: "pointer", marginBottom: 1,
                  transition: "all .2s var(--ease-out)", position: "relative",
                  background: active ? "var(--accent-subtle)" : hovered ? "rgba(255,255,255,.03)" : "transparent",
                  color: active ? "var(--accent)" : hovered ? "var(--text-secondary)" : "var(--text-muted)",
                }}>
                {active && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, borderRadius: 2, background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)" }}/>}
                <Icon type={n.icon} size={17}/>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{n.label}</span>
                {n.id === "monitor" && monitorActive && (
                  <div style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: 4, background: "var(--accent)", animation: "pulse 2s infinite", boxShadow: "0 0 6px var(--accent-glow)" }}/>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-subtle)" }}>
          {/* Command palette shortcut */}
          <div onClick={() => setCmdOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 10,
            background: "var(--bg-hover)", borderRadius: "var(--radius-md)", cursor: "pointer",
            border: "1px solid var(--border-subtle)", transition: "all .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-strong)"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}
          >
            <Icon type="search" size={14} style={{ color: "var(--text-faint)" }}/>
            <span style={{ fontSize: 12, color: "var(--text-faint)", flex: 1 }}>Search...</span>
            <kbd style={{ fontSize: 10, color: "var(--text-disabled)", background: "var(--bg-surface)", padding: "2px 5px", borderRadius: 3, border: "1px solid var(--border-subtle)" }}>⌘K</kbd>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: 4,
              background: settings.authToken ? "var(--accent)" : "var(--red)",
              boxShadow: settings.authToken ? "0 0 6px var(--accent-glow)" : "none",
            }}/>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{settings.authToken ? "API Connected" : "No Token"}</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-disabled)" }}>v2.0.0</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <header style={{
          padding: "16px 28px", borderBottom: "1px solid rgba(255,255,255,.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.06) 100%)",
          backdropFilter: "blur(44px)", WebkitBackdropFilter: "blur(44px)",
          boxShadow: "inset 0 -1px 0 rgba(255,255,255,.06), 0 4px 16px rgba(0,0,0,.18)",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--text-primary)" }}>{NAV.find(n => n.id === page)?.label}</h1>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-faint)" }}>{pageDescriptions[page]}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Monitor Start/Stop lives inside Monitor page so cutoff/seen logic applies */}
            {page === "orders" && (
              <Button onClick={refreshOrders} variant="secondary" icon="refresh">Refresh</Button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto", padding: 28 }}>
          {page === "dashboard" && <DashboardPage stats={stats} settings={settings} logs={logs} monitorActive={monitorActive} currency={settings.currency} orders={orders}/>}
          {page === "monitor" && <MonitorPage settings={settings} setSettings={setSettings} prices={prices} logs={logs} addLog={addLog} stats={stats} setStats={setStats} showToast={showToast} monitorActive={monitorActive} setMonitorActive={setMonitorActive}/>}
          {page === "analytics" && <AnalyticsPage stats={stats} orders={orders} currency={settings.currency}/>}
          {page === "orders" && <OrderHistoryPage orders={orders} showToast={showToast} currency={settings.currency}/>}
          {page === "prices" && <PricesPage prices={prices} setPrices={setPrices} showToast={showToast} currency={settings.currency} settings={settings} setSettings={setSettings}/>}
          {page === "messages" && <MessagesPage settings={settings} setSettings={setSettings} showToast={showToast}/>}
          {page === "settings" && <SettingsPage settings={settings} setSettings={setSettings} showToast={showToast}/>}
          {page === "logs" && <LogsPage logs={logs} setLogs={setLogs} showToast={showToast}/>}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNavigate={setPage} pages={NAV}/>

      {/* Toasts */}
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}
    </div>
  );
}
