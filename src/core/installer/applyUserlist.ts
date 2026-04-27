/**
 * LOOT userlist application — Phase 3 slice 6d.
 *
 * Walks `manifest.userlist` (plugin-to-plugin rules + groups) and
 * dispatches the `extension-plugin-management` Redux actions so the
 * user-side `state.userlist` matches the curator's. The persistor
 * downstream of those actions writes `userlist.yaml`, which LOOT
 * reads at sort-time during deploy — so this is what actually moves
 * the user's `plugins.txt`.
 *
 * ─── DESIGN NOTES ──────────────────────────────────────────────────────
 *
 * **Why dispatch (not direct YAML write)?**
 * Vortex's `UserlistPersistor` is bidirectional but asymmetric:
 *   - Redux state changes → YAML file is rewritten (continuous sync).
 *   - YAML file changes → state is NOT re-loaded until game-mode
 *     switch or extension init.
 * So writing YAML directly leaves Redux state stale; the next time
 * Vortex serializes (any future userlist mutation, even a `setGroup`
 * triggered by the auto-sort dialog) it will overwrite our YAML with
 * the stale Redux snapshot. Dispatching keeps both halves coherent.
 *
 * **Why no public Vortex action import?**
 * `vortex-api` does NOT re-export the userlist actions — they live
 * inside the `extension-plugin-management` extension's private
 * `actions/userlist.ts`. We dispatch the raw Redux action objects
 * with the exact `type` strings the reducer matches on. The strings
 * are stable (they ship inside a published Vortex bundle the user is
 * running; changing them would break the extension's own UI).
 *
 * **Verification-on-dispatch (the reason the user asked us to keep
 * this dispatch-based)**:
 * After every dispatch we re-read `api.getState().userlist` and
 * confirm the expected mutation appeared. If it didn't, the entry is
 * recorded as a *verification failure* — the message includes the
 * dispatched type, payload, and a brief state diff. That's our
 * canary for "Vortex changed the action contract and the silent
 * no-op didn't surface elsewhere." It's the difference between
 * "everything looks fine but plugins.txt is wrong" (current Vortex
 * collections experience for adjacent paths) and "we got an
 * actionable error in the receipt's skippedUserlist list."
 *
 * **Conflict policy ("collection-wins", scoped):**
 * The user has a session-equivalent right of refusal — they can edit
 * their userlist after install — but at install time the curator's
 * intent overrides theirs WHERE IT MATTERS:
 *   - **Group assignments**: the curator's `SET_PLUGIN_GROUP` wins.
 *     If the user had a different group assignment for a plugin we
 *     touch, we overwrite it. Plugins NOT in our userlist are NOT
 *     touched — unrelated plugin group assignments are preserved.
 *   - **Plugin `after`/`req`/`inc` rules**: ADDITIVE. Vortex's
 *     reducer dedupes by name, so re-adding an existing rule is a
 *     no-op; we don't try to "overwrite" rule kind because (P,R,kind)
 *     triples are independent semantic statements (`req` and `inc`
 *     for the same pair are a real contradiction the user should see
 *     in LOOT, not a thing for us to silently resolve).
 *   - **Groups**: ADD groups we define if they don't exist. NEVER
 *     remove groups (other plugin rules in the user's userlist may
 *     depend on them).
 *   - **Group `after` rules**: ADD ours. NEVER remove user's
 *     existing group rules (a shared "Late Loaders → Late" rule from
 *     a prior collection install would otherwise vanish).
 *
 * This is intentionally narrower than `applyModRules`'s
 * collection-wins (which wholesale removes all user rules between a
 * given source/target pair). Plugin rules tend to be many-to-many
 * collaborative state that survives across collection installs;
 * mod-to-mod rules are typically curator-authored singletons. The
 * difference reflects the difference in usage.
 *
 * **Reference encoding:**
 * Vortex's reducer stores `after`/`req`/`inc` as plain strings and
 * compares case-insensitively. We dispatch plain strings (matching
 * the captured shape), per the contract documented in
 * `src/core/userlist.ts`.
 *
 * ─── INVARIANTS ────────────────────────────────────────────────────────
 *  - This module never reads from any state slice other than
 *    `state.userlist`. The driver does NOT need to pass the post-
 *    install mod map — userlist is plugin-name keyed, mods are
 *    irrelevant.
 *  - All dispatches are best-effort. A failure on one entry logs and
 *    continues; partial application is strictly better than none.
 *  - Empty `manifest.userlist` (no plugins AND no groups) returns
 *    immediately — we never disturb the user's userlist for nothing.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "vortex-api";

import type {
  EhcollUserlist,
  EhcollUserlistGroup,
  EhcollUserlistPlugin,
} from "../../types/ehcoll";

// ---------------------------------------------------------------------------
// Action type strings (must match
// extension-plugin-management/src/actions/userlist.ts at runtime)
// ---------------------------------------------------------------------------

const ACTION_ADD_RULE = "ADD_USERLIST_RULE";
const ACTION_REMOVE_RULE = "REMOVE_USERLIST_RULE";
const ACTION_SET_GROUP = "SET_PLUGIN_GROUP";
const ACTION_ADD_PLUGIN_GROUP = "ADD_PLUGIN_GROUP";
const ACTION_ADD_GROUP_RULE = "ADD_GROUP_RULE";

/**
 * The Vortex userlist reducer maps `type` payload values like so
 * (see `extension-plugin-management/src/reducers/userlist.ts` →
 * `listForType`): "requires" → `req`, "incompatible" → `inc`, anything
 * else (including "after") → `after`. We dispatch the long-form
 * strings the reducer expects.
 */
