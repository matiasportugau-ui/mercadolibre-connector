import crypto from "node:crypto";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { createTokenStore } from "./tokenStore.js";
import { createMercadoLibreClient, initializeClient } from "./mercadoLibreClient.js";
import apiAuth from "./middleware/apiAuth.js";
import * as webhookStore from "./webhookStore.js";
import listingsRouter from "./routes/listings.js";
import messagesRouter from "./routes/messages.js";
import shipmentsRouter from "./routes/shipments.js";
import advertisingRouter from "./routes/advertising.js";
import analyticsRouter from "./routes/analytics.js";
import aiRouter from "./routes/ai.js";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    genReqId: () => crypto.randomUUID(),
  })
);

const stateTtlMs = 10 * 60 * 1000;
const oauthStates = new Map();

const pruneExpiredOauthStates = () => {
  const now = Date.now();
  for (const [state, createdAt] of oauthStates) {
    if (now - createdAt > stateTtlMs) {
      oauthStates.delete(state);
    }
  }
};

const oauthStatePruneInterval = setInterval(pruneExpiredOauthStates, stateTtlMs);
if (typeof oauthStatePruneInterval.unref === "function") {
  oauthStatePruneInterval.unref();
}

const tokenStore = createTokenStore({
  filePath: config.tokenFile,
  encryptionKey: config.tokenEncryptionKey,
  logger,
});
const ml = createMercadoLibreClient({ config, tokenStore, logger });
initializeClient(ml);

const missingConfig = () => {
  const missing = [];
  if (!config.mlClientId) missing.push("ML_CLIENT_ID");
  if (!config.mlClientSecret) missing.push("ML_CLIENT_SECRET");
  if (!config.mlRedirectUriDev) missing.push("ML_REDIRECT_URI_DEV");
  if (config.useProdRedirect && !config.mlRedirectUriProd) {
    missing.push("ML_REDIRECT_URI_PROD");
  }
  return missing;
};

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const ensureValidState = (state) => {
  const createdAt = oauthStates.get(state);
  if (!createdAt) return false;
  const expired = Date.now() - createdAt > stateTtlMs;
  oauthStates.delete(state);
  return !expired;
};

app.get("/health", asyncHandler(async (req, res) => {
  const tokens = await ml.getStoredTokens();
  const missing = missingConfig();
  res.json({
    ok: true,
    appEnv: config.appEnv,
    hasTokens: Boolean(tokens?.access_token),
    missingConfig: missing,
  });
}));

app.get("/auth/ml/start", asyncHandler(async (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now());
  const authUrl = ml.buildAuthUrl(state);

  if (req.query.mode === "json") {
    return res.json({ authUrl, state });
  }
  return res.redirect(authUrl);
}));

app.get("/auth/ml/callback", asyncHandler(async (req, res) => {
  const { code, error, error_description: errorDescription, state } = req.query;
  if (error) {
    return res.status(400).json({
      ok: false,
      error: String(error),
      errorDescription: errorDescription ? String(errorDescription) : "",
    });
  }
  if (!code) {
    return res.status(400).json({ ok: false, error: "Missing code in callback querystring" });
  }
  if (!state || !ensureValidState(String(state))) {
    return res.status(400).json({ ok: false, error: "Invalid or expired OAuth state" });
  }

  const tokens = await ml.exchangeCodeForTokens(String(code));
  return res.json({
    ok: true,
    userId: tokens.user_id,
    scope: tokens.scope,
    expiresAt: tokens.expires_at,
  });
}));

app.get("/auth/ml/status", asyncHandler(async (req, res) => {
  const tokens = await ml.getStoredTokens();
  if (!tokens?.access_token) {
    return res.status(404).json({ ok: false, message: "No token stored yet" });
  }
  return res.json({
    ok: true,
    userId: tokens.user_id,
    scope: tokens.scope,
    updatedAt: tokens.updated_at,
    expiresAt: tokens.expires_at,
  });
}));

