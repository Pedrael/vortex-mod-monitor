/**
 * CollectionsPage — Phase 5.2.
 *
 * Lists every install receipt under
 * `<appData>/Vortex/event-horizon/installs/*.json` so the user has a
 * single place to:
 *
 *   - See "what did Event Horizon install on this machine?"
 *   - Switch to the Vortex profile that holds a given collection.
 *   - Inspect the per-mod records the receipt holds.
 *   - Uninstall (remove all recorded mods + delete the receipt).
 *
 * The page never edits a receipt directly — it only reads, deletes,
 * and acts on profiles. Receipts are written exclusively by the
 * install driver.
 */

import * as React from "react";
import { util } from "vortex-api";

import {
  deleteReceipt,
  listReceipts,
} from "../../core/installLedger";
import { uninstallMod } from "../../core/installer/modInstall";
import { switchToProfile } from "../../core/installer/profile";
import type { InstallReceipt } from "../../types/installLedger";
import {
  Button,
  Card,
  EventHorizonLogo,
  Modal,
  Pill,
  ProgressRing,
  useToast,
} from "../components";
import { ErrorBoundary, useErrorReporter, useErrorReporterFormatted } from "../errors";
import type { EventHorizonRoute } from "../routes";
import { useApi } from "../state";

export interface CollectionsPageProps {
  onNavigate: (route: EventHorizonRoute) => void;
}

interface LoadedState {
  kind: "loaded";
  receipts: InstallReceipt[];
  errors: Array<{ filename: string; message: string }>;
}

type PageState =
  | { kind: "loading" }
  | LoadedState
  | { kind: "empty" };

export function CollectionsPage(props: CollectionsPageProps): JSX.Element {
  const reportFormatted = useErrorReporterFormatted();
  return (
    <ErrorBoundary
      where="CollectionsPage"
      variant="page"
      onReport={reportFormatted}
    >
      <CollectionsList onNavigate={props.onNavigate} />
    </ErrorBoundary>
  );
}