const RULE_KIND_TO_DISPATCH: Record<UserlistRuleKind, string> = {
  after: "after",
  req: "requires",
  inc: "incompatible",
};

type UserlistRuleKind = "after" | "req" | "inc";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ApplyUserlistInput = {
  api: types.IExtensionApi;
  userlist: EhcollUserlist;
  signal?: AbortSignal;
};

export type ApplyUserlistResult = {
  /** ADD_USERLIST_RULE dispatches that landed (verified in state). */
  appliedRuleCount: number;
  /**
   * SET_PLUGIN_GROUP dispatches that overwrote a previous user-set
   * group assignment (the user had a different group for this
   * plugin). Surfaced in the receipt so the user can see what
   * changed under their feet.
   */
  overwrittenGroupAssignmentCount: number;
  /** SET_PLUGIN_GROUP dispatches that landed (group changed). */
  appliedGroupAssignmentCount: number;
  /** ADD_PLUGIN_GROUP dispatches that created a new group. */
  appliedNewGroupCount: number;
  /** ADD_GROUP_RULE dispatches that landed. */
  appliedGroupRuleCount: number;
  /** Manifest entries we couldn't apply, with verbose reason. */
  skipped: SkippedUserlistEntry[];
};

export type SkippedUserlistEntry = {
  /** What kind of manifest entry this corresponds to. */
  kind:
    | "plugin-rule"
    | "plugin-group"
    | "group-definition"
    | "group-rule";
  /** Human-readable identifier (plugin or group name) for the receipt UI. */
  subject: string;
  /** Optional: rule kind (`after`/`req`/`inc`) for plugin rules. */
  ruleKind?: UserlistRuleKind;
  /** Optional: reference (other plugin / other group) for plugin and group rules. */
  reference?: string;
  /** Verbose, actionable explanation. */
  reason: string;
};

class AbortError extends Error {
  constructor() {
    super("Aborted");
    this.name = "AbortError";
  }
}

/**
 * Apply the curator's userlist to the user's `state.userlist`. Returns
 * a summary the driver attaches to the install receipt.
 *
 * Empty input → no-op return (no dispatches, no skipped entries).
 *
 * Never throws for individual entry failures. The only thrown error
 * is `AbortError` from cooperative cancellation.
 */
