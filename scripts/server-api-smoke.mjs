import { Readable, Writable } from "node:stream";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "jup-sh-server-api-"));
const store = join(root, "intents");
const intentId = "intent_api_smoke";
const require = createRequire(import.meta.url);
const { createServer } = require("../server.js");
const intent = {
  intentId,
  agent: "deepseek",
  payToken: "SOL",
  recipient: "api.vendor.example",
  reference: "server-api-smoke",
  settlement: {
    amount: 2,
    token: "USDC",
  },
  quote: {
    source: "mock_jupiter",
    inputToken: "SOL",
    inputAmount: 0.013333333,
    settleAmount: 2,
    settleToken: "USDC",
    priceImpactBps: 12,
    capturedAt: "2026-05-12T00:00:00.000Z",
    expiresAt: "2099-05-12T00:02:00.000Z",
  },
  status: "review_required",
  decision: "review_required",
  nextAction: "open_review",
  riskLevel: "medium",
  reasons: ["recipient is not trusted"],
  policyChecks: [
    {
      name: "verified_token",
      status: "pass",
      message: "SOL is verified",
    },
  ],
  reviewUrl: `https://www.jup.sh/pay/${intentId}`,
  reviewCommand: `npx jup-sh review ${intentId}`,
  transactionRequest: {
    requestToken: "request_smoke_token",
  },
  createdAt: "2026-05-12T00:00:00.000Z",
  expiresAt: "2099-05-12T00:15:00.000Z",
};

mkdirSync(store, { recursive: true });
writeFileSync(join(store, `${intentId}.json`), `${JSON.stringify(intent, null, 2)}\n`);

const swapCalls = [];
const server = createServer({
  intentStore: store,
  jupiterSwapUrl: "https://jupiter.test/swap",
  fetch: async (url, options) => {
    swapCalls.push({
      url: String(url),
      body: JSON.parse(options.body),
      headers: options.headers,
    });
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ swapTransaction: "base64-swap-transaction" }),
    };
  },
});

