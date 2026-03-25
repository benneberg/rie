import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { WebhookHandler, WebhookSignatureError } from './webhook-handler.js';

// Mock GitHub client
const mockGitHubClient = {
  getPullRequestFiles: vi.fn().mockResolvedValue([]),
  createCommitStatus: vi.fn().mockResolvedValue(undefined),
  createComment: vi.fn().mockResolvedValue(undefined),
  generatePRComment: vi.fn().mockReturnValue('Mock PR comment'),
};

// Mock PR analyzer
const mockPRAnalyzer = {
  analyze: vi.fn().mockResolvedValue({
    statusCheck: { status: 'success', summary: 'All checks passed' },
    shouldBlock: false,
    impact: { newViolations: [], fixedViolations: [], fitnessScoreDelta: 0, layerPurityDelta: 0 },
  }),
};

describe('WebhookHandler', () => {
  let webhookHandler: WebhookHandler;
  const testSecret = 'test-webhook-secret-12345';
  const testPayload = {
    action: 'opened',
    event: 'pull_request' as const,
    repository: {
      id: 123,
      name: 'test-repo',
      full_name: 'org/test-repo',
      owner: { login: 'org' },
    },
    pull_request: {
      number: 1,
      title: 'Test PR',
      state: 'open',
      head: { sha: 'abc123', ref: 'feature-branch' },
      base: { ref: 'main' },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBHOOK_SECRET = testSecret;
    webhookHandler = new WebhookHandler(
      mockGitHubClient as any,
      mockPRAnalyzer as any,
    );
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  describe('verifyAndParsePayload', () => {
    it('parses and verifies a valid payload', () => {
      const payloadBuffer = Buffer.from(JSON.stringify(testPayload));
      const signature = generateSignature(payloadBuffer, testSecret);

      const result = webhookHandler.verifyAndParsePayload(payloadBuffer, signature);

      expect(result).toEqual(testPayload);
    });

    it('throws WebhookSignatureError for a missing signature', () => {
      const payloadBuffer = Buffer.from(JSON.stringify(testPayload));

      expect(() => {
        webhookHandler.verifyAndParsePayload(payloadBuffer, '');
      }).toThrow(WebhookSignatureError);
    });

    it('throws WebhookSignatureError for an invalid signature', () => {
      const payloadBuffer = Buffer.from(JSON.stringify(testPayload));

      expect(() => {
        webhookHandler.verifyAndParsePayload(payloadBuffer, 'sha256=invalidsignature');
      }).toThrow(WebhookSignatureError);
    });

    it('throws WebhookSignatureError for a tampered payload', () => {
      const originalPayload = Buffer.from(JSON.stringify(testPayload));
      const signature = generateSignature(originalPayload, testSecret);
      const tamperedPayload = Buffer.from(JSON.stringify({ ...testPayload, action: 'closed' }));

      expect(() => {
        webhookHandler.verifyAndParsePayload(tamperedPayload, signature);
      }).toThrow(WebhookSignatureError);
    });

    it('throws WebhookSignatureError for invalid JSON', () => {
      const invalidJson = Buffer.from('not valid json');
      const signature = generateSignature(invalidJson, testSecret);

      expect(() => {
        webhookHandler.verifyAndParsePayload(invalidJson, signature);
      }).toThrow(WebhookSignatureError);
    });

    it('works without a secret in development mode', () => {
      delete process.env.WEBHOOK_SECRET;
      const devHandler = new WebhookHandler(
        mockGitHubClient as any,
        mockPRAnalyzer as any,
      );
      const payloadBuffer = Buffer.from(JSON.stringify(testPayload));

      const result = devHandler.verifyAndParsePayload(payloadBuffer, '');
      expect(result).toEqual(testPayload);
    });
  });

  describe('handleEvent', () => {
    it('processes a pull_request event', async () => {
      await webhookHandler.handleEvent(testPayload);

      expect(mockPRAnalyzer.analyze).toHaveBeenCalled();
    });

    it('skips duplicate events', async () => {
      await webhookHandler.handleEvent(testPayload);
      await webhookHandler.handleEvent(testPayload);

      expect(mockPRAnalyzer.analyze).toHaveBeenCalledTimes(1);
    });

    it('creates a failure status when blocking', async () => {
      mockPRAnalyzer.analyze.mockResolvedValueOnce({
        statusCheck: { status: 'failure', summary: '1 critical violation' },
        shouldBlock: true,
        impact: {
          newViolations: [
            { id: 'v1', ruleId: 'layer-ui-to-infra', severity: 'critical', message: 'Layer violation', filePath: 'src/ui/A.ts', lineNumber: 1, entityId: 'e1' },
          ],
          fixedViolations: [],
          fitnessScoreDelta: -6,
          layerPurityDelta: -5,
        },
      });

      await webhookHandler.handleEvent(testPayload);

      expect(mockGitHubClient.createCommitStatus).toHaveBeenCalledWith(
        'org',
        'test-repo',
        'abc123',
        expect.objectContaining({ state: 'failure' }),
      );
    });

    it('posts a PR comment when violations are found', async () => {
      mockPRAnalyzer.analyze.mockResolvedValueOnce({
        statusCheck: { status: 'failure', summary: '1 critical violation' },
        shouldBlock: true,
        impact: {
          newViolations: [
            { id: 'v1', ruleId: 'layer-ui-to-infra', severity: 'critical', message: 'Layer violation', filePath: 'src/ui/A.ts', lineNumber: 1, entityId: 'e1' },
          ],
          fixedViolations: [],
          fitnessScoreDelta: 0,
          layerPurityDelta: 0,
        },
      });

      await webhookHandler.handleEvent(testPayload);

      expect(mockGitHubClient.createComment).toHaveBeenCalled();
    });

    it('does not post a comment when there are no violations', async () => {
      await webhookHandler.handleEvent(testPayload);

      expect(mockGitHubClient.createComment).not.toHaveBeenCalled();
    });
  });

  describe('deduplication cache', () => {
    it('processes distinct events independently', async () => {
      const payload2 = { ...testPayload, pull_request: { ...testPayload.pull_request!, number: 2 } };

      await webhookHandler.handleEvent(testPayload);
      await webhookHandler.handleEvent(payload2);

      expect(mockPRAnalyzer.analyze).toHaveBeenCalledTimes(2);
    });
  });
});

function generateSignature(payload: Buffer, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}
