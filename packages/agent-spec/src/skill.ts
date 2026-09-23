export interface SkillIssue {
  code:
    | 'SKILL_FRONTMATTER_INVALID'
    | 'SKILL_NAME_MISMATCH'
    | 'SKILL_DESCRIPTION_TOO_LONG'
    | 'SKILL_ACTIVATION_MISSING';
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
