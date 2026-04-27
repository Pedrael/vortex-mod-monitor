/**
 * EHRuntime — global "are we busy?" tracker shared between BuildSession
 * and InstallSession.
 *
 * Why this exists: Vortex state (mods, deployment, profile) is mutable
 * and shared. If a curator is mid-build (hashing every mod archive on
 * disk to compute the manifest) and an install simultaneously deploys
 * a new collection, the build's snapshot drifts mid-flight and may
 * emit a `.ehcoll` whose mod set doesn't match the disk by the time
 * it finishes. Inverse hazard for install-during-build is milder
 * (install's snapshot is taken once at planning time) but the install
 * driver still writes downloads/, mods/, and the receipt during the
 * build's hashing pass, which can race the file enumeration we use
 * to derive `bundledArchives`.
 *
 * Cheapest mitigation: the page that's NOT in flight surfaces a
 * "build/install in progress on the other tab" banner, and disables
 * its own Begin button so the user has to consciously dismiss the
 * warning to start a second concurrent operation. We don't outright
 * forbid concurrent operations because:
 *
 *   • The user might know exactly what they're doing.
 *   • The two pipelines NEVER race on receipts vs `.ehcoll` files
 *     (different folders), so the worst case is a stale build, not a
 *     corrupted install.
 *
 * Implementation is deliberately tiny: two booleans + listeners.
 * Sessions push their busy state into here whenever they transition;
 * the React layer subscribes to render the banner.
 */

export interface EHRuntimeSnapshot {
  buildBusy: boolean;
  installBusy: boolean;
}

export type EHRuntimeListener = (snap: EHRuntimeSnapshot) => void;

class EHRuntime {
  private state: EHRuntimeSnapshot = { buildBusy: false, installBusy: false };
  private readonly listeners = new Set<EHRuntimeListener>();

  getSnapshot(): EHRuntimeSnapshot {
    return this.state;
  }

  subscribe(listener: EHRuntimeListener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  setBuildBusy(busy: boolean): void {
    if (this.state.buildBusy === busy) return;
    this.state = { ...this.state, buildBusy: busy };
    this.notify();
  }

  setInstallBusy(busy: boolean): void {
    if (this.state.installBusy === busy) return;
    this.state = { ...this.state, installBusy: busy };
    this.notify();
  }

  private notify(): void {
    const snap = this.state;
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch {
        /* one bad subscriber must not poison the others */
      }
    }
  }
}

let singleton: EHRuntime | undefined;

export function getEHRuntime(): EHRuntime {
  if (singleton === undefined) singleton = new EHRuntime();
  return singleton;
}
