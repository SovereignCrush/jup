---
title: Architecture
description: Technical architecture and design diagrams for jup.sh.
---

# Architecture

`jup.sh` is a risk and settlement layer for Solana agent payments.

The design goal is narrow: an agent can create a payment intent, but policy
decides whether that intent can continue automatically, must be reviewed by a
human, or should be rejected. Jupiter is used for token-to-USDC settlement. The
current 1.0 release can build Jupiter swap transactions and execute them from
the user's machine with an explicit local keypair.

## Product Boundary

The most important boundary is between **intent creation** and **funds
authorization**.

Agents can request a payment. They do not directly control private keys, sign
transactions, or bypass policy. The user or local wallet remains the signing
boundary.

```mermaid
flowchart LR
  Agent["AI agent<br/>creates payment intent"]
  Policy["jup.sh policy layer<br/>risk + limits + route checks"]
  Decision{"decision"}
  Auto["auto-pay candidate<br/>inside policy"]
  Review["Risk Review<br/>human approval required"]
  Reject["rejected<br/>hard policy failure"]
  Wallet["local wallet / signer<br/>authorization boundary"]

  Agent --> Policy --> Decision
  Decision -->|"low risk"| Auto --> Wallet
  Decision -->|"needs context"| Review --> Wallet
  Decision -->|"unsafe / unsupported"| Reject
```

This boundary keeps the product from becoming "an agent wallet." `jup.sh`
should be a payment control layer: it receives structured intent, adds policy
and settlement context, then returns a deterministic next action.

## Layered Architecture

The system is split into five layers. The current release implements the CLI,
core policy engine, quote abstraction, local intent store, static Risk Review
rendering, Solana Pay transaction requests, and local CLI execution.

```mermaid
flowchart TB
  subgraph Interface["Interface layer"]
    CLI["CLI<br/>npm + source-run"]
    SDK["SDK<br/>source-only"]
    ReviewUI["Risk Review UI<br/>hosted static page"]
  end

  subgraph Core["Core payment layer"]
    Intent["intent model"]
    Policy["policy engine"]
    Quote["quote provider abstraction"]
    Result["JSON contract + exit code"]
  end

  subgraph Settlement["Settlement layer"]
    Jupiter["Jupiter API<br/>quote + swap"]
    TxRequest["Solana Pay transaction request"]
  end

  subgraph State["State layer"]
    LocalStore["local intent store<br/>.jup-sh/intents"]
    RemoteStore["remote persistence<br/>planned"]
  end

  subgraph Authorization["Authorization layer"]
    Wallet["local wallet / signer"]
    Solana["Solana network"]
  end

  CLI --> Intent
  SDK -. planned .-> Intent
  Intent --> Policy --> Quote --> Result
  Quote --> Jupiter
  Result --> LocalStore
  Result --> ReviewUI
  Result --> TxRequest
  TxRequest --> Wallet --> Solana
  RemoteStore -. planned .-> ReviewUI
```

This structure lets the CLI and SDK share the same core behavior. The interface
may change, but the policy result, JSON contract, and settlement assumptions
should remain stable.

## Current Runtime Flow

The CLI flow is local and available through `npx jup-sh`. It is useful
because it validates the contract an agent would actually consume: command
input, structured output, exit codes, policy checks, and a review URL when
needed.

```mermaid
sequenceDiagram
  autonumber
  participant Agent as AI agent / script
  participant CLI as jup.sh CLI
  participant Core as jup_sh_core
  participant Policy as policy engine
  participant Quote as quote provider
  participant Store as local intent store
  participant Review as Risk Review page

  Agent->>CLI: pay --agent deepseek --token SOL --amount 20 --settle USDC --json
  CLI->>Core: build PaymentIntent
  Core->>Policy: validate token, amount, settlement, recipient
  Core->>Quote: get mock or Jupiter quote
  Quote-->>Core: route estimate + price impact
  Core->>Policy: run quote-aware checks
  Policy-->>Core: auto_pay / review_required / rejected
  Core->>Store: persist intent JSON
  Core-->>CLI: structured result
  CLI-->>Agent: JSON + exit code
  CLI-->>Review: review URL when policy requires it
```

The server transaction request path creates an unsigned Jupiter swap
transaction for wallet signing. The CLI execution path signs and submits only
when the user provides a local keypair.

## Policy Decision Model

Policy is not a single boolean. It should produce one of three decisions:

- `auto_pay`: intent is inside policy and can proceed to local authorization.
- `review_required`: intent is valid, but risk context requires a human.
- `rejected`: intent violates a hard rule and should not continue.

```mermaid
stateDiagram-v2
  [*] --> IntentCreated
  IntentCreated --> Rejected: unverified token<br/>unsupported settlement<br/>over max amount
  IntentCreated --> QuoteRequested: structurally valid intent
  QuoteRequested --> Rejected: quote unavailable<br/>wrong settlement token
  QuoteRequested --> ReviewRequired: untrusted recipient<br/>over auto-pay limit<br/>high price impact
  QuoteRequested --> ReadyForAuthorization: trusted recipient<br/>inside limits<br/>acceptable route
  ReadyForAuthorization --> [*]: exit 0
  ReviewRequired --> [*]: exit 2
  Rejected --> [*]: exit 1
```

This is the core product hook. `jup.sh` becomes more valuable as the policy
layer gets richer: recipient trust, route quality, token verification,
behavioral limits, and eventually business-specific rules.

## Data Model

The current data model is intentionally small. It should remain explicit,
because agents and scripts need predictable fields.

