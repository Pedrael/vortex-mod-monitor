import type { types } from "vortex-api";

import createExportModsAction from "./actions/exportModsAction";
import createCompareModsAction from "./actions/compareModsAction";

function init(context: types.IExtensionContext): boolean {
  const exportModsAction = createExportModsAction(context);
  const compareModsAction = createCompareModsAction(context);

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

  return true;
}

export default init;
