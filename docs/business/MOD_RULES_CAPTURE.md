# Mod Rules Capture — Spec

How we extract and normalize Vortex's per-mod rules into the snapshot. **Why this matters**: rules are the part of Vortex collection installs that go missing most reliably on user machines. The curator says "Mod A must load before Mod B"; on the user's side, that rule silently disappears, deployment runs, the user's game loads with the wrong overrides, and we get a Discord support ticket.

We can't fix Vortex's rule-loss bug from inside an extension. We **can** capture every rule with full identity at curator time, then re-apply on the user side after install (Phase 4+).

## Trigger

Indirect — `getModsForProfile` calls `normalizeModRules(mod.rules)` once per mod during snapshot construction. Runs on every Export Mods action and every Compare Mods action.

No standalone toolbar button.

## Inputs

- `mod.rules` from a single entry of `state.persistent.mods[gameId][modId]`. Vortex types this as `IModRule[]` (extending `IRule` from `modmeta-db`). Anything else — `undefined`, non-array — is treated as "no rules".

A single `IModRule` from Vortex looks roughly like:

```ts
{
  type: 'before' | 'after' | 'requires' | 'recommends' | 'conflicts' | 'provides',
  reference: IModReference,
  comment?: string,
  ignored?: boolean,
  fileList?: IFileListItem[],
  installerChoices?: any,
  downloadHint?: IDownloadHint,
  extra?: { [key: string]: any },
}
```

The `reference` is the **target** of the rule — which mod the relationship points at. It can identify the target via Nexus repo pin, MD5 hash, archive id, filename glob, version expression, or internal id. Multiple identifiers can be set on the same reference.

## Output shape

Every `AuditorMod` carries a `rules: CapturedModRule[]` field. Always an array; empty when no rules exist. Never `undefined`.

```ts
type CapturedModRule = {
  type: string;                   // "before" | "after" | "requires" | "recommends" | "conflicts" | "provides"
  reference: CapturedRuleReference;
  comment?: string;
  ignored?: true;                 // omitted when not ignored
};

type CapturedRuleReference = {
  // Cross-machine portable (most preferred):
  nexusModId?: string;
  nexusFileId?: string;
  nexusGameId?: string;

  // Hash-based (portable iff archive bytes match):
  fileMD5?: string;
  md5Hint?: string;

  // Local (machine-specific):
  archiveId?: string;

  // Filename / version match (fragile but informative):
  logicalFileName?: string;
  fileExpression?: string;
  versionMatch?: string;

  // Opaque:
  tag?: string;

  // Lowest priority — Vortex internal id (per-machine):
  id?: string;
};
```

All numeric repo ids are **stringified** at capture time so JSON comparison doesn't false-positive on `123` vs `"123"`.

## Behavior — `normalizeModRules`

