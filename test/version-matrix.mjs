import { execFileSync } from "node:child_process";

const nodeVersions = ["22.12.0", "22.23.2", "24.19.0", "26.7.0"];
const checks = [
  ["--test", "test/package-api.test.mjs", "test/audio-calibration.test.mjs"],
  ["test/stress.mjs"],
  ["node_modules/vite/bin/vite.js", "build"],
];
const results = [];

for (const nodeVersion of nodeVersions) {
  const prefix = ["--yes", "--package", `node@${nodeVersion}`, "node"];
  const actualVersion = execFileSync("npx", [...prefix, "--version"], {
    encoding: "utf8",
  }).trim();
  const startedAt = performance.now();

  for (const check of checks) {
    execFileSync("npx", [...prefix, ...check], { stdio: "pipe" });
  }

  results.push({
    requested: nodeVersion,
    actual: actualVersion,
    checks: checks.length,
    durationMs: Math.round(performance.now() - startedAt),
  });
}

console.log(JSON.stringify({
  pass: true,
  results,
}, null, 2));
