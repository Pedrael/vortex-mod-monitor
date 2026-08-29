/**
 * ──────────────────────────────────────────────────────────────────────
 * Clear the user's own ordering rules so the curator's are the only ones.
 *
 * ─── WHY REPLACE RATHER THAN MERGE ─────────────────────────────────────
 * Applying the collection's rules on top of whatever the user already had
 * produces a rule set that exists on nobody's machine but theirs. Mod rules
 * decide which mod wins a file conflict and LOOT rules decide plugin order, so
 * one leftover rule silently changes what the game loads — and it does it
 * without failing anything. Verification passes, every file is byte-correct,
 * and the game still behaves differently from the curator's.
 *
 * That failure is invisible from both ends and lands as "your collection is
 * broken". The collection's rule set has to be the whole rule set.
 *
 * ─── WHAT THIS DELETES, STATED PLAINLY ─────────────────────────────────
 * Vortex stores mod rules on each MOD (`persistent.mods[gameId][modId].rules`)
 * and the LOOT userlist per active GAME — neither is per-profile. So this
 * removes:
 *
 *   - rules on mods that are not in the collection, and
 *   - rules the user set for their OTHER profiles of the same game.
 *
 * That is the intended scope and it is not recoverable from Vortex, so
 * {@link captureUserRuleState} snapshots everything first and the caller
 * writes it beside the receipt. A user who says "it deleted my rules" can be
 * shown exactly what was removed and put back.
 *
 * ─── THE ACTION NAMES ARE VORTEX'S, NOT INVENTED ───────────────────────
 * Read out of the shipped `gamebryo-plugin-management` bundle rather than
 * guessed:
 *
 *   createAction('REMOVE_USERLIST_RULE', (a,b,c) => ({pluginId, reference, type}))
 *   createAction('REMOVE_PLUGIN_GROUP',  a      => ({group}))
 *   createAction('CLEAR_USERLIST')       // no payload transformer at all
 *
 * `CLEAR_USERLIST` empties the whole userlist in one dispatch, which is both
 * what we want and far less fragile than removing entries one at a time.
 * ──────────────────────────────────────────────────────────────────────
 */

import { actions, type types } from "@nexusmods/vortex-api";

/** One rule as Vortex stores it, kept verbatim so it can be restored. */
export type CapturedModRule = {
  modId: string;
  /** Vortex's rule object — `{ type, reference, comment? }`. */
  rule: Record<string, unknown>;
};

export type UserRuleSnapshot = {
  gameId: string;
  capturedAt: string;
  modRules: CapturedModRule[];
  /** `state.userlist` verbatim: `{ plugins: [...], groups: [...] }`. */
  userlist: Record<string, unknown>;
};

export type PurgeResult = {
  modRulesRemoved: number;
  /** Mods that had at least one rule removed. */
  modsTouched: number;
  userlistCleared: boolean;
  /** Anything Vortex refused, so a partial purge is visible rather than silent. */
  failures: string[];
};

/**
 * Everything we are about to delete, verbatim.
 *
 * Never throws: a snapshot that fails must not stop the install, but the
 * caller needs to know it is empty before deciding to purge — see
 * {@link purgeUserRuleState}, which refuses to run without one.
 */
export function captureUserRuleState(
  api: types.IExtensionApi,
  gameId: string,
): UserRuleSnapshot {
  const snapshot: UserRuleSnapshot = {
    gameId,
    capturedAt: new Date().toISOString(),
    modRules: [],
    userlist: {},
  };

  try {
    const state = api.getState() as unknown as {
      persistent?: {
        mods?: Record<string, Record<string, { rules?: unknown[] }>>;
      };
      userlist?: Record<string, unknown>;
    };

    const mods = state?.persistent?.mods?.[gameId] ?? {};
    for (const [modId, mod] of Object.entries(mods)) {
      for (const rule of mod?.rules ?? []) {
        if (rule !== null && typeof rule === "object") {
          snapshot.modRules.push({
            modId,
            rule: rule as Record<string, unknown>,
          });
        }
      }
    }

    // Structured-cloned so a later dispatch cannot mutate the backup out from
    // under us — the whole point is that this survives the purge.
    const userlist = state?.userlist;
    if (userlist !== undefined && userlist !== null) {
      snapshot.userlist = JSON.parse(JSON.stringify(userlist)) as Record<
        string,
        unknown
      >;
    }
  } catch {
    // Leaves the snapshot empty, which purgeUserRuleState treats as "do not
    // proceed" rather than "nothing to remove".
  }

  return snapshot;
}

