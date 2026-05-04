import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useNetworkLogger } from '../context/NetworkLoggerContext';
import type { ConsoleEntry } from '../types';
import { useTheme, type Theme } from '../theme';
import { ConsoleDetailView } from './ConsoleDetailView';

const LEVEL_LEGEND: Array<{ level: ConsoleEntry['level']; label: string }> = [
  { level: 'log', label: 'Log' },
  { level: 'info', label: 'Info' },
  { level: 'warn', label: 'Warn' },
  { level: 'error', label: 'Error' },
];

const getLevelColor = (level: ConsoleEntry['level'], theme: Theme) => {
  switch (level) {
    case 'error':
      return theme.danger;
    case 'warn':
      return theme.warning;
    case 'info':
      return theme.primary;
    case 'log':
    default:
      return theme.success;
  }
};

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const ConsoleListView = () => {
  const { consoleEntries } = useNetworkLogger();
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const selectedEntry = selectedId
    ? (consoleEntries.find((entry) => entry.id === selectedId) ?? null)
    : null;

  const filteredEntries = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return consoleEntries;

    return consoleEntries.filter((entry) =>
      entry.level.includes(query) ||
      entry.message.toLowerCase().includes(query)
    );
  }, [consoleEntries, filter]);

  if (selectedEntry) {
    return <ConsoleDetailView entry={selectedEntry} onBack={() => setSelectedId(null)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      {consoleEntries.length > 0 && (
        <>
          <TextInput
            style={[
              styles.searchInput,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              },
            ]}
            value={filter}
            onChangeText={setFilter}
            placeholder="Filter by level or content…"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Filter console entries"
          />

          <View style={styles.legendRow}>
            {LEVEL_LEGEND.map(({ level, label }) => (
              <View key={level} style={[styles.legendItem, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
                <View style={[styles.legendDot, { backgroundColor: getLevelColor(level, theme) }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>{label}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {filteredEntries.length === 0 ? (
        <View style={styles.empty}> 
          <Text style={styles.emptyIcon}>📟</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}> 
            {consoleEntries.length === 0 ? 'No console output yet' : 'No matches'}
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}> 
            {consoleEntries.length === 0
              ? 'console.log, info, warn and error messages will appear here automatically.'
              : 'Try a different console filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const levelColor = getLevelColor(item.level, theme);
            return (
              <TouchableOpacity
                style={[
                  styles.row,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderLeftColor: levelColor,
                  },
                ]}
                onPress={() => setSelectedId(item.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${item.level} console entry ${item.message}`}
              >
                <View style={styles.middle}>
                  <Text style={[styles.message, { color: theme.text }]} numberOfLines={4}>
                    {item.message}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textSecondary }]}>
                    {`${item.level.toUpperCase()} • ${formatTimestamp(item.timestamp)}`}
                  </Text>
                </View>

                <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
              </TouchableOpacity>
            );
          }}
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchInput: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 6,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 12,
    paddingTop: 8,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    marginBottom: 4,
    gap: 10,
  },
  middle: {
    flex: 1,
    gap: 3,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontSize: 11,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
    marginLeft: 2,
    marginTop: 2,
  },
});