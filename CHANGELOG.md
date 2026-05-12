# Changelog

All notable changes to jup.sh will be documented in this file.

## 1.0.0 - 2026-05-12

### Added

- Added Transaction Request Skeleton design docs for the future Solana Pay
  wallet boundary.
- Documented why the transaction request work remains a skeleton, the planned
  GET/POST endpoint shape, future CLI output shape, and safety boundaries.
- Added `docs/complete-version-roadmap.md` to track the remaining path from
  alpha to authorization, settlement, confirmation, and receipt.
- Added draft `docs/releases/0.1.0-alpha.8.md` notes for the transaction
  request skeleton design checkpoint.
- Added draft `docs/releases/0.1.0-alpha.9.md` notes for the read-only Intent
  API and status model checkpoint.
- Added draft `docs/releases/0.1.0-alpha.10.md` notes for the persisted local
  review decision checkpoint.
- Added draft `docs/releases/0.1.0-alpha.11.md` notes for the transaction
  request runtime gate checkpoint.
- Added draft `docs/releases/0.1.0-alpha.12.md` notes for the transaction
  request preflight checkpoint.
- Added draft `docs/releases/0.1.0-alpha.13.md` notes for the receipt scaffold
  checkpoint.
- Added draft `docs/releases/0.1.0-alpha.14.md` notes for the intent event log
  checkpoint.
- Added draft `docs/releases/0.1.0-alpha.15.md` notes for the intent expiry and
  replay gate checkpoint.
- Added draft `docs/releases/0.1.0-alpha.16.md` notes for the transaction
  request token gate checkpoint.
- Added draft `docs/releases/0.1.0-alpha.17.md` notes for the wallet account
  binding checkpoint.
- Added draft `docs/releases/0.1.0-alpha.18.md` notes for the quote freshness
  gate checkpoint.
- Added a local read-only Intent API for listing intents, reading an intent,
  and fetching lifecycle status.
- Added `jup-sh intent status <intent_id> --json` for the same lifecycle
  summary without returning the full intent body.
- Added local review decision persistence through
  `POST /api/intents/:intentId/review`, `jup-sh intent approve`, and
  `jup-sh intent reject`.
- Added transaction request endpoint gates for metadata, wallet account
  validation, review gating, and explicit `transaction_not_implemented`
  responses.
- Added transaction request preflight through
  `GET /api/transaction-requests/:intentId/preflight` and
  `jup-sh intent preflight`.
- Added unavailable receipt scaffold through `GET /api/intents/:intentId/receipt`
  and `jup-sh intent receipt`.
- Added local intent events through `GET /api/intents/:intentId/events` and
  `jup-sh intent events`.
- Added `expiresAt` and `expired` status fields, plus expiry gates for review
  decisions and transaction request creation.
- Added local transaction request tokens and token validation for transaction
  request metadata and POST paths.
- Added wallet account binding and account mismatch refusal for transaction
  request POST attempts.
- Added quote capture/expiry metadata and stale quote refusal for transaction
  request creation.
- Added executable Jupiter quote preservation for `--quote-provider jupiter`.
- Added `--recipient-token-account` to payment intents for USDC settlement
  delivery.
- Added real Jupiter swap transaction creation in
  `POST /api/transaction-requests/:intentId`.
- Added `jup-sh intent execute <intent_id> --keypair ...` for local signing,
  RPC submission, confirmation, and receipt persistence.
- Added local execution smoke coverage for keypair signing.
- Added server API smoke coverage and wired it into the release gate.

### Changed

- Updated README, npm README, website, and docs for the 1.0 real execution
  boundary.

### Not Included

- No custody of funds.
- No hosted private-key handling.
- No server-side signing.
- No remote backend persistence.
- No authentication.
- No published SDK package yet.

## 0.1.0-alpha.7 - 2026-05-11

### Added

- Added `reviewCommand` to `pay --json` output so agents can hand off to
  `npx jup-sh@alpha review intent_xxx`.
- `review_required` `pay --json` output now includes a full Risk Review URL
  with `#intent=` payload.

### Changed

- Simplified the homepage CLI prompt to the two-line alpha entry point:
  `npx jup-sh@alpha init` and `npx jup-sh@alpha doctor`.
- Aligned README and GitHub Pages docs around the same hierarchy: short
  homepage entry first, full `init -> doctor -> policy -> pay -> review`
  developer flow in docs.

### Not Included

- No wallet signing.
- No swap execution.
- No Solana Pay transaction request generation.
- No custody of funds.
- No remote backend persistence.
- No authentication.
- No published SDK package yet.

## 0.1.0-alpha.6 - 2026-05-11

### Added

- Added `jup-sh doctor` for local workspace diagnostics.
- Added `jup-sh doctor --json` for agents and scripts.
- Doctor now reports CLI version, config state, policy state, intent store,
  review base URL, quote provider, trusted recipients, and warnings.
- Updated README, Quickstart, npm README, and Agent Integration docs with the
  doctor command.
- Extended alpha smoke tests to cover doctor JSON output.

### Not Included

- No wallet signing.
- No swap execution.
- No Solana Pay transaction request generation.
- No custody of funds.
- No remote backend persistence.
- No authentication.
- No published SDK package yet.

## 0.1.0-alpha.5 - 2026-05-11

### Added

- Added top-level `jup-sh review <intent_id>` as the preferred shortcut for
  rebuilding a full Risk Review URL from a saved intent.
- Added `jup-sh review <intent_id> --json` for agents and scripts.
- Added `jup-sh review <intent_id> --payload-only` for low-level payload
  handoff.