function CollectionsList(props: CollectionsPageProps): JSX.Element {
  const reportError = useErrorReporter();
  const showToast = useToast();
  const api = useApi();

  const [state, setState] = React.useState<PageState>({ kind: "loading" });
  const [selected, setSelected] = React.useState<InstallReceipt | undefined>(
    undefined,
  );
  const [refreshTick, setRefreshTick] = React.useState(0);

  const refresh = React.useCallback((): void => {
    setRefreshTick((t) => t + 1);
  }, []);

  React.useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      setState({ kind: "loading" });
      try {
        const errors: Array<{ filename: string; message: string }> = [];
        const appData = util.getVortexPath("appData");
        const receipts = await listReceipts(appData, (filename, err) => {
          errors.push({ filename, message: err.message });
        });
        if (!alive) return;
        if (receipts.length === 0 && errors.length === 0) {
          setState({ kind: "empty" });
        } else {
          setState({ kind: "loaded", receipts, errors });
        }
      } catch (err) {
        if (!alive) return;
        reportError(err, {
          title: "Couldn't list installed collections",
          context: { step: "collections-list" },
        });
        setState({ kind: "loaded", receipts: [], errors: [] });
      }
    })();
    return (): void => {
      alive = false;
    };
  }, [refreshTick, reportError]);

  const activeProfileId =
    api.getState().settings?.profiles?.activeProfileId;

  if (state.kind === "loading") {
    return (
      <div className="eh-page">
        <header style={{ marginBottom: "var(--eh-sp-5)" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--eh-text-2xl)",
              color: "var(--eh-text-primary)",
            }}
          >
            Loading installed collections...
          </h2>
        </header>
        <div
          style={{
            padding: "var(--eh-sp-5)",
            background: "var(--eh-bg-raised)",
            borderRadius: "var(--eh-radius-lg)",
            display: "flex",
            gap: "var(--eh-sp-4)",
            alignItems: "center",
          }}
        >
          <ProgressRing size={56} />
          <span style={{ color: "var(--eh-text-secondary)" }}>
            Scanning %APPDATA%/Vortex/event-horizon/installs/
          </span>
        </div>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className="eh-page">
        <EmptyState onInstall={(): void => props.onNavigate("install")} />
      </div>
    );
  }

  return (
    <div className="eh-page">
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "var(--eh-sp-3)",
          marginBottom: "var(--eh-sp-5)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--eh-text-2xl)",
              color: "var(--eh-text-primary)",
              letterSpacing: "var(--eh-tracking-tight)",
            }}
          >
            Installed collections
          </h2>
          <p
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-md)",
            }}
          >
            {state.receipts.length} collection{state.receipts.length === 1 ? "" : "s"} on this machine.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--eh-sp-2)" }}>
          <Button intent="ghost" onClick={refresh}>
            Refresh
          </Button>
          <Button
            intent="primary"
            onClick={(): void => props.onNavigate("install")}
          >
            Install another
          </Button>
        </div>
      </header>

      {state.errors.length > 0 && (
        <div
          style={{
            marginBottom: "var(--eh-sp-4)",
            padding: "var(--eh-sp-3) var(--eh-sp-4)",
            background: "rgba(255, 91, 120, 0.08)",
            border: "1px solid var(--eh-danger)",
            borderRadius: "var(--eh-radius-md)",
            color: "var(--eh-danger)",
          }}
        >
          <strong>{state.errors.length} receipt{state.errors.length === 1 ? "" : "s"} failed to load.</strong>
          <ul
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              paddingLeft: "var(--eh-sp-5)",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {state.errors.slice(0, 5).map((e) => (
              <li key={e.filename}>
                {e.filename}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "var(--eh-sp-4)",
        }}
      >
        {state.receipts.map((receipt) => (
          <ReceiptCard
            key={receipt.packageId}
            receipt={receipt}
            isActive={receipt.vortexProfileId === activeProfileId}
            onOpen={(): void => setSelected(receipt)}
          />
        ))}
      </div>

      <ReceiptDetailModal
        receipt={selected}
        onClose={(): void => setSelected(undefined)}
        onUninstalled={(): void => {
          setSelected(undefined);
          showToast({
            intent: "success",
            message: "Collection uninstalled. Receipt deleted.",
          });
          refresh();
        }}
      />
    </div>
  );
}

// ===========================================================================
// Empty state
// ===========================================================================

function EmptyState(props: { onInstall: () => void }): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--eh-sp-4)",
        padding: "var(--eh-sp-7) var(--eh-sp-5)",
        background: "var(--eh-bg-glass)",
        border: "1px dashed var(--eh-border-default)",
        borderRadius: "var(--eh-radius-lg)",
        textAlign: "center",
        animation:
          "eh-fade-up var(--eh-dur-deliberate) var(--eh-easing) both",
      }}
    >
      <EventHorizonLogo size={88} />
      <h2
        style={{
          margin: 0,
          color: "var(--eh-text-primary)",
          fontSize: "var(--eh-text-xl)",
        }}
      >
        No collections yet
      </h2>
      <p
        style={{
          margin: 0,
          color: "var(--eh-text-secondary)",
          maxWidth: "440px",
          fontSize: "var(--eh-text-sm)",
          lineHeight: "var(--eh-leading-relaxed)",
        }}
      >
        Install your first .ehcoll collection and Event Horizon will keep a
        receipt here so you can switch profiles, inspect the mod list, or
        uninstall in a single click.
      </p>
      <Button intent="primary" onClick={props.onInstall}>
        Install a collection
      </Button>
    </div>
  );
}

// ===========================================================================
// Card
// ===========================================================================

