import * as path from "path";
import { util, type types } from "vortex-api";

import createExportModsAction from "./actions/exportModsAction";
import createCompareModsAction from "./actions/compareModsAction";
import { createComparePluginsAction } from "./actions/comparePluginsAction";
import createBuildPackageAction from "./actions/buildPackageAction";
import createInstallCollectionAction from "./actions/installCollectionAction";
import { EventHorizonMainPage } from "./ui";

/**
 * Symbol id of the Event Horizon glyph inside our SVG sprite.
 * Must match the `<symbol id="...">` in `assets/icons/event-horizon.svg`.
 *
 * Vortex's <Icon name=...> component walks all installed icon sets and
 * resolves the first matching symbol id, so a unique-by-prefix name
 * (`event-horizon-logo`) avoids any collisions with the bundled
 * font-awesome / nucleo sets.
 */
const EH_SIDEBAR_ICON = "event-horizon-logo";

/**
 * Lazily install the monochrome SVG sprite used for the sidebar tab.
 * Called once on first context render — failure is non-fatal: we just
 * fall back to the default font-awesome glyph (`compare`) so the page
 * is still reachable even when the asset is missing.
 *
 * Resolves __dirname relative to the compiled extension entry point.
 * In production Vortex copies the extension folder verbatim, so the
 * sprite lives at `<extDir>/assets/icons/event-horizon.svg`.
 */
function installEventHorizonIconSet(): void {
  try {
    const setPath = path.join(
      __dirname,
      "..",
      "assets",
      "icons",
      "event-horizon.svg",
    );
    void util.installIconSet("event-horizon", setPath).catch((err: unknown) => {
      // Best-effort — never crash extension load over a missing icon.
      // eslint-disable-next-line no-console
      console.warn("[Event Horizon] failed to install icon set:", err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Event Horizon] icon set install threw:", err);
  }
}

function init(context: types.IExtensionContext): boolean {
  const exportModsAction = createExportModsAction(context);
  const compareModsAction = createCompareModsAction(context);
  const comparePluginsAction = createComparePluginsAction(context);
  const buildPackageAction = createBuildPackageAction(context);
  const installCollectionAction = createInstallCollectionAction(context);

  // Install our custom sidebar glyph BEFORE registering the main page —
  // the icon registry must contain the symbol id by the time Vortex
  // first resolves the sidebar tab.
  installEventHorizonIconSet();
  // Register the Event Horizon mainPage. Vortex renders this in its
  // sidebar under the "global" group (visible regardless of which
  // game profile is active). Phase 5.0 wires up the shell, nav,
  // animated logo, and placeholder pages; later slices fill in the
  // install / collections / build flows.
  // The `props` callback runs every time Vortex re-renders the main
  // page; we use it to inject the live `IExtensionApi` so our React
  // tree can call into Vortex (file pickers, dispatch, getState,
  // showDialog fallbacks, ...) without us hand-threading it everywhere.
  context.registerMainPage(
    EH_SIDEBAR_ICON,
    "Event Horizon",
    EventHorizonMainPage,
    {
      id: "event-horizon",
      group: "global",
      priority: 50,
      props: () => ({ api: context.api }),
    },
  );

  context.registerAction(
    "global-icons",
    100,
    "show",
    {},
    "Export Mods To JSON",
    () => {
      void exportModsAction();
    },
  );

  context.registerAction(
    "global-icons",
    101,
    "show",
    {},
    "Compare Current Mods With JSON",
    () => {
      void compareModsAction();
    },
  );

  context.registerAction(
    "gamebryo-plugin-icons",
    150,
    "show",
    {},
    "Compare Plugins With TXT",
    () => {
      void comparePluginsAction();
    },
  );

  // Toolbar fallbacks — kept so power users can hit the same flows
  // outside the Event Horizon main page (handy for CI / scripted
  // testing). The mainPage is the recommended UX.
  context.registerAction(
    "global-icons",
    102,
    "show",
    {},
    "Event Horizon: Build (legacy dialog)",
    () => {
      void buildPackageAction();
    },
  );

  context.registerAction(
    "global-icons",
    103,
    "show",
    {},
    "Event Horizon: Install (legacy dialog)",
    () => {
      void installCollectionAction();
    },
  );

  return true;
}

export default init;
