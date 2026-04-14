import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { NetworkLogEntry } from '../types';
import { useTheme } from '../theme';
import { CollapsibleSection } from './CollapsibleSection';
import { CopyButton } from './CopyButton';
import type { MockPrefill } from './MockEditor';

const prettyJson = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      const result = JSON.stringify(value, null, 2);
      return typeof result === 'string' ? result : String(value);
    } catch {
      // Circular reference or non-serialisable value — show raw string form
      return String(value);
    }
  }
  const str = typeof value === 'string' ? value : String(value);
  if (!str.trim()) return '';
  try {
    const result = JSON.stringify(JSON.parse(str), null, 2);
    return typeof result === 'string' ? result : str;
  } catch {
    // Not valid JSON — display as plain text, nothing is lost
    return str;
  }
};

const tryParse = (value: unknown): unknown => {
  if (value == null) return undefined;
  if (typeof value === 'object') return value;
  const str = typeof value === 'string' ? value : String(value);
  if (!str.trim()) return undefined;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
};

const headersToText = (h: Record<string, string> | undefined): string => {
  if (!h) return '';
  try {
    const result = JSON.stringify(h, null, 2);
    return typeof result === 'string' ? result : '';
  } catch {
    return '';
  }
};

const buildCopyPayload = (entry: NetworkLogEntry): string =>
  JSON.stringify(
    {
      method: entry.method,
      url: entry.url,
      status: entry.status,
      duration: entry.duration !== undefined ? `${entry.duration}ms` : 'pending',
      request: {
        headers: entry.requestHeaders,
        body: tryParse(entry.requestBody),
      },
      response: {
        headers: entry.responseHeaders,
        body: tryParse(entry.responseBody),
      },
    },
    null,
    2
  );

