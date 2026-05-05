export type WakeWordMatchResult = {
  matched: boolean;
  matchedAlias: string | null;
  score: number;
  normalizedHeard: string;
  rawHeard: string;
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  if (!maxLen) return 0;
  return Math.max(0, 1 - dist / maxLen);
}

export function detectWakeWord(
  rawHeard: string,
  aliases: string[],
  minScore: number
): WakeWordMatchResult {
  const normalizedHeard = normalizeText(rawHeard);
  if (!normalizedHeard) {
    return { matched: false, matchedAlias: null, score: 0, normalizedHeard, rawHeard };
  }

  let bestAlias: string | null = null;
  let bestScore = 0;

  for (const aliasRaw of aliases) {
    const alias = normalizeText(aliasRaw);
    if (!alias) continue;

    // Fast path: literal containment with boundaries
    if (normalizedHeard.includes(alias)) {
      return {
        matched: true,
        matchedAlias: aliasRaw,
        score: 1,
        normalizedHeard,
        rawHeard,
      };
    }

    // Fuzzy path over sliding windows of words sized near alias token length
    const heardTokens = normalizedHeard.split(' ');
    const aliasTokens = alias.split(' ');
    const windowSizes = new Set([
      Math.max(1, aliasTokens.length - 1),
      aliasTokens.length,
      aliasTokens.length + 1,
    ]);
    for (const size of windowSizes) {
      if (size <= 0) continue;
      for (let i = 0; i + size <= heardTokens.length; i++) {
        const segment = heardTokens.slice(i, i + size).join(' ');
        const score = similarity(segment, alias);
        if (score > bestScore) {
          bestScore = score;
          bestAlias = aliasRaw;
        }
      }
    }
  }

  return {
    matched: bestScore >= minScore,
    matchedAlias: bestScore >= minScore ? bestAlias : null,
    score: bestScore,
    normalizedHeard,
    rawHeard,
  };
}
