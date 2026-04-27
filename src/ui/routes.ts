/**
 * Internal route table for the Event Horizon mainPage.
 *
 * We deliberately do NOT use `react-router` — Vortex hosts our page
 * inside its own electron-router and adding another router would
 * fight the host. Instead we use a tiny `useState`-backed route hook
 * (see `EventHorizonMainPage.tsx`).
 *
 * Routes are flat (no params) for Phase 5.0; the install wizard in
 * Phase 5.1 will overlay state on top of the `install` route via a
 * sub-state machine, not via URL segments.
 */

export type EventHorizonRoute =
  | "home"
  | "install"
  | "collections"
  | "build"
  | "about";

export interface RouteDescriptor {
  id: EventHorizonRoute;
  label: string;
  description: string;
  /**
   * Vortex icon name (rendered via `<Icon name="..." />`). We pick
   * names that exist in Vortex's bundled icon set.
   */
  icon: string;
  /**
   * If true, the nav item is hidden until that route is feature-flagged
   * on. Used to soft-launch unfinished pages.
   */
  hidden?: boolean;
}

export const ROUTES: RouteDescriptor[] = [
  {
    id: "home",
    label: "Dashboard",
    description: "Overview, system status, and recent activity",
    icon: "home",
  },
  {
    id: "install",
    label: "Install",
    description: "Install an Event Horizon collection",
    icon: "download",
  },
  {
    id: "collections",
    label: "My Collections",
    description: "Installed collections and receipts",
    icon: "layers",
  },
  {
    id: "build",
    label: "Build",
    description: "Package your current setup as a collection",
    icon: "save",
  },
  {
    id: "about",
    label: "About",
    description: "About Event Horizon",
    icon: "about",
  },
];
