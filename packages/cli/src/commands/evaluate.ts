import chalk from 'chalk';
import fs from 'fs-extra';
import { PolicyEngine, defaultPolicies, parsePolicyFile } from '@archlens/engine';
import type { EvaluationReport } from '@archlens/engine';

interface EvaluateOptions {
  policies?: string;
  strict?: boolean;
  failLevel?: string;
  validate?: boolean;
}

type Severity = 'critical' | 'major' | 'minor' | 'info';
const SEVERITY_ORDER: Severity[] = ['critical', 'major', 'minor', 'info'];

export async function evaluate(graphPath: string | undefined, options: EvaluateOptions): Promise<void> {
  console.log(chalk.cyan('⚖️  ArchLens RIE - Policy Evaluation\n'));

  try {
    // Load graph
    let graph: unknown;
    if (graphPath) {
      if (!await fs.pathExists(graphPath)) {
        console.error(chalk.red(`Graph file not found: ${graphPath}`));
        process.exit(1);
      }
      graph = await fs.readJson(graphPath);
    } else {
      console.log(chalk.gray('Reading graph from stdin...\n'));
      let stdinData = '';
      process.stdin.on('data', chunk => { stdinData += chunk; });
      await new Promise<void>(resolve => process.stdin.on('end', resolve));
      graph = JSON.parse(stdinData);
    }

    // Load policies — using validator so bad policy files fail loudly
    let policies = [...defaultPolicies];
    if (options.policies) {
      if (await fs.pathExists(options.policies)) {
        try {
          const raw = await fs.readFile(options.policies, 'utf-8');
          const customPolicies = parsePolicyFile(raw);
          policies = [...defaultPolicies, ...customPolicies];
          console.log(chalk.gray(`   Loaded ${customPolicies.length} custom policies from ${options.policies}\n`));
        } catch (err) {
          console.error(chalk.red(`\n❌ Policy file error: ${(err as Error).message}`));
          process.exit(1);
        }
      } else {
        console.warn(chalk.yellow(`   Policy file not found: ${options.policies} — using defaults\n`));
      }
    }

    // --validate flag: just check policies, don't evaluate
    if (options.validate) {
      console.log(chalk.green(`✓ All ${policies.length} policies are valid`));
      return;
    }

    console.log(chalk.gray(`   Evaluating ${policies.length} policies...\n`));

    const engine = new PolicyEngine({ strict: options.strict ?? false });
    engine.loadPolicies(policies);
    const report = await engine.evaluate(graph as any);

    printEvaluationReport(report, (options.failLevel as Severity) || 'major');

    if (options.strict) {
      const failIdx = SEVERITY_ORDER.indexOf((options.failLevel as Severity) || 'major');
      const hasFailures = SEVERITY_ORDER.slice(0, failIdx + 1).some(s => report.summary[s] > 0);
      if (hasFailures) process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Evaluation failed:'), error);
    process.exit(1);
  }
}

function printEvaluationReport(report: EvaluationReport, failLevel: Severity): void {
  const status = report.passed ? chalk.green('✓ PASSED') : chalk.red('✗ FAILED');
  console.log(`Status: ${status}\n`);

  console.log(chalk.cyan('Summary'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  Critical: ${report.summary.critical > 0 ? chalk.red(report.summary.critical) : report.summary.critical}`);
  console.log(`  Major:    ${report.summary.major > 0 ? chalk.yellow(report.summary.major) : report.summary.major}`);
  console.log(`  Minor:    ${report.summary.minor}`);
  console.log(`  Info:     ${report.summary.info}`);
  console.log();

  console.log(chalk.cyan('Metrics'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  Modules:      ${report.metrics.totalModules}`);
  console.log(`  Dependencies: ${report.metrics.totalDependencies}`);
  console.log(`  Eval time:    ${report.metrics.evaluationTime.toFixed(2)}ms`);
  console.log();

  if (report.violations.length > 0) {
    const failIdx = SEVERITY_ORDER.indexOf(failLevel);
    const blocking = report.violations.filter(v => SEVERITY_ORDER.indexOf(v.severity as Severity) <= failIdx);
    const nonBlocking = report.violations.filter(v => SEVERITY_ORDER.indexOf(v.severity as Severity) > failIdx);

    if (blocking.length > 0) {
      console.log(chalk.red(`Blocking Violations (${blocking.length})`));
      console.log(chalk.gray('─'.repeat(40)));
      printViolations(blocking);
    }
    if (nonBlocking.length > 0) {
      console.log(chalk.yellow(`\nWarnings (${nonBlocking.length})`));
      console.log(chalk.gray('─'.repeat(40)));
      printViolations(nonBlocking);
    }
    if (report.violations.length > 20) {
      console.log(chalk.gray(`\n... and ${report.violations.length - 20} more violations`));
    }
  }
}

function printViolations(violations: EvaluationReport['violations']): void {
  for (const v of violations.slice(0, 20)) {
    const color = { critical: chalk.red, major: chalk.yellow, minor: chalk.blue, info: chalk.gray }[v.severity] ?? chalk.gray;
    console.log(`\n[${color(v.severity.toUpperCase())}] ${v.message}`);
    console.log(chalk.gray(`   File: ${v.filePath}`));
    if (v.lineNumber) console.log(chalk.gray(`   Line: ${v.lineNumber}`));
    if (v.remediation) console.log(chalk.cyan(`   Fix:  ${v.remediation}`));
  }
}
