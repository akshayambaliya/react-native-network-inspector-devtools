import React, { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { getDefaultClipboard } from '../utils/clipboard';
import { useTheme } from '../theme';

interface Props {
  value: string;
  label?: string;
}

export const CopyButton = ({ value, label = 'Copy' }: Props) => {
  const [copied, setCopied] = useState(false);
  const theme = useTheme();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!value) return;

    // Try native clipboard first (auto-detected from @react-native-clipboard/clipboard)
    const clipboard = getDefaultClipboard();
    if (clipboard) {
      clipboard(value);
    } else {
      // Fallback: share sheet — always available, no extra dependency
      try {
        await Share.share({ message: value });
      } catch {
        // User dismissed share sheet — not an error
      }
    }

    setCopied(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TouchableOpacity
      onPress={handleCopy}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      style={[styles.button, { backgroundColor: theme.card }]}
    >
      <Text style={[styles.text, { color: theme.textSecondary }]}>
        {copied ? '✓ Copied' : label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});

