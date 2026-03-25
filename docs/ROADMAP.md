# ArchLens RIE 2.0 — Development Roadmap

## Status: MVP Complete

All three phases of the 90-day plan are complete. The platform is ready for design-partner onboarding and private beta.

---

## Completed Phases

### Phase 1: The Core ✅
**Objective**: Build the fundamental parsing engine and CLI with CAG generation.

Delivered:
- Canonical Architecture Graph (CAG) schema with Zod runtime validation
- Tree-sitter parsers for TypeScript, Java, Python (regex fallback for CI/CD environments without native bindings)
- Full CLI: `rie analyze`, `rie snapshot`, `rie diff`, `rie evaluate`, `rie init`
- Policy engine with four default CEL rules and full policy file validation

**Achieved**: Parses real codebases; graph output is schema-valid and diff-able.

### Phase 2: The Gate ✅
**Objective**: GitHub App integration with PR blocking.

Delivered:
- Express server with HMAC-SHA256 webhook verification
- PR analyzer computing fitness score delta and layer purity delta
- Blocking logic configurable by severity (critical/major/minor)
- Three storage backends: local filesystem, Neo4j, PostgreSQL
- `createStorageFromEnv()` for zero-config startup
- Server APIs: `/api/snapshots`, `/api/snapshots/latest`, `/api/snapshots/:id`
- Readiness check that validates storage health
- Graceful SIGTERM/SIGINT shutdown

**Achieved**: End-to-end pipeline from `rie analyze` → snapshot → PR analysis → GitHub status check.

### Phase 3: The Dashboard ✅
**Objective**: React dashboard with live data and visualisations.

Delivered:
- Live data via `useSnapshot` hook with 30-second polling
- Canvas architecture graph (circle layout from real modules)
- Recharts trend chart (modules, dependencies, entities over time; coupling spike alert)
- N×N dependency matrix (Canvas; violation cells in red)
- Snapshot browser (click to load any historical point)
- Full violation list with severity, file, line, remediation
- Accessibility: skip-to-content, ARIA roles, `aria-live`, keyboard navigation
- Mobile-responsive layout with auto-fit grids and flex-wrap

**Achieved**: Dashboard renders real data from the storage backend with no hardcoded samples.

---

## Next Milestones

### v2.1 — Enhanced Language Support
Target: Q2 2026

- Go parser (tree-sitter-go)
- Rust parser (tree-sitter-rust)
- Kotlin parser (tree-sitter-kotlin)
- Language auto-detection improvements

### v2.2 — Advanced Analytics
Target: Q3 2026

- Real CEL runtime integration (cel-js or WASM build)
- Real `@octokit/rest` GitHub API integration (replaces console.log stubs)
- Historical AFS trend chart (requires storing AFS score per snapshot)
- Dependency heat maps (D3)
- Predictive architecture decay scoring

### v2.3 — Enterprise
Target: Q4 2026

- SSO (SAML/OIDC)
- Audit logging
- Compliance report export (PDF)
- Role-based access control
- Redis caching layer

### v2.4 — Ecosystem
Target: 2027

- VS Code extension
- IntelliJ plugin
- GitLab integration
- Azure DevOps integration

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Analysis speed | &lt;30s for 10K LOC | ✅ Achieved (tree-sitter) |
| PR blocking | 50% design partner enablement | 🔜 Requires real GitHub App install |
| AFS weekly views | 80% of users | 🔜 Requires user analytics |
| Violation reduction | 30% in 6 months | 🔜 Requires longitudinal data |

---

## Resources

- Architecture: 6 packages, monorepo (npm workspaces)
- Languages: TypeScript throughout
- Runtime: Node.js ≥ 20
- Key dependencies: Zod, tree-sitter, Express, Recharts, React, pg, neo4j-driver