1. If input is not an array, return `[]` and stop.
2. For each entry in the input array:
   1. If `entry.type` is `undefined` or `null`, skip the entry. (Defensive — a rule with no type can't be re-applied or compared meaningfully.)
   2. Build a `CapturedModRule` with `type: String(entry.type)` and `reference: normalizeRuleReference(entry.reference)`.
   3. If `entry.comment` is a non-empty string, copy it to the captured rule.
   4. If `entry.ignored === true`, set `ignored: true` on the captured rule. **Strict equality** — only `true` survives, not truthy values like `1` or `"yes"`.
3. **Sort the result** by `JSON.stringify(rule)` ascending. See "Why we sort" below.
4. Return the sorted array.

### `normalizeRuleReference`

For each known field on `reference`, if present and non-empty, copy a stringified version into the output. The full mapping:

| Source | Output | Notes |
|---|---|---|
| `reference.repo.modId` | `nexusModId` | Stringified |
| `reference.repo.fileId` | `nexusFileId` | Stringified |
| `reference.repo.gameId` | `nexusGameId` | Stringified |
| `reference.fileMD5` | `fileMD5` | Vortex's stored archive MD5 |
| `reference.md5Hint` | `md5Hint` | Heuristic / partial match |
| `reference.archiveId` | `archiveId` | Local-only |
| `reference.logicalFileName` | `logicalFileName` | Filename string |
| `reference.fileExpression` | `fileExpression` | Glob / regex |
| `reference.versionMatch` | `versionMatch` | Version expression |
| `reference.tag` | `tag` | Opaque |
| `reference.id` | `id` | Vortex internal id, lowest preference |

Fields not in this list are **dropped**. Notably:

- `reference.fileSize` — not currently captured; consider adding if reconciler needs it.
- `reference.versionMatch` is captured even though it's a constraint expression (not a fixed version) — the future installer needs the original expression to evaluate against any user-side candidate.
- `rule.fileList`, `rule.installerChoices`, `rule.downloadHint`, `rule.extra` on the rule itself — **not captured** in this slice. They're conflict-resolution and download-hint metadata; we'll add them in a follow-up if real-world rules need them.

**INVARIANT**: An empty reference (no fields populated) is still a valid `CapturedRuleReference`. The future installer will need to skip / warn on rules whose reference is unidentifiable.

## Why we sort

`mod.rules` in Vortex is conceptually a **set** but stored as an **array**. The order reflects when each rule was added, which is meaningless for behavior. Without sorting:

- Curator adds rule A then rule B → snapshot has `[A, B]`.
- User has the same rules added in reverse order → snapshot has `[B, A]`.
- `compareSnapshots` reports them as a `rules` field difference, even though the rule sets are identical.

By sorting on `JSON.stringify(rule)` we guarantee that **two snapshots with the same logical rule set produce identical `rules` arrays**, regardless of add-order.

**INVARIANT**: The sort is stable per-snapshot (same rule set → same array order), and the sort key is computed from the captured shape only — so it doesn't depend on internals of the source `IModRule`.

**QUIRK**: `JSON.stringify` is order-sensitive on object keys, but `normalizeRuleReference` always emits keys in the same order (we use a fixed sequence of `if`-copies, not iteration over the source object). So `JSON.stringify(captured)` is deterministic. Don't rearrange those `if`-copies without thinking about it.

## Diff implications

`rules` is added to the `compareFields` list in `compareMods`. Two same-key mods with different sorted rule arrays produce a `ModFieldDifference { field: "rules", … }` entry in the diff report.

Because rules are sorted before capture, **any non-empty difference is meaningful** — it represents an actual change in the rule set, not noise from add-order. Read the diff entries straight; no need to re-sort or compare-as-set on the consumer side.

`deepEqualStable` (the diff's equality function) does its own `sortDeep` pass on object keys. That's a no-op for already-canonical captures, but it doesn't hurt.

## Failure modes

| Situation | Behavior |
|---|---|
| `mod.rules` undefined | `rules: []` on the AuditorMod. |
| `mod.rules` is a non-array (string, object, etc.) | `rules: []`. We don't try to coerce. |
| A rule has no `type` | Skipped. Never appears in output. |
| A rule has no `reference` | Captured with `reference: {}`. **Note**: this is intentionally lossless — Vortex sometimes stores rules with sparse references and we'd rather see them in the diff than silently lose them. |
| `reference.repo.modId` is a number | Stringified to `"12345"` in `nexusModId`. |
| `reference.repo` exists but is empty | All three nexus fields stay `undefined`. |
| `entry.ignored` is truthy but not `=== true` (e.g., `1`, `"yes"`) | Treated as not ignored. **Intentional strictness** — Vortex stores ignored as a boolean; anything else is suspect. |
| `entry.comment` is non-string (number, object) | Dropped. We require an actual string. |

## Quirks & invariants

- **INVARIANT**: `AuditorMod.rules` is always defined and always an array. `rules.length === 0` means no rules; never test for `mod.rules === undefined`.
- **INVARIANT**: Every `CapturedRuleReference` field is either a non-empty string or absent. No `null`, no empty strings, no numbers.
- **QUIRK**: We capture both `nexusModId` and `id` on the same reference when both are present — and they refer to different mods (Nexus mod vs. Vortex internal id). The future installer must prefer Nexus.
- **QUIRK**: A rule's reference might match **multiple** mods on the user's machine if pin fields are weak (e.g., only `logicalFileName` set). The reconciler will need disambiguation logic; the snapshot just records what the curator had.
- **INVARIANT**: We don't dedupe rules. If Vortex stored two rules that compare equal under our normalization, we emit two equal entries (in adjacent positions after sorting). This is fine for diffing but the future installer should dedupe before applying.

## What this enables (preview, not contract)

- **Reconciliation (Phase 5)**: walk the captured `rules`, look up each rule's target via the strongest available pin, call `actions.setModRule(gameId, modId, rule)` to re-apply. This is exactly the surface that the Phase 0.5 spike confirmed exists in `vortex-api`.
- **Cross-machine diff**: `compareSnapshots` can already tell us "user is missing this rule". A future UI can render those as "click to fix".
- **Rule-history audit**: snapshots over time form a rule history. We can spot Vortex eating a user's rules between sessions just by diffing two snapshots from the same machine.

## Code references

- Type definitions: `src/core/getModsListForProfile.ts:16-66`
- `normalizeRuleReference`: `src/core/getModsListForProfile.ts:202-235`
- `rulesSortKey`: `src/core/getModsListForProfile.ts:241-243`
- `normalizeModRules`: `src/core/getModsListForProfile.ts:251-289`
- Wired into `getModsForProfile`: `src/core/getModsListForProfile.ts:307` (build) and `:331` (output)
- Diff inclusion: `src/utils/utils.ts:154-169` (`compareFields` list)
