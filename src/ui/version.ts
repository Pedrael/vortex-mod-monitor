/**
 * Single source of truth for the user-facing extension version.
 *
 * Kept manually in sync with `package.json#version` for now (Phase 5.0).
 * In a later slice we'll generate this at build time from package.json
 * to avoid drift.
 */
export const EXTENSION_VERSION = "0.0.1";
