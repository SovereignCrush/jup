const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const intentStore = process.env.JUP_SH_INTENT_STORE || path.join(root, ".jup-sh", "intents");
const defaultJupiterSwapUrl = "https://api.jup.ag/swap/v1/swap";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal server error");
      return;
    }

    const type = types[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  });
}

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(value, null, 2)}\n`);
}

function sendApiError(res, status, error, message) {
  sendJson(res, status, { error, message });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(text));
      } catch {
        const error = new Error("request body must be valid JSON");
        error.status = 400;
        error.code = "invalid_json";
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function isIntentId(value) {
  return /^intent_[a-zA-Z0-9_]+$/.test(value);
}

function intentPath(store, intentId) {
  return path.resolve(store, `${intentId}.json`);
}

function isInsidePath(base, target) {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readIntent(store, intentId) {
  if (!isIntentId(intentId)) {
    const error = new Error("invalid intent id");
    error.status = 400;
    error.code = "invalid_intent_id";
    throw error;
  }

  const filePath = intentPath(store, intentId);
  if (!isInsidePath(store, filePath)) {
    const error = new Error("invalid intent path");
    error.status = 400;
    error.code = "invalid_intent_id";
    throw error;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error("intent not found");
      notFound.status = 404;
      notFound.code = "intent_not_found";
      throw notFound;
    }
    throw error;
  }
}

function writeIntent(store, intent) {
  const filePath = intentPath(store, intent.intentId);
  if (!isInsidePath(store, filePath)) {
    const error = new Error("invalid intent path");
    error.status = 400;
    error.code = "invalid_intent_id";
    throw error;
  }

  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(intent, null, 2)}\n`);
}

