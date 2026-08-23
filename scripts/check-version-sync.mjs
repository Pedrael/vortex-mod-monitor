/**
 * Fail the build when the extension version disagrees across the three places
 * that declare it.
 *
 * Why this exists: the version lives in three files that nothing links together.
 *   - package.json#version   — what npm sees
 *   - info.json#version      — what VORTEX shows in the extensions list
 *   - src/ui/version.ts      — what the About page and the nav footer render
 *
 * `src/ui/version.ts` carried the comment "Kept manually in sync with
 * package.json#version for now", which is a drift bug waiting for a release: bump
 * two of the three and the UI cheerfully reports a version the package is not.
 * Nothing failed, nothing warned — the wrong number just shipped.
 *
 * Deliberately a CHECK, not a generator. Generating version.ts would rewrite a
 * tracked source file on every build and put a generated artifact in git history.
 * A check costs one file read each and fails at the moment the mistake is made.
 *
 * Runs as `prebuild`, so `npm run build` and `npm run build:vortex` both gate on it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const sources = [];

try {
  sources.push({ file: "package.json", version: JSON.parse(read("package.json")).version });
  sources.push({ file: "info.json", version: JSON.parse(read("info.json")).version });
} catch (err) {
  console.error(`version check: could not read a manifest — ${err.message}`);
  process.exit(1);
}

// src/ui/version.ts is TypeScript, so parse the literal rather than import it.
const versionTs = read("src/ui/version.ts");
const match = versionTs.match(/EXTENSION_VERSION\s*=\s*["']([^"']+)["']/);
if (!match) {
  console.error(
    "version check: could not find EXTENSION_VERSION in src/ui/version.ts.\n" +
      "  If it was renamed, update this script — do not delete the check.",
  );
  process.exit(1);
}
sources.push({ file: "src/ui/version.ts", version: match[1] });

const distinct = [...new Set(sources.map((s) => s.version))];

if (distinct.length !== 1) {
  console.error("\nversion check FAILED — the extension version disagrees:\n");
  for (const { file, version } of sources) {
    console.error(`  ${version.padEnd(12)} ${file}`);
  }
  console.error(
    "\nAll three must match. Vortex shows info.json; the About page shows\n" +
      "src/ui/version.ts. Shipping them out of step means the UI reports a\n" +
      "version the package is not.\n",
  );
  process.exit(1);
}

if (process.env.VERBOSE) {
  console.log(`version check: ${distinct[0]} consistent across ${sources.length} files`);
}
