export { GitHubClient, type GitHubAppConfig, type PRAnalysisResult } from './github-client.js';
export { PRAnalyzer, type PRAnalyzerConfig } from './pr-analyzer.js';
export { WebhookHandler, WebhookSignatureError, type WebhookEvent, type WebhookPayload, type WebhookHeaders } from './webhook-handler.js';
export { GitHubAppServer } from './server.js';

const ENV = {
  GITHUB_APP_ID:         'GITHUB_APP_ID',
  GITHUB_APP_PRIVATE_KEY: 'GITHUB_APP_PRIVATE_KEY',
  WEBHOOK_SECRET:        'WEBHOOK_SECRET',
  PORT:                  'PORT',
  ENABLE_BLOCKING:       'ENABLE_BLOCKING',
} as const;

/**
 * GitHub App entry point.
 *
 * Required environment variables:
 *   GITHUB_APP_ID            — numeric App ID from GitHub App settings
 *   GITHUB_APP_PRIVATE_KEY   — PEM private key (include newlines or base64-encode)
 *   WEBHOOK_SECRET           — secret used to sign webhook payloads
 *
 * Optional:
 *   PORT                     — HTTP port (default: 3000)
 *   ENABLE_BLOCKING          — 'false' to disable PR blocking (default: true)
 *   ARCHLENS_STORAGE_TYPE    — 'local' | 'neo4j' | 'postgresql' (default: 'local')
 *   ARCHLENS_STORAGE_URL     — connection string / path (default: '.archlens/snapshots')
 *   ARCHLENS_STORAGE_USERNAME / ARCHLENS_STORAGE_PASSWORD  — for neo4j / postgresql
 */
async function main(): Promise<void> {
  console.log('Starting ArchLens RIE GitHub App...');
  console.log('Version: 2.0.0\n');

  const config = {
    appId:          process.env[ENV.GITHUB_APP_ID] ?? '',
    privateKey:     process.env[ENV.GITHUB_APP_PRIVATE_KEY] ?? '',
    webhookSecret:  process.env[ENV.WEBHOOK_SECRET] ?? '',
    port:           parseInt(process.env[ENV.PORT] ?? '3000', 10),
    enableBlocking: process.env[ENV.ENABLE_BLOCKING] !== 'false',
  };

  const missing: string[] = [];
  if (!config.appId)         missing.push('GITHUB_APP_ID');
  if (!config.privateKey)    missing.push('GITHUB_APP_PRIVATE_KEY');
  if (!config.webhookSecret) missing.push('WEBHOOK_SECRET');

  if (missing.length > 0) {
    console.warn(`Warning: missing environment variables: ${missing.join(', ')}`);
    console.warn('Running in development mode — webhook signature verification disabled.\n');
  }

  // Initialise storage (import dynamically to keep the package optional)
  let storage;
  try {
    const { createStorageFromEnv } = await import('@archlens/storage');
    storage = await createStorageFromEnv();
    console.log('Storage backend: ready\n');
  } catch (err) {
    console.warn('Storage backend: unavailable —', (err as Error).message);
    console.warn('Snapshot APIs will be disabled and PR analysis will use mock data.\n');
  }

  const { GitHubClient } = await import('./github-client.js');
  const { PRAnalyzer }   = await import('./pr-analyzer.js');
  const { GitHubAppServer } = await import('./server.js');

  const github   = new GitHubClient({ appId: config.appId, privateKey: config.privateKey, webhookSecret: config.webhookSecret });
  const analyzer = new PRAnalyzer({ enableBlocking: config.enableBlocking, minFitnessDelta: -10 });
  const server   = new GitHubAppServer(config.port);

  server.configure(github, analyzer, storage);
  await server.start();

  console.log('\n✅ ArchLens RIE GitHub App is running!');
  console.log(`   Webhook:     http://localhost:${config.port}/webhook`);
  console.log(`   Health:      http://localhost:${config.port}/health`);
  console.log(`   Snapshots:   http://localhost:${config.port}/api/snapshots`);
  console.log(`   Metrics:     http://localhost:${config.port}/metrics`);
  console.log(`   Blocking:    ${config.enableBlocking ? 'enabled' : 'disabled'}`);
  console.log(`   Signature:   ${config.webhookSecret ? 'ENABLED 🔐' : 'DISABLED ⚠️'}`);

  // Graceful shutdown
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, async () => {
      console.log(`\nReceived ${sig} — shutting down gracefully...`);
      await server.stop();
      process.exit(0);
    });
  }
}

main().catch(error => {
  console.error('Failed to start GitHub App:', error);
  process.exit(1);
});
