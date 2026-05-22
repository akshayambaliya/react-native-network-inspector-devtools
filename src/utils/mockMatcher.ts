import type { NetworkMock } from '../types';

/**
 * Returns a **specificity score** when `url` matches `mock`, or `null` when it does not.
 *
 * Score = (matchTypeWeight × 1_000_000) + urlPattern.length
 *
 * Match-type weights:
 *   `exact`    → 3  — always beats regex and contains
 *   `regex`    → 2  — always beats contains
 *   `contains` → 1  — broadest, least specific
 *
 * Within the same match type, a longer pattern has a higher score because it
 * constrains the URL more tightly.
 */
export const urlMatchScore = (url: string, mock: NetworkMock): number | null => {
  const pattern = mock.urlPattern ?? '';
  switch (mock.matchType) {
    case 'exact':
      if (url.toLowerCase() !== pattern.toLowerCase()) return null;
      return 3_000_000 + pattern.length;
    case 'regex': {
      try {
        if (!new RegExp(pattern).test(url)) return null;
        return 2_000_000 + pattern.length;
      } catch {
        return null;
      }
    }
    case 'contains':
    default:
      if (!url.toLowerCase().includes(pattern.toLowerCase())) return null;
      return 1_000_000 + pattern.length;
  }
};

/**
 * Among `candidates` that are enabled and match `url`+`method`, returns the one
 * with the highest specificity score. Ties are broken by array order.
 */
export const findBestMock = (
  candidates: NetworkMock[],
  url: string,
  method: string,
): NetworkMock | undefined => {
  let best: NetworkMock | undefined;
  let bestScore = -1;
  for (const mock of candidates) {
    if ((mock.method ?? '').toUpperCase() !== method) continue;
    const score = urlMatchScore(url, mock);
    if (score !== null && score > bestScore) {
      bestScore = score;
      best = mock;
    }
  }
  return best;
};

/**
 * Picks the best matching mock for a URL+method, applying the user-mocks-first
 * tier rule used across all interceptors (axios + fetch).
 */
export const pickMock = (
  activeMocks: NetworkMock[],
  url: string,
  method: string,
): NetworkMock | undefined => {
  const userMocks: NetworkMock[] = [];
  const presetMocks: NetworkMock[] = [];
  for (const m of activeMocks) {
    if (m.source === 'preset') presetMocks.push(m);
    else userMocks.push(m);
  }
  return (
    findBestMock(userMocks, url, method) ??
    findBestMock(presetMocks, url, method)
  );
};
