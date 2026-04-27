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

console.log(`Deploying to ${targetDir} ...`);

copyRecursiveSync(sourceDistDir, path.join(targetDir, "dist"));

// Ship the static asset folder verbatim. Currently it carries the
// monochrome sidebar icon SVG sprite (loaded via util.installIconSet);
// future runtime assets (READMEs, fallback images, sample data, ...)
// can drop in here without touching the deploy script.
const sourceAssetsDir = path.join(repoRoot, "assets");
if (fs.existsSync(sourceAssetsDir)) {
  copyRecursiveSync(sourceAssetsDir, path.join(targetDir, "assets"));
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

console.log("Done.");
