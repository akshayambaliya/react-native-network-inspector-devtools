import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { NetworkLogEntry } from '../types';
import { METHOD_COLORS, useTheme } from '../theme';

const toRelativePath = (url: string): string => {
  try {
    const { pathname, search } = new URL(url);
    return pathname + search;
  } catch {
    return url;
  }
};

const statusLabel = (entry: NetworkLogEntry): string => {
  if (entry.state === 'error' && entry.status === undefined) return 'ERR';
  if (entry.status !== undefined) return String(entry.status);
  return '—';
};

const useStatusColor = (entry: NetworkLogEntry) => {
  const theme = useTheme();
  if (entry.state === 'error' && entry.status === undefined) return theme.danger;
  if (entry.status === undefined) return theme.textSecondary;
  if (entry.status < 300) return theme.success;
  if (entry.status < 400) return theme.warning;
  return theme.danger;
};

interface Props {
  entry: NetworkLogEntry;
  onPress: () => void;
}

export const LogRow = ({ entry, onPress }: Props) => {
  const theme = useTheme();
  const statusColor = useStatusColor(entry);

  const methodColor = METHOD_COLORS[entry.method] ?? '#6B7280';
  const duration = entry.duration !== undefined ? `${entry.duration}ms` : 'pending…';
  const label = statusLabel(entry);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${entry.method} ${entry.url} ${label}`}
    >
      <View style={[styles.methodBadge, { backgroundColor: methodColor }]}>
        <Text style={styles.methodText} numberOfLines={1}>
          {entry.method}
        </Text>
      </View>

      <View style={styles.middle}>
        <Text style={[styles.url, { color: theme.text }]} numberOfLines={1}>
          {toRelativePath(entry.url)}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {duration}
        </Text>
      </View>

      <View style={styles.right}>
        {entry.isMocked && (
          <View style={styles.mockPill}>
            <Text style={styles.mockPillText}>MOCK</Text>
          </View>
        )}
        <Text style={[styles.status, { color: statusColor }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    gap: 10,
  },
  methodBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 54,
    alignItems: 'center',
  },
  methodText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  middle: {
    flex: 1,
    gap: 3,
  },
  url: {
    fontSize: 13,
  },
  meta: {
    fontSize: 11,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
  },
  mockPill: {
    backgroundColor: '#EA580C',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  mockPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
