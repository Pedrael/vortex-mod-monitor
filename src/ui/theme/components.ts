/**
 * Component-scoped CSS for the Event Horizon UI primitives.
 *
 * Naming follows BEM-lite: `.eh-{component}__{element}--{modifier}`.
 * Modifier classes are additive — primary state lives on the base,
 * variants ride on top.
 */

export const COMPONENTS_CSS = `
/* ── Page wrapper ─────────────────────────────────────────────── */
.eh-page {
  width: 100%;
  max-width: var(--eh-max-content);
  margin: 0 auto;
  padding: var(--eh-page-padding);
  animation: eh-fade-up var(--eh-dur-slow) var(--eh-easing) both;
}

.eh-page__header {
  margin-bottom: var(--eh-sp-6);
}

.eh-page__title {
  font-size: var(--eh-text-3xl);
  font-weight: 700;
  letter-spacing: var(--eh-tracking-tight);
  margin: 0 0 var(--eh-sp-2) 0;
}

.eh-page__subtitle {
  color: var(--eh-text-secondary);
  font-size: var(--eh-text-md);
}

/* ── Stagger helpers (parent gives N, children animate w/ delay) ─ */
.eh-stagger > *      { opacity: 0; animation: eh-fade-up var(--eh-dur-base) var(--eh-easing) both; }
.eh-stagger > *:nth-child(1) { animation-delay: 60ms; }
.eh-stagger > *:nth-child(2) { animation-delay: 140ms; }
.eh-stagger > *:nth-child(3) { animation-delay: 220ms; }
.eh-stagger > *:nth-child(4) { animation-delay: 300ms; }
.eh-stagger > *:nth-child(5) { animation-delay: 380ms; }
.eh-stagger > *:nth-child(6) { animation-delay: 460ms; }
.eh-stagger > *:nth-child(7) { animation-delay: 540ms; }
.eh-stagger > *:nth-child(8) { animation-delay: 620ms; }
.eh-stagger > *:nth-child(9) { animation-delay: 700ms; }

/* ── Nav (top bar) ────────────────────────────────────────────── */
.eh-nav {
  height: var(--eh-nav-height);
  display: flex;
  align-items: center;
  gap: var(--eh-sp-3);
  padding: 0 var(--eh-sp-6);
  background: var(--eh-bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--eh-border-subtle);
  position: sticky;
  top: 0;
  z-index: var(--eh-z-nav);
  animation: eh-fade-down var(--eh-dur-base) var(--eh-easing) both;
}

.eh-nav__brand {
  display: flex;
  align-items: center;
  gap: var(--eh-sp-3);
  margin-right: var(--eh-sp-5);
  user-select: none;
}

.eh-nav__brand-text {
  font-size: var(--eh-text-md);
  font-weight: 700;
  letter-spacing: var(--eh-tracking-wide);
  text-transform: uppercase;
  white-space: nowrap;
}

.eh-nav__items {
  display: flex;
  align-items: center;
  gap: var(--eh-sp-1);
  flex: 1;
}

.eh-nav__item {
  appearance: none;
  background: transparent;
  border: 0;
  color: var(--eh-text-secondary);
  font-family: inherit;
  font-size: var(--eh-text-sm);
  font-weight: 500;
  padding: var(--eh-sp-2) var(--eh-sp-4);
  border-radius: var(--eh-radius-sm);
  cursor: pointer;
  position: relative;
  transition: color var(--eh-dur-fast) var(--eh-easing),
              background var(--eh-dur-fast) var(--eh-easing);
}

.eh-nav__item:hover {
  color: var(--eh-text-primary);
  background: var(--eh-border-subtle);
}

.eh-nav__item--active {
  color: var(--eh-text-primary);
}

.eh-nav__item--active::after {
  content: "";
  position: absolute;
  left: var(--eh-sp-4);
  right: var(--eh-sp-4);
  bottom: -2px;
  height: 2px;
  background: var(--eh-gradient-disk);
  border-radius: var(--eh-radius-pill);
  box-shadow: var(--eh-glow-disk);
  animation: eh-fade-in var(--eh-dur-base) var(--eh-easing) both;
}

.eh-nav__meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--eh-sp-3);
  color: var(--eh-text-muted);
  font-size: var(--eh-text-xs);
  letter-spacing: var(--eh-tracking-wide);
  text-transform: uppercase;
}

/* ── Button ───────────────────────────────────────────────────── */
.eh-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--eh-sp-2);
  padding: var(--eh-sp-3) var(--eh-sp-5);
  border: 1px solid var(--eh-border-default);
  border-radius: var(--eh-radius-sm);
  background: var(--eh-bg-raised);
  color: var(--eh-text-primary);
  font-family: inherit;
  font-size: var(--eh-text-sm);
  font-weight: 600;
  letter-spacing: var(--eh-tracking-wide);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    transform var(--eh-dur-fast) var(--eh-easing),
    background var(--eh-dur-fast) var(--eh-easing),
    border-color var(--eh-dur-fast) var(--eh-easing),
    box-shadow var(--eh-dur-fast) var(--eh-easing);
  user-select: none;
  white-space: nowrap;
}

.eh-button:hover:not(:disabled) {
  background: var(--eh-bg-elevated);
  border-color: var(--eh-border-strong);
  transform: translateY(-1px);
}

.eh-button:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  transition-duration: var(--eh-dur-instant);
}

.eh-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Primary: accretion-disk gradient with shimmer on hover. */
.eh-button--primary {
  background: var(--eh-gradient-disk);
  border-color: transparent;
  color: var(--eh-text-inverse);
  box-shadow: var(--eh-shadow-button), var(--eh-glow-disk);
}

.eh-button--primary:hover:not(:disabled) {
  background: var(--eh-gradient-disk);
  border-color: transparent;
  box-shadow:
    var(--eh-shadow-button),
    0 0 32px rgba(255, 107, 61, 0.6);
}

.eh-button--primary::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 30%,
    rgba(255, 255, 255, 0.35) 50%,
    transparent 70%
  );
  transform: translateX(-100%);
  transition: transform 0s;
  pointer-events: none;
}

.eh-button--primary:hover::before {
  animation: eh-shimmer-x 900ms var(--eh-easing) 1;
}

.eh-button--ghost {
  background: transparent;
  border-color: var(--eh-border-default);
}

.eh-button--ghost:hover:not(:disabled) {
  background: var(--eh-border-subtle);
}

.eh-button--danger {
  background: transparent;
  border-color: var(--eh-danger);
  color: var(--eh-danger);
}

.eh-button--danger:hover:not(:disabled) {
  background: rgba(255, 91, 120, 0.12);
  box-shadow: 0 0 16px var(--eh-danger-glow);
}

.eh-button--lg {
  padding: var(--eh-sp-4) var(--eh-sp-6);
  font-size: var(--eh-text-md);
}

.eh-button--sm {
  padding: var(--eh-sp-2) var(--eh-sp-3);
  font-size: var(--eh-text-xs);
}

/* ── Card ─────────────────────────────────────────────────────── */
.eh-card {
  background: var(--eh-bg-raised);
  border: 1px solid var(--eh-border-default);
  border-radius: var(--eh-radius-lg);
  padding: var(--eh-sp-5);
  position: relative;
  overflow: hidden;
  transition:
    transform var(--eh-dur-base) var(--eh-easing),
    border-color var(--eh-dur-base) var(--eh-easing),
    box-shadow var(--eh-dur-base) var(--eh-easing);
}

.eh-card--interactive {
  cursor: pointer;
  user-select: none;
}

.eh-card--interactive:hover {
  transform: translateY(-2px);
  border-color: var(--eh-border-strong);
  box-shadow: var(--eh-shadow-card);
}

.eh-card--interactive:active {
  transform: translateY(0);
  transition-duration: var(--eh-dur-instant);
}

.eh-card--interactive::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: var(--eh-gradient-disk);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  opacity: 0;
  transition: opacity var(--eh-dur-base) var(--eh-easing);
  pointer-events: none;
}

.eh-card--interactive:hover::before {
  opacity: 0.6;
}

.eh-card__title {
  font-size: var(--eh-text-lg);
  font-weight: 600;
  margin: 0 0 var(--eh-sp-2) 0;
  letter-spacing: var(--eh-tracking-tight);
}

.eh-card__body {
  color: var(--eh-text-secondary);
  font-size: var(--eh-text-sm);
  line-height: var(--eh-leading-relaxed);
}

.eh-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--eh-radius-md);
  background: var(--eh-bg-elevated);
  color: var(--eh-disk-pink);
  margin-bottom: var(--eh-sp-4);
  font-size: 22px;
  border: 1px solid var(--eh-border-default);
  position: relative;
  overflow: hidden;
}

.eh-card__icon::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--eh-gradient-disk);
  opacity: 0.18;
  pointer-events: none;
}

.eh-card__footer {
  margin-top: var(--eh-sp-4);
  padding-top: var(--eh-sp-3);
  border-top: 1px solid var(--eh-border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--eh-text-xs);
  color: var(--eh-text-muted);
  letter-spacing: var(--eh-tracking-wide);
  text-transform: uppercase;
}

/* ── Pill ─────────────────────────────────────────────────────── */
.eh-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--eh-sp-1);
  padding: 2px var(--eh-sp-3);
  border-radius: var(--eh-radius-pill);
  background: var(--eh-bg-elevated);
  border: 1px solid var(--eh-border-default);
  color: var(--eh-text-secondary);
  font-size: var(--eh-text-xs);
  font-weight: 600;
  letter-spacing: var(--eh-tracking-wide);
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
}

.eh-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}

.eh-pill--success { color: var(--eh-success); border-color: var(--eh-success-glow); }
.eh-pill--warning { color: var(--eh-warning); border-color: var(--eh-warning-glow); }
.eh-pill--danger  { color: var(--eh-danger);  border-color: var(--eh-danger-glow); }
.eh-pill--info    { color: var(--eh-cyan);    border-color: var(--eh-info-glow); }

/* ── Progress ring ────────────────────────────────────────────── */
.eh-ring {
  position: relative;
  width: var(--eh-ring-size, 64px);
  height: var(--eh-ring-size, 64px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.eh-ring__svg {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}

.eh-ring__track {
  fill: none;
  stroke: var(--eh-border-default);
  stroke-width: 4;
}

.eh-ring__bar {
  fill: none;
  stroke: url(#eh-ring-gradient);
  stroke-width: 4;
  stroke-linecap: round;
  filter: drop-shadow(0 0 4px var(--eh-disk-pink));
  transition: stroke-dashoffset var(--eh-dur-base) var(--eh-easing);
}

.eh-ring__indeterminate {
  animation: eh-spinner var(--eh-dur-warp) linear infinite;
  transform-origin: center;
}

.eh-ring__label {
  font-size: var(--eh-text-xs);
  font-weight: 700;
  color: var(--eh-text-primary);
  font-variant-numeric: tabular-nums;
}

/* ── Step dots (used in wizards) ──────────────────────────────── */
.eh-steps {
  display: inline-flex;
  align-items: center;
  gap: var(--eh-sp-2);
  padding: var(--eh-sp-2) var(--eh-sp-4);
  background: var(--eh-bg-elevated);
  border-radius: var(--eh-radius-pill);
  border: 1px solid var(--eh-border-default);
}

.eh-steps__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--eh-border-strong);
  transition: all var(--eh-dur-base) var(--eh-easing);
}

.eh-steps__dot--active {
  width: 24px;
  border-radius: var(--eh-radius-pill);
  background: var(--eh-gradient-disk);
  box-shadow: var(--eh-glow-disk);
}

.eh-steps__dot--done {
  background: var(--eh-success);
  box-shadow: 0 0 6px var(--eh-success-glow);
}

/* ── Hero (used on HomePage) ──────────────────────────────────── */
.eh-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--eh-sp-8) var(--eh-sp-5) var(--eh-sp-7);
  gap: var(--eh-sp-4);
}

.eh-hero__logo {
  margin-bottom: var(--eh-sp-4);
  animation:
    eh-fade-scale var(--eh-dur-deliberate) var(--eh-easing) both;
}

.eh-hero__title {
  font-size: var(--eh-text-hero);
  font-weight: 800;
  letter-spacing: var(--eh-tracking-tight);
  line-height: var(--eh-leading-tight);
  animation: eh-text-reveal var(--eh-dur-deliberate) var(--eh-easing) 200ms both;
}

.eh-hero__subtitle {
  font-size: var(--eh-text-lg);
  color: var(--eh-text-secondary);
  max-width: 640px;
  line-height: var(--eh-leading-relaxed);
  animation: eh-text-reveal var(--eh-dur-deliberate) var(--eh-easing) 320ms both;
}

.eh-hero__tagline {
  font-size: var(--eh-text-xs);
  letter-spacing: var(--eh-tracking-widest);
  text-transform: uppercase;
  color: var(--eh-cyan);
  margin-bottom: var(--eh-sp-2);
  animation: eh-text-reveal var(--eh-dur-deliberate) var(--eh-easing) 80ms both;
}

/* ── CTA grid (3-up cards on Home) ────────────────────────────── */
.eh-cta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--eh-sp-5);
  max-width: 980px;
  margin: var(--eh-sp-7) auto 0;
  width: 100%;
}

/* ── Empty state ──────────────────────────────────────────────── */
.eh-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--eh-sp-8) var(--eh-sp-5);
  gap: var(--eh-sp-3);
  color: var(--eh-text-muted);
  min-height: 240px;
}

.eh-empty__icon {
  font-size: 48px;
  margin-bottom: var(--eh-sp-3);
  opacity: 0.4;
}

.eh-empty__title {
  font-size: var(--eh-text-lg);
  color: var(--eh-text-secondary);
}

/* ── Coming soon banner (used on placeholder pages) ───────────── */
.eh-coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--eh-sp-8) var(--eh-sp-5);
  gap: var(--eh-sp-4);
  border: 1px dashed var(--eh-border-default);
  border-radius: var(--eh-radius-lg);
  background: var(--eh-bg-glass);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  max-width: 720px;
  margin: 0 auto;
}

.eh-coming-soon__phase {
  font-size: var(--eh-text-xs);
  font-weight: 700;
  letter-spacing: var(--eh-tracking-widest);
  text-transform: uppercase;
  color: var(--eh-cyan);
}

/* ── Form inputs (used by BuildPage form fields) ──────────────── */
.eh-input {
  appearance: none;
  width: 100%;
  background: var(--eh-bg-base);
  color: var(--eh-text-primary);
  border: 1px solid var(--eh-border-subtle);
  border-radius: var(--eh-radius-sm);
  padding: var(--eh-sp-2) var(--eh-sp-3);
  font-size: var(--eh-text-sm);
  font-family: inherit;
  line-height: var(--eh-leading-snug);
  transition: border-color var(--eh-dur-base) var(--eh-easing),
              box-shadow var(--eh-dur-base) var(--eh-easing);
  box-sizing: border-box;
}

.eh-input::placeholder {
  color: var(--eh-text-muted);
}

.eh-input:hover {
  border-color: var(--eh-border-default);
}

.eh-input:focus,
.eh-input:focus-visible {
  outline: none;
  border-color: var(--eh-cyan);
  box-shadow: 0 0 0 3px rgba(76, 201, 240, 0.18);
}

.eh-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.eh-input--textarea {
  min-height: 64px;
  resize: vertical;
  font-family: var(--eh-font-mono);
  font-size: var(--eh-text-xs);
  line-height: var(--eh-leading-relaxed);
}
`;
