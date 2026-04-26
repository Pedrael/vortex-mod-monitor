import type { types } from "vortex-api";

import createExportModsAction from "./actions/exportModsAction";
import createCompareModsAction from "./actions/compareModsAction";
import { createComparePluginsAction } from "./actions/comparePluginsAction";
import createBuildPackageAction from "./actions/buildPackageAction";
import createInstallCollectionAction from "./actions/installCollectionAction";

function init(context: types.IExtensionContext): boolean {
  const exportModsAction = createExportModsAction(context);
  const compareModsAction = createCompareModsAction(context);
  const comparePluginsAction = createComparePluginsAction(context);
  const buildPackageAction = createBuildPackageAction(context);
  const installCollectionAction = createInstallCollectionAction(context);

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

  context.registerAction(
    "global-icons",
    102,
    "show",
    {},
    "Build Event Horizon Collection",
    () => {
      void buildPackageAction();
    },
  );

  context.registerAction(
    "global-icons",
    103,
    "show",
    {},
    "Install Event Horizon Collection",
    () => {
      void installCollectionAction();
    },
  );

  return true;
}

export default init;
