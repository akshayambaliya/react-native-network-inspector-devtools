/**
 * Resolves a clipboard implementation at runtime.
 *
 * Priority:
 *  1. Nothing — the caller always wins (checked before calling this)
 *  2. @react-native-clipboard/clipboard  (autodetected if installed)
 *  3. undefined — copy silently becomes a no-op; a dev warning is shown in CopyButton
 */
export const resolveDefaultClipboard = (): ((text: string) => void) | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-clipboard/clipboard');
    const Clipboard = mod?.default ?? mod;
    if (Clipboard && typeof Clipboard.setString === 'function') {
      return (text: string) => Clipboard.setString(text);
    }
  } catch {
    // @react-native-clipboard/clipboard is not installed — that's fine
  }
  return undefined;
};

/**
 * Singleton resolved once on first use.
 * Lazy so Metro doesn't tree-shake the optional require at bundle time.
 */
let _resolved = false;
let _clipboard: ((text: string) => void) | undefined;

export const getDefaultClipboard = (): ((text: string) => void) | undefined => {
  if (!_resolved) {
    _clipboard = resolveDefaultClipboard();
    _resolved = true;
  }
  return _clipboard;
};
