# jup-sh

Risk and settlement for Solana agent payments.

`jup-sh` 1.0 creates local payment intents, checks policy, gets Jupiter
ExactOut quotes for USDC settlement, and can execute a real swap from the
user's machine when the user explicitly provides a local Solana keypair.

Install or run with `npx`:

```bash
npx jup-sh init
npx jup-sh doctor
npx jup-sh policy trust api.vendor.example
npx jup-sh pay --agent deepseek --token SOL --amount 6 --settle USDC --recipient api.vendor.example --json
```

For real execution, create the intent with a Jupiter quote and the recipient's
USDC token account, then execute with a local keypair:

```bash
jup-sh pay \
  --agent deepseek \
  --token SOL \
  --amount 6 \
  --settle USDC \
  --recipient api.vendor.example \
  --recipient-token-account <RECIPIENT_USDC_TOKEN_ACCOUNT> \
  --quote-provider jupiter \
  --json

jup-sh intent execute intent_xxx \
  --keypair ~/.config/solana/id.json \
  --rpc-url https://api.mainnet-beta.solana.com \
  --json
```

The CLI signs locally, submits the serialized Jupiter swap transaction through
the configured RPC endpoint, confirms the signature, and writes a local
receipt. `jup.sh` does not custody funds or send private keys to a server.

When policy requires review, `pay --json` includes a full Risk Review URL and
local handoff command:

```json
{
  "nextAction": "open_review",
  "reviewUrl": "https://www.jup.sh/pay/intent_xxx#intent=...",
  "reviewCommand": "npx jup-sh review intent_xxx"
}
```

Useful commands:

```bash
jup-sh init
jup-sh doctor
jup-sh policy show
jup-sh policy trust api.vendor.example
jup-sh policy set max-auto 10
jup-sh intent list
jup-sh intent status intent_xxx
jup-sh intent preflight intent_xxx
jup-sh intent execute intent_xxx --keypair ~/.config/solana/id.json
jup-sh intent receipt intent_xxx
jup-sh intent events intent_xxx
jup-sh intent approve intent_xxx
jup-sh intent reject intent_xxx
jup-sh intent export intent_xxx
jup-sh review intent_xxx
```

Docs:

```txt
https://jerrywang33.github.io/jup-sh/
https://www.jup.sh
https://github.com/jerrywang33/jup-sh
```
