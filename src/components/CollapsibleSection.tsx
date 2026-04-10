import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../theme';
import { CopyButton } from './CopyButton';

interface Props {
  title: string;
  copyValue?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsibleSection = ({ title, copyValue, defaultOpen = true, children }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title}`}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          {open ? '▾' : '▸'}{'  '}{title}
        </Text>
        {copyValue ? <CopyButton value={copyValue} label={title} /> : null}
      </TouchableOpacity>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 14,
  },
});
