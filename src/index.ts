import type { types } from "vortex-api";

import createExportModsAction from "./actions/exportModsAction";
import createCompareModsAction from "./actions/compareModsAction";
import { createComparePluginsAction } from "./actions/comparePluginsAction";

function init(context: types.IExtensionContext): boolean {
  const exportModsAction = createExportModsAction(context);
  const compareModsAction = createCompareModsAction(context);
  const comparePluginsAction = createComparePluginsAction(context);

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

  return true;
}

export default init;
