/**
 * Event Horizon design tokens — "Gargantua" palette.
 *
 * Phase 5.0 foundation. Every UI surface in the extension reads from
 * these CSS custom properties, so theming is centralized and a future
 * "Penrose" / "Hawking" theme switch is a one-file change.
 *
 * Color philosophy:
 *  - Background tiers go from "deep void" (page chrome) through
 *    "cosmic dust" (raised surfaces) to "lensed plasma" (interactive
 *    accents). Each tier is intentionally cool to balance the warm
 *    accretion-disk accents.
 *  - The accretion-disk gradient (hot → warm → pink → magenta →
 *    violet) is the SAME left-to-right sweep across the disk in
 *    Interstellar's Gargantua, with Doppler-shifted heat on the
 *    near-side and cooler magenta on the far side.
 *  - The cyan accent doubles as gravitational-lensing color and as
 *    the focus-ring / link / "info" semantic — instantly readable
 *    against the warm disk.
 *
 * Motion philosophy:
 *  - Default ease is `cubic-bezier(0.22, 1, 0.36, 1)` (out-quart):
 *    fast start, gentle settle. Reads as "purposeful, not bouncy."
 *  - Bounce ease is reserved for tactile feedback (button press,
 *    pill tap). Never used for incoming content.
 *  - Durations are powers-of-1.75 from 160ms — perceptually even.
 *  - `--eh-dur-warp` (6s) is the slow-loop timer for ambient
 *    animations (logo rotation, starfield drift). Always tied to
 *    `prefers-reduced-motion: reduce` (overrides to `0s`).
 */

