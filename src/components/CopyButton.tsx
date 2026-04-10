import React from 'react';
import { Share, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useTheme } from '../theme';

interface Props {
  value: string;
  label?: string;
}

export const CopyButton = ({ value, label = 'Export' }: Props) => {
  const theme = useTheme();

  const handleExport = async () => {
    if (!value) return;
    try {
      await Share.share({ message: value });
    } catch {
      // User dismissed share sheet — not an error
    }
  };

  return (
    <TouchableOpacity
      onPress={handleExport}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Export ${label}`}
      style={[styles.button, { backgroundColor: theme.card }]}
    >
      <Text style={[styles.text, { color: theme.textSecondary }]}>Export</Text>
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



