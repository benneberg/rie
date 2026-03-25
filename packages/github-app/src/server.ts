import express, { Request, Response } from 'express';
import { WebhookHandler, WebhookSignatureError } from './webhook-handler.js';
import type { GitHubClient } from './github-client.js';
import type { PRAnalyzer } from './pr-analyzer.js';
import type { StorageBackend } from '@archlens/storage';

const ENV = { WEBHOOK_SECRET: 'WEBHOOK_SECRET', PORT: 'PORT' } as const;

export class GitHubAppServer {
  private app: express.Application;
  private port: number;
  private webhookHandler?: WebhookHandler;
  private storage?: StorageBackend;
  private eventsProcessed = 0;
  private eventsFailed = 0;

  constructor(port?: number) {
    this.app = express();
    this.port = port ?? parseInt(process.env[ENV.PORT] ?? '3000', 10);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Raw body MUST come before JSON parser for the webhook route
    this.app.use('/webhook', express.raw({ type: 'application/json' }));
    this.app.use(express.json());
    this.app.use((req, _res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // ── Health / readiness ──────────────────────────────────────────────────
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString(), version: '2.0.0' });
    });

    this.app.get('/ready', async (_req: Request, res: Response) => {
      if (!this.webhookHandler) {
        res.status(503).json({ status: 'not ready', reason: 'GitHub App not configured' });
        return;
      }
      const storageOk = this.storage ? await this.storage.healthCheck() : true;
      if (!storageOk) {
        res.status(503).json({ status: 'not ready', reason: 'Storage backend unhealthy' });
        return;
      }
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    });

    // ── Webhook ─────────────────────────────────────────────────────────────
    this.app.post('/webhook', async (req: Request, res: Response) => {
      if (!this.webhookHandler) {
        res.status(503).json({ error: 'Webhook handler not configured' });
        return;
      }

      const signature  = req.headers['x-hub-signature-256'] as string;
      const event      = req.headers['x-github-event'] as string;
      const deliveryId = req.headers['x-github-delivery'] as string;

      if (!event) {
        res.status(400).json({ error: 'Missing X-GitHub-Event header' });
        return;
      }

      console.log(`Webhook: received ${event} (delivery: ${deliveryId ?? 'unknown'})`);

      let payload: ReturnType<WebhookHandler['verifyAndParsePayload']>;
      try {
        payload = this.webhookHandler.verifyAndParsePayload(req.body as Buffer, signature);
      } catch (error) {
        this.eventsFailed++;
        if (error instanceof WebhookSignatureError) {
          console.error(`Webhook: signature verification failed — ${error.message}`);
          res.status(401).json({ error: error.message });
        } else {
          console.error('Webhook: failed to parse payload', error);
          res.status(400).json({ error: 'Invalid payload' });
        }
        return;
      }

      // Respond immediately — GitHub enforces a 10 s delivery timeout
      res.status(202).json({ received: true, delivery: deliveryId });

      // Process asynchronously after the response has been sent
      this.eventsProcessed++;
      this.webhookHandler.handleEvent(payload).catch(err => {
        this.eventsFailed++;
        console.error('Webhook: async processing failed', err);
      });
    });

    // ── API ─────────────────────────────────────────────────────────────────
    this.app.post('/api/analyze', async (req: Request, res: Response) => {
      const { owner, repo, prNumber } = req.body as {
        owner?: string;
        repo?: string;
        prNumber?: number;
      };
      if (!owner || !repo || !prNumber) {
        res.status(400).json({ error: 'Missing required fields: owner, repo, prNumber' });
        return;
      }
      res.json({
        status: 'triggered',
        message: `Analysis triggered for ${owner}/${repo} PR #${prNumber}`,
      });
    });

    this.app.get('/api/snapshots', async (_req: Request, res: Response) => {
      if (!this.storage) {
        res.status(503).json({ error: 'Storage not configured' });
        return;
      }
      try {
        const snapshots = await this.storage.listSnapshots(20);
        res.json({ snapshots });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list snapshots' });
      }
    });

    this.app.get('/api/snapshots/latest', async (_req: Request, res: Response) => {
      if (!this.storage) {
        res.status(503).json({ error: 'Storage not configured' });
        return;
      }
      try {
        const graph = await this.storage.loadLatest();
        if (!graph) {
          res.status(404).json({ error: 'No snapshots found' });
          return;
        }
        res.json(graph);
      } catch (error) {
        res.status(500).json({ error: 'Failed to load latest snapshot' });
      }
    });

    this.app.get('/api/snapshots/:id', async (req: Request, res: Response) => {
      if (!this.storage) {
        res.status(503).json({ error: 'Storage not configured' });
        return;
      }
      try {
        const graph = await this.storage.loadSnapshot(req.params.id);
        if (!graph) {
          res.status(404).json({ error: 'Snapshot not found' });
          return;
        }
        res.json(graph);
      } catch (error) {
        res.status(500).json({ error: 'Failed to load snapshot' });
      }
    });

    this.app.get('/api/config', (_req: Request, res: Response) => {
      res.json({
        features: { prAnalysis: true, statusChecks: true, autoComment: true, blocking: true },
        policies: ['layer-ui-to-infra', 'max-coupling', 'no-circular-deps', 'stability-minimum'],
      });
    });

    // ── Metrics (Prometheus) ────────────────────────────────────────────────
    this.app.get('/metrics', (_req: Request, res: Response) => {
      const mem = process.memoryUsage();
      res.set('Content-Type', 'text/plain');
      res.send(`
# HELP archlens_uptime_seconds Server uptime in seconds
# TYPE archlens_uptime_seconds gauge
archlens_uptime_seconds ${process.uptime()}

# HELP archlens_memory_heap_used_bytes Memory heap used in bytes
# TYPE archlens_memory_heap_used_bytes gauge
archlens_memory_heap_used_bytes ${mem.heapUsed}

# HELP archlens_memory_heap_total_bytes Total memory heap in bytes
# TYPE archlens_memory_heap_total_bytes gauge
archlens_memory_heap_total_bytes ${mem.heapTotal}

# HELP archlens_events_processed_total Total webhook events processed
# TYPE archlens_events_processed_total counter
archlens_events_processed_total ${this.eventsProcessed}

# HELP archlens_events_failed_total Total webhook events failed
# TYPE archlens_events_failed_total counter
archlens_events_failed_total ${this.eventsFailed}
`.trim());
    });
  }

  /**
   * Configure the app with its dependencies.
   * Call this before `start()`.
   */
  configure(
    github: GitHubClient,
    analyzer: PRAnalyzer,
    storage?: StorageBackend,
  ): void {
    this.storage = storage;
    this.webhookHandler = new WebhookHandler(github, analyzer, storage ?? null);
    console.log('GitHub App server configured');
    if (storage) {
      console.log('  Storage backend: connected');
    } else {
      console.warn('  Storage backend: not provided — snapshot APIs will return 503');
    }
  }

  async start(): Promise<void> {
    return new Promise(resolve => {
      this.app.listen(this.port, () => {
        console.log(`GitHub App server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.storage?.close();
    console.log('GitHub App server stopped');
  }
}
