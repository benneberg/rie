# ArchLens RIE 2.0

**The GitHub for Architecture — Turn your codebase into a governed, measurable, and self-healing system.**

ArchLens RIE (Runtime Intelligence Engine) is an enterprise-grade software architecture governance platform. It provides deterministic enforcement of architectural constraints through PR-level integration, comprehensive dependency analysis, and measurable KPIs.

---

## What's Built

| Package | Status | Description |
|---------|--------|-------------|
| `@archlens/core` | ✅ Complete | CAG schema, tree-sitter parsers (TS/Java/Python), parser registry |
| `@archlens/engine` | ✅ Complete | CEL policy engine, default rules, policy validator |
| `@archlens/storage` | ✅ Complete | Local filesystem, Neo4j, PostgreSQL backends |
| `@archlens/cli` | ✅ Complete | `analyze`, `snapshot`, `diff`, `evaluate`, `init` commands |
| `@archlens/github-app` | ✅ Complete | Webhook handler, PR analyzer, blocking logic, Express server |
| `@archlens/dashboard` | ✅ Complete | React dashboard, live data, graph viz, trend chart, matrix |

---

## Features

- **Canonical Architecture Graph (CAG)** — JSON-native schema representing your entire architecture with modules, entities, and dependencies. Validated with Zod at every boundary.
- **Tree-sitter Parsers** — Accurate AST-based parsing for TypeScript, Java, and Python. Regex fallback activates automatically if native bindings are unavailable.
- **Policy Engine** — Four built-in CEL rules: layer isolation, coupling threshold, no circular deps, domain stability. Supports custom rules loaded from JSON files with full validation.
- **PR-Level Enforcement** — GitHub App blocks or comments on pull requests that introduce architecture violations. Configurable per severity.
- **Architecture Fitness Score (AFS)** — Composite metric: `(25% × Stability) + (20% × LayerPurity) + (20% × Security) + (15% × Complexity) + (10% × Testability) + (10% × Documentation)`.
- **Time Machine** — Immutable snapshots with `rie snapshot --create`. Diff any two points in history with `rie diff`.
- **Storage Backends** — Local filesystem (default, zero config), Neo4j, PostgreSQL. Switch via environment variable.
- **React Dashboard** — Live architecture graph visualisation, N×N dependency matrix with violation highlighting, Recharts trend charts, snapshot browser.

---

## Project Structure

```
archlens-rie/
├── packages/
│   ├── core/          # CAG schema (Zod) + tree-sitter parsers
│   ├── engine/        # Policy evaluation + validator
│   ├── storage/       # Local / Neo4j / PostgreSQL backends
│   ├── github-app/    # GitHub App server + webhook handler
│   ├── dashboard/     # React + Vite dashboard
│   └── cli/           # rie CLI
└── docs/
    ├── SPEC.md        # Configuration reference
    ├── ROADMAP.md     # Development roadmap
    ├── TASKS.md       # Granular task tracking
    └── DEPLOYMENT.md  # Production deployment guide
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Install & Build

```bash
git clone https://github.com/archlens/archlens-rie.git
cd archlens-rie
npm install
npm run build
```

### Analyse Your First Project

```bash
cd /path/to/your-project

# 1. Initialise — creates .archlens/ config directory
npx rie init

# 2. Analyse source code
npx rie analyze ./src --output .archlens/graph.json

# 3. Evaluate against policies
npx rie evaluate .archlens/graph.json --strict

# 4. Save a snapshot (commit to history)
npx rie snapshot --create

