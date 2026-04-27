/**
 * React hook that surfaces the EHRuntime busy snapshot. Used by the
 * Build / Install pages to render a warning banner when the OTHER
 * pipeline is in flight.
 */

import * as React from "react";

import {
  getEHRuntime,
  type EHRuntimeSnapshot,
} from "./ehRuntime";

export function useEHRuntime(): EHRuntimeSnapshot {
  const runtime = React.useMemo(() => getEHRuntime(), []);
  const [snap, setSnap] = React.useState<EHRuntimeSnapshot>(() =>
    runtime.getSnapshot(),
  );
  React.useEffect(() => {
    setSnap(runtime.getSnapshot());
    return runtime.subscribe(setSnap);
  }, [runtime]);
  return snap;
}
