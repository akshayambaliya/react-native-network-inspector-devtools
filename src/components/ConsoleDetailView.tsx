import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ConsoleEntry } from '../types';
import { useTheme, type Theme } from '../theme';
import { CollapsibleSection } from './CollapsibleSection';

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

const FieldRow = ({ label, value }: { label: string; value: string }) => {
  const theme = useTheme();

  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text selectable style={[styles.fieldValue, { color: theme.text }]}>
        {value}
      </Text>
    </View>
  );
};

const MAX_CHUNK_CHARS = 8_000;

const ChunkedText = ({
  value,
  style,
}: {
  value: string;
  style: object | object[];
}) => {
  const [expanded, setExpanded] = useState(false);
  const isLarge = value.length > MAX_CHUNK_CHARS;
  const visible = isLarge && !expanded ? value.slice(0, MAX_CHUNK_CHARS) : value;

  const chunks: string[] = [];
  for (let i = 0; i < visible.length; i += MAX_CHUNK_CHARS) {
    chunks.push(visible.slice(i, i + MAX_CHUNK_CHARS));
  }

  return (
    <View>
      {chunks.map((chunk, index) => (
        <Text key={index} selectable style={style}>
          {chunk}
        </Text>
      ))}
      {isLarge && (
        <TouchableOpacity
          onPress={() => setExpanded((current) => !current)}
          activeOpacity={0.7}
          style={styles.expandButton}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less console payload' : 'Show full console payload'}
        >
          <Text style={styles.expandButtonText}>
            {expanded
              ? '▲ Show less'
              : `▼ Show full payload (${(value.length / 1024).toFixed(1)} KB)`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

interface Props {
  entry: ConsoleEntry;
  onBack: () => void;
}

export const ConsoleDetailView = ({ entry, onBack }: Props) => {
  const theme = useTheme();
  const levelColor = getLevelColor(entry.level, theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}> 
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back to console list"
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: theme.text }]}>‹ Back</Text>
        </TouchableOpacity>

        <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
          <Text style={styles.levelBadgeText}>{entry.level.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <CollapsibleSection
          title="Overview"
          copyValue={JSON.stringify(
            {
              level: entry.level,
              message: entry.message,
              timestamp: new Date(entry.timestamp).toISOString(),
            },
            null,
            2
          )}
        >
          <FieldRow label="Level" value={entry.level.toUpperCase()} />
          <FieldRow label="Time" value={new Date(entry.timestamp).toISOString()} />
        </CollapsibleSection>

        <CollapsibleSection title="Payload" copyValue={entry.detail}>
          <View style={[styles.codeBlock, { backgroundColor: theme.codeBg }]}> 
            <ChunkedText
              value={entry.detail}
              style={[styles.codeText, { color: theme.codeText }]}
            />
          </View>
        </CollapsibleSection>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  levelBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 32,
  },
  fieldRow: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  fieldValue: {
    fontSize: 13,
    lineHeight: 19,
  },
  codeBlock: {
    borderRadius: 8,
    padding: 12,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  expandButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  expandButtonText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
});