- Updated Agent Integration and Quickstart docs around the review path.
- Extended alpha smoke tests to cover review URL and review JSON output.

### Not Included

- No wallet signing.
- No swap execution.
- No Solana Pay transaction request generation.
- No custody of funds.
- No remote backend persistence.
- No authentication.
- No published SDK package yet.

## 0.1.0-alpha.4 - 2026-05-11

### Added

- Added policy mutation commands for local risk tuning:
  - `jup-sh policy trust <recipient>`
  - `jup-sh policy untrust <recipient>`
  - `jup-sh policy set <field> <value>`
- Added short aliases for common policy fields such as `max-auto`,
  `max-allowed`, and `max-price-impact`.
- Updated agent integration docs to show how a reviewed payment can become an
  `auto_pay` candidate after trusting a recipient and raising local limits.
- Extended alpha smoke tests to cover policy mutation commands.

### Not Included

- No wallet signing.
- No swap execution.
- No Solana Pay transaction request generation.
- No custody of funds.
- No remote backend persistence.
- No authentication.
- No published SDK package yet.

## 0.1.0-alpha.3 - 2026-05-11

### Added

- Added top-level `jup-sh init` for first-run local workspace setup.
- Added `jup.config.json` generation with defaults for:
  - Risk Review base URL
  - policy file path
  - local intent store
  - quote provider
- Added config-aware defaults for `pay` and `intent` commands.
- Added an Agent Integration guide for safe CLI usage from agents and scripts.
- Updated Quickstart and npm README around the new `init -> pay --json`
  workflow.

### Not Included

- No wallet signing.
- No swap execution.
- No Solana Pay transaction request generation.
- No custody of funds.
- No remote backend persistence.
- No authentication.
- No published SDK package yet.

## 0.1.0-alpha.2 - 2026-05-11

### Added

- Prepared the first public npm alpha package under `jup-sh`.
- Added a self-contained Node.js CLI wrapper for `npx jup-sh@alpha`.
- Documented the npm alpha command path:
  - `npx jup-sh@alpha pay --agent deepseek --token SOL --amount 20 --settle USDC --json`
- Kept the CLI alpha quote-only, local-intent-only, and policy-driven.

### Not Included

- No wallet signing.
- No swap execution.
- No Solana Pay transaction request generation.
- No custody of funds.
- No remote backend persistence.
- No authentication.
- No published SDK package yet.

## 0.1.0-alpha.1 - 2026-05-10

### Added

- Added a source-only TypeScript SDK prototype with:
  - `createPaymentIntent`
  - `createJupiterQuoteProvider`
  - `createRiskReviewUrl`
  - `encodeRiskReviewPayload`
  - `parseRiskReviewPayload`
- Added SDK policy profiles:
  - `sandbox`
  - `balanced`
  - `strict`
- Added SDK `withTrustedRecipients` helper for known API/vendor destinations.
- Added SDK `explainPolicyDecision` helper for policy decision summaries,
  risk factors, passed checks, and recommended actions.
- Updated the hosted Risk Review page to present policy explanations before
  raw policy check evidence.

### Not Included

- No wallet signing.
- No swap execution.
- No Solana Pay transaction request generation.
- No custody of funds.
- No remote backend persistence.
- No authentication.
- No published npm package yet.

## 0.1.0-alpha.0 - 2026-05-09

### Added

- Added the initial pay.sh-inspired static website for `jup.sh`.
- Added a Rust workspace for CLI and reusable payment intent logic.
- Added `jup-sh pay` for local payment intent creation.
- Added deterministic local policy checks.
- Added structured intent fields for agents and scripts:
  - `status`
  - `decision`
  - `nextAction`
  - `riskLevel`
  - `policyChecks`
- Added local policy commands:
  - `jup-sh policy show`
  - `jup-sh policy init`
- Added a `SettlementQuoter` boundary.
- Added the default mock settlement quote provider.
- Added optional Jupiter quote-only settlement estimates with:
  - `--quote-provider jupiter`
  - `--slippage-bps`
  - `--jupiter-api-key`
- Added quote-aware policy checks:
  - `quote_available`
  - `quote_settlement_token`
  - `quote_price_impact`
- Added local intent persistence under `.jup-sh/intents`.
- Added local intent commands:
  - `jup-sh intent list`
  - `jup-sh intent show`
  - `jup-sh intent export`
- Added Risk Review URL export using a base64url fragment payload.
- Added static Risk Review page support for exported intent payloads.
- Added a private npm alpha wrapper prototype:
  - `npm/bin/jup-sh`
  - `npm run cli:alpha`
- Added alpha wrapper smoke test:
  - `npm run alpha:smoke`
- Added agent-facing CLI contract coverage for:
  - `pay --json`
  - `auto_pay` exit code `0`
  - `review_required` exit code `2`
  - `rejected` exit code `1`
- Added CLI JSON contract documentation and a review-required fixture.
- Added npm alpha package dry-run tooling and release checklist.
- Added draft GitHub release notes for `0.1.0-alpha.0`.
- Added a `release:check` gate for the alpha release checks.
- Added GitHub Pages developer documentation under `docs/`.
- Added release-readiness documentation:
  - `docs/cli-release-plan.md`
  - `docs/jupiter-quote-design.md`
  - `docs/risk-review-export-design.md`
  - `docs/cli-technical-design.md`

### Not Included

- No wallet signing.
- No swap execution.
- No Solana Pay transaction request generation.
- No custody of funds.
- No remote backend persistence.
- No authentication.
- No published npm package yet.