function request(path, options = {}) {
  return new Promise((resolve) => {
    const body = options.body ? JSON.stringify(options.body) : "";
    const req = Readable.from(body ? [body] : []);
    req.method = options.method ?? "GET";
    req.url = path;
    req.headers = {
      host: "127.0.0.1",
      "content-type": "application/json",
    };
    const chunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });

    res.writeHead = (status, headers) => {
      res.statusCode = status;
      res.headers = headers;
      return res;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString("utf8");
      resolve({
        response: {
          status: res.statusCode,
          headers: res.headers,
        },
        body: JSON.parse(text),
      });
    };

    server.emit("request", req, res);
  });
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}; got ${actual}`);
  }
}

try {
  const list = await request("/api/intents");
  assertEqual(list.response.status, 200, "list status");
  assertEqual(list.body.intents.length, 1, "intent list length");
  assertEqual(list.body.intents[0].intentId, intentId, "list intentId");
  assertEqual(list.body.intents[0].status, "review_required", "list status field");
  if (list.body.intents[0].quote) {
    throw new Error("intent list must return status summaries, not full intent bodies");
  }

  const show = await request(`/api/intents/${intentId}`);
  assertEqual(show.response.status, 200, "show status");
  assertEqual(show.body.intentId, intentId, "show intentId");
  assertEqual(show.body.quote.source, "mock_jupiter", "show quote source");

  const status = await request(`/api/intents/${intentId}/status`);
  assertEqual(status.response.status, 200, "status status");
  assertEqual(status.body.nextAction, "open_review", "status nextAction");
  assertEqual(status.body.expired, false, "status expired field");
  assertEqual(status.body.quoteExpired, false, "status quote expired field");
  if (status.body.quote) {
    throw new Error("status endpoint must not return quote details");
  }

  const receipt = await request(`/api/intents/${intentId}/receipt`);
  assertEqual(receipt.response.status, 200, "receipt status");
  assertEqual(receipt.body.available, false, "receipt availability");
  assertEqual(receipt.body.transactionImplemented, false, "receipt transaction flag");
  assertEqual(receipt.body.receipt, null, "receipt body");

  const missingTokenMetadata = await request(`/api/transaction-requests/${intentId}`);
  assertEqual(missingTokenMetadata.response.status, 403, "missing token metadata status");
  assertEqual(missingTokenMetadata.body.error, "invalid_request_token", "missing token metadata error");

  const transactionMetadata = await request(`/api/transaction-requests/${intentId}?request=request_smoke_token`);
  assertEqual(transactionMetadata.response.status, 200, "transaction request metadata status");
  assertEqual(transactionMetadata.body.label, "jup.sh", "transaction request label");

  const blockedPreflight = await request(`/api/transaction-requests/${intentId}/preflight`);
  assertEqual(blockedPreflight.response.status, 200, "blocked preflight status");
  assertEqual(blockedPreflight.body.status, "blocked_by_review", "blocked preflight state");
  assertEqual(blockedPreflight.body.transactionImplemented, true, "blocked preflight implementation flag");
  if (!blockedPreflight.body.endpoint.includes("request=request_smoke_token")) {
    throw new Error("preflight endpoint must include request token");
  }

  const invalidAccount = await request(`/api/transaction-requests/${intentId}?request=request_smoke_token`, {
    method: "POST",
    body: {
      account: "not-a-solana-public-key",
    },
  });
  assertEqual(invalidAccount.response.status, 400, "invalid account status");
  assertEqual(invalidAccount.body.error, "invalid_account", "invalid account error");

  const missingTokenTransaction = await request(`/api/transaction-requests/${intentId}`, {
    method: "POST",
    body: {
      account: "11111111111111111111111111111111",
    },
  });
  assertEqual(missingTokenTransaction.response.status, 403, "missing token transaction status");
  assertEqual(missingTokenTransaction.body.error, "invalid_request_token", "missing token transaction error");

  const blockedTransaction = await request(`/api/transaction-requests/${intentId}?request=request_smoke_token`, {
    method: "POST",
    body: {
      account: "11111111111111111111111111111111",
    },
  });
  assertEqual(blockedTransaction.response.status, 409, "blocked transaction status");
  assertEqual(blockedTransaction.body.error, "review_required", "blocked transaction error");

  const blockedEvents = await request(`/api/intents/${intentId}/events`);
  assertEqual(blockedEvents.response.status, 200, "blocked events status");
  assertEqual(blockedEvents.body.events.length, 1, "blocked event count");
  assertEqual(blockedEvents.body.events[0].type, "transaction_request.blocked", "blocked event type");

  const reviewed = await request(`/api/intents/${intentId}/review`, {
    method: "POST",
    body: {
      decision: "approved",
      reviewer: "server-smoke",
      reason: "known vendor",
    },
  });
  assertEqual(reviewed.response.status, 200, "review status");
  assertEqual(reviewed.body.status, "ready_for_authorization", "reviewed status field");
  assertEqual(reviewed.body.nextAction, "ready_for_authorization", "reviewed nextAction");
  assertEqual(reviewed.body.reviewDecision.decision, "approved", "review decision");
  assertEqual(reviewed.body.reviewDecision.reviewer, "server-smoke", "review reviewer");

  const reviewedStatus = await request(`/api/intents/${intentId}/status`);
  assertEqual(reviewedStatus.body.status, "ready_for_authorization", "persisted status");
  assertEqual(reviewedStatus.body.reviewDecision.decision, "approved", "persisted review decision");

  const readyPreflight = await request(`/api/transaction-requests/${intentId}/preflight`);
  assertEqual(readyPreflight.response.status, 200, "ready preflight response status");
  assertEqual(readyPreflight.body.status, "blocked_quote_not_executable", "ready preflight status");
  assertEqual(readyPreflight.body.canRequestTransaction, false, "ready preflight request flag");
  assertEqual(readyPreflight.body.transactionImplemented, true, "ready preflight implementation flag");
  assertEqual(readyPreflight.body.boundAccount, null, "ready preflight bound account");

  const readyTransaction = await request(`/api/transaction-requests/${intentId}?request=request_smoke_token`, {
    method: "POST",
    body: {
      account: "11111111111111111111111111111111",
    },
  });
  assertEqual(readyTransaction.response.status, 409, "ready transaction status");
  assertEqual(readyTransaction.body.error, "quote_not_executable", "ready transaction error");

  const boundPreflight = await request(`/api/transaction-requests/${intentId}/preflight`);
  assertEqual(boundPreflight.response.status, 200, "bound preflight response status");
  assertEqual(boundPreflight.body.boundAccount, null, "blocked executable preflight bound account");

  const executableIntentId = "intent_executable_smoke";
  const executableIntent = {
    ...intent,
    intentId: executableIntentId,
    recipientTokenAccount: "22222222222222222222222222222222",
    status: "ready_for_authorization",
    decision: "auto_pay",
    nextAction: "ready_for_authorization",
    reviewUrl: "https://www.jup.sh/pay/intent_executable_smoke",
    reviewCommand: "npx jup-sh review intent_executable_smoke",
    quote: {
      ...intent.quote,
      source: "jupiter_swap_exact_out",
      rawQuoteResponse: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inAmount: "13333333",
        outAmount: "2000000",
        swapMode: "ExactOut",
      },
    },
    transactionRequest: {
      requestToken: "request_executable_smoke",
    },
  };
  writeFileSync(
    join(store, `${executableIntentId}.json`),
    `${JSON.stringify(executableIntent, null, 2)}\n`
  );

  const executablePreflight = await request(`/api/transaction-requests/${executableIntentId}/preflight`);
  assertEqual(executablePreflight.response.status, 200, "executable preflight response status");
  assertEqual(executablePreflight.body.status, "ready", "executable preflight status");
  assertEqual(executablePreflight.body.canRequestTransaction, true, "executable preflight request flag");

  const executableTransaction = await request(
    `/api/transaction-requests/${executableIntentId}?request=request_executable_smoke`,
    {
      method: "POST",
      body: {
        account: "11111111111111111111111111111111",
      },
    }
  );
  assertEqual(executableTransaction.response.status, 200, "executable transaction status");
  assertEqual(executableTransaction.body.transaction, "base64-swap-transaction", "executable transaction body");
  assertEqual(executableTransaction.body.message, `Authorize jup.sh payment intent ${executableIntentId}.`, "transaction message");
  assertEqual(swapCalls.length, 1, "Jupiter swap call count");
  assertEqual(swapCalls[0].url, "https://jupiter.test/swap", "Jupiter swap URL");
  assertEqual(swapCalls[0].body.userPublicKey, "11111111111111111111111111111111", "Jupiter userPublicKey");
  assertEqual(swapCalls[0].body.destinationTokenAccount, "22222222222222222222222222222222", "Jupiter destination");
  assertEqual(swapCalls[0].body.quoteResponse.swapMode, "ExactOut", "Jupiter quote response");

  const executableBoundPreflight = await request(`/api/transaction-requests/${executableIntentId}/preflight`);
  assertEqual(executableBoundPreflight.response.status, 200, "executable bound preflight response status");
  assertEqual(executableBoundPreflight.body.boundAccount, "11111111111111111111111111111111", "bound account");
  if (!executableBoundPreflight.body.accountBoundAt) {
    throw new Error("bound preflight must include accountBoundAt");
  }

  const accountMismatch = await request(`/api/transaction-requests/${executableIntentId}?request=request_executable_smoke`, {
    method: "POST",
    body: {
      account: "22222222222222222222222222222222",
    },
  });
  assertEqual(accountMismatch.response.status, 409, "account mismatch status");
  assertEqual(accountMismatch.body.error, "account_mismatch", "account mismatch error");

  const readyEvents = await request(`/api/intents/${intentId}/events`);
  assertEqual(readyEvents.response.status, 200, "ready events status");
  assertEqual(readyEvents.body.events.length, 3, "ready event count");
  assertEqual(readyEvents.body.events[1].type, "review.approved", "review event type");
  assertEqual(readyEvents.body.events[2].type, "transaction_request.blocked", "quote executable event type");

  const executableEvents = await request(`/api/intents/${executableIntentId}/events`);
  assertEqual(executableEvents.response.status, 200, "executable events status");
  assertEqual(executableEvents.body.events.length, 3, "executable event count");
  assertEqual(executableEvents.body.events[0].type, "transaction_request.account_bound", "executable account bound event");
  assertEqual(executableEvents.body.events[1].type, "transaction_request.created", "executable created event");
  assertEqual(executableEvents.body.events[2].type, "transaction_request.account_mismatch", "executable mismatch event");

  const conflict = await request(`/api/intents/${intentId}/review`, {
    method: "POST",
    body: {
      decision: "rejected",
    },
  });
  assertEqual(conflict.response.status, 409, "review conflict status");
  assertEqual(conflict.body.error, "intent_not_reviewable", "review conflict error");

  const missing = await request("/api/intents/intent_missing/status");
  assertEqual(missing.response.status, 404, "missing status");
  assertEqual(missing.body.error, "intent_not_found", "missing error");

  const invalid = await request("/api/intents/bad-id/status");
  assertEqual(invalid.response.status, 400, "invalid status");
  assertEqual(invalid.body.error, "invalid_intent_id", "invalid error");

  const invalidReviewIntent = {
    ...intent,
    intentId: "intent_invalid_review",
    reviewUrl: "https://www.jup.sh/pay/intent_invalid_review",
    reviewCommand: "npx jup-sh review intent_invalid_review",
    transactionRequest: {
      requestToken: "request_invalid_review",
    },
  };
  writeFileSync(
    join(store, `${invalidReviewIntent.intentId}.json`),
    `${JSON.stringify(invalidReviewIntent, null, 2)}\n`
  );
  const invalidDecision = await request("/api/intents/intent_invalid_review/review", {
    method: "POST",
    body: {
      decision: "maybe",
    },
  });
  assertEqual(invalidDecision.response.status, 400, "invalid decision status");
  assertEqual(invalidDecision.body.error, "invalid_review_decision", "invalid decision error");

  const rejected = await request("/api/intents/intent_invalid_review/review", {
    method: "POST",
    body: {
      decision: "rejected",
      reviewer: "server-smoke",
      reason: "too risky",
    },
  });
  assertEqual(rejected.response.status, 200, "reject status");
  assertEqual(rejected.body.status, "rejected", "rejected status field");
  assertEqual(rejected.body.reviewDecision.decision, "rejected", "rejected decision");

  const rejectedEvents = await request("/api/intents/intent_invalid_review/events");
  assertEqual(rejectedEvents.body.events.length, 1, "rejected event count");
  assertEqual(rejectedEvents.body.events[0].type, "review.rejected", "rejected event type");

  const expiredIntent = {
    ...intent,
    intentId: "intent_expired_smoke",
    reviewUrl: "https://www.jup.sh/pay/intent_expired_smoke",
    reviewCommand: "npx jup-sh review intent_expired_smoke",
    transactionRequest: {
      requestToken: "request_expired_smoke",
    },
    expiresAt: "2000-01-01T00:00:00.000Z",
  };
  writeFileSync(
    join(store, `${expiredIntent.intentId}.json`),
    `${JSON.stringify(expiredIntent, null, 2)}\n`
  );
  const expiredStatus = await request("/api/intents/intent_expired_smoke/status");
  assertEqual(expiredStatus.response.status, 200, "expired status response");
  assertEqual(expiredStatus.body.expired, true, "expired status flag");

  const expiredReview = await request("/api/intents/intent_expired_smoke/review", {
    method: "POST",
    body: {
      decision: "approved",
    },
  });
  assertEqual(expiredReview.response.status, 409, "expired review response");
  assertEqual(expiredReview.body.error, "intent_expired", "expired review error");

  const expiredTransaction = await request("/api/transaction-requests/intent_expired_smoke?request=request_expired_smoke", {
    method: "POST",
    body: {
      account: "11111111111111111111111111111111",
    },
  });
  assertEqual(expiredTransaction.response.status, 409, "expired transaction response");
  assertEqual(expiredTransaction.body.error, "intent_expired", "expired transaction error");

  const staleQuoteIntent = {
    ...intent,
    intentId: "intent_stale_quote_smoke",
    status: "ready_for_authorization",
    nextAction: "ready_for_authorization",
    reviewUrl: "https://www.jup.sh/pay/intent_stale_quote_smoke",
    reviewCommand: "npx jup-sh review intent_stale_quote_smoke",
    quote: {
      ...intent.quote,
      expiresAt: "2000-01-01T00:00:00.000Z",
    },
    transactionRequest: {
      requestToken: "request_stale_quote_smoke",
    },
  };
  writeFileSync(
    join(store, `${staleQuoteIntent.intentId}.json`),
    `${JSON.stringify(staleQuoteIntent, null, 2)}\n`
  );
  const stalePreflight = await request("/api/transaction-requests/intent_stale_quote_smoke/preflight");
  assertEqual(stalePreflight.response.status, 200, "stale preflight response");
  assertEqual(stalePreflight.body.status, "blocked_quote_expired", "stale preflight status");

  const staleTransaction = await request("/api/transaction-requests/intent_stale_quote_smoke?request=request_stale_quote_smoke", {
    method: "POST",
    body: {
      account: "11111111111111111111111111111111",
    },
  });
  assertEqual(staleTransaction.response.status, 409, "stale transaction response");
  assertEqual(staleTransaction.body.error, "quote_expired", "stale transaction error");

  console.log("server api smoke: ok");
} finally {
  rmSync(root, { recursive: true, force: true });
}
