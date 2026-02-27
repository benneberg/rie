**specs.md**

# Repository Insights Engine (RIE)

**Version:** 1.1.0  
**Status:** Draft Specification  
**Last Updated:** 2025-01-XX

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Core Objectives](#3-core-objectives)
4. [Target Use Cases](#4-target-use-cases)
5. [Supported Inputs](#5-supported-inputs)
6. [System Architecture](#6-system-architecture)
7. [Core Components](#7-core-components)
8. [Output Artifacts](#8-output-artifacts)
9. [README Specification](#9-readme-specification)
10. [Validation Engine](#10-validation-engine)
11. [CLI Interface](#11-cli-interface)
12. [Configuration System](#12-configuration-system)
13. [Extension Points](#13-extension-points)
14. [Quality Attributes](#14-quality-attributes)
15. [Constraints & Non-Goals](#15-constraints--non-goals)
16. [Versioning Strategy](#16-versioning-strategy)
17. [Roadmap](#17-roadmap)
18. [Open Questions](#18-open-questions)
19. [Implementation Strategy](#19-implementation-strategy)
20. [Appendix](#20-appendix)

---

## 1. Executive Summary

**Repository Insights Engine (RIE)** is a structured codebase analysis system that extracts architectural, semantic, and operational intelligence from source repositories, transforming them into:

- **Structured metadata** (machine-readable JSON with strict schema)
- **Validated documentation** (README, architecture docs)
- **Visual assets** (dependency graphs, architecture diagrams)
- **LLM-optimized context** (for AI-assisted development workflows)

**Core Value Proposition:** RIE makes repositories *machine-explainable* — bridging the gap between executable code and comprehensible architecture.

---

## 2. Problem Statement

### The Documentation Gap

Modern repositories are optimized for **execution**, not **comprehension**:

| Problem | Impact |
|---------|--------|
| Architecture lives in developers' heads | Knowledge loss, slow onboarding |
| Documentation drifts from reality | Misleading information, wasted time |
| No standard metadata format | Poor tooling integration |
| LLMs lack structural context | Suboptimal AI assistance |
| Manual documentation is expensive | Perpetually outdated docs |

### Why Existing Tools Fall Short

| Tool Category | Limitation |
|--------------|------------|
| Static analyzers (ESLint, SonarQube) | Focus on issues, not architecture |
| Doc generators (JSDoc, Sphinx) | Require manual annotations |
| LLM tools (Copilot, Cursor) | No persistent structural model |
| Diagramming tools | Manual maintenance burden |

**RIE unifies static analysis, documentation generation, and LLM context preparation into a single coherent system.**

---

## 3. Core Objectives

### Primary Objectives

1. **Extract** — Derive architectural metadata from source code deterministically
2. **Model** — Produce a standardized, versioned metadata schema
3. **Document** — Generate accurate, validated README and supporting docs
4. **Visualize** — Produce architecture diagrams and dependency graphs
5. **Validate** — Ensure documentation accuracy against source truth
6. **Enable** — Provide LLM-optimized context for AI workflows

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Deterministic First** | Core extraction produces identical output for identical input |
| **Source of Truth** | Code is authoritative; documentation derives from it |
| **Schema-Driven** | All outputs conform to versioned schemas |
| **Language-Agnostic Core** | Orchestration layer works across languages |
| **Progressive Enhancement** | Basic extraction works without LLM; LLM enhances |
| **Validation by Default** | Every generated artifact is validated |

---

## 4. Target Use Cases

### Primary Use Cases

| Use Case | Description | Priority |
|----------|-------------|----------|
| **README Generation** | Production-grade README from source analysis | P0 |
| **Architecture Audit** | Detect patterns, anti-patterns, violations | P0 |
| **LLM Context Preparation** | Structured context for AI tools | P0 |
| **Developer Onboarding** | Auto-generated project guides | P1 |
| **CI/CD Integration** | Continuous documentation validation | P1 |
| **Technical Due Diligence** | Automated codebase assessment | P2 |

### Secondary Use Cases

| Use Case | Description | Priority |
|----------|-------------|----------|
| **Security Documentation** | Auth models, data handling, threat surface | P2 |
| **Marketing Documentation** | Technical positioning, feature summaries | P3 |
| **SaaS Repository Insights** | Web-based analysis dashboard | Future |

---

## 5. Supported Inputs

### Input Sources

| Source Type | Description | Status |
|-------------|-------------|--------|
| Local Directory | File system path | Core |
| ZIP Archive | Compressed repository | Core |
| Git Repository | Clone URL or local .git | Core |
| Docker Volume | Mounted project path | Core |
| Tarball | .tar.gz archive | Core |
| GitHub/GitLab URL | Remote repository | Future |

**Note:** Git is NOT required. RIE operates on file trees.

### Repository Types

| Type | Support Level |
|------|---------------|
| Single-language project | Full |
| Polyglot repository | Full |
| Monorepo | Full (with package isolation) |
| Workspace (npm/yarn/pnpm) | Full |
| Multi-root workspace | Planned |

### Supported Languages (Initial)

| Language | Analyzer Status | Tools |
|----------|-----------------|-------|
| TypeScript | Primary | tree-sitter, ts-morph, dependency-cruiser |
| JavaScript | Primary | tree-sitter, dependency-cruiser |
| Python | Primary | ast, pyan, rope |
| Go | Planned | go/ast, guru |
| Rust | Planned | syn, rust-analyzer |
| Java | Planned | javaparser, eclipse JDT |

---

## 6. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Local Dir │ ZIP │ Git Repo │ Docker Mount │ Remote URL         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SCANNING LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  File Scanner → Language Detector → Config Parser → Ignorer     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ANALYSIS LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  TypeScript  │  │    Python    │  │   Generic    │          │
│  │   Analyzer   │  │   Analyzer   │  │   Analyzer   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                      │
│              ┌────────────────────────┐                         │
│              │  Dependency Graph      │                         │
│              │  Builder               │                         │
│              └────────────────────────┘                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AGGREGATION LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Metadata Aggregator → Schema Validator → Conflict Resolver     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GENERATION LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │   README   │  │  Diagram   │  │    LLM     │  │   Asset   │ │
│  │ Generator  │  │ Generator  │  │ Summarizer │  │ Generator │ │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VALIDATION LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Claim Validator → Consistency Checker → Drift Detector         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OUTPUT LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  repository.meta.json │ README.md │ Diagrams │ LLM Context      │
└─────────────────────────────────────────────────────────────────┘
```

### Component Communication

```
┌─────────────────────────────────────────────────────────────┐
│                      Core Engine                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Event Bus                           │   │
│  │  (scan.complete, analysis.complete, validation.fail) │   │
│  └─────────────────────────────────────────────────────┘   │
│         │              │              │              │      │
│         ▼              ▼              ▼              ▼      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Scanner  │  │ Analyzer │  │Generator │  │Validator │   │
│  │  Plugin  │  │  Plugin  │  │  Plugin  │  │  Plugin  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Core Components

### 7.1 File System Scanner

**Purpose:** Traverse and index repository structure.

**Responsibilities:**
- Recursive directory traversal with configurable depth limits
- Project root detection (based on markers: package.json, pyproject.toml, go.mod)
- Config file identification and parsing
- Intelligent ignore patterns (.gitignore, .rieignore)
- File hashing for change detection
- Symlink handling

**Outputs:**

```typescript
interface ScanResult {
  projectRoot: string;
  fingerprint: string;  // SHA-256 of file tree
  files: FileEntry[];
  configFiles: ConfigFile[];
  markers: ProjectMarker[];
  statistics: {
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    byExtension: Record<string, number>;
  };
}
```

**Ignore Patterns (Default):**
```
.git/
node_modules/
__pycache__/
.venv/
venv/
dist/
build/
.next/
.nuxt/
coverage/
*.min.js
*.bundle.js
```

---

### 7.2 Language Detection Engine

**Purpose:** Identify programming languages and frameworks.

**Detection Hierarchy:**

1. **Explicit markers** (tsconfig.json → TypeScript)
2. **Package manifests** (package.json dependencies)
3. **File extensions** (.ts, .py, .go)
4. **Shebang lines** (#!/usr/bin/env python)
5. **Content analysis** (for ambiguous files)

**Outputs:**

```typescript
interface LanguageDetection {
  primary: Language;
  secondary: Language[];
  frameworks: Framework[];
  confidence: Record<Language, number>;  // 0-1 confidence score
  evidence: DetectionEvidence[];
}

interface Framework {
  name: string;           // "Next.js", "FastAPI", "Express"
  version?: string;
  category: FrameworkCategory;  // "web", "cli", "library", "api"
}
```

---

### 7.3 Language Analyzers

#### 7.3.1 TypeScript/JavaScript Analyzer

**Tools:** tree-sitter, ts-morph, dependency-cruiser

**Extractions:**

| Category | Elements |
|----------|----------|
| Structure | Modules, namespaces, files |
| Exports | Functions, classes, constants, types |
| Imports | Internal, external, dynamic |
| Types | Interfaces, type aliases, enums, generics |
| Functions | Signatures, async/sync, generators |
| Classes | Hierarchies, decorators, methods |
| Documentation | JSDoc, TSDoc comments |
| Patterns | Singletons, factories, observers |

**Outputs:**

```typescript
interface TypeScriptAnalysis {
  entryPoints: EntryPoint[];
  exports: ExportedSymbol[];
  imports: ImportStatement[];
  classes: ClassDefinition[];
  functions: FunctionDefinition[];
  types: TypeDefinition[];
  dependencies: {
    internal: ModuleDependency[];
    external: PackageDependency[];
    circular: CircularDependency[];
  };
  patterns: DetectedPattern[];
  complexity: ComplexityMetrics;
}
```

#### 7.3.2 Python Analyzer

**Tools:** ast, pyan, rope, importlib.metadata

**Extractions:**

| Category | Elements |
|----------|----------|
| Structure | Packages, modules, __init__.py |
| Classes | Definitions, inheritance, metaclasses |
| Functions | Sync, async, generators, decorators |
| Decorators | @dataclass, @property, custom |
| Types | Type hints, Protocol, TypedDict |
| CLI | argparse, click, typer definitions |
| Entry Points | __main__.py, console_scripts |

**Outputs:**

```typescript
interface PythonAnalysis {
  packages: PackageInfo[];
  modules: ModuleInfo[];
  classes: PythonClassDef[];
  functions: PythonFunctionDef[];
  entryPoints: PythonEntryPoint[];
  dependencies: {
    imports: ImportInfo[];
    circular: CircularImport[];
  };
  cliDefinitions: CLIDefinition[];
  typeAnnotations: TypeAnnotationStats;
}
```

---

### 7.4 Dependency Graph Builder

**Purpose:** Construct and analyze dependency relationships.

**Graph Types:**

| Graph Type | Description | Depth |
|------------|-------------|-------|
| Module Graph | File/module dependencies | Always |
| Package Graph | External package relationships | Always |
| Call Graph | Function call relationships | Configurable |
| Type Graph | Type inheritance/usage | TypeScript only |
| Data Flow Graph | Variable/state flow | Future |

**Analysis Capabilities:**

- Circular dependency detection
- Layer violation detection (configurable boundaries)
- Orphan module identification
- Core vs peripheral module classification
- Coupling metrics (afferent/efferent coupling)
- Stability metrics

**Outputs:**

```typescript
interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metrics: {
    totalNodes: number;
    totalEdges: number;
    avgDegree: number;
    maxDepth: number;
    circularDependencies: number;
  };
  clusters: ModuleCluster[];
  issues: DependencyIssue[];
}
```

**Export Formats:**
- JSON (native)
- Graphviz DOT
- Mermaid
- D3.js compatible

---

### 7.5 Metadata Aggregator

**Purpose:** Unify analysis results into canonical metadata model.

**Aggregation Process:**

1. Collect outputs from all analyzers
2. Resolve conflicts (e.g., conflicting version info)
3. Normalize data structures
4. Apply inference rules
5. Validate against schema
6. Compute derived metrics

**Schema:** See [Appendix A: Metadata Schema](#appendix-a-metadata-schema)

---

### 7.6 LLM Summarization Engine

**Purpose:** Generate human-readable summaries using LLM assistance.

**Mode:** Optional (system works without LLM)

**Input Selection Strategy:**

```typescript
interface LLMContext {
  metadata: RepositoryMetadata;       // Full metadata
  codeExcerpts: CodeExcerpt[];        // High-signal code samples
  configSummaries: ConfigSummary[];   // Parsed config files
  documentationHints: string[];       // Existing docs
  
  // Token budget management
  maxTokens: number;
  prioritization: PriorityStrategy;
}
```

**High-Signal Code Selection:**
1. Entry points
2. Public API definitions
3. Core domain models
4. Configuration schemas
5. README/CONTRIBUTING excerpts

**Generated Sections:**

| Section | Description |
|---------|-------------|
| Executive Summary | 2-3 sentence project description |
| Problem Statement | What problem this solves |
| Architecture Narrative | Plain-English architecture explanation |
| Domain Model Explanation | Business entities and relationships |
| Feature Analysis | Capability breakdown |
| Differentiation | How it compares to alternatives |

**LLM Provider Abstraction:**

```typescript
interface LLMProvider {
  summarize(context: LLMContext, prompt: string): Promise<string>;
  estimateTokens(text: string): number;
}

// Implementations
class OpenAIProvider implements LLMProvider { }
class AnthropicProvider implements LLMProvider { }
class LocalLLMProvider implements LLMProvider { }
```

---

### 7.7 README Generator

**Purpose:** Produce standardized, validated README.md.

**Generation Modes:**

| Mode | Description |
|------|-------------|
| Deterministic | Metadata-only, no LLM |
| Enhanced | Metadata + LLM summaries |
| Hybrid | Deterministic with optional LLM sections |

**Template Engine:** Handlebars or EJS with custom helpers

See [Section 9: README Specification](#9-readme-specification) for template details.

---

### 7.8 Asset Generator

**Purpose:** Generate visual and media assets.

**Asset Types:**

| Asset | Format | Tool |
|-------|--------|------|
| Architecture Diagram | Mermaid, SVG, PNG | mermaid-cli |
| Dependency Graph | SVG, PNG | Graphviz |
| Module Hierarchy | Mermaid | mermaid-cli |
| README Banner | PNG, SVG | AI generation / templates |
| Demo GIF | GIF, WebM | Playwright + ffmpeg |
| API Documentation | HTML, Markdown | TypeDoc, Sphinx |

---

## 8. Output Artifacts

### Primary Outputs

| Artifact | Description | Format |
|----------|-------------|--------|
| `repository.meta.json` | Canonical metadata | JSON (schema-validated) |
| `README.md` | Generated documentation | Markdown |
| `ARCHITECTURE.md` | Detailed architecture doc | Markdown |
| `rie-report.html` | Visual analysis report | HTML |

### Secondary Outputs

| Artifact | Description | Format |
|----------|-------------|--------|
| `dependency-graph.svg` | Visual dependency graph | SVG |
| `architecture.mermaid` | Mermaid diagram source | Mermaid |
| `llm-context.json` | LLM-optimized context | JSON |
| `validation-report.json` | Validation results | JSON |

### Output Directory Structure

```
.rie/
├── repository.meta.json          # Canonical metadata
├── repository.meta.schema.json   # Schema reference
├── cache/                        # Analysis cache
│   ├── scan-cache.json
│   └── analysis-cache.json
├── generated/
│   ├── README.md                 # Generated README
│   ├── ARCHITECTURE.md           # Architecture doc
│   └── assets/
│       ├── dependency-graph.svg
│       ├── architecture.mermaid
│       └── banner.png
├── reports/
│   ├── validation-report.json
│   ├── analysis-report.html
│   └── llm-context.json
└── config.json                   # RIE configuration
```

---

## 9. README Specification

### README Schema v1.0

**Required Sections:**

```markdown
# {Project Name}

> {One-line description}

{Badges: build status, version, license, etc.}

## Overview

{2-3 paragraph project summary}

### Key Features

{Bullet list of main capabilities}

### Who Is This For?

{Target audience description}

## Problem & Context

### The Problem

{Problem statement}

### Existing Solutions

{Alternative approaches and their limitations}

### Our Approach

{How this project addresses the problem differently}

## Architecture

### System Overview

{High-level architecture diagram}

### Core Components

{Component descriptions with responsibilities}

### Data Flow

{How data moves through the system}

## Technical Stack

| Category | Technology |
|----------|------------|
| Language | {languages} |
| Framework | {frameworks} |
| Runtime | {runtime} |
| Database | {if applicable} |
| Build | {build tools} |

## Domain Model

### Core Entities

{Entity descriptions}

### Relationships

{Entity relationship diagram or description}

## Getting Started

### Prerequisites

{Required dependencies and versions}

### Installation

{Step-by-step installation}

### Quick Start

{Minimal example to get running}

## Usage

### Basic Usage

{Common use case examples}

### CLI Reference

{If applicable: command reference}

### API Reference

{If applicable: API overview}

## Configuration

{Configuration options and examples}

## Testing

{How to run tests, coverage information}

## Deployment

{Deployment instructions, CI/CD overview}

## Contributing

{Contribution guidelines or link to CONTRIBUTING.md}

## License

{License information}

---

## Repository Intelligence

> *Auto-generated by [RIE](https://github.com/rie) v{version}*

### Metadata Summary

{Key metrics from analysis}

### Architecture Insights

{Auto-detected patterns, potential issues}

### Last Analyzed

{Timestamp and commit hash if available}
```

### Section Requirements

| Section | Required | Source |
|---------|----------|--------|
| Project Name | Yes | package.json, pyproject.toml, directory name |
| One-line Description | Yes | Metadata or LLM |
| Overview | Yes | LLM or template |
| Key Features | Yes | Analysis + LLM |
| Architecture | Yes | Analysis |
| Technical Stack | Yes | Analysis |
| Domain Model | Conditional | If entities detected |
| Getting Started | Yes | Analysis + templates |
| Usage | Yes | Analysis + examples |
| Configuration | Conditional | If config files exist |
| Testing | Conditional | If tests detected |
| Repository Intelligence | Yes | Analysis metadata |

---

## 10. Validation Engine

### Validation Categories

#### 10.1 Schema Validation

Validate all outputs against JSON schemas:

```typescript
interface SchemaValidation {
  validateMetadata(meta: unknown): ValidationResult;
  validateReadme(readme: string): ValidationResult;
  validateConfig(config: unknown): ValidationResult;
}
```

#### 10.2 Claim Validation

Cross-reference README claims against source truth:

| Claim Type | Validation Method |
|------------|-------------------|
| "Supports TypeScript" | Check for .ts files, tsconfig.json |
| "Uses React" | Check dependencies |
| "Has 95% coverage" | Parse coverage reports |
| "Exports X functions" | Count actual exports |
| "Zero dependencies" | Check package.json |

#### 10.3 Consistency Validation

Ensure internal consistency:

- Entry points in README match detected entry points
- Architecture diagram matches dependency graph
- Feature list matches detected capabilities
- Version numbers are consistent across files

#### 10.4 Completeness Validation

Check for missing required elements:

- All required README sections present
- All detected features documented
- All public APIs documented
- All environment variables documented

### Validation Output

```typescript
interface ValidationReport {
  timestamp: string;
  overallStatus: 'pass' | 'warn' | 'fail';
  score: number;  // 0-100
  
  categories: {
    schema: ValidationCategory;
    claims: ValidationCategory;
    consistency: ValidationCategory;
    completeness: ValidationCategory;
  };
  
  issues: ValidationIssue[];
  suggestions: Suggestion[];
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  code: string;
  message: string;
  location?: Location;
  autoFixable: boolean;
  suggestedFix?: string;
}
```

### Validation Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| Strict | Fail on any issue | CI/CD pipelines |
| Standard | Fail on errors, warn on warnings | Default |
| Lenient | Report all, never fail | Initial analysis |
| Auto-fix | Apply safe automatic fixes | Interactive |

---

## 11. CLI Interface

### Command Structure

```bash
rie <command> [options] [target]
```

### Core Commands

#### `rie scan`

Scan repository and generate metadata.

```bash
rie scan [target] [options]

Arguments:
  target                    Path to repository (default: current directory)

Options:
  -o, --output <path>       Output directory (default: .rie)
  -f, --format <format>     Output format: json, yaml (default: json)
  --depth <number>          Maximum directory depth (default: unlimited)
  --include <patterns>      Include patterns (glob)
  --exclude <patterns>      Exclude patterns (glob)
  --no-cache                Disable caching
  -v, --verbose             Verbose output
  --json                    Output as JSON (for scripting)

Examples:
  rie scan ./my-project
  rie scan --exclude "**/*.test.ts"
  rie scan --output ./analysis --format yaml
```

#### `rie analyze`

Full analysis with optional LLM enhancement.

```bash
rie analyze [target] [options]

Options:
  --mode <mode>             Analysis mode: fast, standard, deep (default: standard)
  --llm                     Enable LLM summarization
  --llm-provider <name>     LLM provider: openai, anthropic, local
  --call-graph              Include call graph analysis
  --no-validation           Skip validation step
  
Examples:
  rie analyze ./project --mode deep
  rie analyze --llm --llm-provider anthropic
```

#### `rie readme`

Generate README from analysis.

```bash
rie readme [target] [options]

Options:
  -o, --output <path>       Output path (default: README.md)
  --template <path>         Custom template path
  --mode <mode>             Generation mode: deterministic, enhanced, hybrid
  --sections <list>         Include only specified sections
  --force                   Overwrite existing README
  --diff                    Show diff with existing README
  
Examples:
  rie readme ./project --mode enhanced
  rie readme --template ./custom-template.md
  rie readme --diff  # Preview changes
```

#### `rie validate`

Validate documentation against source.

```bash
rie validate [target] [options]

Options:
  --readme <path>           Path to README to validate
  --mode <mode>             Validation mode: strict, standard, lenient
  --fix                     Auto-fix safe issues
  --report <path>           Output report path
  
Examples:
  rie validate ./project --mode strict
  rie validate --fix --report ./validation.json
```

#### `rie graph`

Generate dependency graphs.

```bash
rie graph [target] [options]

Options:
  --type <type>             Graph type: module, package, call, all
  --format <format>         Output format: svg, png, mermaid, dot, json
  -o, --output <path>       Output path
  --cluster                 Group by directory/package
  --max-depth <n>           Maximum traversal depth
  
Examples:
  rie graph ./project --type module --format svg
  rie graph --type call --max-depth 3
```

#### `rie export`

Export analysis artifacts.

```bash
rie export [target] [options]

Options:
  --format <format>         Export format: llm-context, markdown, html
  --include <artifacts>     Which artifacts to include
  -o, --output <path>       Output path
  
Examples:
  rie export --format llm-context -o context.json
  rie export --format html -o report.html
```

### Configuration Commands

#### `rie init`

Initialize RIE configuration.

```bash
rie init [options]

Options:
  --preset <name>           Use preset: minimal, standard, full
  --force                   Overwrite existing config
```

#### `rie config`

Manage configuration.

```bash
rie config get <key>
rie config set <key> <value>
rie config list
```

### Utility Commands

```bash
rie version                 # Show version
rie doctor                  # Check system dependencies
rie cache clear             # Clear analysis cache
rie schema show             # Show metadata schema
rie schema validate <file>  # Validate file against schema
```

### Global Options

```bash
--config <path>             # Path to config file
--quiet                     # Suppress non-essential output
--debug                     # Enable debug logging
--color / --no-color        # Control color output
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation failed (strict mode) |
| 3 | Invalid arguments |
| 4 | Missing dependencies |

---

## 12. Configuration System

### Configuration File

`.rie/config.json` or `rie.config.json`:

```json
{
  "$schema": "https://rie.dev/schemas/config.v1.json",
  "version": "1.0",
  
  "scan": {
    "exclude": [
      "node_modules",
      "dist",
      "coverage",
      "**/*.test.ts",
      "**/*.spec.ts"
    ],
    "include": [],
    "maxDepth": null,
    "followSymlinks": false
  },
  
  "analysis": {
    "mode": "standard",
    "languages": {
      "typescript": {
        "enabled": true,
        "parseJSDoc": true,
        "includeTests": false
      },
      "python": {
        "enabled": true,
        "parseDocstrings": true
      }
    },
    "dependencyGraph": {
      "enabled": true,
      "includeCallGraph": false,
      "maxDepth": 10
    }
  },
  
  "validation": {
    "mode": "standard",
    "rules": {
      "readme-completeness": "error",
      "claim-accuracy": "error",
      "schema-compliance": "error",
      "missing-docs": "warning"
    }
  },
  
  "generation": {
    "readme": {
      "template": null,
      "mode": "hybrid",
      "sections": {
        "badges": true,
        "toc": true,
        "intelligence": true
      }
    },
    "assets": {
      "diagrams": true,
      "format": "svg"
    }
  },
  
  "llm": {
    "enabled": false,
    "provider": "openai",
    "model": "gpt-4",
    "maxTokens": 4000,
    "temperature": 0.3
  },
  
  "output": {
    "directory": ".rie",
    "readme": "README.md"
  },
  
  "cache": {
    "enabled": true,
    "ttl": 86400
  }
}
```

### Environment Variables

```bash
RIE_CONFIG_PATH           # Config file path
RIE_OUTPUT_DIR            # Output directory
RIE_LLM_PROVIDER          # LLM provider
RIE_LLM_API_KEY           # LLM API key
RIE_CACHE_DIR             # Cache directory
RIE_LOG_LEVEL             # Logging level
RIE_NO_COLOR              # Disable colors
```

### Configuration Precedence

1. CLI arguments (highest)
2. Environment variables
3. Project config (`.rie/config.json`)
4. User config (`~/.rie/config.json`)
5. Defaults (lowest)

---

## 13. Extension Points

### Plugin Architecture

```typescript
interface RIEPlugin {
  name: string;
  version: string;
  
  // Lifecycle hooks
  onScanStart?(context: ScanContext): void;
  onScanComplete?(result: ScanResult): void;
  onAnalysisStart?(context: AnalysisContext): void;
  onAnalysisComplete?(result: AnalysisResult): void;
  
  // Extensions
  analyzers?: LanguageAnalyzer[];
  validators?: Validator[];
  generators?: Generator[];
  reporters?: Reporter[];
}
```

### Custom Language Analyzer

```typescript
interface LanguageAnalyzer {
  language: string;
  extensions: string[];
  
  canAnalyze(file: FileEntry): boolean;
  analyze(files: FileEntry[], context: AnalysisContext): Promise<LanguageAnalysis>;
}

// Example: Custom Analyzer
const rustAnalyzer: LanguageAnalyzer = {
  language: 'rust',
  extensions: ['.rs'],
  
  canAnalyze(file) {
    return file.extension === '.rs';
  },
  
  async analyze(files, context) {
    // Rust-specific analysis
  }
};
```

### Custom Validator

```typescript
interface Validator {
  name: string;
  category: string;
  
  validate(context: ValidationContext): Promise<ValidationIssue[]>;
}
```

### Custom Generator

```typescript
interface Generator {
  name: string;
  outputType: string;
  
  generate(metadata: RepositoryMetadata, options: GeneratorOptions): Promise<GeneratedArtifact>;
}
```

---

## 14. Quality Attributes

### Performance Requirements

| Metric | Target | Notes |
|--------|--------|-------|
| Scan time | <5s for 10K files | Warm cache |
| Analysis time | <30s for typical project | Standard mode |
| Memory usage | <500MB | Peak usage |
| Incremental analysis | <5s | Changed files only |

### Reliability Requirements

| Requirement | Target |
|-------------|--------|
| Determinism | Identical output for identical input |
| Idempotency | Multiple runs produce same result |
| Graceful degradation | Partial results on analyzer failure |
| Error recovery | Clear error messages, resumable operations |

### Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| No code execution | Static analysis only |
| Sandboxed file access | Configurable root boundary |
| Credential handling | No storage, env vars only |
| Audit logging | Optional operation logging |

### Compatibility Requirements

| Platform | Support |
|----------|---------|
| Node.js | 18.x, 20.x, 22.x |
| Operating Systems | macOS, Linux, Windows |
| CI/CD | GitHub Actions, GitLab CI, Jenkins |

---

## 15. Constraints & Non-Goals

### Explicit Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| Runtime profiling | Requires code execution; different problem domain |
| Full semantic reasoning | Computationally expensive; diminishing returns |
| Code generation | Different tool category |
| IDE replacement | Complementary, not competitive |
| Real-time analysis | Focus on batch/CI workflows |
| Opinionated architecture | Detect and describe, not prescribe |

### Constraints

| Constraint | Description |
|------------|-------------|
| Static analysis only | No code execution |
| Language support | Prioritize TS/JS/Python initially |
| LLM optional | Core functionality works without LLM |
| Deterministic core | Non-determinism only in LLM layer |
| Backward compatibility | Schema versions must be migratable |

---

## 16. Versioning Strategy

### Semantic Versioning

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes to CLI, schemas, or core behavior
MINOR: New features, backward-compatible
PATCH: Bug fixes, performance improvements
```

### Schema Versioning

```
repository.meta.schema.v{MAJOR}.{MINOR}.json

Example: repository.meta.schema.v1.0.json
```

**Migration Policy:**
- Minor version changes: Additive only
- Major version changes: Migration tool provided
- Deprecation: 2 minor versions warning

### README Spec Versioning

```
README Specification v{MAJOR}.{MINOR}
```

---

## 17. Roadmap

### Phase 1: Foundation (MVP)

**Goal:** Working end-to-end system for TypeScript/JavaScript projects

- [ ] File system scanner with ignore patterns
- [ ] TypeScript/JavaScript analyzer (tree-sitter + ts-morph)
- [ ] Dependency graph builder
- [ ] Metadata aggregator with JSON schema
- [ ] Basic README generator (deterministic)
- [ ] Basic validation engine
- [ ] CLI core commands: scan, analyze, readme, validate

**Success Criteria:** Generate accurate README for 90% of typical TS/JS projects

### Phase 2: Enhancement

**Goal:** Production-ready with Python support and LLM integration

- [ ] Python analyzer
- [ ] LLM summarization engine (optional)
- [ ] Enhanced README templates
- [ ] Diagram generation (Mermaid, SVG)
- [ ] Comprehensive validation rules
- [ ] Configuration system
- [ ] Caching layer

### Phase 3: Ecosystem

**Goal:** Plugin architecture and advanced features

- [ ] Plugin system
- [ ] Additional language analyzers
- [ ] CI/CD integrations
- [ ] Custom template support
- [ ] Monorepo improvements
- [ ] Performance optimizations

### Phase 4: Platform

**Goal:** Extended distribution and enterprise features

- [ ] VSCode extension
- [ ] SaaS version
- [ ] Enterprise features (SSO, audit logs)
- [ ] Continuous drift detection
- [ ] Architectural embedding generation

---

## 18. Open Questions

### Architectural Decisions Needed

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Should LLM summarization be optional or mandatory? | Optional / Required / Hybrid | **Optional** - Core must work without LLM |
| 2 | Should metadata extraction be fully deterministic? | Yes / Allow heuristics | **Yes** - Determinism enables caching, CI |
| 3 | How deep should call graph analysis go? | Configurable / Fixed / Adaptive | **Configurable** - Default 3 levels, max 10 |
| 4 | Do we support monorepo package isolation? | Yes / Later / No | **Yes** - Essential for real-world repos |
| 5 | Should plugin system allow custom language analyzers? | Yes / Curated only | **Yes** - Critical for extensibility |
| 6 | Should validation be blocking in CI? | Always / Configurable / Never | **Configurable** - Different needs per project |
| 7 | What's the right caching strategy? | File hash / Git commit / TTL | **File hash** - Works without Git |
| 8 | Should we support incremental analysis? | Yes (complex) / No (simpler) | **Yes** - Essential for large repos |

### Implementation Questions

| # | Question | Notes |
|---|----------|-------|
| 9 | Primary implementation language? | TypeScript recommended for ecosystem fit |
| 10 | Bundling strategy? | Single binary vs npm package |
| 11 | Test strategy? | Unit + integration + golden file tests |
| 12 | Documentation approach? | Dogfooding: use RIE to document RIE |

---

## 19. Implementation Strategy

### Recommended Approach

#### Phase 1 Architecture

```
rie/
├── packages/
│   ├── core/                 # Core engine
│   │   ├── src/
│   │   │   ├── scanner/      # File system scanning
│   │   │   ├── analyzer/     # Analysis orchestration
│   │   │   ├── aggregator/   # Metadata aggregation
│   │   │   ├── validator/    # Validation engine
│   │   │   └── generator/    # Output generation
│   │   └── package.json
│   ├── analyzers/
│   │   ├── typescript/       # TS/JS analyzer
│   │   └── python/           # Python analyzer (Phase 2)
│   ├── cli/                  # CLI application
│   └── schemas/              # JSON schemas
├── templates/                # README templates
├── test/
│   ├── fixtures/             # Test repositories
│   └── golden/               # Expected outputs
└── docs/
```

#### Development Sequence

1. **Week 1-2:** Scanner + Language Detection
2. **Week 3-4:** TypeScript Analyzer (basic)
3. **Week 5-6:** Dependency Graph Builder
4. **Week 7-8:** Metadata Aggregator + Schema
5. **Week 9-10:** README Generator (deterministic)
6. **Week 11-12:** Validation Engine + CLI

### Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | TypeScript | Ecosystem fit, type safety |
| Parser (TS/JS) | tree-sitter + ts-morph | Speed + full AST access |
| Parser (Python) | tree-sitter + ast | Consistency |
| CLI Framework | Commander.js | Mature, well-documented |
| Schema | JSON Schema + Zod | Validation + runtime types |
| Testing | Vitest | Fast, ESM-native |
| Templating | Handlebars | Simple, logic-less |
| Diagrams | Mermaid CLI | Markdown-native |

---

## 20. Appendix

### Appendix A: Metadata Schema

```typescript
interface RepositoryMetadata {
  // Schema metadata
  $schema: string;
  schemaVersion: string;
  generatedAt: string;
  generatedBy: string;
  
  // Project identity
  project: {
    name: string;
    description?: string;
    version?: string;
    license?: string;
    repository?: string;
    homepage?: string;
    keywords?: string[];
  };
  
  // Technical profile
  languages: {
    primary: Language;
    all: LanguageInfo[];
  };
  
  frameworks: Framework[];
  
  runtime: {
    type: 'node' | 'python' | 'go' | 'other';
    version?: string;
  };
  
  // Architecture
  architecture: {
    type: ArchitectureType;
    patterns: ArchitecturePattern[];
    layers?: Layer[];
    entryPoints: EntryPoint[];
    exports: ExportedAPI[];
  };
  
  // Domain model
  domain: {
    entities: DomainEntity[];
    relationships: EntityRelationship[];
  };
  
  // Dependencies
  dependencies: {
    production: Dependency[];
    development: Dependency[];
    internal: InternalModule[];
  };
  
  // Build & tooling
  build: {
    system: BuildSystem;
    scripts: Script[];
    outputs: BuildOutput[];
  };
  
  // Testing
  testing: {
    frameworks: string[];
    coverage?: CoverageInfo;
    hasTests: boolean;
  };
  
  // Security
  security: {
    authMechanism?: string;
    sensitiveFiles: string[];
    envVariables: EnvVariable[];
  };
  
  // Infrastructure
  infrastructure: {
    deployment?: DeploymentConfig;
    cicd?: CICDConfig;
    containers?: ContainerConfig[];
  };
  
  // Quality metrics
  metrics: {
    files: FileMetrics;
    complexity: ComplexityMetrics;
    dependencies: DependencyMetrics;
  };
  
  // Analysis metadata
  analysis: {
    scanDuration: number;
    filesScanned: number;
    issues: AnalysisIssue[];
    confidence: number;
  };
}
```

### Appendix B: Example Metadata Output

```json
{
  "$schema": "https://rie.dev/schemas/repository.meta.v1.0.json",
  "schemaVersion": "1.0.0",
  "generatedAt": "2025-01-15T10:30:00Z",
  "generatedBy": "rie@1.0.0",
  
  "project": {
    "name": "express-api",
    "description": "RESTful API for task management",
    "version": "2.1.0",
    "license": "MIT"
  },
  
  "languages": {
    "primary": "typescript",
    "all": [
      { "language": "typescript", "percentage": 85, "files": 42 },
      { "language": "javascript", "percentage": 10, "files": 5 },
      { "language": "json", "percentage": 5, "files": 8 }
    ]
  },
  
  "frameworks": [
    { "name": "Express", "version": "4.18.2", "category": "web" },
    { "name": "Prisma", "version": "5.0.0", "category": "orm" }
  ],
  
  "architecture": {
    "type": "layered",
    "patterns": ["repository", "controller", "service", "dto"],
    "layers": [
      { "name": "controllers", "path": "src/controllers" },
      { "name": "services", "path": "src/services" },
      { "name": "repositories", "path": "src/repositories" }
    ],
    "entryPoints": [
      { "path": "src/index.ts", "type": "main" },
      { "path": "src/cli.ts", "type": "cli" }
    ]
  }
}
```

### Appendix C: Validation Rule Reference

| Rule ID | Category | Severity | Description |
|---------|----------|----------|-------------|
| `RIE001` | Schema | Error | Metadata does not match schema |
| `RIE002` | Claims | Error | README claims feature not in codebase |
| `RIE003` | Claims | Warning | Version mismatch between files |
| `RIE004` | Completeness | Warning | Public API not documented |
| `RIE005` | Completeness | Info | No usage examples provided |
| `RIE006` | Consistency | Error | Entry point in README doesn't exist |
| `RIE007` | Consistency | Warning | Architecture diagram outdated |
| `RIE008` | Security | Warning | Sensitive file not in .gitignore |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-XX | - | Initial specification |
| 1.1.0 | 2025-01-XX | - | Added configuration system, validation rules, appendices |

---

*This specification is a living document. Updates will follow semantic versioning.*
```

---

# My Thoughts on RIE

## What I Love About This Project

### 1. **You've Identified a Real Gap**

The insight that "repositories are optimized for execution, not comprehension" is spot-on. I've seen this problem countless times:

- New developers joining a project spend 2-3 weeks just understanding the architecture
- Documentation drifts until it's actively misleading
- LLMs hallucinate about codebases because they lack structural context

You're solving a genuine pain point that affects every software team.

### 2. **The "Source of Truth" Philosophy**

Making code authoritative and deriving documentation from it (rather than hoping humans maintain both) is the right approach. This is why tools like Swagger/OpenAPI succeeded — generate from code, validate against code.

### 3. **Deterministic Core + Optional LLM**

This is a mature architectural decision. Too many projects make LLM central and then struggle with:
- Non-determinism breaking CI
- API costs
- Rate limits
- Hallucinations

By making LLM optional/additive, you get:
- Reliable CI integration
- Cacheable outputs
- Works offline
- LLM enhances but doesn't gate

### 4. **The Validation Engine is the Hidden Gem**

Most doc generators create content and walk away. The validation layer that cross-references README claims against code reality is what makes this production-worthy. That's the difference between "generates docs" and "maintains accurate docs."

---

## Key Improvements I Made to the Spec

### 1. **Added Configuration System (Section 12)**
Your original spec lacked configuration details. I added:
- Full JSON config schema
- Environment variable support
- Precedence rules
- Per-language analyzer settings

This is essential for real-world adoption where projects have different needs.

### 2. **Fleshed Out Validation Rules (Section 10)**
The original was conceptual. I added:
- Specific validation categories
- Typed output interfaces
- Validation modes (strict/standard/lenient/auto-fix)
- Rule reference table

This makes validation implementable and user-configurable.

### 3. **Added Extension Points (Section 13)**
Your future vision mentions plugins but didn't spec them. I added:
- Plugin interface definitions
- Custom analyzer contract
- Custom validator contract
- Custom generator contract

Early plugin architecture saves massive refactoring later.

### 4. **Quality Attributes (Section 14)**
Added concrete targets for:
- Performance (scan time, memory)
- Reliability (determinism, idempotency)
- Security (no code execution, sandboxing)
- Compatibility (Node versions, OSes)

These prevent scope creep and give you testable criteria.

### 5. **Implementation Strategy (Section 19)**
Added:
- Recommended project structure
- Development sequence (12-week MVP timeline)
- Technology choices with rationale

This makes the spec actionable rather than aspirational.

### 6. **Comprehensive Metadata Schema (Appendix A)**
Your original had a flat list. I provided:
- Full TypeScript interface
- Proper nesting and typing
- Example output

This is the contract your entire system depends on — it needs precision.

---

## Strategic Suggestions for Maximum Impact

### 1. **Dogfood Immediately**

As soon as you have a working MVP, use RIE to generate RIE's own documentation. This:
- Proves the system works
- Catches usability issues
- Provides authentic before/after examples
- Shows confidence in your own tool

### 2. **Target a Specific Initial Use Case**

While the spec covers many use cases, I'd focus MVP marketing on one:

> **"Generate accurate README.md in 30 seconds"**

This is:
- Immediately testable
- Solves universal problem
- Clear value proposition
- Shareable output (READMEs get viewed)

LLM context generation and CI integration are Phase 2 marketing.

### 3. **Build a "Gallery" of Generated READMEs**

Run RIE against popular open-source projects and showcase:
- Before (their current README)
- After (RIE-generated README)
- Validation report showing gaps

This creates viral content and demonstrates credibility.

### 4. **Consider `llm-context.json` as First-Class Output**

The "LLM-optimized context" use case might be even more valuable than README generation in 2025. Many teams are building:
- Internal AI coding assistants
- RAG systems over codebases
- AI-powered onboarding

A well-structured `llm-context.json` that captures architecture, patterns, and key code excerpts could become a standard format that AI tools consume.

### 5. **Integrate with Existing Ecosystems**

- **npm init rie** — Scaffold with RIE baked in
- **GitHub Action** — `rie-validate` that fails PRs with doc drift
- **pre-commit hook** — Run validation before commits
- **Renovate/Dependabot** — Auto-PR when RIE detects drift

Ecosystem integration drives adoption more than features.

---

## Potential Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Analysis accuracy issues | Users lose trust | Extensive test fixtures, golden tests, conservative confidence scoring |
| LLM costs at scale | Barrier to adoption | Strong deterministic mode, local LLM support |
| Schema versioning complexity | Migration headaches | Start with minimal schema, add cautiously, provide migration tools |
| Language support requests | Scope creep | Plugin architecture from day one, community contributions |
| Performance on large repos | Unusable for monorepos | Incremental analysis, caching, configurable depth limits |

---

## Bottom Line

**This is a genuinely good idea with a well-thought-out approach.** The combination of:

1. Deterministic extraction
2. Strict schemas
3. Validation against source
4. Optional LLM enhancement
5. CI/CD integration

...positions RIE as a *trustworthy* tool, not just another AI-generates-docs experiment.

The spec is now comprehensive enough to implement. The 12-week MVP timeline I suggested is realistic if you:
- Start with TypeScript/JavaScript only
- Skip LLM in Phase 1
- Use tree-sitter (fast) rather than building custom parsers
- Focus on the Scanner → Analyzer → Metadata → README → Validate pipeline

**One final thought:** The name "Repository Intelligence Engine" is good but consider whether "Intelligence" oversells the initial capability. Something like "Repository Insight" or even just "RIE" as a brand (like how "Git" isn't an acronym) might age better.

Good luck building this. I'd use it.
