import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.JUP_SH_LIVE_JUPITER !== "1") {
  console.log("sdk jupiter live smoke: skipped (set JUP_SH_LIVE_JUPITER=1)");
  process.exit(0);
}

const outDir = mkdtempSync(join(tmpdir(), "jup-sh-sdk-jupiter-live-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
  }

  return result.stdout;
}

try {
  run("npx", ["tsc", "--outDir", outDir, "--noEmit", "false", "--declaration", "false"]);
  const stdout = run("node", [join(outDir, "examples/node-agent-pay-jupiter.js")], {
    env: process.env,
  });
  const intent = JSON.parse(stdout);

  if (intent.quote?.source !== "jupiter_swap_exact_out") {
    throw new Error(`unexpected quote source: ${intent.quote?.source}`);
  }
  if (intent.quote?.settleToken !== "USDC") {
    throw new Error(`unexpected settlement token: ${intent.quote?.settleToken}`);
  }

  console.log("sdk jupiter live smoke: ok");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