export function applyUserlist(input: ApplyUserlistInput): ApplyUserlistResult {
  const result: ApplyUserlistResult = {
    appliedRuleCount: 0,
    overwrittenGroupAssignmentCount: 0,
    appliedGroupAssignmentCount: 0,
    appliedNewGroupCount: 0,
    appliedGroupRuleCount: 0,
    skipped: [],
  };

  if (
    input.userlist.plugins.length === 0 &&
    input.userlist.groups.length === 0
  ) {
    return result;
  }

  // 1. Apply group definitions FIRST — plugin entries may reference
  //    these groups via SET_PLUGIN_GROUP, and the persistor's group
  //    validation is friendlier if the group exists before any plugin
  //    is assigned to it.
  for (const group of input.userlist.groups) {
    if (input.signal?.aborted) throw new AbortError();
    applyGroupDefinition(input, group, result);
  }

  // 2. Apply group → group `after` rules. Same ordering reason — a
  //    plugin's group's transitive ordering may rely on other groups
  //    existing.
  for (const group of input.userlist.groups) {
    if (input.signal?.aborted) throw new AbortError();
    if (group.after === undefined) continue;
    for (const ref of group.after) {
      applyGroupRule(input, group.name, ref, result);
    }
  }

  // 3. Apply per-plugin rules + group assignments.
  for (const plugin of input.userlist.plugins) {
    if (input.signal?.aborted) throw new AbortError();
    applyPluginEntry(input, plugin, result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Group operations
// ---------------------------------------------------------------------------

function applyGroupDefinition(
  input: ApplyUserlistInput,
  group: EhcollUserlistGroup,
  result: ApplyUserlistResult,
): void {
  const before = readUserlistState(input.api);
  const existing = findGroup(before, group.name);
  if (existing !== undefined) {
    // Already defined; nothing to dispatch. Do NOT skip — we just
    // didn't need to add it. The group is now (by transitivity) part
    // of our resulting state.
    return;
  }

  try {
    dispatchTyped(input.api, ACTION_ADD_PLUGIN_GROUP, { group: group.name });
  } catch (err) {
    result.skipped.push({
      kind: "group-definition",
      subject: group.name,
      reason:
        `Vortex rejected ADD_PLUGIN_GROUP dispatch: ` +
        formatErr(err) +
        ` (action contract may have changed).`,
    });
    return;
  }

  const after = readUserlistState(input.api);
  if (findGroup(after, group.name) === undefined) {
    result.skipped.push({
      kind: "group-definition",
      subject: group.name,
      reason:
        `ADD_PLUGIN_GROUP dispatched but state.userlist.groups did not gain ` +
        `the group. The reducer either ignored the action or its contract ` +
        `has changed since this build of Event Horizon.`,
    });
    return;
  }
  result.appliedNewGroupCount += 1;
}

function applyGroupRule(
  input: ApplyUserlistInput,
  groupName: string,
  reference: string,
  result: ApplyUserlistResult,
): void {
  const before = readUserlistState(input.api);
  const existingGroup = findGroup(before, groupName);
  if (
    existingGroup?.after?.some(
      (ref) => normalizeRefName(ref).toLowerCase() === reference.toLowerCase(),
    )
  ) {
    // Already present — nothing to do.
    return;
  }

  try {
    dispatchTyped(input.api, ACTION_ADD_GROUP_RULE, {
      groupId: groupName,
      reference,
    });
  } catch (err) {
    result.skipped.push({
      kind: "group-rule",
      subject: groupName,
      reference,
      reason:
        `Vortex rejected ADD_GROUP_RULE dispatch: ` +
        formatErr(err) +
        ` (action contract may have changed).`,
    });
    return;
  }

  const after = readUserlistState(input.api);
  const updatedGroup = findGroup(after, groupName);
  if (
    updatedGroup === undefined ||
    !updatedGroup.after?.some(
      (ref) => normalizeRefName(ref).toLowerCase() === reference.toLowerCase(),
    )
  ) {
    result.skipped.push({
      kind: "group-rule",
      subject: groupName,
      reference,
      reason:
        `ADD_GROUP_RULE dispatched but state.userlist.groups[${groupName}].after ` +
        `did not gain "${reference}". Reducer ignored the action or the ` +
        `payload shape has changed.`,
    });
    return;
  }
  result.appliedGroupRuleCount += 1;
}

// ---------------------------------------------------------------------------
// Plugin operations
// ---------------------------------------------------------------------------

function applyPluginEntry(
  input: ApplyUserlistInput,
  plugin: EhcollUserlistPlugin,
  result: ApplyUserlistResult,
): void {
  // ── Group assignment ─────────────────────────────────────────────
  if (plugin.group !== undefined) {
    applyPluginGroup(input, plugin.name, plugin.group, result);
  }

  // ── Rules: after / req / inc ─────────────────────────────────────
  if (plugin.after !== undefined) {
    for (const ref of plugin.after) {
      applyPluginRuleWithCollectionWins(input, plugin.name, "after", ref, result);
    }
  }
  if (plugin.req !== undefined) {
    for (const ref of plugin.req) {
      applyPluginRuleWithCollectionWins(input, plugin.name, "req", ref, result);
    }
  }
  if (plugin.inc !== undefined) {
    for (const ref of plugin.inc) {
      applyPluginRuleWithCollectionWins(input, plugin.name, "inc", ref, result);
    }
  }
}

function applyPluginGroup(
  input: ApplyUserlistInput,
  pluginName: string,
  group: string,
  result: ApplyUserlistResult,
): void {
  const before = readUserlistState(input.api);
  const existing = findPlugin(before, pluginName);
  if (existing?.group !== undefined && existing.group === group) {
    // Already in the desired group; nothing to do.
    return;
  }
  const hadDifferentGroup =
    existing?.group !== undefined && existing.group !== group;

  try {
    dispatchTyped(input.api, ACTION_SET_GROUP, {
      pluginId: pluginName,
      group,
    });
  } catch (err) {
    result.skipped.push({
      kind: "plugin-group",
      subject: pluginName,
      reference: group,
      reason:
        `Vortex rejected SET_PLUGIN_GROUP dispatch: ` +
        formatErr(err) +
        ` (action contract may have changed).`,
    });
    return;
  }

  const after = readUserlistState(input.api);
  const updated = findPlugin(after, pluginName);
  if (updated?.group !== group) {
    result.skipped.push({
      kind: "plugin-group",
      subject: pluginName,
      reference: group,
      reason:
        `SET_PLUGIN_GROUP dispatched but state.userlist.plugins[${pluginName}].group ` +
        `is "${updated?.group ?? "<unset>"}", expected "${group}". Reducer ` +
        `ignored the action or the payload shape has changed.`,
    });
    return;
  }
  result.appliedGroupAssignmentCount += 1;
  if (hadDifferentGroup) {
    result.overwrittenGroupAssignmentCount += 1;
  }
}

function applyPluginRuleWithCollectionWins(
  input: ApplyUserlistInput,
  pluginName: string,
  ruleKind: UserlistRuleKind,
  reference: string,
  result: ApplyUserlistResult,
): void {
  // Self-referential rule guard. A plugin loading "after" itself
  // would corrupt LOOT's topological sort. Should never happen with
  // a sane manifest, but a hand-edited file might slip through.
  if (pluginName.toLowerCase() === reference.toLowerCase()) {
    result.skipped.push({
      kind: "plugin-rule",
      subject: pluginName,
      ruleKind,
      reference,
      reason: "Rule's plugin and reference resolve to the same plugin.",
    });
    return;
  }

  const before = readUserlistState(input.api);
  const existingPlugin = findPlugin(before, pluginName);
  const list = pluginRuleListByKind(existingPlugin, ruleKind);

  // Already present (case-insensitive name match)? Nothing to do.
  // The reducer's `addUniqueSafe` would no-op on a structurally-
  // identical ref anyway, but we may have stored object-form refs
  // (`{name, display, condition}`) that differ in shape from our
  // dispatched plain string. Treating any name match as "already
  // applied" keeps the receipt honest and avoids planting duplicate-
  // looking entries the user can't tell apart. We do NOT bump
  // overwrittenUserRuleCount here — there was nothing to overwrite,
  // we're just deferring to existing state.
  if (
    list.some(
      (ref) => normalizeRefName(ref).toLowerCase() === reference.toLowerCase(),
    )
  ) {
    return;
  }

  // Collection-wins NOTE: cross-kind conflicts (user has `inc` for
  // (P,R), we want `req` for (P,R)) are NOT removed. They're
  // deliberately rare (curators don't `inc` what they `req`) and
  // silently dropping the user's compatibility marker would change
  // their LOOT report behavior in surprising ways. If a real
  // contradiction exists, LOOT surfaces it as a sort error and the
  // user sees both rules — better than a silent overwrite.

  try {
    dispatchTyped(input.api, ACTION_ADD_RULE, {
      pluginId: pluginName,
      reference,
      type: RULE_KIND_TO_DISPATCH[ruleKind],
    });
  } catch (err) {
    result.skipped.push({
      kind: "plugin-rule",
      subject: pluginName,
      ruleKind,
      reference,
      reason:
        `Vortex rejected ADD_USERLIST_RULE dispatch: ` +
        formatErr(err) +
        ` (action contract may have changed).`,
    });
    return;
  }

  const after = readUserlistState(input.api);
  const updatedPlugin = findPlugin(after, pluginName);
  const updatedList = pluginRuleListByKind(updatedPlugin, ruleKind);
  if (
    !updatedList.some(
      (ref) => normalizeRefName(ref).toLowerCase() === reference.toLowerCase(),
    )
  ) {
    result.skipped.push({
      kind: "plugin-rule",
      subject: pluginName,
      ruleKind,
      reference,
      reason:
        `ADD_USERLIST_RULE dispatched but state.userlist.plugins[${pluginName}].` +
        `${RULE_KIND_TO_DISPATCH[ruleKind] === "requires" ? "req" : RULE_KIND_TO_DISPATCH[ruleKind] === "incompatible" ? "inc" : "after"} ` +
        `did not gain "${reference}". The reducer ignored our action — most ` +
        `likely the action type string or payload shape changed in this ` +
        `Vortex build. Re-check ` +
        `extension-plugin-management/src/actions/userlist.ts for the ` +
        `current contract.`,
    });
    return;
  }
  result.appliedRuleCount += 1;
}

// ---------------------------------------------------------------------------
// State helpers — narrow Vortex's untyped userlist slice
// ---------------------------------------------------------------------------

type UserlistStateSlice = {
  plugins?: Array<{
    name?: string;
    group?: string;
    after?: unknown[];
    req?: unknown[];
    inc?: unknown[];
  }>;
  groups?: Array<{ name?: string; after?: unknown[] }>;
};

function readUserlistState(api: types.IExtensionApi): UserlistStateSlice {
  const state = api.getState();
  const slice = (state as unknown as { userlist?: UserlistStateSlice })
    .userlist;
  return slice ?? {};
}

function findPlugin(
  state: UserlistStateSlice,
  name: string,
): UserlistStateSlice["plugins"] extends (infer T)[] | undefined ? T | undefined : never {
  if (!state.plugins) return undefined as never;
  return (state.plugins.find(
    (p) =>
      typeof p?.name === "string" &&
      p.name.toLowerCase() === name.toLowerCase(),
  ) ?? undefined) as never;
}

function findGroup(
  state: UserlistStateSlice,
  name: string,
): UserlistStateSlice["groups"] extends (infer T)[] | undefined ? T | undefined : never {
  if (!state.groups) return undefined as never;
  return (state.groups.find(
    (g) =>
      typeof g?.name === "string" &&
      g.name.toLowerCase() === name.toLowerCase(),
  ) ?? undefined) as never;
}

function pluginRuleListByKind(
  plugin:
    | { after?: unknown[]; req?: unknown[]; inc?: unknown[] }
    | undefined,
  kind: UserlistRuleKind,
): unknown[] {
  if (plugin === undefined) return [];
  const list =
    kind === "after" ? plugin.after : kind === "req" ? plugin.req : plugin.inc;
  return Array.isArray(list) ? list : [];
}

/**
 * Collapse a stored ref (string OR `{name, ...}` object) to its plain
 * name. The reducer is sloppy about this — `removeRule` calls
 * `ref.toUpperCase()` on the array element directly, so persisted
 * state is normally string-only, but a fresh YAML load can populate
 * the object form.
 */
function normalizeRefName(ref: unknown): string {
  if (typeof ref === "string") return ref;
  if (
    ref !== null &&
    typeof ref === "object" &&
    typeof (ref as { name?: unknown }).name === "string"
  ) {
    return (ref as { name: string }).name;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Dispatch helper — typed wrapper around api.store.dispatch
// ---------------------------------------------------------------------------

function dispatchTyped(
  api: types.IExtensionApi,
  type: string,
  payload: Record<string, unknown>,
): void {
  // `api.store` is `ThunkStore<any>` in the typings; the published
  // shape doesn't expose `dispatch` directly on the public surface
  // because most extensions go through `actions.*` helpers. We
  // sidestep the typings deliberately — the runtime IS a Redux
  // store, and the action shape `{ type, payload }` is exactly what
  // the userlist reducer expects (every action in
  // extension-plugin-management/src/actions/userlist.ts is created
  // via `createAction(type, (a, b, c) => payload)`).
  const store = api.store as unknown as {
    dispatch?: (action: { type: string; payload: unknown }) => void;
  };
  if (typeof store.dispatch !== "function") {
    throw new Error(
      "api.store.dispatch is not a function — Vortex extension API contract has changed.",
    );
  }
  store.dispatch({ type, payload });
}

function formatErr(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
