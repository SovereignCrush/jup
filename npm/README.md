# jup-sh

Risk and settlement for Solana agent payments.

This package is an alpha release for the `jup-sh` CLI.

Current alpha status:

- quote-only
- local intent only
- local policy checks
- Risk Review export
- no wallet signing
- no swap execution
- no custody

Install or run with `npx`:

```bash
npx jup-sh@alpha init
npx jup-sh@alpha doctor
npx jup-sh@alpha policy trust api.vendor.example
npx jup-sh@alpha pay --agent deepseek --token SOL --amount 6 --settle USDC --recipient api.vendor.example --json
```

The npm alpha is self-contained and runs on Node.js. It does not require the
Rust workspace.

Command shape:

```bash
jup-sh init
jup-sh doctor
jup-sh pay --agent deepseek --token SOL --amount 6 --settle USDC --json
```

When policy requires review, `pay --json` includes a full Risk Review URL and
local handoff command:

```json
{
  "nextAction": "open_review",
  "reviewUrl": "https://www.jup.sh/pay/intent_xxx#intent=...",
  "reviewCommand": "npx jup-sh@alpha review intent_xxx"
}
```

Useful commands:

```bash
jup-sh init
jup-sh policy show
jup-sh policy init
jup-sh policy trust api.vendor.example
jup-sh policy set max-auto 10
jup-sh doctor
jup-sh intent list
jup-sh intent export intent_xxx
jup-sh review intent_xxx
```

The CLI JSON contract is documented in:

```txt
docs/cli-json-contract.md
```

Project:

```txt
https://www.jup.sh
https://github.com/jerrywang33/jup-sh
```
