/**
 * The one place that decides what a built `.ehcoll` is called.
 *
 * It lived inside `buildPackageAction` as a private helper, which was fine
 * while exactly one thing produced the name and nothing ever had to find the
 * file again. The Collection Doctor has to find it again — most of its repairs
 * re-run pipeline steps that read the manifest — and a second, hand-copied
 * version of this rule would be a slow-motion bug: the two would agree today
 * and disagree the first time either changed, surfacing as a Doctor that
 * cannot locate a package sitting right in front of it.
 *
 * Both the writer and the finder now import this.
 */

/** Package name → filename slug. */
export function slugifyPackageName(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      // Long names are legal and unbounded; filesystems are not.
      .slice(0, 64) || "collection"
  );
}

/** Version → filename-safe version. Dots and dashes survive; nothing else. */
export function safePackageVersion(version: string): string {
  return version.replace(/[^a-zA-Z0-9.-]/g, "-");
}

/** `<slug>-<version>.ehcoll` — the name the packager writes. */
export function buildOutputFileName(name: string, version: string): string {
  return `${slugifyPackageName(name)}-${safePackageVersion(version)}.ehcoll`;
}