app.get("/ml/users/me", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: "/users/me",
  });
  res.json(payload);
}));

app.get("/ml/items/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/items/${req.params.id}`,
  });
  res.json(payload);
}));

app.get("/ml/questions", asyncHandler(async (req, res) => {
  const path = req.query.id ? `/questions/${req.query.id}` : "/questions/search";
  const payload = await ml.requestWithRetries({
    method: "GET",
    path,
    query: req.query.id ? undefined : req.query,
  });
  res.json(payload);
}));

app.get("/ml/questions/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/questions/${req.params.id}`,
  });
  res.json(payload);
}));

app.post("/ml/questions/:id/answer", asyncHandler(async (req, res) => {
  const questionId = Number(req.params.id);
  if (!Number.isFinite(questionId)) {
    return res.status(400).json({ ok: false, error: "Invalid question id" });
  }
  if (typeof req.body?.text !== "string" || req.body.text.trim() === "") {
    return res.status(400).json({ ok: false, error: "body.text must be a non-empty string" });
  }
  const payload = await ml.requestWithRetries({
    method: "POST",
    path: "/answers",
    body: {
      question_id: questionId,
      text: req.body.text,
    },
  });
  res.json(payload);
}));

app.get("/ml/orders", asyncHandler(async (req, res) => {
  const path = req.query.id ? `/orders/${req.query.id}` : "/orders/search";
  const payload = await ml.requestWithRetries({
    method: "GET",
    path,
    query: req.query.id ? undefined : req.query,
  });
  res.json(payload);
}));

app.get("/ml/orders/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/orders/${req.params.id}`,
  });
  res.json(payload);
}));

app.post("/webhooks/ml", asyncHandler(async (req, res) => {
  if (config.webhookVerifyToken) {
    const authHeader = req.headers.authorization;
    let authorizationToken = authHeader;
    if (typeof authHeader === "string") {
      const bearerPrefix = "Bearer ";
      if (authHeader.startsWith(bearerPrefix) || authHeader.startsWith(bearerPrefix.toLowerCase())) {
        authorizationToken = authHeader.slice(bearerPrefix.length).trim();
      }
    }

    const received =
      req.query.verify_token ||
      req.headers["x-webhook-token"] ||
      authorizationToken;
    if (String(received) !== String(config.webhookVerifyToken)) {
      return res.status(401).json({ ok: false, error: "Invalid webhook token" });
    }
  }

  const event = {
    body: req.body,
    query: req.query,
    headers: {
      "x-request-id": req.headers["x-request-id"],
      topic: req.headers["x-topic"],
      "x-signature": req.headers["x-signature"],
    },
  };
  
  webhookStore.append(event);
  req.log.info({ topic: event.headers.topic }, "MercadoLibre webhook received");
  res.status(200).json({ ok: true, message: "Webhook received" });
}));

if (config.appEnv === "development") {
  app.get("/webhooks/ml/events", asyncHandler(async (req, res) => {
    const n = Number(req.query.limit || 50);
    const events = webhookStore.tail(n);
    res.json({ ok: true, count: events.length, events });
  }));
}

app.use("/ml/listings", apiAuth, listingsRouter);
app.use("/ml/messages", apiAuth, messagesRouter);
app.use("/ml/shipments", apiAuth, shipmentsRouter);
app.use("/ml/ads", apiAuth, advertisingRouter);
app.use("/ml/analytics", apiAuth, analyticsRouter);
app.use("/ai", apiAuth, aiRouter);

app.use((error, req, res, _next) => {
  const status = Number(error.status || 500);
  req.log.error(
    {
      err: error,
      path: error.path,
      payload: error.payload,
    },
    "Request failed"
  );
  res.status(status).json({
    ok: false,
    error: error.message || "Unhandled server error",
    details: error.payload || null,
  });
});

app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      appEnv: config.appEnv,
      publicBaseUrl: config.publicBaseUrl,
    },
    "MercadoLibre connector server started"
  );
});
