<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **vortex-mod-monitor** (2657 symbols, 5580 relationships, 229 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/vortex-mod-monitor/context` | Codebase overview, check index freshness |
| `gitnexus://repo/vortex-mod-monitor/clusters` | All functional areas |
| `gitnexus://repo/vortex-mod-monitor/processes` | All execution flows |
| `gitnexus://repo/vortex-mod-monitor/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
| Work in the Manifest area (141 symbols) | `.claude/skills/generated/manifest/SKILL.md` |
| Work in the Installer area (95 symbols) | `.claude/skills/generated/installer/SKILL.md` |
| Work in the Build area (75 symbols) | `.claude/skills/generated/build/SKILL.md` |
| Work in the Resolver area (73 symbols) | `.claude/skills/generated/resolver/SKILL.md` |
| Work in the Actions area (61 symbols) | `.claude/skills/generated/actions/SKILL.md` |
| Work in the Install area (49 symbols) | `.claude/skills/generated/install/SKILL.md` |
| Work in the Pages area (28 symbols) | `.claude/skills/generated/pages/SKILL.md` |
| Work in the Errors area (20 symbols) | `.claude/skills/generated/errors/SKILL.md` |
| Work in the Runtime area (14 symbols) | `.claude/skills/generated/runtime/SKILL.md` |
| Work in the Cluster_11 area (11 symbols) | `.claude/skills/generated/cluster-11/SKILL.md` |
| Work in the Cluster_12 area (6 symbols) | `.claude/skills/generated/cluster-12/SKILL.md` |
| Work in the Cluster_8 area (4 symbols) | `.claude/skills/generated/cluster-8/SKILL.md` |
| Work in the Dashboard area (4 symbols) | `.claude/skills/generated/dashboard/SKILL.md` |
| Work in the Components area (3 symbols) | `.claude/skills/generated/components/SKILL.md` |

<!-- gitnexus:end -->

<!--
The block below is hand-maintained behavioral guidance and lives OUTSIDE the
gitnexus auto-generated markers on purpose: `npx gitnexus analyze` regenerates
everything between the markers above, but anything below is preserved.

Full reference: .cursor/rules/gitnexus.mdc (alwaysApply: true)
-->

## First move — before any code-understanding tool

This repo is GitNexus-indexed: 2316 nodes, 4801 edges, 199 execution flows, 69 communities, **2186 vector embeddings**. GitNexus tools are the *primary* navigation surface, NOT a "remember to use this." Before reaching for `Grep`, `Glob`, `Read`, or `SemanticSearch`, ask: "Could a GitNexus tool answer this in one shot?" Almost always: yes.

| Intent | First-move tool |
| --- | --- |
| "how does X work?" / "trace this" / fuzzy concept lookup | `gitnexus_query({query: "..."})` (hybrid BM25 + **vector embeddings**) |
| "what calls X?" / 360° view of one symbol | `gitnexus_context({name: "X"})` |
| "what breaks if I change X?" / pre-edit safety | `gitnexus_impact({target: "X", direction: "upstream"})` |
| "did my edits affect anything else?" / pre-commit | `gitnexus_detect_changes({scope: "unstaged"})` |
| "rename X to Y" | `gitnexus_rename({symbol_name: "X", new_name: "Y", dry_run: true})` |
| "what does endpoint /api/x do?" | `api_impact({route: "/api/x"})` |
| "find all writers/readers of field foo" | `gitnexus_cypher` with `ACCESSES` (`reason: 'write'` or `'read'`) |
| Codebase orientation / functional areas | READ `gitnexus://repo/vortex-mod-monitor/clusters` |
| Step-by-step trace of a flow | READ `gitnexus://repo/vortex-mod-monitor/process/<name>` |

`Grep` / `Glob` are appropriate ONLY for: string literals, comments, raw text in JSON/YAML/MD, config keys not modeled in the graph, or exact-string lookups where you already know what you want.

## Anti-patterns — STOP and reconsider

- About to `Grep("functionName")` → STOP. Use `gitnexus_context({name: "functionName"})` — returns callers, callees, file location, and processes the symbol participates in.
- About to `Read` a file end-to-end to "see what it does" → STOP. Use `gitnexus_query` for the concept, then `gitnexus_context` on returned symbols. `Read` is for exact bytes only.
- About to do `git diff | grep` to assess a change → STOP. Use `gitnexus_detect_changes` — maps hunks to symbols, processes, and risk level.
- About to find-and-replace for a rename → STOP. Use `gitnexus_rename` with `dry_run: true` (graph edits vs text_search edits are tagged separately).
- About to skip impact analysis to "save a tool call" before editing → STOP. Workspace contract requires `gitnexus_impact` before editing any function/class/method.
- Tool returned multiple candidates for a name → DO NOT GUESS. Re-call with `uid` / `target_uid` from the ranked list.

## Full feature surface — don't forget any of this

**Tools:** `query`, `context`, `impact`, `detect_changes`, `rename`, `cypher`, `api_impact`, `route_map`, `shape_check`, `tool_map`, `list_repos`, `group_list`, `group_sync`.

**Embeddings (2186):** `query` uses them under the hood (BM25 + vector via Reciprocal Rank Fusion). For fuzzy concepts, trust `query` over keyword search. Pass `task_context` and `goal` to sharpen ranking. Embeddings persist across `npx gitnexus analyze` unless you pass `--drop-embeddings`.

**Resources** (lightweight, 100-500 tokens — read these first to orient):

- `gitnexus://repo/vortex-mod-monitor/context` — stats + staleness check
- `gitnexus://repo/vortex-mod-monitor/clusters` — all 69 functional areas with cohesion + keywords
- `gitnexus://repo/vortex-mod-monitor/processes` — all 199 execution flows
- `gitnexus://repo/vortex-mod-monitor/process/<name>` — step-by-step trace of one flow
- `gitnexus://repo/vortex-mod-monitor/schema` — full graph schema (read before writing Cypher)

**Edge types** (filter `CodeRelation` by `type`): `CALLS`, `IMPORTS`, `EXTENDS`, `IMPLEMENTS`, `HAS_METHOD`, `HAS_PROPERTY`, `METHOD_OVERRIDES`, `METHOD_IMPLEMENTS`, **`ACCESSES`** (with `reason: 'read'` or `'write'` — use this for field-level data-flow tracing), `DEFINES`, `MEMBER_OF`, `STEP_IN_PROCESS`, `HANDLES_ROUTE`, `FETCHES`, `HANDLES_TOOL`, `ENTRY_POINT_OF`.

**Group mode** (cross-repo / monorepo): pass `repo: "@<groupName>"` (or `"@<groupName>/<member>"`) to `query` / `context` / `impact` for cross-boundary analysis via the Contract Registry.

**Index freshness:** every tool reports staleness. On a stale-warning, run `npx gitnexus analyze` (preserves embeddings) and retry the failed tool.

For the full reference (Cypher recipes, disambiguation discipline, per-task workflows), see `.cursor/rules/gitnexus.mdc`.