function listIntents(store) {
  if (!fs.existsSync(store)) return [];

  return fs
    .readdirSync(store)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(store, file), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function intentStatus(intent) {
  return {
    intentId: intent.intentId,
    status: intent.status,
    decision: intent.decision,
    nextAction: intent.nextAction,
    riskLevel: intent.riskLevel,
    reviewUrl: intent.reviewUrl,
    reviewCommand: intent.reviewCommand,
    reviewDecision: intent.reviewDecision ?? null,
    eventCount: Array.isArray(intent.events) ? intent.events.length : 0,
    quoteExpiresAt: intent.quote?.expiresAt ?? null,
    quoteExpired: isQuoteExpired(intent),
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt ?? null,
    expired: isIntentExpired(intent),
  };
}

function intentEvents(intent) {
  return {
    intentId: intent.intentId,
    events: Array.isArray(intent.events) ? intent.events : [],
  };
}

function intentReceipt(intent) {
  if (intent.receipt) {
    return {
      intentId: intent.intentId,
      available: true,
      status: intent.receipt.status ?? "available",
      transactionImplemented: true,
      receipt: intent.receipt,
    };
  }

  return {
    intentId: intent.intentId,
    available: false,
    status: "not_available",
    transactionImplemented: false,
    reason: "No confirmed settlement has been observed for this intent.",
    receipt: null,
  };
}

function appendIntentEvent(intent, event) {
  return {
    ...intent,
    events: [
      ...(Array.isArray(intent.events) ? intent.events : []),
      {
        at: event.at ?? new Date().toISOString(),
        ...event,
      },
    ],
  };
}

function normalizeReviewDecision(value) {
  if (value === "approved" || value === "rejected") return value;

  const error = new Error("review decision must be approved or rejected");
  error.status = 400;
  error.code = "invalid_review_decision";
  throw error;
}

function applyReviewDecision(intent, body) {
  if (isIntentExpired(intent)) {
    const error = new Error("intent is expired");
    error.status = 409;
    error.code = "intent_expired";
    throw error;
  }

  if (intent.status !== "review_required" || intent.nextAction !== "open_review") {
    const error = new Error("intent is not waiting for review");
    error.status = 409;
    error.code = "intent_not_reviewable";
    throw error;
  }

  const decision = normalizeReviewDecision(body.decision);
  const reviewedAt = new Date().toISOString();
  const reviewDecision = {
    decision,
    reviewer: typeof body.reviewer === "string" && body.reviewer.trim() ? body.reviewer.trim() : "local",
    reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
    reviewedAt,
  };

  const updated = {
    ...intent,
    status: decision === "approved" ? "ready_for_authorization" : "rejected",
    nextAction: decision === "approved" ? "ready_for_authorization" : "rejected",
    reviewDecision,
    updatedAt: reviewedAt,
  };

  return appendIntentEvent(updated, {
    type: decision === "approved" ? "review.approved" : "review.rejected",
    at: reviewedAt,
    reviewer: reviewDecision.reviewer,
    reason: reviewDecision.reason,
  });
}

function isSolanaPublicKey(value) {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function previewAccount(account) {
  if (typeof account !== "string" || account.length <= 8) return account;
  return `${account.slice(0, 4)}...${account.slice(-4)}`;
}

function transactionRequestErrorForIntent(intent) {
  if (isIntentExpired(intent)) {
    return {
      status: 409,
      error: "intent_expired",
      message: "Expired intents cannot create transaction requests.",
    };
  }

  if (intent.status === "review_required" || intent.nextAction === "open_review") {
    return {
      status: 409,
      error: "review_required",
      message: "Intent must be approved before transaction creation.",
    };
  }

  if (intent.status === "rejected" || intent.nextAction === "rejected") {
    return {
      status: 409,
      error: "intent_rejected",
      message: "Rejected intents cannot create transaction requests.",
    };
  }

  if (intent.status !== "ready_for_authorization" || intent.nextAction !== "ready_for_authorization") {
    return {
      status: 409,
      error: "intent_not_ready",
      message: "Intent is not ready for authorization.",
    };
  }

  if (isQuoteExpired(intent)) {
    return {
      status: 409,
      error: "quote_expired",
      message: "Quote is expired and must be refreshed before transaction creation.",
    };
  }

  return null;
}

function transactionRequestExecutionErrorForIntent(intent) {
  if (!intent.quote || typeof intent.quote.rawQuoteResponse !== "object" || intent.quote.rawQuoteResponse === null) {
    return {
      status: 409,
      error: "quote_not_executable",
      message: "Intent must be created with a Jupiter executable quote before transaction creation.",
    };
  }

  if (!isSolanaPublicKey(intent.recipientTokenAccount)) {
    return {
      status: 409,
      error: "missing_recipient_token_account",
      message: "Intent must include a recipient token account before transaction creation.",
    };
  }

  return null;
}

function statusForTransactionGate(gate) {
  if (gate.error === "review_required") return "blocked_by_review";
  if (gate.error === "intent_rejected") return "blocked_rejected";
  if (gate.error === "quote_expired") return "blocked_quote_expired";
  if (gate.error === "quote_not_executable") return "blocked_quote_not_executable";
  if (gate.error === "missing_recipient_token_account") return "blocked_missing_recipient_token_account";
  return "blocked_not_ready";
}

function isIntentExpired(intent, now = new Date()) {
  return typeof intent.expiresAt === "string" && Date.parse(intent.expiresAt) <= now.getTime();
}

function isQuoteExpired(intent, now = new Date()) {
  return typeof intent.quote?.expiresAt === "string" && Date.parse(intent.quote.expiresAt) <= now.getTime();
}

function transactionRequestPreflight(intent, origin) {
  const endpointUrl = new URL(`${origin.replace(/\/+$/, "")}/api/transaction-requests/${intent.intentId}`);
  if (intent.transactionRequest?.requestToken) {
    endpointUrl.searchParams.set("request", intent.transactionRequest.requestToken);
  }
  const endpoint = endpointUrl.toString();
  const base = {
    intentId: intent.intentId,
    kind: "solana_pay_transaction_request",
    endpoint,
    url: `solana:${endpoint}`,
    method: "GET_POST",
    transactionImplemented: true,
    boundAccount: intent.transactionRequest?.account ?? null,
    accountBoundAt: intent.transactionRequest?.accountBoundAt ?? null,
  };
  const gate = transactionRequestErrorForIntent(intent);

  if (gate) {
    return {
      ...base,
      status: statusForTransactionGate(gate),
      canRequestTransaction: false,
      reason: gate.message,
    };
  }

  const executionGate = transactionRequestExecutionErrorForIntent(intent);
  if (executionGate) {
    return {
      ...base,
      status: statusForTransactionGate(executionGate),
      canRequestTransaction: false,
      reason: executionGate.message,
    };
  }

  return {
    ...base,
    status: "ready",
    canRequestTransaction: true,
    reason: "Ready to request a Jupiter swap transaction for wallet signing.",
  };
}

function validateTransactionRequestToken(intent, url) {
  const expected = intent.transactionRequest?.requestToken;
  if (!expected) return null;

  const actual = url.searchParams.get("request");
  if (actual === expected) return null;

  return {
    status: 403,
    error: "invalid_request_token",
    message: "Transaction request token is missing or invalid.",
  };
}

function handleTransactionRequestGet(res) {
  sendJson(res, 200, {
    label: "jup.sh",
    icon: "https://www.jup.sh/favicon.svg",
  });
}

async function buildJupiterSwapTransaction(context, intent, account) {
  const fetchImpl = context.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    const error = new Error("fetch is not available for Jupiter swap transaction creation.");
    error.status = 500;
    error.code = "fetch_unavailable";
    throw error;
  }

  const response = await fetchImpl(context.jupiterSwapUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(context.jupiterApiKey ? { "x-api-key": context.jupiterApiKey } : {}),
    },
    body: JSON.stringify({
      quoteResponse: intent.quote.rawQuoteResponse,
      userPublicKey: account,
      destinationTokenAccount: intent.recipientTokenAccount,
    }),
  });

  const text = await response.text();
  let responseBody = null;
  if (text.trim()) {
    try {
      responseBody = JSON.parse(text);
    } catch {
      responseBody = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(
      responseBody?.error || responseBody?.message || `Jupiter swap failed: ${response.status} ${response.statusText}`
    );
    error.status = 502;
    error.code = "jupiter_swap_failed";
    error.jupiterStatus = response.status;
    throw error;
  }

  if (typeof responseBody?.swapTransaction !== "string" || responseBody.swapTransaction.length === 0) {
    const error = new Error("Jupiter swap response did not include swapTransaction.");
    error.status = 502;
    error.code = "jupiter_swap_missing_transaction";
    throw error;
  }

  return {
    transaction: responseBody.swapTransaction,
    source: "jupiter_swap",
  };
}

