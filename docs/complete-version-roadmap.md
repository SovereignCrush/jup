---
title: Complete Version Roadmap
description: Remaining work from the current jup.sh alpha to a complete payment version.
---

# Complete Version Roadmap

`jup.sh` is currently a quote-only, review-only alpha. A complete version needs
to carry the same product line all the way through authorization, settlement,
confirmation, and receipt.

The target path is:

```txt
agent intent
-> policy decision
-> Jupiter quote
-> Risk Review when required
-> transaction request
-> wallet authorization
-> submit and confirm
-> status and receipt
```

The important rule is continuity: each phase should preserve the alpha safety
model instead of skipping around it.

## Already Shipped

The current published checkpoint is `v0.1.0-alpha.7`.

It already includes:

- public npm alpha CLI;
- local workspace initialization and diagnostics;
- local policy configuration;
- trusted recipient management;
- local payment intent creation;
- mock and optional Jupiter quote-only estimates;
- quote-aware risk checks;
- local intent persistence;
- CLI JSON and exit code contract;
- Risk Review URL export and hosted static rendering;
- source-only SDK risk helpers;
- review handoff fields in `pay --json` and `review --json`.

The draft alpha.8 documentation adds the planned transaction request skeleton,
but does not add runtime transaction generation.

## Missing For A Complete Version

### 1. Intent API And Durable State

The current intent store is local. A complete payment version needs a durable
intent API with explicit state transitions:

```txt
created -> quoted -> policy_checked -> review_required
created -> quoted -> policy_checked -> ready_for_authorization
review_required -> approved | rejected
approved -> transaction_requested -> submitted -> confirmed | failed
```

This layer should own expiry, replay protection, idempotency, and audit trails.

### 2. Review Decision Persistence

The current Risk Review page renders static data. It needs an API-backed review
decision model before it can safely influence payment execution.

Required behavior:

- approving a review changes server-side intent state;
- rejecting a review blocks future transaction request generation;
- the review action records actor, timestamp, reason, and policy evidence;
- stale review links expire cleanly.

### 3. Transaction Request Runtime

The next wallet boundary should implement the documented
[Transaction Request Skeleton Design](transaction-request-skeleton-design.md).

The first runtime step should expose the GET and POST shape without pretending
funds moved:

```txt
GET  /api/transaction-requests/:intentId
POST /api/transaction-requests/:intentId
```

The endpoint should only produce a transaction after the intent is still valid,
policy still allows it, review state permits it, and the route is fresh enough.

### 4. Jupiter Swap Transaction Path

The current Jupiter integration is quote-only. A complete version needs a
guarded transaction path:

- refresh quote close to authorization time;
- enforce settlement token and recipient constraints;
- cap slippage and price impact;
- build the swap or payment transaction;
- simulate before handoff when possible;
- fail closed when route assumptions change.

This should start on devnet or behind an explicit experimental flag before it
is treated as a real payment path.

### 5. Wallet Authorization Boundary

`jup.sh` should not custody keys. The complete version needs a clean wallet
handoff where the wallet signs the transaction and the user can inspect what is
being authorized.

The product should keep saying exactly what happened:

- intent approved means policy/review allowed authorization;
- wallet signed means the payer authorized a transaction;
- confirmed means the network accepted the settlement;
- receipt means jup.sh observed the final status.

### 6. Submission, Confirmation, And Receipt

After signing, the system needs status tracking:

- transaction signature capture;
- confirmation polling;
- failure classification;
- retry/idempotency behavior;
- receipt object with intent id, recipient, settlement amount, token route,
  quote evidence, policy evidence, transaction signature, and confirmation
  status.

Receipts are the first point where the product can honestly say the payment
settled.

## Recommended Sequence

The practical sequence from the current alpha is:

| Checkpoint | Goal | Runtime boundary |
| --- | --- | --- |
| alpha.8 | Transaction request skeleton | Documentation only |
| alpha.9 | Intent API and status model | Durable intent state |
| alpha.10 | Review decision persistence | Approve/reject writes state |
| alpha.11 | Transaction request runtime gate | GET/POST endpoint without transaction construction |
| alpha.12 | Transaction request preflight | Inspectable gate before transaction construction |
| beta.0 | Wallet signing and receipt | End-to-end payment with confirmation |

Each checkpoint should keep the CLI JSON contract compatible where possible.
New fields should be additive and nested, especially for transaction request,
status, and receipt data.

## Definition Of Complete

The complete version is ready when this path works end to end:

1. An agent creates a payment intent.
2. Policy evaluates token, amount, recipient, route, and configured limits.
3. Clean intents can continue to authorization.
4. Flagged intents require persisted human review.
5. The transaction request endpoint only serves authorized, fresh intents.
6. The wallet signs; jup.sh never holds private keys.
7. The transaction is submitted and confirmed.
8. The recipient settlement and payment receipt are observable.

Until all eight are true, the product should keep describing itself as an
alpha, not a complete payment system.
