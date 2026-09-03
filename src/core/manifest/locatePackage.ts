/**
 * Find the `.ehcoll` a receipt came from.
 *
 * Two features need it and neither can work without it: the Collection Doctor
 * repairs by re-running pipeline steps that read the manifest, and "check and
 * continue" hands the package back to the installer. Both start from a
 * receipt, which records the package's NAME and VERSION but not where the file
 * is.
 *
 * Extracted because the Doctor grew this logic inline first, and a second
 * hand-rolled copy in My Collections is how two callers start disagreeing
 * about which package belongs to a collection — the same shape of bug that put
 * `treatAsExternal` into the manifest and past two bundling gates that had
 * never heard of it.
 *
 * Never throws: a missing or unreadable collections folder means "not found",
 * and both callers already handle that by asking the user to point at the file.
 */

import { matchEhcollFile } from "../doctor/heal";

export interface LocatedPackage {
  /** Absolute path to the `.ehcoll`. */
  path: string;
  /** Filename that matched, for the message when we want to name it. */
  fileName: string;
}

export async function locateCollectionPackage(args: {
  packageName: string;
  packageVersion: string;
}): Promise<LocatedPackage | undefined> {
  try {
    const [{ getCollectionsDir }, fsp, path] = await Promise.all([
      import("../paths"),
      import("fs/promises"),
      import("path"),
    ]);
    const dir = getCollectionsDir();
    const files = await fsp.readdir(dir).catch(() => [] as string[]);
    const match = matchEhcollFile(
      files,
      args.packageName,
      args.packageVersion,
    );
    if (match === undefined) return undefined;
    return { path: path.join(dir, match), fileName: match };
  } catch {
    return undefined;
  }
}
