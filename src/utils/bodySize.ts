/**
 * Internal helper — not part of the public API.
 * Caps how much of a request/response body we retain in memory and render.
 * Content-driven apps can return multi-MB JSON payloads; storing them in full
 * across up to `maxEntries` log rows bloats reducer state and can stall the
 * JS thread. Truncation happens after serialization so the recorded prefix is
 * still valid-looking JSON/text for the common case of pretty-printing.
 */
export const MAX_BODY_CHARS = 200_000;

export const truncateBody = (
  value: string | undefined,
  maxChars: number = MAX_BODY_CHARS,
): string | undefined => {
  if (value === undefined) return undefined;
  if (value.length <= maxChars) return value;
  const omitted = value.length - maxChars;
  return `${value.slice(0, maxChars)}\n… truncated (${omitted} more characters, ${value.length} total)`;
};
