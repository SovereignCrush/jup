import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requireFromCli = createRequire(new URL("../npm/bin/jup-sh", import.meta.url));
const web3 = requireFromCli("@solana/web3.js");
const root = mkdtempSync(join(tmpdir(), "jup-sh-execute-smoke-"));
const store = join(root, "intents");
const keypairPath = join(root, "payer.json");
const intentId = "intent_execute_smoke";
const payer = web3.Keypair.generate();
const message = new web3.TransactionMessage({
  payerKey: payer.publicKey,
  recentBlockhash: "11111111111111111111111111111111",
  instructions: [],
}).compileToV0Message();
const transaction = new web3.VersionedTransaction(message);
const jupiterSwapUrl = `data:application/json,${encodeURIComponent(
  JSON.stringify({
    swapTransaction: Buffer.from(transaction.serialize()).toString("base64"),
  })
)}`;

mkdirSync(store, { recursive: true });
writeFileSync(keypairPath, JSON.stringify(Array.from(payer.secretKey)));
writeFileSync(
  join(store, `${intentId}.json`),
  `${JSON.stringify(
    {
      intentId,
      agent: "deepseek",
      payToken: "SOL",
      recipient: "api.vendor.example",
      recipientTokenAccount: "22222222222222222222222222222222",
      reference: "execute-smoke",
      settlement: {
        amount: 2,
        token: "USDC",
      },
      quote: {
        source: "jupiter_swap_exact_out",
        inputToken: "SOL",
        inputAmount: 0.013333333,
        settleAmount: 2,
        settleToken: "USDC",
        priceImpactBps: 12,
        capturedAt: "2026-05-12T00:00:00.000Z",
        expiresAt: "2099-05-12T00:02:00.000Z",
        rawQuoteResponse: {
          inputMint: "So11111111111111111111111111111111111111112",
          outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          inAmount: "13333333",
          outAmount: "2000000",
          swapMode: "ExactOut",
        },
      },
      status: "ready_for_authorization",
      decision: "auto_pay",
      nextAction: "ready_for_authorization",
      riskLevel: "low",
      reasons: [],
      policyChecks: [],
      reviewUrl: `https://www.jup.sh/pay/${intentId}`,
      reviewCommand: `npx jup-sh review ${intentId}`,
      transactionRequest: {
        requestToken: "request_execute_smoke",
      },
      createdAt: "2026-05-12T00:00:00.000Z",
      expiresAt: "2099-05-12T00:15:00.000Z",
    },
    null,
    2
  )}\n`
);

try {
  const result = spawnSync(
    "node",
    [
      "npm/bin/jup-sh",
      "intent",
      "execute",
      intentId,
      "--store",
      store,
      "--keypair",
      keypairPath,
      "--jupiter-swap-url",
      jupiterSwapUrl,
      "--dry-run",
      "--json",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    }
  );

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`execute smoke failed with status ${result.status}`);
  }

  const output = JSON.parse(result.stdout);
  if (output.status !== "signed_dry_run" || output.account !== payer.publicKey.toBase58()) {
    throw new Error("execute smoke did not return signed dry-run output");
  }
  if (typeof output.transaction !== "string" || output.transaction.length === 0) {
    throw new Error("execute smoke did not return a signed transaction");
  }

  const signed = web3.VersionedTransaction.deserialize(Buffer.from(output.transaction, "base64"));
  if (signed.signatures.length !== 1 || signed.signatures[0].every((byte) => byte === 0)) {
    throw new Error("execute smoke did not sign the transaction");
  }

  const saved = JSON.parse(readFileSync(join(store, `${intentId}.json`), "utf8"));
  if (saved.transactionRequest?.status !== "signed_dry_run") {
    throw new Error("execute smoke did not persist signed dry-run state");
  }

  console.log("execute smoke: ok");
} finally {
  rmSync(root, { recursive: true, force: true });
}
