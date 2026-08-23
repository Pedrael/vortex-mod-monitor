import { defineConfig } from "vitest/config";
import * as path from "node:path";

/**
 * `@nexusmods/vortex-api` ships type declarations only — it has no runtime entry
 * and no "." export condition, because Vortex injects the real module into
 * extension code at load time via its own require hook. Anything importing it is
 * therefore unloadable under vitest and cannot be tested at all without an alias.
 *
 * Aliasing it to a stub is what makes the core modules testable; without this the
 * only testable file in the repo was the one that happened to import nothing from
 * the API. See test/stubs/vortex-api.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@nexusmods/vortex-api": path.resolve(__dirname, "test/stubs/vortex-api.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
