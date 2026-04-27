/**
 * Base styles for the Event Horizon UI shell.
 *
 * Scoped to `.eh-app` and descendants so we don't leak into Vortex's
 * own UI. Vortex's main app uses Bootstrap 3-era styling and a dense
 * dark theme; we deliberately diverge inside our own page chrome but
 * never restyle anything outside `.eh-app`.
 */

export const BASE_CSS = `
.eh-app {
  font-family: var(--eh-font-sans);
  font-size: var(--eh-text-md);
  line-height: var(--eh-leading-normal);
  color: var(--eh-text-primary);
  background: var(--eh-gradient-page);
  /* Vortex's MainPage container is a flex column that gives us a
     definite height via flex sizing, NOT via height:100%. Hooking
     into that flex chain (flex:1 + min-height:0) guarantees a real
     pixel height for our descendants — without this our inner flex
     column collapses and the main scroll region never overflows
     (the "dashboard not scrollable" bug). */
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.eh-app *,
.eh-app *::before,
.eh-app *::after {
  box-sizing: border-box;
}

.eh-app h1, .eh-app h2, .eh-app h3, .eh-app h4 {
  margin: 0;
  font-weight: 600;
  letter-spacing: var(--eh-tracking-tight);
  line-height: var(--eh-leading-tight);
  color: var(--eh-text-primary);
}

.eh-app h1 { font-size: var(--eh-text-3xl); }
.eh-app h2 { font-size: var(--eh-text-2xl); }
.eh-app h3 { font-size: var(--eh-text-xl); }
.eh-app h4 { font-size: var(--eh-text-lg); }

.eh-app p {
  margin: 0;
  color: var(--eh-text-secondary);
}

.eh-app a {
  color: var(--eh-cyan);
  text-decoration: none;
  transition: color var(--eh-dur-fast) var(--eh-easing);
}

.eh-app a:hover {
  color: var(--eh-cyan-bright);
  text-shadow: var(--eh-glow-cyan);
}

.eh-app code, .eh-app pre {
  font-family: var(--eh-font-mono);
  font-size: var(--eh-text-sm);
}

.eh-app code {
  padding: 1px 6px;
  background: var(--eh-bg-raised);
  border: 1px solid var(--eh-border-subtle);
  border-radius: var(--eh-radius-xs);
  color: var(--eh-cyan-bright);
}

/* Decorative starfield: pure-CSS dots via radial-gradient repetition.
   No image asset, no JS; renders crisp at any DPI. */
.eh-app::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: var(--eh-z-base);
  pointer-events: none;
  background-image:
    radial-gradient(1px 1px at 12% 8%,  rgba(255,255,255,0.65), transparent 50%),
    radial-gradient(1px 1px at 78% 12%, rgba(255,255,255,0.5),  transparent 50%),
    radial-gradient(1px 1px at 22% 38%, rgba(255,255,255,0.35), transparent 50%),
    radial-gradient(1px 1px at 53% 22%, rgba(255,255,255,0.55), transparent 50%),
    radial-gradient(1px 1px at 88% 47%, rgba(255,255,255,0.4),  transparent 50%),
    radial-gradient(1px 1px at 8%  72%, rgba(255,255,255,0.5),  transparent 50%),
    radial-gradient(1px 1px at 41% 81%, rgba(255,255,255,0.6),  transparent 50%),
    radial-gradient(1px 1px at 68% 67%, rgba(255,255,255,0.35), transparent 50%),
    radial-gradient(1.4px 1.4px at 92% 88%, rgba(255,255,255,0.6), transparent 50%),
    radial-gradient(1.4px 1.4px at 4% 52%,  rgba(255,255,255,0.5), transparent 50%);
  animation: eh-twinkle var(--eh-dur-warp) ease-in-out infinite;
  opacity: 0.7;
}

/* Faint nebular wash bottom-left for depth. Not animated. */
.eh-app::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: var(--eh-z-base);
  pointer-events: none;
  background:
    radial-gradient(
      circle at 15% 90%,
      rgba(95, 44, 165, 0.15) 0%,
      transparent 35%
    ),
    radial-gradient(
      circle at 90% 10%,
      rgba(76, 201, 240, 0.08) 0%,
      transparent 40%
    );
}

.eh-app__inner {
  position: relative;
  z-index: var(--eh-z-raised);
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
}

.eh-app__main {
  flex: 1 1 auto;
  /* min-height: 0 is required so this flex child can actually shrink
     below its intrinsic content height — otherwise overflow-y:auto
     never kicks in and the page grows past the viewport. */
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.eh-app__main::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.eh-app__main::-webkit-scrollbar-track {
  background: transparent;
}

.eh-app__main::-webkit-scrollbar-thumb {
  background: var(--eh-border-default);
  border-radius: var(--eh-radius-pill);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.eh-app__main::-webkit-scrollbar-thumb:hover {
  background: var(--eh-border-strong);
  background-clip: padding-box;
}

/* Visible focus ring — required for keyboard a11y. We use a double
   ring (cyan glow + dark border) so it's visible on every surface. */
.eh-app *:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--eh-bg-base),
    0 0 0 4px var(--eh-cyan),
    var(--eh-glow-cyan);
  border-radius: var(--eh-radius-sm);
}

/* Remove the default outline on mouse-only interactions. */
.eh-app *:focus:not(:focus-visible) {
  outline: none;
}

/* Utility: gradient text fill (used for the brand wordmark). */
.eh-text-gradient {
  background: var(--eh-gradient-disk);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
`;