async function handleTransactionRequestPost(req, res, context, intentId, url) {
  const body = await readJsonBody(req);
  if (!isSolanaPublicKey(body.account)) {
    sendApiError(res, 400, "invalid_account", "account must be a Solana public key.");
    return true;
  }

  const store = context.store;
  const intent = readIntent(store, intentId);
  const tokenGate = validateTransactionRequestToken(intent, url);
  if (tokenGate) {
    sendApiError(res, tokenGate.status, tokenGate.error, tokenGate.message);
    return true;
  }

  const gate = transactionRequestErrorForIntent(intent);
  if (gate) {
    writeIntent(
      store,
      appendIntentEvent(intent, {
        type: "transaction_request.blocked",
        account: previewAccount(body.account),
        reason: gate.error,
      })
    );
    sendApiError(res, gate.status, gate.error, gate.message);
    return true;
  }

  const executionGate = transactionRequestExecutionErrorForIntent(intent);
  if (executionGate) {
    writeIntent(
      store,
      appendIntentEvent(intent, {
        type: "transaction_request.blocked",
        account: previewAccount(body.account),
        reason: executionGate.error,
      })
    );
    sendApiError(res, executionGate.status, executionGate.error, executionGate.message);
    return true;
  }

  const existingAccount = intent.transactionRequest?.account;
  if (existingAccount && existingAccount !== body.account) {
    writeIntent(
      store,
      appendIntentEvent(intent, {
        type: "transaction_request.account_mismatch",
        account: previewAccount(body.account),
        boundAccount: previewAccount(existingAccount),
      })
    );
    sendApiError(res, 409, "account_mismatch", "Transaction request is already bound to a different account.");
    return true;
  }

  const accountBoundAt = intent.transactionRequest?.accountBoundAt ?? new Date().toISOString();
  const accountBoundIntent = {
    ...intent,
    transactionRequest: {
      ...(intent.transactionRequest ?? {}),
      account: body.account,
      accountBoundAt,
    },
    updatedAt: accountBoundAt,
  };
  const accountBoundEventIntent = existingAccount
    ? accountBoundIntent
    : appendIntentEvent(accountBoundIntent, {
        type: "transaction_request.account_bound",
        at: accountBoundAt,
        account: previewAccount(body.account),
      });

  try {
    const swap = await buildJupiterSwapTransaction(context, accountBoundIntent, body.account);
    const transactionCreatedAt = new Date().toISOString();
    const transactionIntent = appendIntentEvent(
      {
        ...accountBoundEventIntent,
        transactionRequest: {
          ...(accountBoundEventIntent.transactionRequest ?? {}),
          status: "transaction_created",
          transactionSource: swap.source,
          transactionCreatedAt,
        },
        updatedAt: transactionCreatedAt,
      },
      {
        type: "transaction_request.created",
        at: transactionCreatedAt,
        account: previewAccount(body.account),
        source: swap.source,
      }
    );

    writeIntent(store, transactionIntent);
    sendJson(res, 200, {
      transaction: swap.transaction,
      message: `Authorize jup.sh payment intent ${intent.intentId}.`,
    });
  } catch (error) {
    writeIntent(
      store,
      appendIntentEvent(accountBoundEventIntent, {
        type: "transaction_request.failed",
        account: previewAccount(body.account),
        reason: error.code || "jupiter_swap_failed",
      })
    );
    sendApiError(
      res,
      error.status || 502,
      error.code || "jupiter_swap_failed",
      error.status ? error.message : "Jupiter swap transaction creation failed."
    );
  }
  return true;
}

