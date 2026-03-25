import type { CanonicalArchitectureGraph, Violation } from '@archlens/core';

/**
 * GitHub App configuration
 */
export interface GitHubAppConfig {
  /** GitHub App ID */
  appId: string;
  /** GitHub App private key */
  privateKey: string;
  /** Webhook secret for validating payloads */
  webhookSecret: string;
  /** Installation ID for the GitHub App */
  installationId?: string;
}

/**
 * PR analysis result
 */
export interface PRAnalysisResult {
  /** PR identifier */
  prNumber: number;
  /** Repository full name */
  repo: string;
  /** SHA of the PR head commit */
  headSha: string;
  /** Base branch */
  baseBranch: string;
  /** Head branch */
  headBranch: string;
  /** Files changed in the PR */
  changedFiles: string[];
  /** Architecture impact report */
  impact: {
    newViolations: Violation[];
    fixedViolations: Violation[];
    fitnessScoreDelta: number;
    layerPurityDelta: number;
  };
  /** Whether the PR should be blocked */
  shouldBlock: boolean;
  /** Status check details */
  statusCheck: {
    id: string;
    status: 'pending' | 'success' | 'failure';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped';
    title: string;
    summary: string;
    details: string;
  };
}

/**
 * GitHub API client for interacting with GitHub
 */
export class GitHubClient {
  private config: GitHubAppConfig;
  private token?: string;

  constructor(config: GitHubAppConfig) {
    this.config = config;
  }

  /**
   * Get an installation access token
   */
  async getInstallationToken(): Promise<string> {
    // In production, this would:
    // 1. Generate a JWT using appId and privateKey
    // 2. Exchange the JWT for an installation token
    
    if (!this.token) {
      this.token = 'mock-token';
      console.log('GitHub: Obtained installation token');
    }
    
    return this.token;
  }

  /**
   * Get information about a pull request
   */
  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<{
    number: number;
    title: string;
    body: string;
    head: { sha: string; ref: string };
    base: { ref: string };
    state: string;
    user: { login: string };
  }> {
    const token = await this.getInstallationToken();
    console.log(`GitHub API: GET /repos/${owner}/${repo}/pulls/${prNumber}`);
    
    // In production, use @octokit/rest to make API calls
    return {
      number: prNumber,
      title: `PR #${prNumber}`,
      body: '',
      head: { sha: 'abc123def456', ref: 'feature-branch' },
      base: { ref: 'main' },
      state: 'open',
      user: { login: 'developer' },
    };
  }

  /**
   * Get the list of files changed in a pull request
   */
  async getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<{
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
  }[]> {
    console.log(`GitHub API: GET /repos/${owner}/${repo}/pulls/${prNumber}/files`);
    
    // In production, fetch from GitHub API
    return [
      { filename: 'src/services/payment.ts', status: 'modified', additions: 50, deletions: 10 },
      { filename: 'src/ui/checkout.tsx', status: 'added', additions: 100, deletions: 0 },
    ];
  }

  /**
   * Create a status check for a commit
   */
  async createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    status: {
      state: 'pending' | 'success' | 'error' | 'failure';
      targetUrl?: string;
      description: string;
      context: string;
    }
  ): Promise<{ id: number; url: string }> {
    console.log(`GitHub API: POST /repos/${owner}/${repo}/statuses/${sha}`, status);
    
    // In production, create status via GitHub API
    return {
      id: Date.now(),
      url: `https://github.com/${owner}/${repo}/runs/${Date.now()}`,
    };
  }

  /**
   * Create a PR comment
   */
  async createComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<{ id: number; url: string }> {
    console.log(`GitHub API: POST /repos/${owner}/${repo}/issues/${prNumber}/comments`, { body });
    
    // In production, create comment via GitHub API
    return {
      id: Date.now(),
      url: `https://github.com/${owner}/${repo}/pull/${prNumber}#issuecomment-${Date.now()}`,
    };
  }

  /**
   * Update an existing PR comment
   */
  async updateComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string
  ): Promise<void> {
    console.log(`GitHub API: PATCH /repos/${owner}/${repo}/issues/comments/${commentId}`, { body });
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<{
    fullName: string;
    defaultBranch: string;
    language: string;
    description: string;
  }> {
    console.log(`GitHub API: GET /repos/${owner}/${repo}`);
    
    return {
      fullName: `${owner}/${repo}`,
      defaultBranch: 'main',
      language: 'TypeScript',
      description: 'Repository managed by ArchLens RIE',
    };
  }

  /**
   * Generate the PR impact report comment
   */
  generatePRComment(result: PRAnalysisResult): string {
    const { impact, statusCheck } = result;
    
    let comment = `## Architecture Impact Report

`;
    
    if (impact.newViolations.length > 0) {
      comment += `### Blockers (Must Fix)

`;
      for (const violation of impact.newViolations) {
        if (violation.severity === 'critical' || violation.severity === 'major') {
          comment += `- **[${violation.severity.toUpperCase()}]** ${violation.message}
  - File: \`${violation.filePath}\`
  - Remediation: ${violation.remediation || 'Fix the architecture violation'}

`;
        }
      }
    }

    if (impact.fixedViolations.length > 0) {
      comment += `### Fixed Violations

`;
      for (const violation of impact.fixedViolations) {
        comment += `- ~~${violation.message}~~ (Resolved)

`;
      }
    }

    comment += `### Metrics

| Metric          | Delta |
|-----------------|-------|
| Fitness Score   | ${impact.fitnessScoreDelta >= 0 ? '+' : ''}${impact.fitnessScoreDelta.toFixed(1)} |
| Layer Purity    | ${impact.layerPurityDelta >= 0 ? '+' : ''}${impact.layerPurityDelta.toFixed(1)}% |
| New Violations  | ${impact.newViolations.length} |
| Fixed Violations| ${impact.fixedViolations.length} |

---

*Powered by ArchLens RIE 2.0*`;

    return comment;
  }
}
