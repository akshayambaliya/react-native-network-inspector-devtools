import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useNetworkLogger } from "../context/NetworkLoggerContext";
import { useTheme } from "../theme";
import type { NetworkMock } from "../types";
import { MockDetailView } from "./MockDetailView";

interface PresetSectionGroup {
  key: string;
  title: string;
  allMocks: NetworkMock[];
  visibleMocks: NetworkMock[];
}

interface Props {
  /** Which mock source to display. Defaults to 'user'. */
  source?: 'user' | 'preset';
  /** Called when the user requests to edit a mock. */
  onEditMock?: (mock: NetworkMock) => void;
}

export const MockListView = ({ source = 'user', onEditMock }: Props) => {
  const { mocks, dispatch } = useNetworkLogger();
  const theme = useTheme();
  const [filter, setFilter] = useState('');
  const [pinnedSectionKeys, setPinnedSectionKeys] = useState<string[]>([]);

  // Filter to only the relevant source for this view.
  const sourceMocks = mocks.filter((m) =>
    source === 'preset' ? m.source === 'preset' : m.source !== 'preset'
  );

  const normalizedFilter = filter.trim().toLowerCase();
  const filtered = normalizedFilter
    ? sourceMocks.filter((mock) => {
      const variantNames = (mock.variants ?? []).map((variant) => variant.name).join(' ');
      const haystack = `${mock.method} ${mock.urlPattern} ${variantNames}`.toLowerCase();
      return haystack.includes(normalizedFilter);
    })
    : sourceMocks;

  // Pinned mocks float to the top; order within each group is preserved.
  const visibleMocks = [
    ...filtered.filter((m) => m.pinned),
    ...filtered.filter((m) => !m.pinned),
  ];

  const presetSectionGroups = new Map<string, PresetSectionGroup>();
  if (source === 'preset') {
    for (const mock of sourceMocks) {
      if (!mock.sectionKey || !mock.sectionTitle) continue;

      const existing = presetSectionGroups.get(mock.sectionKey);
      if (existing) {
        existing.allMocks.push(mock);
      } else {
        presetSectionGroups.set(mock.sectionKey, {
          key: mock.sectionKey,
          title: mock.sectionTitle,
          allMocks: [mock],
          visibleMocks: [],
        });
      }
    }

    for (const mock of visibleMocks) {
      if (!mock.sectionKey || !mock.sectionTitle) continue;

      const section = presetSectionGroups.get(mock.sectionKey);
      if (section) {
        section.visibleMocks.push(mock);
      }
    }
  }

  const allPresetsEnabled =
    source === 'preset' && sourceMocks.length > 0 && sourceMocks.every((mock) => mock.enabled);

  const presetBlocks: Array<{ type: 'row'; mock: NetworkMock } | { type: 'section'; section: PresetSectionGroup }> = [];
  if (source === 'preset') {
    const renderedSections = new Set<string>();

    for (const mock of visibleMocks) {
      if (mock.sectionKey && mock.sectionTitle) {
        if (renderedSections.has(mock.sectionKey)) continue;

        const section = presetSectionGroups.get(mock.sectionKey);
        if (section && section.visibleMocks.length > 0) {
          presetBlocks.push({ type: 'section', section });
          renderedSections.add(mock.sectionKey);
        }
        continue;
      }

      presetBlocks.push({ type: 'row', mock });
    }
  }

  const orderedPresetBlocks =
    source === 'preset'
      ? [
          ...presetBlocks.filter(
            (block) =>
              block.type === 'section' && pinnedSectionKeys.includes(block.section.key)
          ),
          ...presetBlocks.filter(
            (block) =>
              block.type !== 'section' || !pinnedSectionKeys.includes(block.section.key)
          ),
        ]
      : [];

  // ID of the currently selected mock. We look it up live from `mocks` so
  // that toggle changes made inside MockDetailView are immediately reflected.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMock = selectedId
    ? (mocks.find((m) => m.id === selectedId) ?? null)
    : null;

  if (selectedMock) {
    return (
      <MockDetailView
        mock={selectedMock}
        onBack={() => setSelectedId(null)}
        onEdit={onEditMock ?? undefined}
      />
    );
  }

  if (sourceMocks.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>{source === 'preset' ? '📦' : '🎭'}</Text>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {source === 'preset' ? 'No presets loaded' : 'No mocks yet'}
        </Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          {source === 'preset'
            ? 'Pass initialMocks as a flat list or section list to pre-load preset rules.'
            : 'Add a mock rule from the "Add Mock" tab or tap "Mock" on any log entry.'}
        </Text>
      </View>
    );
  }

  const renderRow = (mock: NetworkMock) => {
    const isPreset = mock.source === 'preset';
    const isPinned = mock.pinned === true;
    const safeStatus = mock.status ?? 0;
    const statusColor =
      safeStatus >= 200 && safeStatus < 300
        ? theme.success
        : safeStatus >= 400
          ? theme.danger
          : theme.warning;
    return (
      <TouchableOpacity
        key={mock.id}
        style={[
          styles.mockRow,
          {
            borderColor: isPinned ? theme.primary : theme.border,
            backgroundColor: theme.surface,
          },
        ]}
        onPress={() => setSelectedId(mock.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${mock.urlPattern ?? 'mock'}`}
      >
        <View style={styles.mockInfo}>
          <View style={styles.badgeRow}>
            <View
              style={[styles.methodBadge, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.methodBadgeText}>{mock.method || '—'}</Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColor }]}
            >
              <Text style={styles.statusBadgeText}>{safeStatus || '—'}</Text>
            </View>
            {isPreset && (
              <View style={styles.presetBadge}>
                <Text style={styles.presetBadgeText}>PRESET</Text>
              </View>
            )}
            {!mock.enabled && (
              <View
                style={[styles.disabledBadge, { borderColor: theme.border }]}
              >
                <Text
                  style={[
                    styles.disabledBadgeText,
                    { color: theme.textSecondary },
                  ]}
                >
                  DISABLED
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.mockUrl, { color: theme.text }]}
            numberOfLines={2}
          >
            {mock.urlPattern || '—'}
          </Text>

          {/* Variant switcher — only shown when the mock has more than one variant */}
          {(mock.variants?.length ?? 0) > 1 && (
            <View style={styles.variantChips}>
              {mock.variants!.map((v) => {
                const isActive = v.id === mock.activeVariantId;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.variantChip,
                      isActive
                        ? { backgroundColor: theme.primary }
                        : { borderColor: theme.border, borderWidth: 1 },
                    ]}
                    onPress={() =>
                      dispatch({
                        type: 'SET_MOCK_VARIANT',
                        payload: { mockId: mock.id, variantId: v.id },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${isActive ? 'Active' : 'Switch to'} ${v.name} variant`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[
                        styles.variantChipText,
                        { color: isActive ? '#FFFFFF' : theme.textSecondary },
                      ]}
                    >
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {/* Pin / Unpin button — sits at the top of the actions column */}
          <TouchableOpacity
            onPress={() =>
              dispatch({ type: 'TOGGLE_MOCK_PIN', payload: mock.id })
            }
            style={[
              styles.pinButton,
              isPinned
                ? { backgroundColor: theme.primary }
                : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isPinned ? `Unpin mock for ${mock.urlPattern}` : `Pin mock for ${mock.urlPattern} to top`}
            accessibilityState={{ selected: isPinned }}
          >
            <Text style={[styles.pinButtonText, { color: isPinned ? '#FFFFFF' : theme.textSecondary }]}>
              📌
            </Text>
          </TouchableOpacity>

          {/*
           * iOS 26 "Liquid Glass" UISwitch is significantly larger than older
           * versions. Wrapping in a fixed-size container and applying a scale
           * transform normalises the visual and layout footprint across all
           * iOS versions without any Platform guards.
           */}
          <View style={styles.switchWrapper}>
            <Switch
              value={mock.enabled}
              onValueChange={() =>
                dispatch({ type: 'TOGGLE_MOCK', payload: mock.id })
              }
              trackColor={{ false: '#767577', true: theme.primary }}
              style={styles.switch}
              accessibilityLabel={`Toggle mock for ${mock.urlPattern}`}
              accessibilityRole="switch"
            />
          </View>
          {!isPreset && (
            <TouchableOpacity
              onPress={() =>
                dispatch({ type: 'REMOVE_MOCK', payload: mock.id })
              }
              style={[styles.deleteButton, { backgroundColor: theme.danger }]}
              accessibilityRole="button"
              accessibilityLabel={`Delete mock for ${mock.urlPattern}`}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>
            ›
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (section: PresetSectionGroup) => {
    const enabledCount = section.allMocks.filter((mock) => mock.enabled).length;
    const allSectionEnabled = section.allMocks.length > 0 && enabledCount === section.allMocks.length;
    const isSectionPinned = pinnedSectionKeys.includes(section.key);
    const visibleCount = section.visibleMocks.length;
    const totalCount = section.allMocks.length;
    const countLabel =
      visibleCount === totalCount
        ? `${totalCount} preset${totalCount === 1 ? '' : 's'}`
        : `${visibleCount} of ${totalCount} presets shown`;

    return (
      <View
        key={`section:${section.key}`}
        style={[styles.sectionBlock, { borderColor: theme.border }]}
      >
        <View style={[styles.sectionHeader, { backgroundColor: theme.surface }]}>
          <View style={styles.sectionHeaderTextWrap}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              {countLabel} • {enabledCount} enabled
            </Text>
          </View>
          <View style={styles.sectionHeaderActions}>
            <TouchableOpacity
              onPress={() =>
                setPinnedSectionKeys((prev) =>
                  prev.includes(section.key)
                    ? prev.filter((key) => key !== section.key)
                    : [section.key, ...prev]
                )
              }
              style={[
                styles.sectionPinButton,
                isSectionPinned
                  ? { backgroundColor: theme.primary }
                  : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isSectionPinned ? `Unpin preset section ${section.title}` : `Pin preset section ${section.title} to top`}
              accessibilityState={{ selected: isSectionPinned }}
            >
              <Text style={[styles.sectionPinButtonText, { color: isSectionPinned ? '#FFFFFF' : theme.textSecondary }]}>📌</Text>
            </TouchableOpacity>

            <View style={styles.switchWrapper}>
            <Switch
              value={allSectionEnabled}
              onValueChange={(enabled) =>
                dispatch({
                  type: 'SET_PRESET_SECTION_ENABLED',
                  payload: { sectionKey: section.key, enabled },
                })
              }
              trackColor={{ false: '#767577', true: theme.primary }}
              style={styles.switch}
              accessibilityLabel={`Toggle preset section ${section.title}`}
              accessibilityRole="switch"
            />
            </View>
          </View>
        </View>

        <View style={styles.sectionRows}>
          {section.visibleMocks.map(renderRow)}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {source === 'preset' && sourceMocks.length > 0 && (
        <View style={styles.controls}>
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
            placeholder="Search by method, URL or variant…"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Search presets"
          />

          <View style={[styles.bulkToggleRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.bulkToggleTextWrap}>
              <Text style={[styles.bulkToggleTitle, { color: theme.text }]}>All Presets</Text>
              <Text style={[styles.bulkToggleSubtitle, { color: theme.textSecondary }]}>
                {sourceMocks.length} preset{sourceMocks.length === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.switchWrapper}>
              <Switch
                value={allPresetsEnabled}
                onValueChange={(enabled) =>
                  dispatch({
                    type: 'SET_SOURCE_MOCKS_ENABLED',
                    payload: { source: 'preset', enabled },
                  })
                }
                trackColor={{ false: '#767577', true: theme.primary }}
                style={styles.switch}
                accessibilityLabel="Toggle all presets"
                accessibilityRole="switch"
              />
            </View>
          </View>
        </View>
      )}

      {visibleMocks.length === 0 ? (
        <View style={styles.emptyFiltered}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No preset matches</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Try a different method, URL or variant name.</Text>
        </View>
      ) : (
        source === 'preset'
          ? orderedPresetBlocks.map((block) =>
            block.type === 'section' ? renderSection(block.section) : renderRow(block.mock)
          )
          : visibleMocks.map(renderRow)
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: 12,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 4,
  },
  controls: {
    gap: 8,
    marginBottom: 8,
  },
  sectionBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  sectionHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionPinButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionPinButtonText: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 11,
  },
  sectionRows: {
    padding: 8,
    paddingBottom: 4,
    width: '100%',
  },
  searchInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  bulkToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  bulkToggleTextWrap: {
    flex: 1,
    gap: 2,
  },
  bulkToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  bulkToggleSubtitle: {
    fontSize: 11,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  emptyFiltered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  mockRow: {
    flexDirection: "row",
    // flex-start so the actions column pins to the top of the row;
    // this looks clean whether the URL is 1 or 2 lines.
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginBottom: 4,
  },
  mockInfo: { flex: 1, gap: 4, minWidth: 0 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  methodBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  methodBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  presetBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#7C3AED",
  },
  presetBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  disabledBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  disabledBadgeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  mockUrl: {
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  pinButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  pinButtonText: {
    fontSize: 14,
  },
  chevron: {
    fontSize: 20,
    fontWeight: "300",
    marginLeft: 2,
  },
  variantChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: '100%',
    gap: 4,
    marginTop: 6,
  },
  variantChip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'flex-start',
  },
  variantChipText: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  /**
   * Provides a stable layout box for the Switch so the larger iOS 26
   * "Liquid Glass" toggle doesn't push neighbouring elements around.
   * The scaleX/scaleY transform shrinks the rendered switch to a size
   * consistent with the pre-iOS-26 UISwitch dimensions.
   */
  switchWrapper: {
    width: 52,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switch: {
    transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }],
  },
});
