import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(file, needle) {
  const content = read(file);
  if (!content.includes(needle)) {
    throw new Error(`${file} must include: ${needle}`);
  }
}

function assertNotIncludes(file, needle) {
  const content = read(file);
  if (content.includes(needle)) {
    throw new Error(`${file} must not include: ${needle}`);
  }
}

async function markdownFiles(dir) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await markdownFiles(relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relativePath);
    }
  }

  return files;
}

function normalizeLinkTarget(file, target) {
  const withoutHash = target.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];

  if (!withoutQuery) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(withoutQuery)) return null;
  if (withoutQuery.startsWith("/")) return null;

  const decoded = decodeURIComponent(withoutQuery);
  return path.resolve(root, path.dirname(file), decoded);
}

async function assertMarkdownLinks() {
  const files = [
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "npm/README.md",
    ...await markdownFiles("docs"),
  ];

  const missing = [];
  const linkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const file of files) {
    const content = read(file);

    for (const match of content.matchAll(linkPattern)) {
      const target = normalizeLinkTarget(file, match[1]);
      if (!target) continue;

      if (!existsSync(target)) {
        missing.push(`${file} -> ${match[1]}`);
        continue;
      }

      if (!statSync(target).isFile() && !statSync(target).isDirectory()) {
        missing.push(`${file} -> ${match[1]}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`missing markdown link targets:\n${missing.join("\n")}`);
  }
}

function assertReleaseBoundary() {
  assertIncludes("docs/index.md", "The current published checkpoint is `v1.0.0`.");
  assertIncludes("docs/releases/1.0.0.md", "`v1.0.0` is the first real payment execution release");
  assertIncludes("docs/releases/1.0.0.md", "jup-sh intent execute");
  assertIncludes("docs/releases/1.0.0.md", "server-side signing");
  assertIncludes("npm/README.md", "jup-sh intent execute");
  assertIncludes("README.md", "The 1.0 CLI can execute real Jupiter swaps");
  assertNotIncludes("npm/README.md", "alpha release");
}

function assertRoadmapWiring() {
  assertIncludes("README.md", "docs/complete-version-roadmap.md");
  assertIncludes("CHANGELOG.md", "docs/complete-version-roadmap.md");
  assertIncludes("docs/index.md", "[Complete Version Roadmap](complete-version-roadmap.md)");
  assertIncludes("docs/_layouts/default.html", "Complete Version Roadmap");
  assertIncludes("docs/_layouts/default.html", "1.0.0");
  assertIncludes("docs/product.md", "[Complete Version Roadmap](complete-version-roadmap.md)");
  assertIncludes("docs/complete-version-roadmap.md", "alpha.9");
  assertIncludes("docs/complete-version-roadmap.md", "beta.0");
}

function assertIntentApiWiring() {
  assertIncludes("server.js", "GET /api/intents");
  assertIncludes("server.js", "/api/intents/:intentId/status");
  assertIncludes("server.js", "/api/intents/:intentId/events");
  assertIncludes("server.js", "/api/intents/:intentId/receipt");
  assertIncludes("server.js", "POST /api/intents/:intentId/review");
  assertIncludes("server.js", "GET /api/transaction-requests/:intentId");
  assertIncludes("server.js", "POST /api/transaction-requests/:intentId");
  assertIncludes("server.js", "GET /api/transaction-requests/:intentId/preflight");
  assertIncludes("server.js", "buildJupiterSwapTransaction");
  assertIncludes("server.js", "swapTransaction");
  assertIncludes("server.js", "jupiter_swap_failed");
  assertIncludes("server.js", "intent_expired");
  assertIncludes("server.js", "invalid_request_token");
  assertIncludes("server.js", "account_mismatch");
  assertIncludes("server.js", "quote_expired");
  assertIncludes("server.js", "quote_not_executable");
  assertIncludes("npm/bin/jup-sh", "expiresAt");
  assertIncludes("npm/bin/jup-sh", "requestToken");
  assertIncludes("npm/bin/jup-sh", "executeIntent");
  assertIncludes("npm/bin/jup-sh", "sendRawTransaction");
  assertIncludes("npm/bin/jup-sh", "intent status <intent_id> [--json]");
  assertIncludes("npm/bin/jup-sh", "intent preflight <intent_id> [--json]");
  assertIncludes("npm/bin/jup-sh", "intent receipt <intent_id> [--json]");
  assertIncludes("npm/bin/jup-sh", "intent events <intent_id> [--json]");
  assertIncludes("npm/bin/jup-sh", "intent approve <intent_id>");
  assertIncludes("npm/bin/jup-sh", "intent reject <intent_id>");
  assertIncludes("npm/bin/jup-sh", "intent execute <intent_id>");
  assertIncludes("docs/cli-json-contract.md", "## Intent Status Summary");
  assertIncludes("docs/cli-json-contract.md", "`expiresAt`");
  assertIncludes("docs/cli-json-contract.md", "`requestToken`");
  assertIncludes("docs/cli-json-contract.md", "`boundAccount`");
  assertIncludes("docs/cli-json-contract.md", "\"quoteExpired\"");
  assertIncludes("docs/architecture.md", "GET /api/intents/:intentId/status");
  assertIncludes("docs/architecture.md", "GET /api/intents/:intentId/events");
  assertIncludes("docs/architecture.md", "GET /api/intents/:intentId/receipt");
  assertIncludes("docs/architecture.md", "POST /api/intents/:intentId/review");
  assertIncludes("docs/architecture.md", "POST /api/transaction-requests/:intentId");
  assertIncludes("docs/architecture.md", "GET /api/transaction-requests/:intentId/preflight");
  assertIncludes("scripts/release-check.mjs", "server:smoke");
  assertIncludes("scripts/release-check.mjs", "execute:smoke");
}

function assertWebsiteCopyBoundary() {
  assertIncludes("app.js", "Approve intent");
  assertIncludes("app.js", "Intent approved for future authorization. No transaction was sent.");
  assertIncludes("app.js", "Recipient target");
  assertNotIncludes("app.js", "Approve payment");
  assertNotIncludes("app.js", "Payment approved. Recipient receives USDC.");
  assertNotIncludes("app.js", "Recipient gets");
}

await assertMarkdownLinks();
assertReleaseBoundary();
assertRoadmapWiring();
assertIntentApiWiring();
assertWebsiteCopyBoundary();

console.log("docs contract check: ok");
