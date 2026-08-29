/**
 * Minimal types for `react-dom/server`.
 *
 * `@types/react-dom` is not a dependency of this project and adding one for a
 * dev-only rendering harness would put a package in the tree that nothing
 * shipped ever imports. Only `renderToStaticMarkup` is used, and only by
 * `renderScreens.test.ts`, so the surface declared here is exactly the surface
 * consumed — a fuller stub would be a maintenance burden claiming to describe
 * an API nobody calls.
 *
 * Emits nothing: declarations produce no JavaScript.
 */
declare module "react-dom/server" {
  import type { ReactElement } from "react";
  export function renderToStaticMarkup(element: ReactElement): string;
}
