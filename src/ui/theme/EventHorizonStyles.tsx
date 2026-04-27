/**
 * Single source of CSS truth for the Event Horizon UI.
 *
 * All theme files (`tokens`, `keyframes`, `base`, `components`,
 * `logo`) export plain CSS strings. This component concatenates them
 * and renders them in one `<style>` tag at the top of our React tree.
 *
 * Why inline `<style>` instead of importing `.css` files?
 *   The extension is built with plain `tsc` (no bundler / loader).
 *   tsc cannot bundle CSS and Vortex's runtime won't resolve
 *   `import "./foo.css"` magic. Inline strings ship as part of the
 *   compiled JS, no extra build pipeline required.
 *
 * Idempotency: the `<style>` carries a stable `id` so React's render
 * never produces duplicates even if the EventHorizonMainPage is
 * mounted/unmounted multiple times. Vortex tends to keep mainPages
 * mounted but defensive against re-mount churn.
 */

import * as React from "react";

import { TOKENS_CSS } from "./tokens";
import { KEYFRAMES_CSS } from "./keyframes";
import { BASE_CSS } from "./base";
import { COMPONENTS_CSS } from "./components";
import { LOGO_CSS } from "./logo";

const STYLE_ID = "eh-styles";

const COMBINED_CSS = [
  TOKENS_CSS,
  KEYFRAMES_CSS,
  BASE_CSS,
  COMPONENTS_CSS,
  LOGO_CSS,
].join("\n\n");

export function EventHorizonStyles(): JSX.Element {
  return (
    <style
      id={STYLE_ID}
      dangerouslySetInnerHTML={{ __html: COMBINED_CSS }}
    />
  );
}