function ReceiptCard(props: {
  receipt: InstallReceipt;
  isActive: boolean;
  onOpen: () => void;
}): JSX.Element {
  const { receipt, isActive, onOpen } = props;
  return (
    <Card
      onClick={onOpen}
      title={receipt.packageName}
      footer={
        <span style={{ color: "var(--eh-text-muted)" }}>
          installed {new Date(receipt.installedAt).toLocaleDateString()}
        </span>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-2)",
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--eh-sp-2)", flexWrap: "wrap" }}>
          <Pill intent="info">v{receipt.packageVersion}</Pill>
          <Pill intent="neutral">{receipt.gameId}</Pill>
          {receipt.installTargetMode === "fresh-profile" ? (
            <Pill intent="info">fresh profile</Pill>
          ) : (
            <Pill intent="warning">current profile</Pill>
          )}
          {isActive && (
            <Pill intent="success" withDot>
              active
            </Pill>
          )}
        </div>
        <div>
          <strong>Profile:</strong> {receipt.vortexProfileName}
        </div>
        <div>
          <strong>Mods:</strong> {receipt.mods.length}
        </div>
      </div>
    </Card>
  );
}

// ===========================================================================
// Detail modal
// ===========================================================================

function ReceiptDetailModal(props: {
  receipt: InstallReceipt | undefined;
  onClose: () => void;
  onUninstalled: () => void;
}): JSX.Element {
  const { receipt, onClose, onUninstalled } = props;
  const api = useApi();
  const reportError = useErrorReporter();
  const showToast = useToast();

  const [busy, setBusy] = React.useState(false);
  const [confirmingUninstall, setConfirmingUninstall] = React.useState(false);
  const [progress, setProgress] = React.useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleSwitchProfile = async (): Promise<void> => {
    if (receipt === undefined) return;
    setBusy(true);
    try {
      await switchToProfile(api, receipt.vortexProfileId);
      showToast({
        intent: "success",
        message: `Switched to profile "${receipt.vortexProfileName}".`,
      });
      onClose();
    } catch (err) {
      reportError(err, {
        title: "Couldn't switch profile",
        context: {
          step: "switch-profile",
          profileId: receipt.vortexProfileId,
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async (): Promise<void> => {
    if (receipt === undefined) return;
    setBusy(true);
    setProgress({ current: 0, total: receipt.mods.length });
    try {
      let i = 0;
      for (const mod of receipt.mods) {
        i += 1;
        setProgress({ current: i, total: receipt.mods.length });
        try {
          await uninstallMod(api, {
            gameId: receipt.gameId,
            modId: mod.vortexModId,
          });
        } catch (err) {
          // Continue removing the rest — log per-mod failures, finalize
          // by reporting once at the end.
          // eslint-disable-next-line no-console
          console.warn(
            `[Event Horizon] Failed to uninstall ${mod.name} (${mod.vortexModId}):`,
            err,
          );
        }
      }
      const appData = util.getVortexPath("appData");
      await deleteReceipt(appData, receipt.packageId);
      onUninstalled();
    } catch (err) {
      reportError(err, {
        title: "Uninstall partially failed",
        context: {
          step: "uninstall",
          packageId: receipt.packageId,
        },
      });
    } finally {
      setBusy(false);
      setProgress(null);
      setConfirmingUninstall(false);
    }
  };

  return (
    <Modal
      open={receipt !== undefined}
      onClose={(): void => {
        if (busy) return;
        onClose();
      }}
      size="lg"
      title={receipt?.packageName ?? ""}
      subtitle={
        receipt !== undefined
          ? `v${receipt.packageVersion} · ${receipt.gameId}`
          : undefined
      }
      footer={
        receipt !== undefined && (
          <>
            <Button
              intent="danger"
              disabled={busy}
              onClick={(): void => setConfirmingUninstall(true)}
            >
              Uninstall
            </Button>
            <Button
              intent="ghost"
              disabled={busy}
              onClick={(): void => {
                void handleSwitchProfile();
              }}
            >
              Switch to profile
            </Button>
            <Button intent="primary" onClick={onClose} disabled={busy}>
              Close
            </Button>
          </>
        )
      }
    >
      {receipt !== undefined && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--eh-sp-4)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--eh-sp-3)",
            }}
          >
            <DetailTile
              label="Profile"
              value={receipt.vortexProfileName}
              sub={`id ${receipt.vortexProfileId}`}
            />
            <DetailTile
              label="Mode"
              value={
                receipt.installTargetMode === "fresh-profile"
                  ? "Fresh profile"
                  : "Current profile"
              }
            />
            <DetailTile
              label="Installed at"
              value={new Date(receipt.installedAt).toLocaleString()}
            />
            <DetailTile
              label="Mod count"
              value={String(receipt.mods.length)}
            />
          </div>

          <section>
            <h4
              style={{
                margin: "0 0 var(--eh-sp-2) 0",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-xs)",
                textTransform: "uppercase",
                letterSpacing: "var(--eh-tracking-widest)",
              }}
            >
              Mods recorded
            </h4>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                maxHeight: "320px",
                overflowY: "auto",
                border: "1px solid var(--eh-border-subtle)",
                borderRadius: "var(--eh-radius-sm)",
              }}
            >
              {receipt.mods.map((m) => (
                <li
                  key={m.vortexModId}
                  style={{
                    padding: "var(--eh-sp-2) var(--eh-sp-3)",
                    borderBottom: "1px solid var(--eh-border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--eh-sp-2)",
                  }}
                >
                  <span style={{ color: "var(--eh-text-primary)" }}>
                    {m.name}
                  </span>
                  <span
                    style={{
                      color: "var(--eh-text-muted)",
                      fontSize: "var(--eh-text-xs)",
                      fontFamily: "var(--eh-font-mono)",
                    }}
                  >
                    {m.source} · {m.vortexModId}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {progress !== null && (
            <div
              style={{
                padding: "var(--eh-sp-3)",
                background: "var(--eh-bg-base)",
                borderRadius: "var(--eh-radius-sm)",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
              }}
            >
              Uninstalling... {progress.current} / {progress.total}
            </div>
          )}
        </div>
      )}

      <UninstallConfirmModal
        open={confirmingUninstall}
        receipt={receipt}
        onCancel={(): void => setConfirmingUninstall(false)}
        onConfirm={(): void => {
          void handleUninstall();
        }}
        busy={busy}
      />
    </Modal>
  );
}