# 5. Compare snapshots after your next change
npx rie diff <commit-before> <commit-after>
```

---

## CLI Reference

### `rie analyze [path]`

Parses source files and builds a Canonical Architecture Graph.

```bash
rie analyze ./src                        # Analyse src/, print metadata
rie analyze ./src -o graph.json          # Save graph to file
rie analyze ./src -o graph.yaml -f yaml  # YAML output
```

Supported languages: **TypeScript** (`.ts`, `.tsx`), **Java** (`.java`), **Python** (`.py`).  
Automatically skips: `node_modules`, `.git`, `dist`, `build`, `.next`, `.archlens`, `coverage`.

### `rie snapshot`

Manage architecture history.

```bash
rie snapshot --create          # Snapshot the current state
rie snapshot --list            # List all snapshots (newest first)
rie snapshot --id <id>         # Print snapshot by ID
rie snapshot --commit <hash>   # Print snapshot by commit (short hash supported)
```

### `rie diff <from> <to>`

Compare two snapshots by ID or commit hash.

```bash
rie diff abc1234 def5678                   # Text diff (default)
rie diff abc1234 def5678 --format json     # JSON diff
rie diff abc1234 def5678 -o diff.json      # Save to file
```

### `rie evaluate [graph]`

Run policy rules against an architecture graph.

```bash
rie evaluate graph.json                         # Evaluate, print report
rie evaluate graph.json --strict                # Exit 1 on violations
rie evaluate graph.json --fail-level critical   # Only fail on critical
rie evaluate graph.json -p custom-rules.json    # Include custom policies
rie evaluate --validate -p custom-rules.json    # Validate policy file only
cat graph.json | rie evaluate                   # Read from stdin
```

### `rie init`

Initialise ArchLens in the current project.

```bash
rie init          # Create .archlens/ with config and default policies
rie init --force  # Overwrite existing configuration
```

---

## Policy Rules

### Built-in Rules

| ID | Severity | Description |
|----|----------|-------------|
| `layer-ui-to-infra` | Critical | UI/presentation must not import infrastructure directly |
| `max-coupling` | Major | Module coupling must not exceed 0.15 |
| `no-circular-deps` | Critical | No circular dependency cycles between modules |
| `stability-minimum` | Major | Domain modules must maintain stability ≥ 0.7 |

### Custom Rules

Place a JSON array in `.archlens/policies/custom.json`:

```json
[
  {
    "id": "no-service-to-ui",
    "name": "Services Must Not Import UI",
    "description": "Service modules must not depend on UI modules",
    "expression": "modules.all(m, m.type != \"service\" || m.dependencies.all(d, d.targetType != \"ui\"))",
    "severity": "major",
    "enabled": true,
    "tags": ["layering"]
  }
]
```

Validate a policy file without running evaluation:

```bash
rie evaluate --validate -p .archlens/policies/custom.json
```

---

## Storage Backends

Default is **local filesystem** — no configuration needed.

### Local (default)

```bash
# Default location: .archlens/snapshots/
rie snapshot --create
```

### PostgreSQL

```bash
export ARCHLENS_STORAGE_TYPE=postgresql
export ARCHLENS_STORAGE_URL=postgresql://user:pass@localhost:5432/archlens
npm run start:github-app
```

### Neo4j

```bash
export ARCHLENS_STORAGE_TYPE=neo4j
export ARCHLENS_STORAGE_URL=neo4j://localhost:7687
export ARCHLENS_STORAGE_USERNAME=neo4j
export ARCHLENS_STORAGE_PASSWORD=password
npm run start:github-app
```

---

## GitHub App

### Environment Variables

```bash
# Required
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
WEBHOOK_SECRET=your-secret

# Optional
PORT=3000
ENABLE_BLOCKING=true

# Storage (defaults to local)
ARCHLENS_STORAGE_TYPE=local
ARCHLENS_STORAGE_URL=.archlens/snapshots
```

### Start

```bash
cd packages/github-app
cp .env.example .env   # fill in values
npm run start
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhook` | GitHub webhook receiver |
| `GET` | `/health` | Health check |
| `GET` | `/ready` | Readiness check (includes storage health) |
| `GET` | `/api/snapshots` | List recent snapshots |
| `GET` | `/api/snapshots/latest` | Get latest snapshot |
| `GET` | `/api/snapshots/:id` | Get snapshot by ID |
| `GET` | `/metrics` | Prometheus-format metrics |

---

## Dashboard

```bash
# Development (proxies /api to localhost:3000)
npm run dev:dashboard

# Production build
npm run build:dashboard
```

The dashboard connects to the GitHub App server at the same origin (or `VITE_API_URL` if set). It polls for new snapshots every 30 seconds.

**Tabs:**
- **Overview** — architecture graph, recent violations, trend chart
- **Dependency Matrix** — N×N module adjacency matrix, layer violations in red
- **Violations** — full violation list with severity, file, and remediation
- **History** — snapshot browser, click any row to load that point in time

---

## Development

### Build Individual Packages

```bash
npm run build:core
npm run build:engine
npm run build:storage
npm run build:github-app
npm run build:dashboard
```

### Run Tests

```bash
npm test                            # All packages
npm test -w @archlens/storage       # Storage tests only
npm test -w @archlens/github-app    # GitHub App tests (webhook handler)
```

### Type Check

```bash
npm run typecheck
```

---

## Architecture Decision Records

| ADR | Decision | Rationale |
|-----|----------|-----------|
| CEL for policies | Expression field stores canonical CEL; TypeScript dispatch evaluates rules | Readable policy format now, real CEL runtime drop-in later |
| Neo4j + SQLite | Neo4j for production, local FS for dev/CLI | Zero-config dev experience; native graph queries in production |
| tree-sitter with regex fallback | Attempt native bindings; fall back silently | Correctness when compiled, no hard failure in CI/CD without native deps |
| Zod for CAG schema | Runtime validation at every ingest boundary | Catches malformed graphs early, generates TypeScript types automatically |

---

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full plan.

**Next milestones:**
- v2.1: Go, Rust, Kotlin parsers
- v2.2: Predictive decay analytics, heat maps
- v2.3: SSO, audit logging, compliance reports
- v2.4: VS Code extension, GitLab integration

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