```mermaid
erDiagram
  PAYMENT_INTENT ||--|| SETTLEMENT : requests
  PAYMENT_INTENT ||--o| QUOTE : receives
  PAYMENT_INTENT ||--o{ POLICY_CHECK : evaluates
  PAYMENT_INTENT ||--o| REVIEW : exports

  PAYMENT_INTENT {
    string intentId
    string agent
    string payToken
    string recipient
    string status
    string decision
    string nextAction
    string riskLevel
    datetime createdAt
  }

  SETTLEMENT {
    float amount
    string token
  }

  QUOTE {
    string source
    string inputToken
    float inputAmount
    float settleAmount
    string settleToken
    int priceImpactBps
  }

  POLICY_CHECK {
    string name
    string status
    string message
  }

  REVIEW {
    string reviewUrl
    string exportedPayload
  }
```

The important design choice is that policy evidence is returned with the
decision. A caller should not receive only `review_required`; it should receive
the reasons and checks that made review necessary.

## Settlement Direction

Jupiter is the settlement primitive. The payer should be able to use any
verified token; the recipient should receive USDC.

The CLI can ask Jupiter for ExactOut route quotes and preserve that quote
response for transaction creation. The same route context is used to build a
Solana Pay transaction request or a local CLI execution transaction.

The wallet-facing boundary is documented in
[Transaction Request Skeleton Design](transaction-request-skeleton-design.md).

The local prototype server also exposes a read-only Intent API for status
inspection:

```txt
GET /api/intents
GET /api/intents/:intentId
GET /api/intents/:intentId/status
GET /api/intents/:intentId/events
GET /api/intents/:intentId/receipt
POST /api/intents/:intentId/review
GET /api/transaction-requests/:intentId
POST /api/transaction-requests/:intentId
GET /api/transaction-requests/:intentId/preflight
```

This API reads and updates the same local intent store as the CLI. Review
approval/rejection is local. Transaction request POST validates request shape,
intent readiness, request token, quote freshness, executable Jupiter quote
state, and recipient token account before returning a signable transaction.

Preflight exposes the same transaction request gate without asking a wallet to
POST an account first.

Receipt state is also explicit. Until the system observes a confirmed
settlement, `GET /api/intents/:intentId/receipt` returns an unavailable receipt
scaffold rather than claiming payment completion.

Intent events provide a local audit scaffold for review decisions and
transaction request attempts. They are designed to be replaced or backed by a
hosted authenticated event log in a production version.

Intent expiry is a replay-control scaffold. New local intents include
`expiresAt`; expired intents remain readable but cannot be approved or used for
transaction request creation.

Transaction request URLs also include a local opaque request token. The current
draft runtime rejects transaction request metadata and POST calls when the token
is missing or incorrect.

The transaction request POST gate also binds the first valid wallet account to
the local intent. Later attempts with a different account are rejected before
any future transaction construction can occur.

Quote freshness is a separate transaction-construction gate. Draft intents carry
quote capture and expiry metadata; stale quotes are blocked before transaction
request creation.

```mermaid
flowchart LR
  PayToken["payer token<br/>SOL / JUP / BONK / other verified token"]
  Quote["Jupiter quote<br/>route + price impact"]
  Policy["policy checks<br/>route quality + limits"]
  Tx["transaction request<br/>future"]
  Sign["local wallet approval<br/>future"]
  USDC["recipient settlement<br/>USDC"]

  PayToken --> Quote --> Policy
  Policy -->|"approved or auto-pay"| Tx --> Sign --> USDC
  Policy -->|"review / reject"| Stop["stop before signing"]
```

The settlement layer should never hide risk. Route quality, settlement token,
and price impact are policy inputs, not just execution details.

## Current Alpha Boundary

This table is deliberately strict. It keeps the project honest about what is
usable today and what is still design work.

| Area | Current alpha | Target direction |
| --- | --- | --- |
| CLI | Source-run Rust CLI | Published npm wrapper and stable CLI |
| Agent contract | JSON output and exit codes | SDK + CLI contract shared by agents |
| Policy | Deterministic local checks | Configurable policy profiles |
| Jupiter | Quote-only estimates | Transaction route construction |
| Transaction request | Draft skeleton only | Solana Pay request endpoint |
| Risk Review | Static hosted page | Review workflow with durable state |
| Signing | Not implemented | Local wallet/user approval boundary |
| Settlement | Not executed | USDC settlement through Solana transaction |
| Storage | Local `.jup-sh/intents` | Optional remote persistence |

## Future End-to-End Flow

The target flow should still feel simple from the agent side. Complexity belongs
inside `jup.sh`: policy, risk evidence, route checks, review fallback, and
transaction request construction.

```mermaid
flowchart LR
  A["1. agent calls<br/>pay --agent deepseek ..."]
  B["2. jup.sh builds<br/>payment intent"]
  C["3. policy evaluates<br/>risk + route"]
  D{"4. decision"}
  E["5a. auto-pay candidate"]
  F["5b. Risk Review"]
  G["6. Jupiter route<br/>token -> USDC"]
  H["7. Solana Pay<br/>transaction request"]
  I["8. local wallet<br/>signs"]
  J["9. recipient<br/>gets USDC"]

  A --> B --> C --> D
  D -->|"inside policy"| E --> G
  D -->|"review required"| F --> G
  D -->|"rejected"| R["stop"]
  G --> H --> I --> J
```

The product should stay command-first. UI exists to review risk and explain
policy decisions, not to become another manual payment dashboard.

The transaction request step should follow the skeleton contract first, then
implementation can add server-side persistence, route construction, and wallet
handoff without changing the agent-facing intent model.

## Engineering Principles

- Keep the agent interface boring: stable commands, stable JSON, stable exit
  codes.
- Keep signing local: agents create intents; users or local policy authorize
  funds.
- Treat policy output as product surface: every review decision needs evidence.
- Treat Jupiter route data as risk context, not only settlement plumbing.
- Ship in phases: quote-only contract first, then transaction request, then
  carefully scoped execution.
