import type { IProject } from '@/lib/models/Project';

/** Category slugs from linked tech + marketing stack on a project. */
export function getProjectLinkedCategorySlugs(project: Pick<IProject, 'techStack' | 'marketingStack'>): Set<string> {
  const slugs = new Set<string>();
  for (const item of project.techStack ?? []) {
    if (item.category) slugs.add(item.category);
  }
  for (const item of project.marketingStack ?? []) {
    if (item.category) slugs.add(item.category);
  }
  return slugs;
}

export function diffNewLinkedCategorySlugs(
  before: Pick<IProject, 'techStack' | 'marketingStack'>,
  after: Pick<IProject, 'techStack' | 'marketingStack'>
): string[] {
  const beforeSet = getProjectLinkedCategorySlugs(before);
  const afterSet = getProjectLinkedCategorySlugs(after);
  return [...afterSet].filter((slug) => !beforeSet.has(slug));
}
