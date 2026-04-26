const fs = require("fs");
const path = require("path");

const sourceDir = path.resolve(__dirname, "../dist");
const targetDir =
  "C:/Users/Michael/AppData/Roaming/Vortex/plugins/vortex-mod-auditor";

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

console.log("Deploying to Vortex plugins...");
copyRecursiveSync(sourceDir, targetDir);
console.log("Done.");
