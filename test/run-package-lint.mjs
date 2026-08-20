import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "orbloom-package-lint-"));
const artifactDirectory = path.join(temporaryRoot, "artifact");
const cacheDirectory = path.join(temporaryRoot, "npm-cache");
const lintTarget = process.argv[2];

if (!new Set(["publint", "types"]).has(lintTarget)) {
  throw new Error(`Unknown package lint target: ${lintTarget ?? "missing"}`);
}

try {
  await Promise.all([mkdir(artifactDirectory), mkdir(cacheDirectory)]);
  const packOutput = execFileSync("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    artifactDirectory,
    "--cache",
    cacheDirectory,
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: cacheDirectory,
      npm_config_dry_run: "false",
    },
  });
  const [packResult] = JSON.parse(packOutput);
  const tarballPath = path.join(artifactDirectory, packResult.filename);
  const commands = {
    publint: [
      path.join(projectRoot, "node_modules/publint/src/cli.js"),
      tarballPath,
      "--pack",
      "false",
    ],
    types: [
      path.join(projectRoot, "node_modules/@arethetypeswrong/cli/dist/index.js"),
      tarballPath,
      "--profile",
      "esm-only",
    ],
  };
  execFileSync(process.execPath, commands[lintTarget], { cwd: projectRoot, stdio: "inherit" });
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
