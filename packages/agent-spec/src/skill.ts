import { findSection } from './tables.ts';

export interface SkillIssue {
  code:
    | 'SKILL_FRONTMATTER_INVALID'
    | 'SKILL_NAME_MISMATCH'
    | 'SKILL_DESCRIPTION_TOO_LONG'
    | 'SKILL_ACTIVATION_MISSING'
    | 'SKILL_STEPS_MISSING'
    | 'SKILL_RESOURCE_UNLINKED'
    | 'SKILL_FAILURE_SECTION_MISSING'
    | 'SKILL_DEADLINE_INVALID';
  message: string;
}

// Annex A: lowercase letters, digits and hyphens, at most 64; description at most 1024.
const SKILL_NAME = /^[a-z0-9-]{1,64}$/;
const MAX_DESCRIPTION = 1024;
const ACTIVATION = 'Úsala cuando';

/** Checks the frontmatter of `.github/skills/<folder>/SKILL.md` (REQ-2.2-01..04). */
export function skillFrontmatterIssues(
  path: string,
  frontmatter: Record<string, unknown>,
): SkillIssue[] {
  const { name, description } = frontmatter;
  if (typeof name !== 'string' || typeof description !== 'string') {
    return [
      {
        code: 'SKILL_FRONTMATTER_INVALID',
        message: 'SKILL.md needs a text `name` and a text `description`',
      },
    ];
  }
  const issues: SkillIssue[] = [];
  const folder = path.split('/').at(-2);
  if (!SKILL_NAME.test(name)) {
    issues.push({
      code: 'SKILL_FRONTMATTER_INVALID',
      message: '`name` must be 1-64 lowercase letters, digits or hyphens',
    });
  }
  if (name !== folder) {
    issues.push({
      code: 'SKILL_NAME_MISMATCH',
      message: `\`name\` is \`${name}\` but the folder is \`${folder}\``,
    });
  }
  const text = description.normalize('NFC');
  const length = [...text].length;
  if (length > MAX_DESCRIPTION) {
    issues.push({
      code: 'SKILL_DESCRIPTION_TOO_LONG',
      message: `\`description\` has ${length} characters (maximum ${MAX_DESCRIPTION})`,
    });
  }
  if (!text.includes(ACTIVATION)) {
    issues.push({
      code: 'SKILL_ACTIVATION_MISSING',
      message: `\`description\` lacks an activation clause that starts with \`${ACTIVATION}\``,
    });
  }
  return issues;
}

export const FAILURE_HEADING = '## Manejo de fallos';
const TIMEOUT_LINE = /^- \*\*Timeout:\*\* (\d+(?:\.\d+)?) s$/m;
const DEADLINE_CONSTANT = /^const DEFAULT_DEADLINE_MS = (\d+);$/m;

/** Timeout of the skill resources, from the `- **Timeout:** <n> s` line of `## Manejo de fallos`. */
export function skillTimeoutMs(body: string): number | undefined {
  const match = TIMEOUT_LINE.exec(findSection(body, FAILURE_HEADING) ?? '');
  return match ? Number(match[1]) * 1000 : undefined;
}

/** Relative link targets of a Markdown body, without a leading `./`. */
function linkTargets(body: string): Set<string> {
  return new Set(
    [...body.matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target.replace(/^\.\//, '')),
  );
}

/**
 * Checks the body of `.github/skills/<folder>/SKILL.md` (REQ-2.2-05..08) against the scripts of its
 * folder (`resources`, by path): numbered steps, a link to each script, the failure section and a
 * script deadline lower than the declared timeout.
 */
export function skillBodyIssues(
  path: string,
  body: string,
  resources: Record<string, string>,
): SkillIssue[] {
  const issues: SkillIssue[] = [];
  const steps = body.split('\n').filter((line) => /^\s{0,3}\d+\.\s+\S/.test(line));
  if (steps.length < 2) {
    issues.push({
      code: 'SKILL_STEPS_MISSING',
      message: 'the body has no numbered procedure (at least 2 numbered steps)',
    });
  }

  const folder = path.slice(0, -'SKILL.md'.length);
  const scripts = Object.keys(resources)
    .filter((resource) => resource.startsWith(`${folder}scripts/`))
    .map((resource) => resource.slice(folder.length));
  const links = linkTargets(body);
  for (const script of scripts.filter((candidate) => !links.has(candidate))) {
    issues.push({
      code: 'SKILL_RESOURCE_UNLINKED',
      message: `the body has no relative link to \`${script}\``,
    });
  }

  if (findSection(body, FAILURE_HEADING) === undefined) {
    issues.push({
      code: 'SKILL_FAILURE_SECTION_MISSING',
      message: `the body has no \`${FAILURE_HEADING}\` section`,
    });
    return issues;
  }
  const timeoutMs = skillTimeoutMs(body);
  if (timeoutMs === undefined) {
    issues.push({
      code: 'SKILL_DEADLINE_INVALID',
      message: `\`${FAILURE_HEADING}\` lacks the line \`- **Timeout:** <n> s\``,
    });
    return issues;
  }
  for (const script of scripts) {
    const deadline = DEADLINE_CONSTANT.exec(resources[`${folder}${script}`]);
    if (!deadline) {
      issues.push({
        code: 'SKILL_DEADLINE_INVALID',
        message: `\`${script}\` defines no \`const DEFAULT_DEADLINE_MS = <n>;\``,
      });
    } else if (Number(deadline[1]) >= timeoutMs) {
      issues.push({
        code: 'SKILL_DEADLINE_INVALID',
        message: `DEFAULT_DEADLINE_MS of \`${script}\` (${deadline[1]} ms) must be lower than the ${timeoutMs} ms timeout`,
      });
    }
  }
  return issues;
}
