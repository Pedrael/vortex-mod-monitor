/**
 * Event Horizon keyframe library.
 *
 * Every animation in the app pulls from this file. Naming convention:
 *  - `eh-rotate-*`      : continuous rotation (logo, orbit decorations)
 *  - `eh-pulse-*`       : breathing scale/opacity loops
 *  - `eh-fade-*`        : entrance / exit transitions (used with
 *                         animation-fill-mode: both)
 *  - `eh-shimmer-*`     : translate-based gradient sweeps
 *  - `eh-warp-*`        : the signature "lensing pulse" — scale + blur
 *
 * All entrance keyframes start at 0 opacity and translate from a
 * direction; pair with `animation-fill-mode: both` so they hold their
 * end state after running.
 */

export const KEYFRAMES_CSS = `
@keyframes eh-rotate-cw {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes eh-rotate-ccw {
  from { transform: rotate(360deg); }
  to   { transform: rotate(0deg); }
}

@keyframes eh-pulse-scale {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.04); }
}

@keyframes eh-pulse-opacity {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}

@keyframes eh-pulse-glow {
  0%, 100% { filter: brightness(1) drop-shadow(0 0 8px rgba(255, 107, 61, 0.35)); }
  50%      { filter: brightness(1.15) drop-shadow(0 0 24px rgba(255, 107, 61, 0.6)); }
}

@keyframes eh-warp-pulse {
  0%, 88%, 100% {
    transform: scale(1);
    filter: blur(0);
  }
  92% {
    transform: scale(1.025);
    filter: blur(0.5px);
  }
  96% {
    transform: scale(0.995);
    filter: blur(0);
  }
}

@keyframes eh-shimmer-x {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes eh-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes eh-fade-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes eh-fade-down {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes eh-fade-scale {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes eh-text-reveal {
  from {
    opacity: 0;
    transform: translateY(8px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@keyframes eh-doppler-sweep {
  0% {
    opacity: 0;
    transform: rotate(0deg);
  }
  20% { opacity: 0.9; }
  80% { opacity: 0.9; }
  100% {
    opacity: 0;
    transform: rotate(360deg);
  }
}

@keyframes eh-orbit {
  from {
    transform: rotate(0deg) translateX(var(--eh-orbit-radius, 24px)) rotate(0deg);
  }
  to {
    transform: rotate(360deg) translateX(var(--eh-orbit-radius, 24px)) rotate(-360deg);
  }
}

@keyframes eh-twinkle {
  0%, 100% { opacity: 0.15; }
  50%      { opacity: 0.85; }
}

@keyframes eh-progress-indeterminate {
  0%   { transform: translateX(-100%) scaleX(0.4); }
  50%  { transform: translateX(0%) scaleX(0.6); }
  100% { transform: translateX(100%) scaleX(0.4); }
}

@keyframes eh-spinner {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes eh-slide-in-right {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
`;
