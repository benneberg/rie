# Repository Insights Engine (RIE) - ArchLens

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/archlens/rie)
[![Status](https://img.shields.io/badge/status-draft-yellow.svg)](https://github.com/archlens/rie)

**ArchLens RIE** is an AI-powered repository analysis engine that transforms source code into comprehensive insights, interactive dashboards, validated documentation, and governance policies. Extract architectural DNA, visualize dependencies, detect drift, and generate production-grade READMEs automatically.

## ✨ Core Features

| Feature | Description |
|---------|-------------|
| **Repository Ingestion** | ZIP upload, GitHub/GitLab URLs, local directories |
| **Architecture DNA** | Interactive radar charts, dependency heatmaps, module hierarchies |
| **Drift Detection** | Compare current vs baseline architecture, detect violations |
| **AI Documentation** | Auto-generate README.md, ARCHITECTURE.md, SECURITY.md |
| **Interactive Studio** | CLI + Web dashboard for analysis, editing, export |
| **Policy Engine** | Custom governance rules, layer boundaries, pattern detection |
| **Visualization Suite** | Mermaid diagrams, Graphviz graphs, Recharts dashboards |
| **LLM Context** | Structured context for AI development workflows |

## 🧬 Architecture DNA Visualizations

```
├── DNA Radar Chart: Core modules, coupling, complexity, stability
├── Dependency Heatmap: Module interactions by frequency
├── Layer Cake: Architecture layer compliance
├── Call Graph: Function-level relationships
└── Tech Radar: Framework/language distribution
```

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) 1.1+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- Cloudflare account with AI Gateway

### 1. Clone & Install
```bash
git clone https://github.com/archlens/rie
cd rie
bun install
```

### 2. Configure AI Gateway
Edit `wrangler.jsonc`:
```json
{
  "vars": {
    "CF_AI_BASE_URL": "https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai",
    "CF_AI_API_KEY": "your-cloudflare-api-token"
  }
}
```

Set secrets:
```bash
wrangler secret put CF_AI_API_KEY
```

### 3. Development
```bash
bun dev
```
Open `http://localhost:3000` - Dashboard + Studio ready!

### 4. Deploy
```bash
bun run deploy
```

## 📊 Usage

### Web Dashboard
1. **Upload** ZIP or paste GitHub URL
2. **Analyze** → View DNA charts, dependency graphs
3. **Studio** → Edit metadata, customize docs
4. **Export** → README, diagrams, `repository.meta.json`

### CLI Studio
```bash
# Analyze repository
bunx rie analyze ./my-project --output .rie/

# Generate docs only
bunx rie docs ./my-project --enhanced

# Validate drift
bunx rie validate ./my-project --baseline .rie/baseline.meta.json

# Policy check
bunx rie policy ./my-project --config policies/arch.json
```

## 🛠️ Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Recharts |
| **Backend** | Cloudflare Workers + Hono + Durable Objects |
| **Analysis** | tree-sitter + ts-morph + dependency-cruiser + AST parsers |
| **AI** | Cloudflare AI Gateway (Gemini/@cf/meta models) |
| **Visualization** | Mermaid + Graphviz + D3.js + Recharts |
| **Dev** | Bun + Wrangler + Vitest + ESLint + Prettier |

## 🎛️ Governance & Settings

### Policy Editor (Studio)
```
├── Layer Boundaries: ui/ → domain/ → infra/
├── Complexity Limits: max 15 per function
├── Dependency Rules: no ui → infra coupling
├── Pattern Detection: singleton, factory, observer
└── Custom Metrics: your business rules
```

### Configuration
```json
{
  "analysis": {
    "languages": ["typescript", "python", "javascript"],
    "depthLimit": 5,
    "llmMode": "enhanced"
  },
  "validation": {
    "strictMode": true,
    "driftThreshold": 0.1
  }
}
```

## 📋 Core Outputs

```
.rie/
├── repository.meta.json     # Canonical metadata (JSON Schema)
├── README.md               # Generated documentation
├── ARCHITECTURE.md         # Architecture deep-dive
├── SECURITY.md             # Security posture
├── assets/
│   ├── dna-radar.svg
│   ├── dep-graph.svg
│   └── architecture.mermaid
└── reports/
    ├── validation.json
    └── llm-context.json
```

## 🌐 API Endpoints

```
POST  /api/analyze        # Start analysis (ZIP/URL)
GET   /api/analyze/:id    # Poll results
POST  /api/studio/:id     # Edit metadata
GET   /api/export/:id     # Download artifacts
POST  /api/policy         # Validate policies
```

## ⚠️ AI Rate Limits

- **Free Tier**: 10 analyses/hour, 60s timeout
- **Paid Gateway**: 1000 analyses/hour, parallel processing
- **Local Mode**: No limits (requires local LLM)

**Note**: Analysis time varies: 30s (small) → 5min (monorepo)

## 🧪 Development Scripts

```bash
bun dev           # Start dev server + Worker
bun build         # Production build
bun lint          # Code quality
bun test          # Unit + integration
bun run deploy    # Deploy to Cloudflare
bun studio        # CLI studio mode
```

## 🤝 Contributing

1. Fork → Clone → `bun install`
2. Create feature branch
3. Add tests → `bun test`
4. PR with changelog entry

**Focus areas**: New language analyzers, visualization plugins, policy rules.

## 📄 License

MIT - See [LICENSE](LICENSE)

---
*Built with ❤️ for developer comprehension at [ArchLens](https://archlens.ai)*
```
//