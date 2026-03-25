# ArchLens RIE — Configuration Specification

Version 2.0.0

---

## Project Configuration

**Location**: `.archlens/config.json` (created by `rie init`)

```json
{
  "version": "2.0.0",
  "project": {
    "name": "my-project",
    "root": "/path/to/project"
  },
  "analysis": {
    "include": ["**/*.ts", "**/*.tsx", "**/*.java", "**/*.py"],
    "exclude": ["node_modules/**", "dist/**", "build/**", ".git/**", ".archlens/**"]
  },
  "policies": {
    "enabled": true,
    "rules": ["layer-ui-to-infra", "max-coupling", "no-circular-deps", "stability-minimum"]
  },
  "storage": {
    "type": "local",
    "path": ".archlens/snapshots"
  },
  "github": {
    "enabled": false,
    "appId": null,
    "installationId": null
  }
}
```

---

## Policy Rules

### Built-in Rules

| Rule ID | Severity | Description |
|---------|----------|-------------|
| `layer-ui-to-infra` | critical | UI/presentation layers must not import infrastructure directly |
| `max-coupling` | major | Module coupling must not exceed 0.15 |
| `no-circular-deps` | critical | No circular dependency cycles between modules |
| `stability-minimum` | major | Domain modules must maintain stability ≥ 0.7 |

### Custom Rule Schema

```json
{
  "id": "kebab-case-id",
  "name": "Human-readable name",
  "description": "What this rule enforces",
  "expression": "CEL expression (documents intent; TypeScript dispatch evaluates)",
  "severity": "critical | major | minor | info",
  "enabled": true,
  "tags": ["optional", "tags"]
}
```

**Validation rules applied to custom policies:**
- `id` must be lowercase alphanumeric with hyphens or underscores only
- `expression` must not be empty or a trivial constant (`true`, `false`, `1`, `0`)
- `tags` must not contain empty strings
- IDs must be unique across the policy set

**Validate a policy file without evaluating:**
```bash
rie evaluate --validate -p .archlens/policies/custom.json
```

---

## Storage Backends

### Local (default — zero configuration)

```json
{ "type": "local", "path": ".archlens/snapshots" }
```

Disk layout:
```
.archlens/snapshots/
  snapshots/<id>.json        — full CAG
  violations/<id>.json       — violations array
  policies.json              — saved policy rules
  index.json                 — ordered snapshot metadata (newest first)
```

### PostgreSQL

```json
{
  "type": "postgresql",
  "connectionString": "postgresql://user:pass@localhost:5432/archlens"
}
```

Tables auto-created on first `initialize()`: `snapshots`, `violations`, `policies`.

### Neo4j

```json
{
  "type": "neo4j",
  "connectionString": "neo4j://localhost:7687",
  "auth": { "username": "neo4j", "password": "password" }
}
```

Constraints and indexes auto-created on `initialize()`.

---

## Environment Variables

### GitHub App Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_APP_ID` | Yes | — | Numeric GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | Yes | — | PEM private key |
| `WEBHOOK_SECRET` | Yes | — | HMAC secret for payload verification |
| `PORT` | No | `3000` | HTTP server port |
| `ENABLE_BLOCKING` | No | `true` | Block PRs on critical violations |

### Storage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ARCHLENS_STORAGE_TYPE` | No | `local` | `local` \| `neo4j` \| `postgresql` |
| `ARCHLENS_STORAGE_URL` | No | `.archlens/snapshots` | Connection string or directory path |
| `ARCHLENS_STORAGE_USERNAME` | No | — | Database username (Neo4j/PostgreSQL) |
| `ARCHLENS_STORAGE_PASSWORD` | No | — | Database password |
| `ARCHLENS_STORAGE_CACHE` | No | `true` | Enable in-memory read cache |
| `ARCHLENS_STORAGE_CACHE_TTL` | No | `300` | Cache TTL in seconds |

### Blocking Behaviour

| Variable | Default | Description |
|----------|---------|-------------|
| `ARCHLENS_BLOCKING_ENABLED` | `true` | Master switch for PR blocking |
| `ARCHLENS_BLOCK_CRITICAL` | `true` | Block on critical violations |
| `ARCHLENS_BLOCK_MAJOR` | `true` | Block on major violations |
| `ARCHLENS_BLOCK_MINOR` | `false` | Block on minor violations |
| `ARCHLENS_BLOCK_FITNESS_DROP` | `true` | Block on AFS drop > threshold |
| `ARCHLENS_MIN_FITNESS_DELTA` | `-10` | AFS delta that triggers blocking |
| `ARCHLENS_EXCLUDED_BRANCHES` | `main,master,develop` | Comma-separated branches exempt from blocking |

### Dashboard

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `` (same origin) | GitHub App server base URL |

---

## CAG Schema Reference

The Canonical Architecture Graph is validated with Zod. Key fields:

```typescript
{
  version: string;           // "2.0.0"
  createdAt: string;         // ISO-8601 datetime (required)
  updatedAt: string;         // ISO-8601 datetime (required)
  metadata: {
    projectName: string;
    sourceRoot: string;
    parserVersion: string;
    commit?: string;         // Git commit hash (optional for local analysis)
    totalFiles?: number;
    totalEntities?: number;
    totalDependencies?: number;
  };
  entities: CodeEntity[];    // classes, interfaces, functions, modules...
  dependencies: Dependency[]; // import, extends, implements, calls, uses...
  modules: Module[];          // architectural groupings with metrics
  violations?: Violation[];
  policyRules?: PolicyRule[];
}
```

**Module types**: `layer` | `module` | `component` | `service` | `repository` | `controller` | `domain` | `infrastructure` | `ui` | `infra` | `presentation`

---

## Architecture Fitness Score Formula

```
AFS = (25% × Stability)
    + (20% × LayerPurity)
    + (20% × Security)      ← placeholder: 0.9
    + (15% × Complexity)    ← placeholder: 0.8
    + (10% × Testability)   ← placeholder: 0.85
    + (10% × Documentation) ← placeholder: 0.75
```

Stability and LayerPurity are computed from real graph data. The remaining components are placeholders pending integration of test coverage and documentation metrics in v2.2.
