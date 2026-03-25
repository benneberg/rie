import crypto from 'crypto';
import type { GitHubClient } from './github-client.js';
import type { PRAnalyzer } from './pr-analyzer.js';
import type { StorageBackend } from '@archlens/storage';

const ENV = { WEBHOOK_SECRET: 'WEBHOOK_SECRET' } as const;

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export type WebhookEvent =
  | 'pull_request'
  | 'pull_request_review'
  | 'pull_request_review_comment'
  | 'check_run'
  | 'check_suite'
  | 'installation'
  | 'installation_repositories';

export interface WebhookHeaders {
  'x-hub-signature-256'?: string;
  'x-github-event'?: string;
  'x-github-delivery'?: string;
  'content-type'?: string;
}

export interface WebhookPayload {
  action: string;
  event: WebhookEvent;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
  };
  pull_request?: {
    number: number;
    title: string;
    state: string;
    head: { sha: string; ref: string };
    base: { ref: string };
  };
  installation?: { id: number };
}

const MAX_DEDUP_CACHE = 1000;

export class WebhookHandler {
  private github: GitHubClient;
  private analyzer: PRAnalyzer;
  private webhookSecret: string;
  private processedEvents: Set<string> = new Set();
  /** Injected storage backend — used to load real CAG snapshots. */
  private storage: StorageBackend | null;

  constructor(
    github: GitHubClient,
    analyzer: PRAnalyzer,
    storage: StorageBackend | null = null,
  ) {
    this.github = github;
    this.analyzer = analyzer;
    this.storage = storage;
    this.webhookSecret = process.env[ENV.WEBHOOK_SECRET] || '';

    if (!this.webhookSecret) {
      console.warn('WebhookHandler: WEBHOOK_SECRET not set — signature verification disabled');
    }
    if (!this.storage) {
      console.warn('WebhookHandler: no storage backend provided — using mock graph data');
    }
  }

  verifyAndParsePayload(rawBody: Buffer, signatureHeader: string): WebhookPayload {
    if (!this.webhookSecret) {
      console.warn('WebhookHandler: skipping signature verification (no secret configured)');
      return this.parsePayload(rawBody);
    }
    if (!signatureHeader) {
      throw new WebhookSignatureError('Missing x-hub-signature-256 header');
    }
    if (!this.secureCompare(this.generateSignature(rawBody), signatureHeader)) {
      throw new WebhookSignatureError('Invalid webhook signature');
    }
    return this.parsePayload(rawBody);
  }

  private parsePayload(rawBody: Buffer): WebhookPayload {
    try {
      return JSON.parse(rawBody.toString()) as WebhookPayload;
    } catch (error) {
      throw new WebhookSignatureError(`Failed to parse webhook payload: ${error}`);
    }
  }

  /** @deprecated Use verifyAndParsePayload + handleEvent instead */
  async handle(payload: WebhookPayload): Promise<void> {
    await this.handleEvent(payload);
  }

  async handleEvent(payload: WebhookPayload): Promise<void> {
    const eventKey = `${payload.event}:${payload.action}:${payload.pull_request?.number ?? 'n/a'}`;

    if (this.processedEvents.has(eventKey)) {
      console.log(`Webhook: skipping duplicate event ${eventKey}`);
      return;
    }
    if (this.processedEvents.size >= MAX_DEDUP_CACHE) {
      const oldest = this.processedEvents.values().next().value;
      if (oldest !== undefined) this.processedEvents.delete(oldest);
    }
    this.processedEvents.add(eventKey);

    console.log(`Webhook: handling ${payload.event} (${payload.action})`);

    switch (payload.event) {
      case 'pull_request': await this.handlePullRequest(payload); break;
      case 'check_run':    await this.handleCheckRun(payload);    break;
      case 'installation': await this.handleInstallation(payload); break;
      default: console.log(`Webhook: unhandled event type ${payload.event}`);
    }
  }

  private async handlePullRequest(payload: WebhookPayload): Promise<void> {
    const { pull_request, repository } = payload;

    if (!pull_request) {
      console.log('Webhook: no PR data in payload');
      return;
    }
    if (!['opened', 'synchronize', 'reopened'].includes(payload.action)) {
      console.log(`Webhook: ignoring PR action "${payload.action}"`);
      return;
    }

    console.log(`Webhook: analyzing PR #${pull_request.number} in ${repository.full_name}`);

    try {
      const files = await this.github.getPullRequestFiles(
        repository.owner.login,
        repository.name,
        pull_request.number,
      );
      const changedFiles = files.map(f => f.filename);

      // Load real snapshot from storage; fall back to mock only if unavailable
      const currentGraph = (await this.storage?.loadLatest()) ?? this.createMockGraph();
      // Load snapshot for the base branch commit as the "before" graph
      const previousGraph = await this.storage?.loadByCommit(pull_request.base.ref) ?? undefined;

      const analysisResult = await this.analyzer.analyze(
        {
          number: pull_request.number,
          repo: repository.full_name,
          headSha: pull_request.head.sha,
          headBranch: pull_request.head.ref,
          baseBranch: pull_request.base.ref,
          changedFiles,
        },
        currentGraph,
        previousGraph,
      );

      await this.github.createCommitStatus(
        repository.owner.login,
        repository.name,
        pull_request.head.sha,
        {
          state: analysisResult.statusCheck.status,
          description: analysisResult.statusCheck.summary,
          context: 'archlens/architecture',
          targetUrl: `https://archlens.app/pr/${repository.full_name}/${pull_request.number}`,
        },
      );

      if (analysisResult.impact.newViolations.length > 0) {
        const comment = this.github.generatePRComment(analysisResult);
        await this.github.createComment(
          repository.owner.login,
          repository.name,
          pull_request.number,
          comment,
        );
      }

      console.log(`Webhook: PR analysis complete — block: ${analysisResult.shouldBlock}`);
    } catch (error) {
      console.error('Webhook: failed to analyze PR', error);
      await this.github.createCommitStatus(
        repository.owner.login,
        repository.name,
        pull_request.head.sha,
        {
          state: 'error',
          description: 'Failed to analyze architecture',
          context: 'archlens/architecture',
        },
      );
    }
  }

  private async handleCheckRun(payload: WebhookPayload): Promise<void> {
    if (payload.action === 'rerequested') {
      console.log('Webhook: check run rerequested');
    }
  }

  private async handleInstallation(payload: WebhookPayload): Promise<void> {
    switch (payload.action) {
      case 'created':   console.log(`Webhook: app installed on account ${payload.installation?.id}`); break;
      case 'deleted':   console.log(`Webhook: app uninstalled from account ${payload.installation?.id}`); break;
      case 'suspend':   console.log(`Webhook: app suspended on account ${payload.installation?.id}`); break;
      case 'unsuspend': console.log(`Webhook: app unsuspended on account ${payload.installation?.id}`); break;
    }
  }

  private generateSignature(payload: Buffer): string {
    return `sha256=${crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('hex')}`;
  }

  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  /** Fallback graph used when storage has no snapshots yet. */
  private createMockGraph() {
    const now = new Date().toISOString();
    return {
      version: '2.0.0',
      createdAt: now,
      updatedAt: now,
      metadata: {
        projectName: 'test-project',
        sourceRoot: '/src',
        parserVersion: '1.0.0',
        totalFiles: 0,
        totalEntities: 0,
        totalDependencies: 0,
      },
      modules: [],
      entities: [],
      dependencies: [],
      violations: [],
    };
  }
}
