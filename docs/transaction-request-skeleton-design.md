---
title: Transaction Request Skeleton Design
description: Planned Solana Pay transaction request boundary for jup.sh.
---

# Transaction Request Skeleton Design

This page defines the next settlement boundary after quote-only intents:
a Solana Pay transaction request skeleton.

The word **skeleton** is intentional. The current alpha can create a local
payment intent, run policy, attach quote evidence, and export Risk Review
context. It still does not create a transaction, ask a wallet to sign, execute a
swap, or move funds.

The skeleton documents the shape that future transaction request support should
use once policy, quote behavior, and review handoff are stable enough to place a
wallet at the end of the flow.

## Why A Skeleton

Solana Pay transaction requests add a wallet-facing HTTP boundary. That is a
different risk surface from a local intent JSON object.

The current system is safe because it stops at:

```txt
intent -> policy -> quote -> review or ready_for_authorization
```

The future transaction request path adds:

```txt
intent -> policy -> quote -> review or ready_for_authorization -> transaction request -> wallet
```

Documenting the skeleton before implementation keeps four contracts explicit:

- the agent still receives a deterministic CLI result;
- the wallet receives a standard Solana Pay transaction request;
- the server composes the transaction only after policy checks pass;
- signing stays with the user's wallet, not with the agent or CLI.

## Protocol Shape

Solana Pay transaction requests use an interactive URL:

```txt
solana:<absolute-https-endpoint>
```

The wallet talks to that endpoint in two steps:

| Step | Method | Purpose |
| --- | --- | --- |
| 1 | `GET` | Fetch display metadata such as label and icon. |
| 2 | `POST` | Send the signing account and receive a transaction to sign. |

Reference:
[Solana Pay Specification v1.1](https://launch.solana.com/docs/solana-pay/specification/version1.1).

## Planned jup.sh Endpoint Shape

The future hosted endpoint should be scoped to one reviewed or
ready-for-authorization intent:

```txt
GET  /api/transaction-requests/:intentId
POST /api/transaction-requests/:intentId
```

The endpoint may also include an opaque request token:

```txt
GET  /api/transaction-requests/:intentId?request=<opaque_token>
POST /api/transaction-requests/:intentId?request=<opaque_token>
```

The token should identify the server-side request context without exposing
private policy data, wallet details, or raw route internals in the URL.

Current draft runtime builds generate a local opaque `requestToken` for new
intents and require it on transaction request metadata and POST paths. This is
a replay-control scaffold, not a production authentication layer.

## GET Shape

The wallet should be able to call:

```http
GET /api/transaction-requests/intent_abc123 HTTP/1.1
Accept: application/json
```

Planned response:

```json
{
  "label": "jup.sh",
  "icon": "https://www.jup.sh/favicon.svg"
}
```

The GET response is display metadata. It should not identify the wallet or the
user, and it should not be treated as authorization. Any user-specific or
account-specific validation belongs in POST.

## POST Shape

The wallet should POST the account that may sign the transaction:

```http
POST /api/transaction-requests/intent_abc123 HTTP/1.1
Content-Type: application/json

{
  "account": "Base58WalletPublicKey"
}
```

Planned success response:

```json
{
  "transaction": "base64-encoded-serialized-transaction",
  "message": "jup.sh payment intent intent_abc123"
}
```

The POST handler should:

1. Validate `account` as a Solana public key.
2. Load the server-side intent.
3. Confirm the intent is still valid and not expired.
4. Re-run or verify policy and quote evidence.
5. Refuse rejected or still-unreviewed intents.
6. Build a transaction that settles the requested amount in USDC.
7. Return only a transaction for the requesting account to inspect and sign.

Error responses should be ordinary HTTP errors with JSON bodies:

```json
{
  "error": "review_required",
  "message": "Intent must be reviewed before transaction creation."
}
```

## CLI Output Shape

The current alpha CLI does not output transaction request fields.

Draft runtime builds expose the endpoint shape, but the POST path still returns
`transaction_not_implemented` after validation. That keeps the protocol boundary
testable without pretending that transaction construction exists.

Today, `pay --json` ends at:

```json
{
  "intentId": "intent_abc123",
  "decision": "review_required",
  "nextAction": "open_review",
  "reviewUrl": "https://www.jup.sh/pay/intent_abc123#intent=...",
  "reviewCommand": "npx jup-sh review intent_abc123"
}
```

Future transaction request support should add an explicit nested field instead
of overloading `reviewUrl`:

```json
{
  "intentId": "intent_abc123",
  "decision": "auto_pay",
  "nextAction": "ready_for_authorization",
  "transactionRequest": {
    "kind": "solana_pay_transaction_request",
    "status": "available",
    "url": "solana:https://www.jup.sh/api/transaction-requests/intent_abc123?request=...",
    "endpoint": "https://www.jup.sh/api/transaction-requests/intent_abc123?request=...",
    "method": "GET_POST",
    "expiresAt": "2026-05-12T00:15:00Z"
  }
}
```

For review-required intents, the field should be absent or explicitly
unavailable:

```json
{
  "intentId": "intent_abc123",
  "decision": "review_required",
  "nextAction": "open_review",
  "transactionRequest": {
    "kind": "solana_pay_transaction_request",
    "status": "blocked_by_review"
  }
}
```

Agents must continue to branch on `nextAction`. They must not treat the
presence of a transaction request URL as proof that funds moved.

## Safety Boundary

The transaction request endpoint must preserve the alpha safety model:

- no private keys in the CLI, SDK, URL, request body, response body, or server
  logs;
- no transaction creation for rejected intents;
- no transaction creation for review-required intents before review approval;
- no client-supplied amount, recipient, settlement token, or route accepted as
  authoritative;
- no HTTP endpoints without HTTPS in production;
- no long-lived transaction request URLs;
- no reusable request tokens after expiration or completion;
- no signing by jup.sh;
- no claim of payment completion until the signed transaction is confirmed and
  validated on-chain.

The wallet must still display and validate the transaction as untrusted input.
The endpoint composes a transaction; it does not authorize the transaction.

## Non-Goals

This skeleton does not implement:

- Solana transaction construction;
- Jupiter swap transaction generation;
- wallet signing;
- transaction submission;
- remote durable intent storage;
- authentication;
- payment confirmation or fulfillment logic.

## Implementation Gate

Transaction request work should start only after these contracts are stable:

1. CLI JSON output and exit codes.
2. Local and hosted Risk Review handoff.
3. Quote-aware policy checks.
4. Intent persistence model for server-side request lookup.
5. Expiry, replay protection, and validation rules for request tokens.
