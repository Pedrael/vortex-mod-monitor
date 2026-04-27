/**
 * useKeyboardShortcut — bind a callback to a single key while the
 * component is mounted.
 *
 * Designed for wizard step screens where we want:
 *   - `Enter` to fire the primary action ("Continue", "Install"...)
 *   - `Escape` to fire the secondary action ("Back", "Cancel"...)
 *
 * Rules:
 *   - We attach to `window` in capture phase so it works no matter
 *     where focus lives. We still skip the event when focus is inside
 *     an editable element (input, textarea, contenteditable, select)
 *     because the user is plainly typing, not commanding.
 *   - We skip when any modifier (Ctrl, Meta, Alt) is held — those are
 *     for global Vortex/OS shortcuts.
 *   - Listener is rebuilt only when `key` or `enabled` change. The
 *     callback is read through a ref so callers can pass inline
 *     arrows without thrashing the listener every render.
 */

import * as React from "react";

export type ShortcutKey = "Enter" | "Escape";

export interface UseKeyboardShortcutOptions {
  enabled?: boolean;
}

export function useKeyboardShortcut(
  key: ShortcutKey,
  callback: () => void,
  options: UseKeyboardShortcutOptions = {},
): void {
  const enabled = options.enabled !== false;
  const cbRef = React.useRef(callback);
  React.useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== key) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      cbRef.current();
    };
    window.addEventListener("keydown", handler, true);
    return (): void => {
      window.removeEventListener("keydown", handler, true);
    };
  }, [key, enabled]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (target === null) return false;
  const el = target as HTMLElement;
  if (typeof el.tagName !== "string") return false;
  const tag = el.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable === true) return true;
  return false;
}
