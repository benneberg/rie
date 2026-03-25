# ArchLens RIE 2.0 - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Production Deployment](#production-deployment)
4. [GitHub App Setup](#github-app-setup)
5. [Configuration](#configuration)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| npm | 9.x | 10.x |
| RAM | 512MB | 2GB |
| Disk | 1GB | 10GB |

### Required Accounts

- GitHub account with admin access to create a GitHub App
- Web server with public HTTPS endpoint (for production)

---

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/archlens/rie.git
cd rie
npm install
```

### 2. Configure Environment

```bash
cd packages/github-app
cp .env.example .env
```

Edit `.env` with your development credentials:

```env
# Required for local development
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...
WEBHOOK_SECRET=development-secret-change-in-production

# Optional
PORT=3000
ENABLE_BLOCKING=true
```

### 3. Run Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`.

### 4. Test Webhook Endpoint

Use [Smee.io](https://smee.io/) for local webhook testing:

1. Create a new channel at smee.io
2. Start the Smee client:
   ```bash
   npx smee -u https://smee.io/your-channel-id --target http://localhost:3000/webhook
   ```
3. Configure your GitHub App to use the Smee URL as webhook URL

---

## Production Deployment

### Option 1: Docker Deployment

#### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/github-app/dist ./dist
COPY --from=builder /app/packages/github-app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

#### Build and Run

```bash
docker build -t archlens-rie .
docker run -d \
  --name archlens-rie \
  -p 3000:3000 \
  -e GITHUB_APP_ID=your-app-id \
  -e GITHUB_APP_PRIVATE_KEY=your-private-key \
  -e WEBHOOK_SECRET=your-webhook-secret \
  -e ENABLE_BLOCKING=true \
  archlens-rie
```

### Option 2: Kubernetes Deployment

#### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: archlens-rie
  labels:
    app: archlens-rie
spec:
  replicas: 2
  selector:
    matchLabels:
      app: archlens-rie
  template:
    metadata:
      labels:
        app: archlens-rie
    spec:
      containers:
        - name: archlens-rie
          image: archlens/rie:latest
          ports:
            - containerPort: 3000
          env:
            - name: GITHUB_APP_ID
              valueFrom:
                secretKeyRef:
                  name: archlens-secrets
                  key: github-app-id
            - name: GITHUB_APP_PRIVATE_KEY
              valueFrom:
                secretKeyRef:
                  name: archlens-secrets
                  key: github-app-private-key
            - name: WEBHOOK_SECRET
              valueFrom:
                secretKeyRef:
                  name: archlens-secrets
                  key: webhook-secret
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: archlens-rie-service
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: archlens-rie
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: archlens-rie-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - archlens.example.com
      secretName: archlens-tls
  rules:
    - host: archlens.example.com
      http:
        paths:
          - path: /webhook
            pathType: Prefix
            backend:
              service:
                name: archlens-rie-service
                port:
                  number: 80
```

#### Apply Configuration

```bash
kubectl apply -f deployment.yaml
```

### Option 3: Cloud Platform Deployment

#### Railway (Recommended for Quick Start)

1. Connect your GitHub repository to Railway
2. Add environment variables:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `WEBHOOK_SECRET`
3. Deploy

#### Fly.io

```bash
fly launch
fly secrets set GITHUB_APP_ID=your-id
fly secrets set GITHUB_APP_PRIVATE_KEY="$(cat private-key.pem | tr -d '\n')"
fly secrets set WEBHOOK_SECRET=your-secret
fly deploy
```

#### Render

1. Create Web Service on Render
2. Connect GitHub repository
3. Configure:
   - Build Command: `npm run build`
   - Start Command: `npm start`
4. Add environment variables

---

## GitHub App Setup

### 1. Create GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Fill in details:

| Field | Value |
|-------|-------|
| Name | ArchLens RIE - Your Org |
| Homepage URL | https://archlens.example.com |
| Webhook URL | https://archlens.example.com/webhook |
| Webhook secret | Generate a secure random string |

### 2. Configure Permissions

Set these repository permissions:

| Permission | Access |
|------------|--------|
| Contents | Read |
| Pull requests | Read & Write |
| Commit statuses | Read & Write |
| Pull request reviews | Read |
| Issues | Read & Write |

### 3. Subscribe to Events

Check these events:
- [x] Pull requests
- [x] Pull request review comment
- [x] Check run
- [x] Check suite
- [x] Installation
- [x] Installation repositories

### 4. Generate Private Key

1. In your GitHub App settings, click "Generate a private key"
2. Download the PEM file
3. Convert to single-line format for environment variable:
   ```bash
   cat private-key.pem | tr '\n' ' ' | sed 's/ //g'
   ```

### 5. Install the App

1. In your GitHub App settings, click "Install App"
2. Select "All repositories" or specific repositories
3. Note the installation ID

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_APP_ID` | Yes | - | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | Yes | - | Private key (PEM) |
| `WEBHOOK_SECRET` | Yes | - | Webhook signature secret |
| `PORT` | No | 3000 | Server port |
| `ENABLE_BLOCKING` | No | true | Enable PR blocking |

### Blocking Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ARCHLENS_BLOCKING_ENABLED` | true | Enable/disable blocking |
| `ARCHLENS_BLOCK_CRITICAL` | true | Block on critical violations |
| `ARCHLENS_BLOCK_MAJOR` | true | Block on major violations |
| `ARCHLENS_BLOCK_MINOR` | false | Block on minor violations |
| `ARCHLENS_BLOCK_FITNESS_DROP` | true | Block on fitness score drop |
| `ARCHLENS_MIN_FITNESS_DELTA` | -10 | Min delta to trigger blocking |
| `ARCHLENS_EXCLUDED_BRANCHES` | main,master,develop | Branches to skip |

### Example Production Configuration

```env
# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----

# Webhook
WEBHOOK_SECRET=your-secure-random-string

# Server
PORT=3000
NODE_ENV=production

# Blocking
ENABLE_BLOCKING=true
ARCHLENS_BLOCK_CRITICAL=true
ARCHLENS_BLOCK_MAJOR=true
ARCHLENS_BLOCK_MINOR=false
ARCHLENS_MIN_FITNESS_DELTA=-10
ARCHLENS_EXCLUDED_BRANCHES=main,master,develop,staging

# Storage (optional)
# NEO4J_URI=bolt://neo4j:7687
# NEO4J_USER=neo4j
# NEO4J_PASSWORD=password

# Logging
LOG_LEVEL=info
```

---

## Monitoring

### Health Checks

```bash
# Health check
curl https://archlens.example.com/health

# Readiness check
curl https://archlens.example.com/ready
```

### Metrics (Prometheus Format)

```bash
curl https://archlens.example.com/metrics
```

Exposed metrics:
- `archlens_uptime_seconds` - Server uptime
- `archlens_memory_heap_used_bytes` - Memory usage
- `archlens_events_processed_total` - Total events processed
- `archlens_events_failed_total` - Total event failures

### Log Aggregation

Configure structured logging:

```env
LOG_FORMAT=json
LOG_LEVEL=info
```

Example JSON log:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Webhook processed",
  "event": "pull_request",
  "action": "opened",
  "duration_ms": 234
}
```

---

## Troubleshooting

### Common Issues

#### 1. Webhook Signature Verification Fails

**Symptom:** `401 Unauthorized` errors in webhook logs

**Solution:**
- Verify `WEBHOOK_SECRET` matches GitHub App settings
- Check that raw body is being sent (not parsed JSON)
- Ensure Express middleware is configured correctly

#### 2. PR Not Being Blocked

**Symptom:** PRs with violations are not blocked

**Solution:**
1. Check that `ENABLE_BLOCKING=true`
2. Verify branch protection rules require the `archlens/architecture` check
3. Ensure the check has time to complete before merge is allowed

#### 3. Server Not Starting

**Symptom:** Process exits immediately

**Solution:**
- Check all required environment variables are set
- Verify the private key is properly formatted
- Check logs for specific error messages

#### 4. Rate Limiting

**Symptom:** `403 Forbidden` from GitHub API

**Solution:**
- Implement exponential backoff
- Use installation tokens (not JWT) for API calls
- Check GitHub App rate limits

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

View real-time logs:

```bash
kubectl logs -f deployment/archlens-rie -c archlens-rie
```

### Health Check Failures

```bash
# Check if server is responding
curl -v http://localhost:3000/health

# Check readiness
curl -v http://localhost:3000/ready
```

Expected responses:

```json
// Health
{"status":"healthy","timestamp":"2024-01-15T10:30:00Z","version":"2.0.0"}

// Ready
{"status":"ready","timestamp":"2024-01-15T10:30:00Z"}
```

---

## Security Checklist

- [ ] Use HTTPS for webhook endpoint
- [ ] Set a strong `WEBHOOK_SECRET`
- [ ] Store secrets in a secure secrets manager
- [ ] Enable blocking only on protected branches
- [ ] Review logs regularly
- [ ] Implement rate limiting
- [ ] Use read-only permissions where possible
- [ ] Enable audit logging
- [ ] Regular security updates

---

## Support

- GitHub Issues: https://github.com/archlens/rie/issues
- Documentation: https://docs.archlens.app
- Email: support@archlens.app
