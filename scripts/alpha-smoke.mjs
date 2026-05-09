import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const store = mkdtempSync(join(tmpdir(), "jup-sh-alpha-smoke-"));

function run(args) {
  const result = spawnSync("node", ["npm/bin/jup-sh", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`command failed: jup-sh ${args.join(" ")}`);
  }

  return result.stdout;
}

try {
  console.log("alpha smoke: policy show");
  const policy = run(["policy", "show"]);
  if (!policy.includes("jup.sh policy")) {
    throw new Error("policy show did not print policy output");
  }

  console.log("alpha smoke: pay");
  const pay = run([
    "pay",
    "--agent",
    "claude",
    "--token",
    "SOL",
    "--settle",
    "20",
    "USDC",
    "--store",
    store,
  ]);
  const intentId = pay.match(/Intent: (intent_[a-z0-9]+)/)?.[1];
  if (!intentId) {
    throw new Error("pay output did not include an intent id");
  }

  console.log("alpha smoke: intent list");
  const list = run(["intent", "list", "--store", store]);
  if (!list.includes(intentId)) {
    throw new Error("intent list did not include the created intent");
  }

  console.log("alpha smoke: intent export");
  const payload = run(["intent", "export", intentId, "--store", store, "--payload-only"]).trim();
  if (payload.length < 100) {
    throw new Error("intent export payload is unexpectedly short");
  }

  console.log(`alpha smoke: ok (${intentId})`);
} finally {
  rmSync(store, { recursive: true, force: true });
}
