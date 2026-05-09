---
title: Quickstart
description: Run the jup.sh source alpha locally.
---

# Quickstart

The current alpha runs from source.

## Install

```bash
git clone https://github.com/jerrywang33/jup-sh.git
cd jup-sh
npm install
```

You also need a working Rust toolchain because the CLI is implemented in Rust.

## Show Policy

```bash
npm run cli:alpha -- policy show
```

## Create A Payment Intent

```bash
npm run cli:alpha -- pay --agent claude --token SOL --settle 20 USDC
```

By default, this uses the mock quote provider and writes local intent JSON under
`.jup-sh/intents`.

## JSON Mode

Agents and scripts should use `--json`:

```bash
npm run --silent cli:alpha -- pay --agent claude --token SOL --settle 20 USDC --json
```

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | The intent is inside policy and ready for local authorization. |
| `2` | The intent is valid, but policy requires Risk Review. |
| `1` | The intent is rejected or the command failed. |

The full JSON contract is documented in
[CLI JSON Contract](cli-json-contract.md).

## Jupiter Quote-Only Mode

```bash
npm run cli:alpha -- pay --agent claude --token SOL --settle 20 USDC --quote-provider jupiter
```

This requests a Jupiter quote estimate only. It does not sign, submit, or
execute a swap.

## Local Intents

List saved intents:

```bash
npm run cli:alpha -- intent list
```

Show one intent:

```bash
npm run cli:alpha -- intent show intent_xxx
```

Export a Risk Review URL:

```bash
npm run cli:alpha -- intent export intent_xxx
```

## Release Gate

Before a release checkpoint:

```bash
npm run release:check
```

This runs code checks, alpha smoke tests, npm package dry-run checks, and Rust
workspace tests.
