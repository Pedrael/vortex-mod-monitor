/**
 * ──────────────────────────────────────────────────────────────────────
 * Layout and tone utilities.
 *
 * The UI has a real design system — tokens, and ~1,500 lines of component CSS
 * — and the pages route around it. Measured: **393 inline `style={{…}}`
 * blocks**, and what they mostly do is re-derive the same handful of layouts
 * by hand:
 *
 *   19x  color: var(--eh-text-muted)
 *   15x  display:flex; flex-direction:column; gap:<a spacing token>
 *    9x  muted + xs + uppercase + letter-spacing   (a field label)
 *    5x  display:flex; gap:sp-2; flex-wrap:wrap    (a row of pills)
 *    5x  flex:1; min-width:0                       (the item that gives)
 *
 * Written out at 393 call sites, those drift. One page pads a card with
 * `sp-3` and the next with `sp-4`; one muted note is `xs` and another is
 * `sm`; a row wraps here and not there. Nothing is broken and everything is
 * slightly different, which is exactly what "makeshift" looks like.
 *
 * These classes are EXACTLY the styles they replace — same tokens, same
 * values. Converting a call site is a no-op visually, on purpose: a sweep
 * that also changes how things look cannot be reviewed, because every
 * difference could be intentional or a mistake. Make it identical first;
 * change the design afterwards, deliberately.
 * ──────────────────────────────────────────────────────────────────────
 */

export const UTILITIES_CSS = `
/* ── Stacks: the vertical rhythm of a card or a panel ─────────────── */
.eh-stack {
  display: flex;
  flex-direction: column;
  gap: var(--eh-sp-3);
}
.eh-stack--xs { gap: var(--eh-sp-1); }
.eh-stack--sm { gap: var(--eh-sp-2); }
.eh-stack--lg { gap: var(--eh-sp-4); }
.eh-stack--xl { gap: var(--eh-sp-5); }

/* ── Rows: things side by side, wrapping by default ───────────────── */
.eh-row {
  display: flex;
  align-items: center;
  gap: var(--eh-sp-2);
  flex-wrap: wrap;
}
.eh-row--sm { gap: var(--eh-sp-1); }
.eh-row--lg { gap: var(--eh-sp-3); }
/* A row that must stay on one line — a toolbar, not a pill cloud. */
.eh-row--nowrap { flex-wrap: nowrap; }
/* Push everything after this to the far edge. */
.eh-row__spacer { margin-left: auto; }
/* The element that absorbs the leftover width. min-width:0 is what stops a
   long unbroken string (a mod name, a path) forcing the row wider than its
   container — the single most common flexbox surprise. */
.eh-fill {
  flex: 1;
  min-width: 0;
}

/* ── Text tone ────────────────────────────────────────────────────── */
.eh-muted { color: var(--eh-text-muted); }
.eh-secondary { color: var(--eh-text-secondary); }
.eh-strong { color: var(--eh-text-primary); }

/* Small print: a hint under a field, a caveat under a heading. */
.eh-note {
  color: var(--eh-text-muted);
  font-size: var(--eh-text-sm);
  line-height: 1.5;
}

/* The micro-label above a value — uppercase, tracked, quiet. */
.eh-label {
  color: var(--eh-text-muted);
  font-size: var(--eh-text-xs);
  text-transform: uppercase;
  letter-spacing: var(--eh-tracking-wide);
}

/* A key/value line: label of fixed width, value taking the rest. */
.eh-field {
  display: flex;
  gap: var(--eh-sp-2);
  flex-wrap: wrap;
  font-size: var(--eh-text-sm);
}
.eh-field__label {
  color: var(--eh-text-muted);
  min-width: 132px;
}

/* Monospace for things that are identifiers rather than prose. */
.eh-mono {
  font-family: var(--eh-font-mono);
  font-size: var(--eh-text-xs);
  word-break: break-all;
}
`;
