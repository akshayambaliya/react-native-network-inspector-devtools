import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useNetworkLogger } from '../context/NetworkLoggerContext';
import { useTheme } from '../theme';
import type { NetworkMock } from '../types';

interface Props {
  mock: NetworkMock;
  onBack: () => void;
  /** Called when the user clicks the Edit button. Only provided for user mocks. */
  onEdit?: (mock: NetworkMock) => void;
}

/**
 * Converts any runtime value to a human-readable, pretty-printed string.
 * Handles all cases that can occur at runtime even when TypeScript types say `string`:
 * - null / undefined        → ''
 * - empty / whitespace-only → ''
 * - plain object / array    → JSON.stringify (already parsed by axios)
 * - JSON string             → pretty-printed JSON
 * - non-JSON string         → returned as-is
 */
const prettyPrint = (value: unknown): string => {
  if (value == null) return '';
  // Already a parsed object/array (e.g. axios auto-parsed the response)
  if (typeof value === 'object') {
    try {
      const result = JSON.stringify(value, null, 2);
      return typeof result === 'string' ? result : '';
    } catch {
      return '';
    }
  }
  const str = typeof value === 'string' ? value : String(value);
  if (!str.trim()) return '';
  try {
    const result = JSON.stringify(JSON.parse(str), null, 2);
    return typeof result === 'string' ? result : str;
  } catch {
    // Not JSON — return as plain text
    return str;
  }
};

