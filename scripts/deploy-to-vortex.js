const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourceDistDir = path.join(repoRoot, "dist");

const appData = process.env.APPDATA;
if (!appData) {
  console.error("APPDATA env var is not set; cannot resolve Vortex plugin path.");
  process.exit(1);
}

const targetDir = path.join(appData, "Vortex", "plugins", "vortex-event-horizon");

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Delete files under `destRoot` that `srcRoot` no longer produces.
 *
 * Without this the deploy is copy-only, so a renamed or deleted module lingers
 * in the plugin folder forever. That is how a May build left MO2 modules,
 * pluginsTxt.js and ComingSoonPage.js on disk long after their sources were
 * removed — inert, because nothing imported them, but indistinguishable from
 * live code when you are trying to work out what is actually running.
 *
 * Only prunes inside the directories this script owns (dist/, assets/), never
 * the plugin root, so anything Vortex or the user puts beside them survives.
 */
function pruneRemovedSync(srcRoot, destRoot) {
  if (!fs.existsSync(destRoot)) return 0;
  let pruned = 0;
  for (const entry of fs.readdirSync(destRoot, { withFileTypes: true })) {
    const destPath = path.join(destRoot, entry.name);
    const srcPath = path.join(srcRoot, entry.name);
    if (entry.isDirectory()) {
      pruned += pruneRemovedSync(srcPath, destPath);
      // Drop the directory too once whatever justified it is gone.
      if (!fs.existsSync(srcPath) && fs.readdirSync(destPath).length === 0) {
        fs.rmdirSync(destPath);
      }
    } else if (!fs.existsSync(srcPath)) {
      fs.unlinkSync(destPath);
      pruned += 1;
    }
  }
  return pruned;
}

console.log(`Deploying to ${targetDir} ...`);

copyRecursiveSync(sourceDistDir, path.join(targetDir, "dist"));
const prunedDist = pruneRemovedSync(sourceDistDir, path.join(targetDir, "dist"));

// Ship the static asset folder verbatim. Currently it carries the
// monochrome sidebar icon SVG sprite (loaded via util.installIconSet);
// future runtime assets (READMEs, fallback images, sample data, ...)
// can drop in here without touching the deploy script.
let prunedAssets = 0;
const sourceAssetsDir = path.join(repoRoot, "assets");
if (fs.existsSync(sourceAssetsDir)) {
  copyRecursiveSync(sourceAssetsDir, path.join(targetDir, "assets"));
  prunedAssets = pruneRemovedSync(sourceAssetsDir, path.join(targetDir, "assets"));
}

for (const file of ["index.js", "info.json"]) {
  const src = path.join(repoRoot, file);
  if (fs.existsSync(src)) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(src, path.join(targetDir, file));
  } else {
    console.warn(`Skipping missing file: ${file}`);
  }
}

const prunedTotal = prunedDist + prunedAssets;
console.log(
  prunedTotal > 0
    ? `Done. Pruned ${prunedTotal} stale file(s) whose source no longer exists.`
    : "Done.",
);
