import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "orbloom-managers-"));
const artifactDirectory = path.join(temporaryRoot, "artifact");
await mkdir(artifactDirectory);

const managerDefinitions = [
  {
    id: "npm",
    lockfile: "package-lock.json",
    version: () => run("npm", ["--version"]),
    install: (directory, tarballPath) => run("npm", [
      "install",
      tarballPath,
      "--save-exact",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--install-strategy=linked",
      "--cache",
      path.join(temporaryRoot, "npm-cache"),
    ], directory),
  },
  {
    id: "pnpm",
    lockfile: "pnpm-lock.yaml",
    version: () => runNpx("pnpm@11.22.0", "pnpm", ["--version"]),
    install: (directory, tarballPath) => runNpx("pnpm@11.22.0", "pnpm", [
      "add",
      tarballPath,
      "--save-exact",
      "--ignore-scripts",
      "--store-dir",
      path.join(temporaryRoot, "pnpm-store"),
    ], directory),
  },
  {
    id: "yarn",
    lockfile: "yarn.lock",
    version: () => runNpx("@yarnpkg/cli-dist@4.18.0", "yarn", ["--version"]),
    prepare: (directory) => writeFile(
      path.join(directory, ".yarnrc.yml"),
      "nodeLinker: node-modules\nenableScripts: false\n",
    ),
    install: (directory, tarballPath) => runNpx("@yarnpkg/cli-dist@4.18.0", "yarn", [
      "add",
      `orbloom@file:${tarballPath}`,
      "--exact",
    ], directory),
  },
];

function run(command, arguments_, cwd = projectRoot) {
  return execFileSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      COREPACK_ENABLE_PROJECT_SPEC: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runNpx(packageSpecifier, binary, arguments_, cwd = projectRoot) {
  return run("npx", [
    "--yes",
    "--package",
    packageSpecifier,
    binary,
    ...arguments_,
  ], cwd);
}

async function writeConsumer(directory, managerId) {
  await writeFile(path.join(directory, "package.json"), JSON.stringify({
    name: `orbloom-${managerId}-consumer`,
    private: true,
    type: "module",
  }, null, 2));
  await writeFile(path.join(directory, "consume.mjs"), `
import assert from "node:assert/strict";
import { createOrbTheme, orbStates, orbVariantIds, resolveVariant } from "orbloom";
assert.equal(orbVariantIds.length, 36);
assert.equal(resolveVariant().id, "core-teal-01");
assert.equal(createOrbTheme({ id: "manager-test" }).id, "manager-test");
assert.ok(orbStates.includes("speaking"));
assert.match(import.meta.resolve("orbloom/styles.css"), /orb\\.css$/);
assert.match(import.meta.resolve("orbloom/worker"), /orb-worker\\.js$/);
assert.match(import.meta.resolve("orbloom/package.json"), /package\\.json$/);
`);
  await writeFile(path.join(directory, "types.ts"), `
import { createOrb, createOrbTheme } from "orbloom";
import "orbloom/styles.css";
declare const canvas: HTMLCanvasElement;
const orb = createOrb(canvas, {
  quality: "balanced",
  state: "listening",
  theme: createOrbTheme({ id: "typed-manager-test" }),
});
orb.setState("speaking");
`);
  await writeFile(path.join(directory, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      lib: ["DOM", "ES2022"],
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      strict: true,
      target: "ES2022",
    },
    include: ["types.ts"],
  }, null, 2));
  await writeFile(path.join(directory, "index.html"), `
<canvas id="orb"></canvas>
<script type="module" src="/main.js"></script>
`);
  await writeFile(path.join(directory, "main.js"), `
import { createOrbTheme } from "orbloom";
import "orbloom/styles.css";
document.querySelector("#orb").dataset.theme = createOrbTheme({ id: "bundled-manager-test" }).id;
`);
}

try {
  const [packResult] = JSON.parse(run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    artifactDirectory,
    "--cache",
    path.join(temporaryRoot, "npm-cache"),
  ]));
  const tarballPath = path.join(artifactDirectory, packResult.filename);
  const results = [];

  for (const manager of managerDefinitions) {
    const consumerDirectory = path.join(temporaryRoot, manager.id);
    await mkdir(consumerDirectory);
    await writeConsumer(consumerDirectory, manager.id);
    await manager.prepare?.(consumerDirectory);
    const version = manager.version();
    const startedAt = performance.now();
    manager.install(consumerDirectory, tarballPath);
    const installDurationMs = performance.now() - startedAt;

    run(process.execPath, ["consume.mjs"], consumerDirectory);
    run(process.execPath, [
      path.join(projectRoot, "node_modules/typescript/bin/tsc"),
      "--project",
      path.join(consumerDirectory, "tsconfig.json"),
    ], consumerDirectory);
    run(process.execPath, [
      path.join(projectRoot, "node_modules/vite/bin/vite.js"),
      "build",
    ], consumerDirectory);

    await readFile(path.join(consumerDirectory, manager.lockfile), "utf8");
    const installedManifest = JSON.parse(await readFile(
      path.join(consumerDirectory, "node_modules/orbloom/package.json"),
      "utf8",
    ));
    assert.equal(installedManifest.name, "orbloom");
    assert.deepEqual(installedManifest.dependencies ?? {}, {});

    results.push({
      manager: manager.id,
      version,
      installDurationMs: Math.round(installDurationMs),
      esmImport: true,
      cssExport: true,
      workerExport: true,
      typeDeclarations: true,
      viteConsumerBuild: true,
      lockfile: manager.lockfile,
    });
  }

  console.log(JSON.stringify({
    pass: true,
    artifact: packResult.filename,
    packedBytes: packResult.size,
    results,
  }, null, 2));
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
