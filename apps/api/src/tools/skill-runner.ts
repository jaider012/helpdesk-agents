import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { skillTimeoutMs, type AgentName, type SpecBundle } from 'agent-spec';
import type { AuditLog } from '../audit/audit-log.js';

/** The registry tool that runs skill scripts (design §10.1). */
const RUNNER_TOOL = 'execute/runInTerminal';

/** A script of a registered skill: the only thing the runner executes (design §6.3). */
export interface SkillScript {
  /** Folder of the skill under `.github/skills/`. */
  skill: string;
  /** Path of the script inside the skill folder, as the `SKILL.md` links it. */
  script: string;
  /** Absolute path of the script. */
  path: string;
  /** The `- **Timeout:** <n> s` line of the `SKILL.md` failure section (ADR-01). */
  timeoutMs: number;
}

export type ToolRunStatus = 'ok' | 'failed' | 'error' | 'timeout';

export interface ScriptRun {
  /** `null` when the runtime killed the process. */
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/** The scripts of each skill in the spec, with the timeout declared by its `SKILL.md`. */
export function compileSkillScripts(bundle: SpecBundle): SkillScript[] {
  return bundle.files
    .filter((file) => file.kind === 'skill')
    .flatMap((file) => {
      if (!file.frontmatter.ok) throw new Error(`${file.path} has an invalid frontmatter`);
      const folder = file.path.slice(0, -'SKILL.md'.length);
      const timeoutMs = skillTimeoutMs(file.frontmatter.body);
      if (timeoutMs === undefined) throw new Error(`${file.path} declares no timeout`);
      return Object.keys(bundle.resources)
        .filter((resource) => resource.startsWith(`${folder}scripts/`))
        .map((resource) => ({
          skill: folder.split('/').at(-2) ?? '',
          script: resource.slice(folder.length),
          path: join(bundle.root, resource),
          timeoutMs,
        }));
    });
}

function statusOf({ exitCode, timedOut }: ScriptRun): ToolRunStatus {
  if (timedOut) return 'timeout';
  if (exitCode === 0) return 'ok';
  return exitCode === 1 ? 'failed' : 'error';
}

/** Runs `node <script> ...args` without a shell and kills it with SIGKILL after the timeout. */
function execute(script: SkillScript, args: readonly string[]): Promise<ScriptRun> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script.path, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, script.timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        timedOut,
        stdout,
        stderr,
        durationMs: performance.now() - start,
      });
    });
  });
}

/**
 * Runs the scripts of registered skills as child processes (REQ-2.2-23, REQ-2.2-24) and records
 * each run in the audit log with the tool, the status and the duration (REQ-AUD-05).
 */
export class SkillRunner {
  constructor(private readonly audit: AuditLog) {}

  async run(
    script: SkillScript,
    args: readonly string[],
    context: { ticketId: string; agent: AgentName },
  ): Promise<ScriptRun> {
    const run = await execute(script, args);
    const status = statusOf(run);
    await this.audit.append({
      ticketId: context.ticketId,
      agent: context.agent,
      decision: 'tool_run',
      reason: run.timedOut
        ? `${script.script} killed after ${script.timeoutMs} ms`
        : `${script.script} exited with code ${run.exitCode}`,
      data: {
        tool: RUNNER_TOOL,
        skill: script.skill,
        script: script.script,
        status,
        exitCode: run.exitCode,
        durationMs: Math.round(run.durationMs),
      },
    });
    return run;
  }
}