// Local alpha API:
// GET /api/intents
// GET /api/intents/:intentId
// GET /api/intents/:intentId/status
// GET /api/intents/:intentId/events
// GET /api/intents/:intentId/receipt
// POST /api/intents/:intentId/review
// GET /api/transaction-requests/:intentId
// POST /api/transaction-requests/:intentId
// GET /api/transaction-requests/:intentId/preflight
async function handleApi(req, res, url, context) {
  const store = context.store;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return false;
  if (parts[1] === "transaction-requests") {
    try {
      if (req.method === "GET" && parts.length === 4 && parts[3] === "preflight") {
        const intent = readIntent(store, parts[2]);
        sendJson(res, 200, transactionRequestPreflight(intent, url.origin));
        return true;
      }

      if (req.method === "GET" && parts.length === 3) {
        if (!isIntentId(parts[2])) {
          sendApiError(res, 400, "invalid_intent_id", "invalid intent id");
          return true;
        }
        const intent = readIntent(store, parts[2]);
        const tokenGate = validateTransactionRequestToken(intent, url);
        if (tokenGate) {
          sendApiError(res, tokenGate.status, tokenGate.error, tokenGate.message);
          return true;
        }
        handleTransactionRequestGet(res);
        return true;
      }

      if (req.method === "POST" && parts.length === 3) {
        await handleTransactionRequestPost(req, res, context, parts[2], url);
        return true;
      }

      sendApiError(res, 404, "not_found", "API route not found.");
      return true;
    } catch (error) {
      sendApiError(
        res,
        error.status || 500,
        error.code || "internal_error",
        error.status ? error.message : "Internal server error"
      );
      return true;
    }
  }
  if (parts[1] !== "intents") {
    sendApiError(res, 404, "not_found", "API route not found.");
    return true;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    sendApiError(res, 405, "method_not_allowed", "Only GET and POST are supported by the local alpha API.");
    return true;
  }

  try {
    if (req.method === "POST") {
      if (parts.length === 4 && parts[3] === "review") {
        const intent = readIntent(store, parts[2]);
        const body = await readJsonBody(req);
        const updated = applyReviewDecision(intent, body);
        writeIntent(store, updated);
        sendJson(res, 200, intentStatus(updated));
        return true;
      }

      sendApiError(res, 404, "not_found", "API route not found.");
      return true;
    }

    if (parts.length === 2) {
      sendJson(res, 200, { intents: listIntents(store).map(intentStatus) });
      return true;
    }

    const intent = readIntent(store, parts[2]);
    if (parts.length === 3) {
      sendJson(res, 200, intent);
      return true;
    }

    if (parts.length === 4 && parts[3] === "status") {
      sendJson(res, 200, intentStatus(intent));
      return true;
    }

    if (parts.length === 4 && parts[3] === "events") {
      sendJson(res, 200, intentEvents(intent));
      return true;
    }

    if (parts.length === 4 && parts[3] === "receipt") {
      sendJson(res, 200, intentReceipt(intent));
      return true;
    }

    sendApiError(res, 404, "not_found", "API route not found.");
    return true;
  } catch (error) {
    sendApiError(
      res,
      error.status || 500,
      error.code || "internal_error",
      error.status ? error.message : "Internal server error"
    );
    return true;
  }
}

function createServer(options = {}) {
  const effectiveIntentStore = options.intentStore || intentStore;
  const context = {
    store: effectiveIntentStore,
    fetch: options.fetch,
    jupiterSwapUrl: options.jupiterSwapUrl || process.env.JUPITER_SWAP_URL || defaultJupiterSwapUrl,
    jupiterApiKey: options.jupiterApiKey || process.env.JUPITER_API_KEY || null,
  };

  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    handleApi(req, res, url, context).then((handled) => {
      if (handled) return;

      const requested = path.normalize(decodeURIComponent(url.pathname));
      const filePath = path.join(root, requested === "/" ? "index.html" : requested);

      if (!isInsidePath(root, filePath)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      fs.stat(filePath, (error, stat) => {
        if (!error && stat.isFile()) {
          sendFile(res, filePath);
          return;
        }

        sendFile(res, path.join(root, "index.html"));
      });
    }).catch(() => {
      sendApiError(res, 500, "internal_error", "Internal server error");
    });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(port, () => {
    console.log(`jup.sh prototype running at http://localhost:${port}`);
  });
}

module.exports = {
  createServer,
  intentStatus,
};