export const MockDetailView = ({ mock, onBack, onEdit }: Props) => {
  const { dispatch } = useNetworkLogger();
  const theme = useTheme();

  const isPreset = mock.source === 'preset';
  const isUserMock = mock.source === 'user';
  const canEdit = isUserMock && !!onEdit;
  const prettyBody = prettyPrint(mock.responseBody);
  const safeStatus = mock.status ?? 0;
  const matchType = mock.matchType ?? 'contains';
  const hasHeaders =
    mock.responseHeaders != null && Object.keys(mock.responseHeaders).length > 0;
  const delayLabel =
    mock.delay && mock.delay > 0
      ? mock.delay >= 1000
        ? `${(mock.delay / 1000).toFixed(mock.delay % 1000 === 0 ? 0 : 1)}s delay`
        : `${mock.delay}ms delay`
      : null;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to mock list"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.backText, { color: theme.primary }]}>‹ Mocks</Text>
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.text }]}>Mock Details</Text>

        <View style={styles.headerRight}>
          <Switch
            value={mock.enabled}
            onValueChange={() =>
              dispatch({ type: 'TOGGLE_MOCK', payload: mock.id })
            }
            trackColor={{ false: '#767577', true: theme.primary }}
            accessibilityLabel={`Toggle mock for ${mock.urlPattern}`}
            accessibilityRole="switch"
          />
          {canEdit && (
            <TouchableOpacity
              onPress={() => onEdit!(mock)}
              style={styles.editButton}
              accessibilityRole="button"
              accessibilityLabel={`Edit mock for ${mock.urlPattern}`}
            >
              <Text style={[styles.editButtonText, { color: theme.primary }]}>
                Edit
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity card ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.badgeRow}>
            <View style={[styles.methodBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.methodBadgeText}>{mock.method}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    safeStatus >= 200 && safeStatus < 300
                      ? theme.success
                      : safeStatus >= 400
                      ? theme.danger
                      : theme.warning,
                },
              ]}
            >
              <Text style={styles.statusBadgeText}>{safeStatus || '—'}</Text>
            </View>
            {isPreset ? (
              <View style={styles.presetBadge}>
                <Text style={styles.presetBadgeText}>PRESET</Text>
              </View>
            ) : (
              <View style={[styles.userBadge, { borderColor: theme.border }]}>
                <Text style={[styles.userBadgeText, { color: theme.textSecondary }]}>
                  USER
                </Text>
              </View>
            )}
            {!mock.enabled && (
              <View style={[styles.disabledBadge, { borderColor: theme.border }]}>
                <Text style={[styles.disabledBadgeText, { color: theme.textSecondary }]}>
                  DISABLED
                </Text>
              </View>
            )}
            {delayLabel && (
              <View style={[styles.delayBadge, { borderColor: theme.border }]}>
                <Text style={[styles.delayBadgeText, { color: theme.textSecondary }]}>
                  ⏱ {delayLabel}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            URL PATTERN
          </Text>
          <View style={styles.urlRow}>
            <View style={[styles.matchTypeBadge, { borderColor: theme.border }]}>
              <Text style={[styles.matchTypeBadgeText, { color: theme.textSecondary }]}>
                {matchType.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.urlText, { color: theme.text }]} selectable>
              {mock.urlPattern || '—'}
            </Text>
          </View>
        </View>

        {/* ── Variants ── only rendered when the mock has multiple response scenarios ── */}
        {(mock.variants?.length ?? 0) > 1 && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              VARIANTS
            </Text>
            <Text style={[styles.variantHint, { color: theme.textSecondary }]}>
              Tap a variant to switch its response. Changes take effect immediately on the next
              matching request.
            </Text>
            {mock.variants!.map((v, index) => {
              const isActive = v.id === mock.activeVariantId;
              const vStatus = v.status ?? 0;
              const statusColor =
                vStatus >= 200 && vStatus < 300
                  ? theme.success
                  : vStatus >= 400
                  ? theme.danger
                  : theme.warning;
              // Compact inline body preview (strip whitespace so it fits on 1–2 lines)
              const bodyPreview = prettyPrint(v.responseBody)
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 80);
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.variantRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.border,
                    },
                  ]}
                  onPress={() =>
                    dispatch({
                      type: 'SET_MOCK_VARIANT',
                      payload: { mockId: mock.id, variantId: v.id },
                    })
                  }
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${v.name} variant, status ${vStatus}${
                    isActive ? ', currently active' : ''
                  }`}
                >
                  {/* Radio selector */}
                  <View
                    style={[
                      styles.variantRadio,
                      isActive
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { borderColor: theme.border },
                    ]}
                  >
                    {isActive && (
                      <Text style={styles.variantRadioCheck}>✓</Text>
                    )}
                  </View>

                  {/* Name + body preview */}
                  <View style={styles.variantInfo}>
                    <Text
                      style={[
                        styles.variantName,
                        { color: isActive ? theme.primary : theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {v.name}
                    </Text>
                    {v.delay && v.delay > 0 ? (
                      <Text style={[styles.variantDelay, { color: theme.textSecondary }]}>
                        ⏱{
                          v.delay >= 1000
                            ? `${(v.delay / 1000).toFixed(v.delay % 1000 === 0 ? 0 : 1)}s`
                            : `${v.delay}ms`
                        } delay
                      </Text>
                    ) : null}
                    {bodyPreview ? (
                      <Text
                        style={[styles.variantPreview, { color: theme.textSecondary }]}
                        numberOfLines={2}
                      >
                        {bodyPreview}
                      </Text>
                    ) : null}
                  </View>

                  {/* Status badge */}
                  <View style={[styles.variantStatus, { backgroundColor: statusColor }]}>
                    <Text style={styles.variantStatusText}>{vStatus || '—'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Response Headers ── */}
        {hasHeaders && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              RESPONSE HEADERS
            </Text>
            {Object.entries(mock.responseHeaders!).map(([key, value]) => (
              <View
                key={key}
                style={[styles.headerRow, { borderTopColor: theme.border }]}
              >
                <Text
                  style={[styles.headerKey, { color: theme.primary }]}
                  selectable
                  numberOfLines={1}
                >
                  {key}
                </Text>
                <Text
                  style={[styles.headerValue, { color: theme.text }]}
                  selectable
                  numberOfLines={2}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Response Body ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            RESPONSE BODY
          </Text>
          <View style={[styles.codeBlock, { backgroundColor: theme.codeBg }]}>
            <Text style={[styles.codeText, { color: theme.codeText }]} selectable>
              {prettyBody || '(empty)'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    paddingRight: 8,
    paddingVertical: 4,
    minWidth: 64,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  headerRight: {
    minWidth: 64,
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  methodBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  methodBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  presetBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#7C3AED',
  },
  presetBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  userBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  userBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  disabledBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  disabledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  delayBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  delayBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
  },
  matchTypeBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  matchTypeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  urlText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  headerRow: {
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  headerKey: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerValue: {
    fontSize: 12,
    lineHeight: 17,
  },
  variantHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  variantRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  variantRadioCheck: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  variantInfo: {
    flex: 1,
    gap: 3,
  },
  variantName: {
    fontSize: 14,
    fontWeight: '600',
  },
  variantDelay: {
    fontSize: 11,
    fontWeight: '500',
  },
  variantPreview: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 15,
  },
  variantStatus: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  variantStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  codeBlock: {
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
