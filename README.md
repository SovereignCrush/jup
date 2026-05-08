# jup.sh

Risk and settlement for Solana agent payments.

`jup.sh` is an early side project exploring the intersection of Solana DeFi,
AI, and payments.

The idea:

```txt
Agents pay with any verified token.
Recipients settle in USDC.
Policy decides when humans step in.
```

## Status

This repository currently contains a static V1 product prototype.

It is not a production payment system and does not execute real payments yet.

Live site:

```txt
https://www.jup.sh
```

## Product Direction

`jup.sh` is designed as a Jupiter-powered risk and settlement layer for Solana
agent payments.

The intended flow:

```txt
agent intent -> policy check -> auto pay or risk review -> Jupiter route -> USDC settlement
```

The default path should be automatic. Human review should appear only when
policy or risk signals require it.

## Current Prototype

V1 includes:

- A pay.sh-inspired landing page.
- A command-first agent payment concept.
- A Risk Review prototype.
- A static product shell for the current positioning.
- Product notes in `docs/product.md`.
- X / Twitter content notes in `docs/x-content.md`.

Current demo command:

```bash
pay --agent claude --token SOL --settle 20 USDC
```

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Open:

```txt
http://localhost:5173
```

Run checks:

```bash
npm run check
```

## Roadmap

Planned Phase 2 work:

- Intent API.
- CLI prototype.
- Policy engine.
- Risk Review fallback.
- Solana Pay transaction request.
- Jupiter API token-to-USDC settlement.
- Payment status and receipt.

## Disclaimer

`jup.sh` is an independent community-built tool.

It is not affiliated with, sponsored by, or endorsed by Jupiter Exchange, Solana
Foundation, or pay.sh.

References to Jupiter are about using Jupiter API/routing as infrastructure.

## License

MIT
