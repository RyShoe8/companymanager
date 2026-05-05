type NamedEmployee = {
  name: string;
};

export type EmployeeRankedCandidate<T extends NamedEmployee> = {
  employee: T;
  score: number;
  reason: 'exact' | 'fuzzy';
};

export type EmployeeMatchOutcome<T extends NamedEmployee> =
  | { kind: 'exact'; match: EmployeeRankedCandidate<T> }
  | { kind: 'fuzzy'; match: EmployeeRankedCandidate<T> }
  | { kind: 'ambiguous'; candidates: EmployeeRankedCandidate<T>[] }
  | { kind: 'none'; candidates: EmployeeRankedCandidate<T>[] };

function normalize(input: string): string {
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
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d = levenshtein(a, b);
  const m = Math.max(a.length, b.length);
  if (!m) return 0;
  return Math.max(0, 1 - d / m);
}

function soundex(input: string): string {
  const s = normalize(input).replace(/\s+/g, '');
  if (!s) return '';
  const first = s[0].toUpperCase();
  const map: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6',
  };
  let out = first;
  let prev = map[s[0]] || '';
  for (let i = 1; i < s.length && out.length < 4; i++) {
    const c = s[i];
    const code = map[c] || '';
    if (code && code !== prev) out += code;
    prev = code || prev;
  }
  return (out + '000').slice(0, 4);
}

export function matchEmployeeByVoiceName<T extends NamedEmployee>(
  spokenRaw: string,
  employees: T[]
): EmployeeMatchOutcome<T> {
  const spoken = normalize(spokenRaw);
  if (!spoken || employees.length === 0) return { kind: 'none', candidates: [] };

  const exact = employees.find((e) => {
    const en = normalize(e.name);
    return en === spoken || en.includes(spoken) || spoken.includes(en);
  });
  if (exact) {
    return {
      kind: 'exact',
      match: { employee: exact, score: 1, reason: 'exact' },
    };
  }

  const spokenTokens = spoken.split(' ');
  const spokenLast = spokenTokens[spokenTokens.length - 1] || '';
  const spokenSdx = soundex(spokenLast);

  const ranked: EmployeeRankedCandidate<T>[] = employees
    .map((employee) => {
      const en = normalize(employee.name);
      const et = en.split(' ');
      const tokenOverlap =
        spokenTokens.filter((t) => et.some((x) => x.includes(t) || t.includes(x))).length /
        Math.max(1, Math.max(spokenTokens.length, et.length));
      const sim = similarity(spoken, en);
      const last = et[et.length - 1] || '';
      const lastSdx = soundex(last);
      const surnameBonus = spokenSdx && lastSdx && spokenSdx === lastSdx ? 0.12 : 0;
      const score = Math.min(1, 0.58 * sim + 0.42 * tokenOverlap + surnameBonus);
      return { employee, score, reason: 'fuzzy' as const };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < 0.72) {
    return { kind: 'none', candidates: ranked.slice(0, 3) };
  }

  const delta = second ? top.score - second.score : top.score;
  if (second && top.score >= 0.78 && delta < 0.05) {
    return { kind: 'ambiguous', candidates: ranked.slice(0, 3) };
  }

  if (top.score >= 0.82) {
    return { kind: 'fuzzy', match: top };
  }

  return { kind: 'ambiguous', candidates: ranked.slice(0, 3) };
}
