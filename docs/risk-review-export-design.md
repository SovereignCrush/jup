---
title: Risk Review Export Design
description: How local payment intents are exported to hosted Risk Review pages.
---

# Risk Review Export Design

This phase connects the local CLI intent store to the static Risk Review page
without adding a backend.

## Goal

The CLI can already create and save local intents:

```txt
.jup-sh/intents/<intent_id>.json
```

`intent export` turns a saved intent into a hosted review URL:

```bash
jup-sh intent export intent_abc123
```

Output:

```txt
https://jup.sh/pay/intent_abc123#intent=<base64url-json-payload>
```

The website reads the `#intent=` fragment and renders the real intent data in
Risk Review.

## Why URL Fragment

Cloudflare Pages is currently serving a static app. It cannot read a user's
local `.jup-sh/intents` directory, and adding a backend would pull in API
storage, authentication, and deployment complexity too early.

A URL fragment is enough for MVP review:

- no backend required
- works with the current static site
- keeps CLI and Risk Review connected
- does not send the fragment to the server in normal browser requests

## Non-Goals

This phase does not:

- store intents remotely
- authenticate users
- sign transactions
- execute swaps
- include private keys or signatures
- handle sensitive customer data in the URL

## Payload Rules

The exported payload is the serialized `PaymentIntent` JSON encoded with
base64url without padding.

The payload may include:

- intent ID
- agent name
- payer token
- settlement amount and token
- quote
- status
- decision
- reasons
- policy checks
- review URL
- created timestamp

The payload must not include:

- private keys
- wallet signatures
- unsigned transaction bytes
- access tokens
- API keys
- sensitive customer data

## Future Backend Path

The fragment export should be replaced when a backend intent API exists:

```txt
POST /api/intents
GET  /api/intents/:id
GET  /pay/:id
```

At that point, `intent export` can upload or sync a local intent and return a
short hosted review URL.
