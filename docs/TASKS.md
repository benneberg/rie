# ArchLens RIE 2.0 — Task Tracking

**Last Updated**: 2026-03-25

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: The Core | ✅ Complete | 100% |
| Phase 2: The Gate | ✅ Complete | 100% |
| Phase 3: The Dashboard | ✅ Complete | 100% |

---

## Phase 1: The Core ✅ 100% COMPLETE

### Foundation
- [x] Initialise monorepo structure
- [x] Set up TypeScript configuration
- [x] Create `@archlens/core` package with CAG schema (Zod)
- [x] Implement `BaseParser` interface and `ParserRegistry`

### Parsers
- [x] TypeScript parser — tree-sitter primary, regex fallback
- [x] Java parser — tree-sitter primary, regex fallback
- [x] Python parser — tree-sitter primary, regex fallback
- [x] Parser registry with dynamic language detection

### CLI
- [x] `rie analyze` — source → CAG (collects real entities/deps, createdAt/updatedAt, YAML output)
- [x] `rie snapshot` — create, list, load by ID, load by commit (short hash)
- [x] `rie diff` — text and JSON output
- [x] `rie evaluate` — policy evaluation with `--validate`, `--strict`, `--fail-level`
- [x] `rie init` — project initialisation

### Policy Engine
- [x] `PolicyEngine` with switch-dispatch per rule ID (CEL intent documented)
- [x] Four default rules: `layer-ui-to-infra`, `max-coupling`, `no-circular-deps`, `stability-minimum`
- [x] **Fixed**: inverted `stability-minimum` logic
- [x] Policy rule validator (`validatePolicy`, `validatePolicies`, `parsePolicyFile`)
- [x] `--validate` flag on `rie evaluate` for policy-file-only validation

---

## Phase 2: The Gate ✅ 100% COMPLETE

### GitHub App Foundation
- [x] `WebhookHandler` with HMAC-SHA256 signature verification
- [x] Bounded event deduplication cache (evicts at 1 000 entries)
- [x] `GitHubClient` (placeholder API calls, ready for `@octokit/rest` swap)
- [x] Express server with `/webhook`, `/health`, `/ready`, `/metrics`

### PR Analysis
- [x] `PRAnalyzer` — impact calculation, fitness score delta, layer purity delta
- [x] `blocking.ts` — `shouldBlockPR`, `generateBlockingSummary`, `generateRemediationInstructions`
- [x] Commit status creation (pending → success/failure)
- [x] PR comment generation with violation table

### Storage Integration
- [x] `LocalStorage` — filesystem backend (snapshots/, violations/, index.json)
- [x] `Neo4jStorage` — real driver, Cypher, constraints/indexes, short-hash commit lookup
- [x] `PostgresStorage` — real pg Pool, DDL auto-create, JSONB, batch violation inserts
- [x] `createStorage(config)` factory with auto-init
- [x] `createStorageFromEnv()` for server startup
- [x] Webhook handler loads real CAG from storage; falls back to empty mock only when empty
- [x] Server exposes `/api/snapshots`, `/api/snapshots/latest`, `/api/snapshots/:id`
- [x] Graceful SIGTERM/SIGINT shutdown

### Testing
- [x] `webhook-handler.test.ts` — 9 tests: signature, tampering, invalid JSON, dedup, blocking, comments, distinct PRs
- [x] `local-storage.test.ts` — 21 tests covering all storage operations

---

## Phase 3: The Dashboard ✅ 100% COMPLETE

### Foundation
- [x] React + Vite setup
- [x] Design system tokens (`tokens.ts`)
- [x] `Navigation` component (refresh button, live/syncing indicator)

### Data Integration
- [x] `api/client.ts` — typed fetch client (VITE_API_URL, getLatestSnapshot, listSnapshots)
- [x] `hooks/useSnapshot.ts` — polling every 30 s, metric derivation, error handling
- [x] `App.tsx` wired to real data — no hardcoded sample data

### Visualisations
- [x] `GraphVisualization` — Canvas, circle layout from real modules, fallback to sample
- [x] `MetricCard` — value, trend, alert pulse
- [x] `ViolationsList` — severity badge, file, line, remediation
- [x] `TrendChart` — Recharts LineChart, modules/dependencies/entities over time, coupling spike alert
- [x] `DependencyMatrix` — N×N Canvas matrix, cyan = dep, red = layer violation, rotated labels
- [x] `SnapshotBrowser` — clickable table, active row highlighted, formatBytes

### Polish
- [x] Error banner with retry button
- [x] Loading state with `aria-live`
- [x] Tab bar with violation count badge
- [x] Skip-to-content link (keyboard accessibility)
- [x] ARIA roles: `role="tab"`, `aria-selected`, `role="tabpanel"`, `role="alert"`, `aria-label` on sections
- [x] Mobile-friendly: `flex-wrap`, `auto-fit` grid, horizontal scroll on tab bar, `minmax` columns
- [x] Vite dev proxy for `/api` and `/health` → localhost:3000

---

## Bug Fixes Applied (All Sessions)

- [x] **Variable shadowing** — `path` param vs `path` module in `analyze.ts`
- [x] **Missing `createdAt`/`updatedAt`** — now set in `analyze`, `snapshot`, webhook mock graph
- [x] **YAML output stub** — now produces real YAML via inline serialiser
- [x] **Inverted stability rule** — `checkStabilityMinimum` was flagging passing modules
- [x] **Fake CEL dispatch** — `includes('coupling')` keyword sniffing replaced with `switch(policy.id)`
- [x] **Circular dep DFS** — replaced buggy recursion-stack approach with Tarjan-style `onStack` set
- [x] **`processedEvents` memory leak** — bounded at 1 000 entries with LRU eviction
- [x] **Missing `afterEach` import** in test file
- [x] **`Module.type` enum missing** `'ui'`, `'infra'`, `'presentation'` — caused Zod rejection of mock data
- [x] **Typo in `core/package.json`** — `"./ CAG"` export path had a space
- [x] **Signature error before response** — server now returns 401 before processing, not after 202
- [x] **`endLine: 0`** — tree-sitter parsers now populate from `node.endPosition.row`

---

## Backlog / Post-MVP

### v2.1: Language Support
- [ ] Go parser (tree-sitter-go)
- [ ] Rust parser (tree-sitter-rust)
- [ ] Kotlin parser (tree-sitter-kotlin)

### v2.2: Advanced Analytics
- [ ] Predictive architecture decay scoring
- [ ] Dependency heat maps (D3)
- [ ] Team contribution analysis
- [ ] Historical AFS trend (requires storing AFS per snapshot)

### v2.3: Enterprise
- [ ] SSO (SAML/OIDC)
- [ ] Audit logging
- [ ] Compliance report export (PDF)
- [ ] Role-based access control

### v2.4: Ecosystem
- [ ] VS Code extension
- [ ] IntelliJ plugin
- [ ] GitLab integration
- [ ] Azure DevOps integration
- [ ] Real CEL runtime integration (cel-js or WASM)
- [ ] Real `@octokit/rest` integration in `GitHubClient`
- [ ] Redis caching layer

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Packages | 6 |
| Source files | ~35 |
| Test files | 2 |
| Tests | 30 |
| Bugs fixed | 13 |
| Completion (MVP) | **100%** |