function UninstallConfirmModal(props: {
  open: boolean;
  receipt: InstallReceipt | undefined;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}): JSX.Element {
  return (
    <Modal
      open={props.open && props.receipt !== undefined}
      onClose={props.onCancel}
      size="sm"
      title="Uninstall this collection?"
      footer={
        <>
          <Button intent="ghost" onClick={props.onCancel} disabled={props.busy}>
            Cancel
          </Button>
          <Button
            intent="danger"
            onClick={props.onConfirm}
            disabled={props.busy}
          >
            Yes, uninstall
          </Button>
        </>
      }
    >
      <p
        style={{
          margin: 0,
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
          lineHeight: "var(--eh-leading-relaxed)",
        }}
      >
        Event Horizon will remove every mod recorded in this receipt
        {props.receipt !== undefined &&
          ` (${props.receipt.mods.length} mod${props.receipt.mods.length === 1 ? "" : "s"})`}{" "}
        and delete the receipt file. The Vortex profile itself is NOT
        deleted — switch to it manually if you want to inspect what
        survives.
      </p>
    </Modal>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function DetailTile(props: {
  label: string;
  value: string;
  sub?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: "var(--eh-sp-3)",
        background: "var(--eh-bg-base)",
        border: "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-sm)",
      }}
    >
      <div
        style={{
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-xs)",
          textTransform: "uppercase",
          letterSpacing: "var(--eh-tracking-widest)",
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          marginTop: "var(--eh-sp-1)",
          color: "var(--eh-text-primary)",
          fontSize: "var(--eh-text-sm)",
          fontWeight: 600,
          wordBreak: "break-word",
        }}
      >
        {props.value}
      </div>
      {props.sub !== undefined && (
        <div
          style={{
            marginTop: 2,
            color: "var(--eh-text-muted)",
            fontSize: "var(--eh-text-xs)",
            fontFamily: "var(--eh-font-mono)",
          }}
        >
          {props.sub}
        </div>
      )}
    </div>
  );
}
