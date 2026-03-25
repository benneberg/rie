# ArchLens RIE GitHub App

A GitHub App that provides PR-level architecture enforcement for your codebase.

## Features

- **Webhook Signature Verification**: Validates all incoming webhook requests using HMAC-SHA256
- **PR Analysis**: Automatically analyzes pull requests for architecture violations
- **Commit Status Checks**: Posts status checks to GitHub with analysis results
- **PR Comments**: Posts detailed architecture impact reports as PR comments
- **Blocking**: Optionally blocks PRs that violate architecture policies

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your GitHub App credentials:

```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...
WEBHOOK_SECRET=your-webhook-secret
```

### 3. Create a GitHub App

1. Go to GitHub Settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Fill in the details:
   - **GitHub App name**: archlens-rie-your-repo
   - **Homepage URL**: https://archlens.app
   - **Webhook URL**: Your server URL (e.g., `https://your-server.com/webhook`)
   - **Webhook secret**: Same as `WEBHOOK_SECRET` in your `.env`
4. Permissions required:
   - Repository permissions:
     - Contents: Read
     - Pull requests: Read & Write
     - Commit statuses: Read & Write
     - Pull request reviews: Read
5. Subscribe to events:
   - Pull request
   - Pull request review comment
   - Check run
   - Check suite

### 4. Run the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

### 5. Install the App

1. Go to your GitHub App settings
2. Click "Install App"
3. Select the repositories you want to monitor

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub                                   │
│  ┌──────────────┐    Webhook    ┌─────────────────────────┐  │
│  │   PR Event   │──────────────▶│  GitHub App Server       │  │
│  └──────────────┘              │  ┌─────────────────────┐ │  │
└─────────────────────────────────│  │ Signature Verifier  │ │  │
                                   │  └─────────────────────┘ │  │
                                   │           │              │  │
                                   │           ▼              │  │
                                   │  ┌─────────────────────┐ │  │
                                   │  │  Webhook Handler    │ │  │
                                   │  └─────────────────────┘ │  │
                                   │           │              │  │
                                   │           ▼              │  │
                                   │  ┌─────────────────────┐ │  │
                                   │  │  PR Analyzer        │ │  │
                                   │  └─────────────────────┘ │  │
                                   └─────────────────────────┘  │
                                               │                  │
                                               ▼                  │
                              ┌────────────────────────────────┐ │
                              │         GitHub API              │ │
                              │  • Create commit status         │ │
                              │  • Post PR comments             │ │
                              │  • Block PR (if enabled)        │ │
                              └────────────────────────────────┘ │
```

## Webhook Signature Verification

All incoming webhooks are verified using HMAC-SHA256:

1. The `WEBHOOK_SECRET` environment variable is used as the key
2. A SHA-256 HMAC digest is computed from the raw request body
3. The digest is compared to the `x-hub-signature-256` header
4. Constant-time comparison prevents timing attacks

If verification fails, the server responds with 401 Unauthorized.

## PR Analysis Workflow

1. **Event Received**: Webhook handler receives a `pull_request` event
2. **Signature Verified**: Payload is verified using HMAC-SHA256
3. **Files Analyzed**: Changed files are fetched from GitHub API
4. **Architecture Checked**: PR analyzer checks for violations
5. **Status Posted**: Commit status is created/updated on the PR
6. **Comment Posted**: If violations found, a detailed comment is posted

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_APP_ID` | Yes | - | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | Yes | - | GitHub App private key (PEM) |
| `WEBHOOK_SECRET` | Yes | - | Webhook signature secret |
| `PORT` | No | 3000 | Server port |
| `ENABLE_BLOCKING` | No | true | Enable PR blocking |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook` | POST | GitHub webhook endpoint |
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |
| `/metrics` | GET | Prometheus metrics |
| `/api/config` | GET | App configuration |

## Metrics

The `/metrics` endpoint exposes Prometheus-format metrics:

- `archlens_uptime_seconds`: Server uptime
- `archlens_memory_heap_used_bytes`: Memory usage
- `archlens_events_processed_total`: Total events processed
- `archlens_events_failed_total`: Total event processing failures

## Testing

Run tests:
```bash
npm test
```

Run in watch mode:
```bash
npm run test:watch
```

## Development

Start development server with hot reload:
```bash
npm run dev
```

## License

Apache 2.0
