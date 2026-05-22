import type { BlacklistRule } from '../types';

/**
 * Returns `true` when `url` (and optionally `method`) matches `rule`.
 *
 * Matching rules mirror `MockUrlMatchType` so developers learn a single
 * vocabulary across mocks and the blacklist:
 *   - `'contains'` (default) — case-insensitive substring
 *   - `'exact'`              — case-insensitive full URL equality
 *   - `'regex'`              — JavaScript `RegExp` source string
 *
 * The optional `method` filter defaults to `'ALL'` (matches any HTTP method).
 * Malformed regex patterns never throw — they simply do not match, so a typo
 * in a blacklist entry can never crash a consumer's network layer.
 */
export const matchesBlacklistRule = (
  rule: BlacklistRule,
  url: string,
  method: string,
): boolean => {
  // Defensive guards for JS consumers (no TS at the call site). Any malformed
  // input simply fails to match — never throws.
  if (!rule || typeof rule !== 'object') return false;
  if (typeof url !== 'string' || url.length === 0) return false;

  const ruleMethod =
    typeof rule.method === 'string' ? rule.method.toUpperCase() : 'ALL';
  const requestMethod = typeof method === 'string' ? method.toUpperCase() : '';
  if (ruleMethod !== 'ALL' && ruleMethod !== requestMethod) return false;

  const pattern = typeof rule.urlPattern === 'string' ? rule.urlPattern : '';
  if (!pattern) return false;

  switch (rule.matchType) {
    case 'exact':
      return url.toLowerCase() === pattern.toLowerCase();
    case 'regex':
      try {
        return new RegExp(pattern).test(url);
      } catch {
        return false;
      }
    case 'contains':
    default:
      return url.toLowerCase().includes(pattern.toLowerCase());
  }
};

/**
 * Returns `true` if **any** rule in `rules` matches `url` + `method`.
 *
 * A blacklisted request is dropped before logging or mock matching — the
 * panel never records it and any configured mock is intentionally bypassed.
 *
 * The function tolerates `undefined` / non-array inputs so the interceptors
 * can call it unconditionally without guarding the ref's `.current`.
 */
export const isBlacklisted = (
  rules: BlacklistRule[] | undefined,
  url: string,
  method: string,
): boolean => {
  if (!rules || rules.length === 0) return false;
  for (const rule of rules) {
    if (matchesBlacklistRule(rule, url, method)) return true;
  }
  return false;
};
