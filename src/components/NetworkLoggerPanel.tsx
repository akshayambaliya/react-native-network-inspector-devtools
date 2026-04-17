import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useNetworkLogger } from '../context/NetworkLoggerContext';
import { useTheme } from '../theme';
import type { NetworkLogEntry } from '../types';
import { LogDetailView } from './LogDetailView';
import { LogRow } from './LogRow';
import { MockEditor, type MockPrefill } from './MockEditor';
import { MockListView } from './MockListView';
import { PresetImporter } from './PresetImporter';

type Tab = 'logs' | 'add-mock' | 'my-mocks' | 'presets';

const PingDot = ({ color }: { color: string }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.75,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [opacity, scale]);

  return (
    <View style={styles.pingWrapper}>
      <Animated.View
        style={[
          styles.pingRipple,
          { backgroundColor: color, transform: [{ scale }], opacity },
        ]}
      />
      <View style={[styles.pingDot, { backgroundColor: color }]} />
    </View>
  );
};

export const NetworkLoggerPanel = () => {
  const { isVisible, entries, mocks, selectedEntry, dispatch } = useNetworkLogger();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('logs');
  const [mockPrefill, setMockPrefill] = useState<MockPrefill | undefined>(undefined);
  const [filter, setFilter] = useState('');

  const filteredEntries = filter.trim()
    ? entries.filter(
        (e) =>
          e.url.toLowerCase().includes(filter.toLowerCase()) ||
          e.method.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  // Active-dot logic: a tab shows a dot when ≥1 enabled mock exists in its category.
  const hasActiveUserMocks = mocks.some((m) => m.source !== 'preset' && m.enabled);
  const hasActivePresets = mocks.some((m) => m.source === 'preset' && m.enabled);

  const handleClose = () => dispatch({ type: 'SET_VISIBLE', payload: false });

  const handleClear = () => {
    dispatch({ type: 'CLEAR_ENTRIES' });
    dispatch({ type: 'SET_SELECTED_ENTRY', payload: null });
  };

  const handleSelectEntry = (entry: NetworkLogEntry) =>
    dispatch({ type: 'SET_SELECTED_ENTRY', payload: entry.id });

  const handleBack = () => dispatch({ type: 'SET_SELECTED_ENTRY', payload: null });

  const handleMock = (prefill: MockPrefill) => {
    dispatch({ type: 'SET_SELECTED_ENTRY', payload: null });
    setMockPrefill(prefill);
    setActiveTab('add-mock');
  };
  const renderLogs = () => {
    if (selectedEntry) {
      return (
        <LogDetailView
          entry={selectedEntry}
          onBack={handleBack}
          onMock={handleMock}
        />
      );
    }
    return (
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
          placeholder="Filter by URL or method…"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Filter log entries"
        />
        {filteredEntries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon]}>📡</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {entries.length === 0 ? 'No requests yet' : 'No matches'}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {entries.length === 0
                ? 'Network requests will appear here once captured.'
                : 'Try a different URL or method filter.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredEntries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <LogRow entry={item} onPress={() => handleSelectEntry(item)} />
            )}
            style={{ backgroundColor: theme.background }}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={5}
            removeClippedSubviews
          />
        )}
      </>
    );
  };

  const isLogsTab = activeTab === 'logs';
  const isAddMockTab = activeTab === 'add-mock';
  const isMyMocksTab = activeTab === 'my-mocks';
  const isPresetsTab = activeTab === 'presets';

  const userMockCount = mocks.filter((m) => m.source !== 'preset').length;
  const presetCount = mocks.filter((m) => m.source === 'preset').length;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Dev Tool</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleClear}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Clear all logs"
            >
              <Text style={[styles.clearText, { color: theme.danger }]}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Close network logger"
            >
              <Text style={[styles.closeText, { color: theme.text }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {/* ── Logs ── */}
          <TouchableOpacity
            style={[
              styles.tab,
              { borderBottomColor: isLogsTab ? theme.primary : 'transparent' },
            ]}
            onPress={() => setActiveTab('logs')}
            accessibilityRole="tab"
            accessibilityState={{ selected: isLogsTab }}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: isLogsTab ? theme.primary : theme.textSecondary },
              ]}
            >
              {`Logs (${filter.trim() ? `${filteredEntries.length}/` : ''}${entries.length})`}
            </Text>
          </TouchableOpacity>

          {/* ── Add Mock ── */}
          <TouchableOpacity
            style={[
              styles.tab,
              { borderBottomColor: isAddMockTab ? theme.primary : 'transparent' },
            ]}
            onPress={() => setActiveTab('add-mock')}
            accessibilityRole="tab"
            accessibilityState={{ selected: isAddMockTab }}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: isAddMockTab ? theme.primary : theme.textSecondary },
              ]}
            >
              Add Mock
            </Text>
          </TouchableOpacity>

          {/* ── My Mocks ── */}
          <TouchableOpacity
            style={[
              styles.tab,
              { borderBottomColor: isMyMocksTab ? theme.primary : 'transparent' },
            ]}
            onPress={() => setActiveTab('my-mocks')}
            accessibilityRole="tab"
            accessibilityState={{ selected: isMyMocksTab }}
          >
            <View style={styles.tabLabelWrapper}>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isMyMocksTab ? theme.primary : theme.textSecondary },
                ]}
              >
                {`My Mocks (${userMockCount})`}
              </Text>
              {hasActiveUserMocks && <PingDot color={theme.success} />}
            </View>
          </TouchableOpacity>

          {/* ── Presets ── */}
          <TouchableOpacity
            style={[
              styles.tab,
              { borderBottomColor: isPresetsTab ? theme.primary : 'transparent' },
            ]}
            onPress={() => setActiveTab('presets')}
            accessibilityRole="tab"
            accessibilityState={{ selected: isPresetsTab }}
          >
            <View style={styles.tabLabelWrapper}>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isPresetsTab ? theme.primary : theme.textSecondary },
                ]}
              >
                {`Presets (${presetCount})`}
              </Text>
              {hasActivePresets && <PingDot color={theme.success} />}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activeTab === 'logs' && renderLogs()}
          {activeTab === 'add-mock' && (
            <MockEditor
              prefill={mockPrefill}
              onPrefillConsumed={() => setMockPrefill(undefined)}
              onSaved={() => setActiveTab('my-mocks')}
            />
          )}
          {activeTab === 'my-mocks' && <MockListView source="user" />}
          {activeTab === 'presets' && (
            <>
              <PresetImporter onImport={(presets) => dispatch({ type: 'ADD_PRESETS', payload: presets })} />
              <MockListView source="preset" />
            </>
          )}
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  headerButton: {
    padding: 4,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '400',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  pingWrapper: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingRipple: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  content: {
    flex: 1,
  },
  searchInput: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
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
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
});
