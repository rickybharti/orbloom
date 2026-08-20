import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "orbloom-package-"));
const artifactDirectory = path.join(temporaryRoot, "artifact");
const consumerDirectory = path.join(temporaryRoot, "consumer");
const cacheDirectory = path.join(temporaryRoot, "npm-cache");
const packageTestEnvironment = {
  ...process.env,
  npm_config_dry_run: "false",
};
await Promise.all([
  mkdir(artifactDirectory),
  mkdir(consumerDirectory),
  mkdir(cacheDirectory),
]);

try {
  const packOutput = execFileSync("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    artifactDirectory,
    "--cache",
    cacheDirectory,
  ], { cwd: projectRoot, encoding: "utf8", env: packageTestEnvironment });
  const [packResult] = JSON.parse(packOutput);
  assert.equal(packResult.name, "orbloom");
  assert.equal(packResult.version, "0.1.0");
  assert.equal(packResult.entryCount, 17);
  assert.ok(packResult.size < 40000);
  const packedFiles = packResult.files.map(({ path: filePath }) => filePath).sort();
  assert.deepEqual(packedFiles, [
    "LICENSE",
    "README.md",
    "package.json",
    "src/audio-calibration.js",
    "src/audio.js",
    "src/controller.js",
    "src/customization.js",
    "src/index.d.ts",
    "src/index.js",
    "src/motion.js",
    "src/orb-engine.js",
    "src/orb-worker.js",
    "src/orb.css",
    "src/presets.js",
    "src/shaders.js",
    "src/styles.d.css.ts",
    "src/worker.d.ts",
  ]);
  const tarballPath = path.join(artifactDirectory, packResult.filename);

  await writeFile(path.join(consumerDirectory, "package.json"), JSON.stringify({
    name: "orbloom-consumer-test",
    private: true,
    type: "module",
  }, null, 2));
  execFileSync("npm", [
    "install",
    tarballPath,
    "--save-exact",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--cache",
    cacheDirectory,
  ], { cwd: consumerDirectory, env: packageTestEnvironment, stdio: "pipe" });

  await writeFile(path.join(consumerDirectory, "consume.mjs"), `
import assert from "node:assert/strict";
import { AudioLevelCalibrator, DEFAULT_VARIANT_ID, createOrbTheme, orbStates, orbVariantIds, resolveVariant } from "orbloom";
assert.equal(DEFAULT_VARIANT_ID, "core-teal-01");
assert.equal(orbVariantIds.length, 36);
assert.equal(resolveVariant().id, DEFAULT_VARIANT_ID);
assert.equal(createOrbTheme({ id: "consumer-theme" }).id, "consumer-theme");
assert.ok(orbStates.includes("speaking"));
assert.equal(new AudioLevelCalibrator().processDb(-120, 0), 0);
assert.match(import.meta.resolve("orbloom/styles.css"), /orb\\.css$/);
assert.match(import.meta.resolve("orbloom/worker"), /orb-worker\\.js$/);
assert.match(import.meta.resolve("orbloom/package.json"), /package\\.json$/);
`);
  execFileSync(process.execPath, ["consume.mjs"], {
    cwd: consumerDirectory,
    stdio: "pipe",
  });

  await writeFile(path.join(consumerDirectory, "types.ts"), `
import { AudioLevelCalibrator, OrbEngine, createOrb, createOrbTheme, resolveVariant } from "orbloom";
import type { OrbWorkerInputMessage, OrbWorkerOutputMessage } from "orbloom/worker";
import "orbloom/styles.css";
declare const canvas: HTMLCanvasElement;
const engine = new OrbEngine(canvas, { variant: resolveVariant("core-teal-01") });
engine.resize(264, 2);
engine.setAudioLevel(0.5);
const calibrator = new AudioLevelCalibrator({ outputGamma: 1.6 });
const level: number = calibrator.processDb(-24, 1);
const theme = createOrbTheme({ appearance: { glow: 0.8 }, colors: { base: "#112233" } });
const controller = createOrb(canvas, { quality: "balanced", state: "listening", theme });
controller.setState("speaking");
controller.setQuality("high");
const workerMessage: OrbWorkerInputMessage = {
  type: "audio-level",
  value: 0.5,
};
declare const workerResult: OrbWorkerOutputMessage;
void workerMessage;
void workerResult;
void level;
`);
  await writeFile(path.join(consumerDirectory, "tsconfig.json"), JSON.stringify({
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
  execFileSync(process.execPath, [
    path.join(projectRoot, "node_modules/typescript/bin/tsc"),
    "--project",
    path.join(consumerDirectory, "tsconfig.json"),
  ], { cwd: consumerDirectory, stdio: "pipe" });

  await writeFile(path.join(consumerDirectory, "index.html"), `
<div id="app"></div>
<script type="module" src="/main.js"></script>
`);
  await writeFile(path.join(consumerDirectory, "main.js"), `
import { DEFAULT_VARIANT_ID, createOrbTheme, resolveVariant } from "orbloom";
import "orbloom/styles.css";
document.querySelector("#app").dataset.variant = resolveVariant(DEFAULT_VARIANT_ID).id;
document.querySelector("#app").dataset.theme = createOrbTheme({ id: "vite-theme" }).id;
`);
  execFileSync(process.execPath, [
    path.join(projectRoot, "node_modules/vite/bin/vite.js"),
    "build",
  ], { cwd: consumerDirectory, stdio: "pipe" });
  const bundledAssets = await readdir(path.join(consumerDirectory, "dist/assets"));
  assert.ok(bundledAssets.some((fileName) => fileName.endsWith(".js")));
  assert.ok(bundledAssets.some((fileName) => fileName.endsWith(".css")));

  const installedPackage = JSON.parse(await readFile(
    path.join(consumerDirectory, "node_modules/orbloom/package.json"),
    "utf8",
  ));
  const publishedCss = await readFile(
    path.join(consumerDirectory, "node_modules/orbloom/src/orb.css"),
    "utf8",
  );
  assert.doesNotMatch(publishedCss, /(^|\n)\s*(?:\*|:root|html|body)\s*[{,]/);
  assert.deepEqual(installedPackage.dependencies ?? {}, {});
  console.log(JSON.stringify({
    pass: true,
    packageName: packResult.name,
    packageVersion: packResult.version,
    packedFiles: packResult.entryCount,
    packedBytes: packResult.size,
    unpackedBytes: packResult.unpackedSize,
    runtimeDependencies: 0,
    esmImport: true,
    cssExport: true,
    typeDeclarations: true,
    viteConsumerBuild: true,
  }, null, 2));
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
