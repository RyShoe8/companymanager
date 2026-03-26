import { IProject } from '@/lib/models/Project';

export interface TaskMatchResult {
    project: IProject;
    taskIdx: number;
    score: number;
}

/**
 * Fuzzy-match a task by spoken name and optional project context (same scoring as voice "complete task").
 */
export function matchTaskInProjects(
    projects: IProject[],
    normalize: (s: string) => string,
    name: string,
    context: string | null | undefined,
    opts?: { allowCompleted?: boolean }
): TaskMatchResult | null {
    const searchName = name ? normalize(name) : '';
    const searchContext = context ? normalize(context) : null;
    const allowCompleted = opts?.allowCompleted ?? false;

    const searchWords = searchName.split(/\s+/).filter(Boolean);
    const wordOverlapScore = (tName: string) => {
        const taskWords = new Set(tName.split(/\s+/).filter(Boolean));
        let shared = 0;
        for (const w of searchWords) {
            if (taskWords.has(w)) shared++;
        }
        return searchWords.length > 0 ? (shared / searchWords.length) * 50 : 0;
    };

    let bestMatch: TaskMatchResult | null = null;

    for (const p of projects) {
        const pName = normalize(p.name);
        const isProjectContextMatched = searchContext
            ? pName.includes(searchContext) ||
              searchContext.includes(pName) ||
              (searchContext.length <= 2 && pName.startsWith(searchContext))
            : false;
        const isProjectMentionedInName = searchName.includes(pName);

        p.tasks?.forEach((t, idx) => {
            if (!allowCompleted && t.status === 'completed') return;

            const tName = normalize(t.name);
            let score = 0;

            if (tName === searchName) score = 100;
            else if (searchName.includes(tName)) score = 80;
            else if (tName.includes(searchName)) score = 60;

            if (score > 0 && isProjectContextMatched) score += 50;
            else if (score > 0 && isProjectMentionedInName) score += 20;

            if (score > 40 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { project: p, taskIdx: idx, score };
            }
        });
    }

    if (!bestMatch && searchWords.length > 0) {
        const WORD_OVERLAP_THRESHOLD = 25;
        for (const p of projects) {
            const pName = normalize(p.name);
            const contextMatch = searchContext
                ? pName.includes(searchContext) ||
                  searchContext.includes(pName) ||
                  (searchContext.length <= 2 && pName.startsWith(searchContext))
                : true;
            if (!contextMatch) continue;
            p.tasks?.forEach((t, idx) => {
                if (!allowCompleted && t.status === 'completed') return;
                const tName = normalize(t.name);
                const overlap = wordOverlapScore(tName);
                if (overlap >= WORD_OVERLAP_THRESHOLD && (!bestMatch || overlap > bestMatch.score)) {
                    bestMatch = { project: p, taskIdx: idx, score: overlap };
                }
            });
        }
    }

    return bestMatch;
}
