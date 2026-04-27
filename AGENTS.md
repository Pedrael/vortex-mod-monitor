<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **vortex-mod-monitor** (2316 symbols, 4801 relationships, 199 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| Work in the Manifest area (122 symbols) | `.claude/skills/generated/manifest/SKILL.md` |
| Work in the Installer area (83 symbols) | `.claude/skills/generated/installer/SKILL.md` |
| Work in the Resolver area (62 symbols) | `.claude/skills/generated/resolver/SKILL.md` |
| Work in the Actions area (58 symbols) | `.claude/skills/generated/actions/SKILL.md` |
| Work in the Install area (49 symbols) | `.claude/skills/generated/install/SKILL.md` |
| Work in the Build area (45 symbols) | `.claude/skills/generated/build/SKILL.md` |
| Work in the Pages area (29 symbols) | `.claude/skills/generated/pages/SKILL.md` |
| Work in the Errors area (26 symbols) | `.claude/skills/generated/errors/SKILL.md` |
| Work in the Cluster_16 area (11 symbols) | `.claude/skills/generated/cluster-16/SKILL.md` |
| Work in the Runtime area (11 symbols) | `.claude/skills/generated/runtime/SKILL.md` |
| Work in the Components area (6 symbols) | `.claude/skills/generated/components/SKILL.md` |
| Work in the Cluster_13 area (5 symbols) | `.claude/skills/generated/cluster-13/SKILL.md` |
| Work in the Cluster_17 area (5 symbols) | `.claude/skills/generated/cluster-17/SKILL.md` |
| Work in the Cluster_10 area (4 symbols) | `.claude/skills/generated/cluster-10/SKILL.md` |
| Work in the Dashboard area (4 symbols) | `.claude/skills/generated/dashboard/SKILL.md` |

<!-- gitnexus:end -->
