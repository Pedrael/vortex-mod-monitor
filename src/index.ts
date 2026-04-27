import type { types } from "vortex-api";

import createExportModsAction from "./actions/exportModsAction";
import createCompareModsAction from "./actions/compareModsAction";
import { createComparePluginsAction } from "./actions/comparePluginsAction";
import createBuildPackageAction from "./actions/buildPackageAction";
import createInstallCollectionAction from "./actions/installCollectionAction";
import { EventHorizonMainPage } from "./ui";

function init(context: types.IExtensionContext): boolean {
  const exportModsAction = createExportModsAction(context);
  const compareModsAction = createCompareModsAction(context);
  const comparePluginsAction = createComparePluginsAction(context);
  const buildPackageAction = createBuildPackageAction(context);
  const installCollectionAction = createInstallCollectionAction(context);

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
    "compare",
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
    "global-icons",
    101,
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