const buildCurlCommand = (entry: NetworkLogEntry): string => {
  const parts: string[] = [`curl -X ${entry.method}`];

  // Request headers
  if (entry.requestHeaders) {
    for (const [key, val] of Object.entries(entry.requestHeaders)) {
      // POSIX shell single-quote escape: replace ' with '\''
      parts.push(`  -H '${key}: ${val.replace(/'/g, "'\\''")}'`);
    }
  }

  // Request body (POST / PUT / PATCH / etc.)
  if (entry.requestBody && entry.requestBody.trim()) {
    // Same POSIX escape for body content
    const escaped = entry.requestBody.replace(/'/g, "'\\''");
    parts.push(`  -d '${escaped}'`);
  }

  // URL — always last; escape single quotes in the URL as well
  const escapedUrl = entry.url.replace(/'/g, "'\\''");
  parts.push(`  '${escapedUrl}'`);

  return parts.join(' \\\n');
};

/**
 * React Native's Text component silently renders blank when the string
 * exceeds ~50-100 KB (the native layout engine gives up computing line breaks).
 * We chunk large strings into slices of MAX_CHUNK_CHARS so each Text node
 * stays well inside the safe zone, while the user sees the full content.
 */
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

  // Split into chunks so no single Text node exceeds the safe limit.
  const chunks: string[] = [];
  for (let i = 0; i < visible.length; i += MAX_CHUNK_CHARS) {
    chunks.push(visible.slice(i, i + MAX_CHUNK_CHARS));
  }

  return (
    <View>
      {chunks.map((chunk, idx) => (
        <Text key={idx} selectable style={style}>
          {chunk}
        </Text>
      ))}
      {isLarge && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
          style={styles.expandButton}
        >
          <Text style={styles.expandButtonText}>
            {expanded
              ? '▲ Show less'
              : `▼ Show full response (${(value.length / 1024).toFixed(1)} KB)`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

interface FieldRowProps {
  label: string;
  value: string | undefined;
  isCode?: boolean;
  copyValue?: string;
}

const FieldRow = ({ label, value, isCode, copyValue }: FieldRowProps) => {
  const theme = useTheme();
  const display = value || '—';

  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
        {copyValue ? <CopyButton value={copyValue} label={label} /> : null}
      </View>
      {isCode ? (
        <View style={[styles.codeBlock, { backgroundColor: theme.codeBg }]}>
          <ChunkedText
            value={display}
            style={[styles.codeText, { color: theme.codeText }]}
          />
        </View>
      ) : (
        <Text selectable style={[styles.fieldValue, { color: theme.text }]}>
          {display}
        </Text>
      )}
    </View>
  );
};

interface Props {
  entry: NetworkLogEntry;
  onBack: () => void;
  onMock: (prefill: MockPrefill) => void;
}

export const LogDetailView = ({ entry, onBack, onMock }: Props) => {
  const theme = useTheme();

  const handleMock = () => {
    onMock({
      urlPattern: entry.url,
      method: entry.method,
      status: entry.status !== undefined ? String(entry.status) : '200',
      responseBody: entry.responseBody ?? '{}',
    });
  };

  const handleExport = async () => {
    try {
      await Share.share({
        message: buildCopyPayload(entry),
      });
    } catch {
      // User dismissed the share sheet — not an error
    }
  };

  const handleExportCurl = async () => {
    try {
      await Share.share({
        message: buildCurlCommand(entry),
      });
    } catch {
      // User dismissed the share sheet — not an error
    }
  };

  const statusDisplay =
    entry.state === 'pending'
      ? 'pending…'
      : entry.status !== undefined
        ? String(entry.status)
        : entry.state;

  const durationDisplay =
    entry.duration !== undefined ? `${entry.duration}ms` : 'pending…';

  const reqCopy = JSON.stringify(
    { headers: entry.requestHeaders, body: tryParse(entry.requestBody) },
    null,
    2
  );

  const resCopy = JSON.stringify(
    {
      status: entry.status,
      headers: entry.responseHeaders,
      body: tryParse(entry.responseBody),
    },
    null,
    2
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back to log list"
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: theme.text }]}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleMock}
            activeOpacity={0.7}
            style={[styles.mockButton, { borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Mock this request"
          >
            <Text style={[styles.mockButtonText, { color: theme.text }]}>Mock</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExport}
            activeOpacity={0.7}
            style={[styles.exportButton, { borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Export this request"
          >
            <Text style={[styles.exportButtonText, { color: theme.text }]}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExportCurl}
            activeOpacity={0.7}
            style={[styles.exportButton, { borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Export as cURL command"
          >
            <Text style={[styles.exportButtonText, { color: theme.text }]}>cURL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {entry.isMocked && (
        <View
          style={[
            styles.mockBanner,
            {
              backgroundColor: theme.mockBanner,
              borderBottomColor: theme.mockBannerBorder,
            },
          ]}
        >
          <Text style={[styles.mockBannerText, { color: theme.mockBannerText }]}>
            ⚠️ This response was mocked
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <CollapsibleSection title="Overview">
          <FieldRow label="URL" value={entry.url} copyValue={entry.url} />
          <FieldRow label="Method" value={entry.method} />
          <FieldRow label="Status" value={statusDisplay} />
          <FieldRow label="Duration" value={durationDisplay} />
          <FieldRow label="Start Time" value={new Date(entry.startTime).toISOString()} />
        </CollapsibleSection>

        <CollapsibleSection title="Request" copyValue={reqCopy}>
          <FieldRow
            label="Headers"
            value={headersToText(entry.requestHeaders)}
            isCode
            copyValue={headersToText(entry.requestHeaders) || undefined}
          />
          <FieldRow
            label="Body"
            value={prettyJson(entry.requestBody)}
            isCode
            copyValue={entry.requestBody}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Response" copyValue={resCopy}>
          <FieldRow label="Status Code" value={entry.status !== undefined ? String(entry.status) : '—'} />
          <FieldRow
            label="Headers"
            value={headersToText(entry.responseHeaders)}
            isCode
            copyValue={headersToText(entry.responseHeaders) || undefined}
          />
          <FieldRow
            label="Body"
            value={prettyJson(entry.responseBody)}
            isCode
            copyValue={entry.responseBody}
          />
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
    fontSize: 16,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mockButton: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mockButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exportButton: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mockBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  mockBannerText: {
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  fieldRow: {
    gap: 4,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldValue: {
    fontSize: 13,
    lineHeight: 20,
  },
  codeBlock: {
    borderRadius: 6,
    padding: 10,
    marginTop: 2,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  expandButton: {
    marginTop: 8,
    paddingVertical: 4,
  },
  expandButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