export const TOKENS_CSS = `
:root {
  /* ── Background tiers ─────────────────────────────────────────── */
  --eh-bg-deep: #07060d;
  --eh-bg-base: #0c0a18;
  --eh-bg-raised: #15122b;
  --eh-bg-elevated: #1f1a3d;
  --eh-bg-overlay: rgba(7, 6, 13, 0.85);
  --eh-bg-glass: rgba(21, 18, 43, 0.55);

  /* ── Accretion disk gradient ──────────────────────────────────── */
  --eh-disk-hot: #ffb15c;
  --eh-disk-warm: #ff6b3d;
  --eh-disk-pink: #f0386b;
  --eh-disk-magenta: #a93289;
  --eh-disk-violet: #5f2ca5;
  --eh-disk-deep-violet: #2c1a5e;

  /* Pre-baked gradients (for backgrounds, borders, text fills) */
  --eh-gradient-disk:
    linear-gradient(
      90deg,
      var(--eh-disk-hot) 0%,
      var(--eh-disk-warm) 22%,
      var(--eh-disk-pink) 48%,
      var(--eh-disk-magenta) 72%,
      var(--eh-disk-violet) 100%
    );
  --eh-gradient-disk-radial:
    radial-gradient(
      circle at center,
      var(--eh-disk-hot) 0%,
      var(--eh-disk-warm) 30%,
      var(--eh-disk-pink) 55%,
      var(--eh-disk-violet) 80%,
      transparent 100%
    );
  --eh-gradient-page:
    radial-gradient(
      ellipse at top,
      #1a1338 0%,
      var(--eh-bg-base) 45%,
      var(--eh-bg-deep) 100%
    );

  /* ── Lensing accent (cool, electric) ──────────────────────────── */
  --eh-cyan: #4cc9f0;
  --eh-cyan-bright: #76e4f7;
  --eh-cyan-dim: #2d8aa9;

  /* ── Singularity / void ───────────────────────────────────────── */
  --eh-void: #050309;
  --eh-void-edge: rgba(0, 0, 0, 0.95);

  /* ── Text ─────────────────────────────────────────────────────── */
  --eh-text-primary: #f5f7ff;
  --eh-text-secondary: #b8b6cf;
  --eh-text-muted: #7a7898;
  --eh-text-disabled: #4a4866;
  --eh-text-inverse: #0c0a18;

  /* ── Semantic ─────────────────────────────────────────────────── */
  --eh-success: #3ddc84;
  --eh-success-glow: rgba(61, 220, 132, 0.35);
  --eh-warning: #ffb15c;
  --eh-warning-glow: rgba(255, 177, 92, 0.4);
  --eh-danger: #ff5b78;
  --eh-danger-glow: rgba(255, 91, 120, 0.4);
  --eh-info: #4cc9f0;
  --eh-info-glow: rgba(76, 201, 240, 0.4);

  /* ── Borders ──────────────────────────────────────────────────── */
  --eh-border-subtle: rgba(255, 255, 255, 0.06);
  --eh-border-default: rgba(255, 255, 255, 0.12);
  --eh-border-strong: rgba(255, 255, 255, 0.22);
  --eh-border-disk: rgba(240, 56, 107, 0.4);

  /* ── Glows / shadows ──────────────────────────────────────────── */
  --eh-glow-disk: 0 0 24px rgba(255, 107, 61, 0.45);
  --eh-glow-cyan: 0 0 16px rgba(76, 201, 240, 0.4);
  --eh-glow-violet: 0 0 32px rgba(95, 44, 165, 0.4);
  --eh-shadow-card: 0 8px 32px rgba(0, 0, 0, 0.45);
  --eh-shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.7);
  --eh-shadow-button: 0 2px 8px rgba(0, 0, 0, 0.35);

  /* ── Spacing scale (4px base, perceptual ramp) ────────────────── */
  --eh-sp-1: 4px;
  --eh-sp-2: 8px;
  --eh-sp-3: 12px;
  --eh-sp-4: 16px;
  --eh-sp-5: 24px;
  --eh-sp-6: 32px;
  --eh-sp-7: 48px;
  --eh-sp-8: 64px;
  --eh-sp-9: 96px;

  /* ── Radius ───────────────────────────────────────────────────── */
  --eh-radius-xs: 4px;
  --eh-radius-sm: 8px;
  --eh-radius-md: 12px;
  --eh-radius-lg: 16px;
  --eh-radius-xl: 24px;
  --eh-radius-pill: 9999px;

  /* ── Typography ───────────────────────────────────────────────── */
  --eh-font-sans:
    "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont,
    "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --eh-font-mono:
    "JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;

  --eh-text-xs: 11px;
  --eh-text-sm: 13px;
  --eh-text-md: 15px;
  --eh-text-lg: 18px;
  --eh-text-xl: 22px;
  --eh-text-2xl: 28px;
  --eh-text-3xl: 36px;
  --eh-text-4xl: 48px;
  --eh-text-hero: 64px;

  --eh-leading-tight: 1.2;
  --eh-leading-snug: 1.35;
  --eh-leading-normal: 1.55;
  --eh-leading-relaxed: 1.7;

  --eh-tracking-tight: -0.02em;
  --eh-tracking-normal: 0;
  --eh-tracking-wide: 0.04em;
  --eh-tracking-widest: 0.16em;

  /* ── Motion ───────────────────────────────────────────────────── */
  --eh-easing: cubic-bezier(0.22, 1, 0.36, 1);
  --eh-easing-in: cubic-bezier(0.55, 0, 0.85, 0);
  --eh-easing-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --eh-easing-linear: linear;

  --eh-dur-instant: 80ms;
  --eh-dur-fast: 160ms;
  --eh-dur-base: 280ms;
  --eh-dur-slow: 480ms;
  --eh-dur-deliberate: 720ms;
  --eh-dur-warp: 6000ms;
  --eh-dur-orbit: 20000ms;
  --eh-dur-orbit-fast: 12000ms;

  /* ── Layout ───────────────────────────────────────────────────── */
  --eh-max-content: 1280px;
  --eh-nav-height: 56px;
  --eh-page-padding: var(--eh-sp-6);

  /* ── Z-index ──────────────────────────────────────────────────── */
  --eh-z-base: 0;
  --eh-z-raised: 10;
  --eh-z-nav: 50;
  --eh-z-overlay: 100;
  --eh-z-modal: 1000;
  --eh-z-toast: 2000;
}

/* Honor user preference: kill ambient motion + dampen entrance
   animations to a quick fade. Keep glows + colors intact. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --eh-dur-warp: 0s;
    --eh-dur-orbit: 0s;
    --eh-dur-orbit-fast: 0s;
    --eh-dur-deliberate: var(--eh-dur-fast);
    --eh-dur-slow: var(--eh-dur-fast);
    --eh-dur-base: var(--eh-dur-fast);
  }
}
`;
