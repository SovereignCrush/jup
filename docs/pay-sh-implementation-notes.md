# pay.sh Implementation Notes

This document captures engineering lessons from reviewing
`solana-foundation/pay`. It is for product and architecture inspiration only.

Repository reviewed:

```txt
https://github.com/solana-foundation/pay
```

## What pay.sh Gets Right

`pay` is not just a website. It is a full payment toolchain around HTTP payment
challenges:

```txt
CLI wrapper -> 402 challenge detection -> local payment authorization ->
payment proof -> request retry -> final provider response
```

The repo structure reflects that:

- `rust/`: production CLI and core payment flow.
- `typescript/`: SDK/docs/spec packages.
- `pdb/`: payment debugger UI.
- `skills/`: agent-facing usage instructions.
- `README.md`: product definition and quickstart.
- `CONTRIBUTING.md`: local development and conventional commit rules.
- `SECURITY.md`: security reporting and user-safety expectations.

## Engineering Lessons for jup.sh

### 1. Start From the Command

pay.sh starts from real agent/API behavior:

```sh
pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL
pay claude
pay codex
```

jup.sh Phase 2 should also start from a working command:

```sh
pay --agent claude --token SOL --settle 20 USDC
```

The website should explain the product, but the product should become an
agent-native payment primitive.

### 2. Separate Client, Core, and Review Surfaces

pay.sh separates CLI, core payment logic, MCP/agent integration, and debugger
UI.

jup.sh should eventually separate:

- CLI/client: create payment intents.
- Core: policy evaluation, quote checks, recipient checks, route checks.
- Settlement: Jupiter API token-to-USDC route.
- Review: Risk Review page for policy exceptions.
- Docs/examples: agent and developer integration notes.

### 3. Treat Human Approval as a Safety Boundary

pay.sh does not give agents private keys. It prepares payment locally and asks
the user to authorize signing.

jup.sh should keep the same safety posture:

- agents create intents;
- policy decides whether the payment is automatic;
- human review appears only for exceptions;
- no hidden routes or blind signing;
- amount, recipient, route, and risk reason must be visible.

### 4. Keep Sandbox First

pay.sh uses sandbox mode heavily for learning and testing.

jup.sh should have a sandbox mode before any production payment path:

```sh
pay --sandbox --agent claude --token SOL --settle 20 USDC
```

Sandbox should make it possible to test:

- policy pass;
- policy fail;
- new recipient;
- high slippage;
- unverified token;
- daily limit exceeded.

### 5. Use Professional Open-Source Hygiene

pay.sh uses:

- clear README;
- CONTRIBUTING;
- SECURITY;
- MIT license;
- conventional commits;
- explicit build/test commands.

jup.sh should follow the same discipline from the first public commit.

Recommended commit style:

```txt
feat: add ...
fix: correct ...
docs: update ...
chore: prepare ...
```

## jup.sh Phase 2 Reminder

The next real milestone should be:

```txt
intent API + CLI demo + policy-gated Auto Pay + Risk Review fallback
```

Do not over-polish the static website before there is a real agent payment
loop.
