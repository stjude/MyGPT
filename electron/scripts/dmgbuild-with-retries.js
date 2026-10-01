#!/usr/bin/env node

const { existsSync, readFileSync, readdirSync, writeFileSync } = require("fs");
const { homedir } = require("os");
const { dirname, join } = require("path");
const { spawnSync } = require("child_process");

const retryCount = process.env.DMGBUILD_DETACH_RETRIES || "6";
const cacheRoot = join(homedir(), "Library", "Caches", "electron-builder", "dmg-builder@1.2.5");

function findDmgbuild(directory) {
  if (!existsSync(directory)) {
    return null;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isFile() && entry.name === "dmgbuild" && entryPath !== __filename) {
      return entryPath;
    }
    if (entry.isDirectory()) {
      const result = findDmgbuild(entryPath);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

const dmgbuildPath = findDmgbuild(cacheRoot);

if (!dmgbuildPath) {
  console.error(`Unable to find electron-builder dmgbuild binary under ${cacheRoot}`);
  process.exit(1);
}

const corePath = join(dirname(dmgbuildPath), "python", "lib", "python3.14", "site-packages", "dmgbuild", "core.py");
const patchMarker = "# MyGPT electron-builder detach fallback";

if (existsSync(corePath)) {
  const source = readFileSync(corePath, "utf8");
  const originalDetachBlock = `    if ret:\n        hdiutil("detach", "-force", device, plist=False)\n        raise DMGError(callback, f"Unable to detach device cleanly: {output}")`;
  const patchedDetachBlock = `    if ret:\n        ${patchMarker}\n        time.sleep(3)\n        ret, output = hdiutil("detach", "-force", device, plist=False)\n        if ret:\n            subprocess.call(("/usr/sbin/diskutil", "unmountDisk", "force", device))\n            time.sleep(2)\n            ret, output = hdiutil("detach", "-force", device, plist=False)\n        if ret:\n            raise DMGError(callback, f"Unable to detach device cleanly: {output}")`;

  if (!source.includes(patchMarker) && source.includes(originalDetachBlock)) {
    writeFileSync(corePath, source.replace(originalDetachBlock, patchedDetachBlock));
  }
}

const result = spawnSync(dmgbuildPath, ["--detach-retries", retryCount, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    CUSTOM_DMGBUILD_PATH: "",
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);