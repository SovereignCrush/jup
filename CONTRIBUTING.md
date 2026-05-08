# Contributing

Thanks for checking out `jup.sh`.

This project is still early. The best contributions right now are:

- Product feedback.
- Risk and policy ideas for agent payments.
- Solana Pay transaction request references.
- Jupiter API integration notes.
- Small fixes to docs or the static prototype.

## Local Setup

```bash
npm install
npm run dev
```

Run checks before opening a pull request:

```bash
npm run check
```

## Project Principles

- Keep the product agent-first.
- Treat human review as a policy-triggered fallback, not the default path.
- Keep payment routes inspectable.
- Avoid custody.
- Keep the Jupiter/Solana/pay.sh relationship wording accurate.

## Pull Requests

Please keep pull requests focused and small.

For product or protocol-level changes, open an issue first so the direction can
be discussed before implementation.

## Commit Style

Use conventional commits:

```txt
feat: add a user-facing capability
fix: correct a bug
docs: update documentation
chore: update project setup or maintenance files
refactor: change code structure without changing behavior
```

Examples:

```txt
docs: document pay.sh implementation notes
feat: add policy evaluation prototype
chore: prepare open-source prototype
```