/**
 * Remove every captured rule, then empty the userlist.
 *
 * Driven by the SNAPSHOT rather than by re-reading state, so what is deleted
 * is exactly what was recorded. Removing something we did not record would be
 * a deletion with no way back.
 */
export function purgeUserRuleState(
  api: types.IExtensionApi,
  gameId: string,
  snapshot: UserRuleSnapshot,
): PurgeResult {
  const result: PurgeResult = {
    modRulesRemoved: 0,
    modsTouched: 0,
    userlistCleared: false,
    failures: [],
  };

  const touched = new Set<string>();
  for (const entry of snapshot.modRules) {
    try {
      api.store?.dispatch(
        actions.removeModRule(gameId, entry.modId, entry.rule as never),
      );
      result.modRulesRemoved += 1;
      touched.add(entry.modId);
    } catch (err) {
      result.failures.push(
        `mod rule on "${entry.modId}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  result.modsTouched = touched.size;

  // One dispatch for the whole userlist. Vortex's own action, verified in the
  // shipped bundle; it takes no payload.
  try {
    const store = api.store as unknown as {
      dispatch?: (action: { type: string; payload?: unknown }) => void;
    };
    if (typeof store?.dispatch === "function") {
      store.dispatch({ type: "CLEAR_USERLIST" });
      result.userlistCleared = true;
    } else {
      result.failures.push("userlist: no dispatch available");
    }
  } catch (err) {
    result.failures.push(
      `userlist: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
}

/**
 * What to tell the user, or `undefined` when nothing was theirs to begin with.
 *
 * Said out loud rather than buried in a log. Deleting someone's work quietly
 * is how a tool earns the reputation this one is trying to avoid — and the
 * backup is only reassuring if they know it exists.
 */
export function describePurge(
  result: PurgeResult,
  snapshot: UserRuleSnapshot,
  backupPath: string | undefined,
): string[] | undefined {
  // Nothing of the user's was actually removed. Clearing an already-empty
  // userlist is a dispatch, not an event, and announcing it would tell someone
  // their rules were deleted when they had none — the kind of scary,
  // content-free notice that teaches people to ignore the rest.
  const hadUserlist =
    (Array.isArray(snapshot.userlist.plugins)
      ? snapshot.userlist.plugins.length
      : 0) +
      (Array.isArray(snapshot.userlist.groups)
        ? snapshot.userlist.groups.length
        : 0) >
    0;
  if (result.modRulesRemoved === 0 && !hadUserlist) {
    return result.failures.length > 0
      ? [
          `Could not clear your existing rules, so some may still be active: ` +
            result.failures.slice(0, 3).join("; "),
        ]
      : undefined;
  }

  // Deliberately NOT "replaced your own". On every install after the first,
  // what gets cleared is the rules THIS collection applied last time — saying
  // "your own" there tells the user we deleted their work when we deleted our
  // own, which is both false and alarming. This wording is true either way.
  const lines: string[] = [
    `The collection's conflict and load-order rules are now the only ones in ` +
      `place, so what loads is exactly what the curator tested. ` +
      `${result.modRulesRemoved} mod rule(s) across ${result.modsTouched} ` +
      `mod(s) were removed${
        result.userlistCleared && hadUserlist
          ? ", and your LOOT rules were cleared"
          : ""
      }.`,
  ];
  if (backupPath !== undefined) {
    lines.push(`A copy of everything removed was saved to: ${backupPath}`);
  }
  if (result.failures.length > 0) {
    lines.push(
      `${result.failures.length} could not be removed, so a few of your own ` +
        `rules may still be active: ${result.failures.slice(0, 3).join("; ")}`,
    );
  }
  return lines;
}
