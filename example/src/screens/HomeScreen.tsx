import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import {
  createPost,
  createTodo,
  deletePost,
  getCountry,
  getPokemon,
  getPokemonList,
  getPostById,
  getPosts,
  getTodos,
  getUserById,
  getUsers,
  patchPost,
  postLogin,
  searchCountry,
  updatePost,
} from '../api/endpoints';
import type { DetailScreenParams, DetailScreenType } from './DetailsScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestState = 'idle' | 'loading' | 'success' | 'error';

interface ButtonItem {
  id: string;
  label: string;
  method: string;
  description: string;
  action: () => Promise<any>;
  /** If set, tapping will navigate to DetailsScreen with this type */
  detailType?: DetailScreenType;
}

// ─── Section Header ───────────────────────────────────────────────────────────

const SectionHeader = ({
  title,
  subtitle,
  isDark,
}: {
  title: string;
  subtitle?: string;
  isDark: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#111827' }]}>
      {title}
    </Text>
    {subtitle && (
      <Text style={[styles.sectionSubtitle, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
        {subtitle}
      </Text>
    )}
  </View>
);

// ─── Method Badge ─────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET: { bg: '#DBEAFE', text: '#1D4ED8' },
  POST: { bg: '#EDE9FE', text: '#6D28D9' },
  PUT: { bg: '#FFEDD5', text: '#C2410C' },
  PATCH: { bg: '#FEF3C7', text: '#B45309' },
  DELETE: { bg: '#FEE2E2', text: '#B91C1C' },
};

const MethodBadge = ({ method }: { method: string }) => {
  const colors = METHOD_COLORS[method] ?? { bg: '#E5E7EB', text: '#374151' };
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{method}</Text>
    </View>
  );
};

// ─── API Button ───────────────────────────────────────────────────────────────

const ApiButton = ({
  item,
  isDark,
  onPress,
  onNavigate,
}: {
  item: ButtonItem;
  isDark: boolean;
  onPress: (item: ButtonItem) => void;
  onNavigate?: (params: DetailScreenParams) => void;
}) => {
  const [state, setState] = useState<RequestState>('idle');

  const handlePress = useCallback(async () => {
    if (item.detailType && onNavigate) {
      onNavigate({ type: item.detailType, title: item.label, method: item.method, action: item.action });
      return;
    }
    setState('loading');
    try {
      await onPress(item);
      setState('success');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2500);
    }
  }, [item, onPress, onNavigate]);

  const stateColors: Record<RequestState, string> = {
    idle: isDark ? '#1E293B' : '#FFFFFF',
    loading: isDark ? '#1E293B' : '#FFFFFF',
    success: isDark ? '#14532D' : '#D1FAE5',
    error: isDark ? '#7F1D1D' : '#FEE2E2',
  };

  const isNavigable = !!item.detailType;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.apiButton,
        {
          backgroundColor: stateColors[state],
          borderColor: isDark ? '#334155' : '#E5E7EB',
        },
      ]}
      onPress={handlePress}
      disabled={state === 'loading'}
    >
      <View style={styles.buttonRow}>
        <MethodBadge method={item.method} />
        <View style={styles.buttonContent}>
          <Text
            style={[styles.buttonLabel, { color: isDark ? '#F8FAFC' : '#111827' }]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          <Text
            style={[styles.buttonDesc, { color: isDark ? '#94A3B8' : '#6B7280' }]}
            numberOfLines={1}
          >
            {item.description}
          </Text>
        </View>
        {state === 'loading' && <ActivityIndicator size="small" color="#3B82F6" />}
        {state === 'success' && <Text style={styles.stateIcon}>✓</Text>}
        {state === 'error' && <Text style={[styles.stateIcon, { color: '#EF4444' }]}>✕</Text>}
        {state === 'idle' && isNavigable && (
          <Text style={[styles.navArrow, { color: isDark ? '#60A5FA' : '#3B82F6' }]}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── Info Card ────────────────────────────────────────────────────────────────

const InfoCard = ({ isDark }: { isDark: boolean }) => (
  <View style={[styles.infoCard, { backgroundColor: isDark ? '#0F172A' : '#EFF6FF', borderColor: isDark ? '#1E40AF' : '#BFDBFE' }]}>
    <Text style={[styles.infoTitle, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
      How to use this demo
    </Text>
    <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#374151' }]}>
      1. Tap any button to fire a real HTTP request.{'\n'}
      2. The floating{' '}
      <Text style={{ fontWeight: '700' }}>🌐 FAB</Text> appears at bottom-right — tap it to open the logger panel.{'\n'}
      3. Switch between{' '}
      <Text style={{ fontWeight: '700' }}>Logs</Text>,{' '}
      <Text style={{ fontWeight: '700' }}>My Mocks</Text>, and{' '}
      <Text style={{ fontWeight: '700' }}>Presets</Text> tabs.{'\n'}
      4. In <Text style={{ fontWeight: '700' }}>Presets</Text>, enable a mock and switch its{' '}
      <Text style={{ fontWeight: '700' }}>variant</Text> (Success / Error / Slow…).{'\n'}
      5. Fire the same request again — the mocked response is returned instantly.
    </Text>
  </View>
);

// ─── Home Screen ──────────────────────────────────────────────────────────────

export const HomeScreen = ({ onNavigate }: { onNavigate?: (params: DetailScreenParams) => void }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bg = isDark ? '#0F172A' : '#F4F6F8';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';

  // handleRequest is used only for non-navigable buttons (DELETE, PATCH, PUT, etc.)
  const handleRequest = useCallback(async (item: ButtonItem) => {
    await item.action();
  }, []);

  // ─── Button groups ────────────────────────────────────────────────────────

  const crudButtons: ButtonItem[] = [
    {
      id: 'get-posts',
      label: 'Fetch Posts',
      method: 'GET',
      description: 'jsonplaceholder.typicode.com/posts',
      action: getPosts,
      detailType: 'posts-list' as DetailScreenType,
    },
    {
      id: 'get-post-1',
      label: 'Get Post #1',
      method: 'GET',
      description: 'jsonplaceholder.typicode.com/posts/1',
      action: () => getPostById(1),
      detailType: 'posts-list' as DetailScreenType,
    },
    {
      id: 'create-post',
      label: 'Create Post',
      method: 'POST',
      description: 'jsonplaceholder.typicode.com/posts',
      action: createPost,
      detailType: 'post-create' as DetailScreenType,
    },
    {
      id: 'update-post',
      label: 'Update Post (PUT)',
      method: 'PUT',
      description: 'jsonplaceholder.typicode.com/posts/1',
      action: () => updatePost(1),
    },
    {
      id: 'patch-post',
      label: 'Patch Post Title',
      method: 'PATCH',
      description: 'jsonplaceholder.typicode.com/posts/1',
      action: () => patchPost(1),
    },
    {
      id: 'delete-post',
      label: 'Delete Post',
      method: 'DELETE',
      description: 'jsonplaceholder.typicode.com/posts/1',
      action: () => deletePost(1),
    },
  ];

  const userButtons: ButtonItem[] = [
    {
      id: 'get-users',
      label: 'Get All Users',
      method: 'GET',
      description: 'jsonplaceholder.typicode.com/users',
      action: getUsers,
      detailType: 'users-list' as DetailScreenType,
    },
    {
      id: 'get-user-1',
      label: 'Get User #1',
      method: 'GET',
      description: 'jsonplaceholder.typicode.com/users/1',
      action: () => getUserById(1),
      detailType: 'users-list' as DetailScreenType,
    },
    {
      id: 'post-login',
      label: 'Simulate Login (POST)',
      method: 'POST',
      description: 'Returns JWT on success — try variants!',
      action: postLogin,
      detailType: 'auth' as DetailScreenType,
    },
  ];

  const todoButtons: ButtonItem[] = [
    {
      id: 'get-todos',
      label: 'Get Todos',
      method: 'GET',
      description: 'jsonplaceholder.typicode.com/todos',
      action: getTodos,
      detailType: 'todos' as DetailScreenType,
    },
    {
      id: 'create-todo',
      label: 'Create Todo',
      method: 'POST',
      description: 'jsonplaceholder.typicode.com/todos',
      action: createTodo,
    },
  ];

  const pokeButtons: ButtonItem[] = [
    {
      id: 'get-pikachu',
      label: 'Get Pikachu',
      method: 'GET',
      description: 'pokeapi.co — exact match mock available',
      action: () => getPokemon('pikachu'),
      detailType: 'pokemon' as DetailScreenType,
    },
    {
      id: 'get-charizard',
      label: 'Get Charizard',
      method: 'GET',
      description: 'pokeapi.co/api/v2/pokemon/charizard',
      action: () => getPokemon('charizard'),
      detailType: 'pokemon' as DetailScreenType,
    },
    {
      id: 'list-pokemon',
      label: 'List Pokémon (Top 5)',
      method: 'GET',
      description: 'pokeapi.co/api/v2/pokemon?limit=5',
      action: getPokemonList,
    },
  ];

  const countryButtons: ButtonItem[] = [
    {
      id: 'get-india',
      label: 'Get India (IN)',
      method: 'GET',
      description: 'restcountries.com — regex mock: IN|US|GB',
      action: () => getCountry('IN'),
      detailType: 'country' as DetailScreenType,
    },
    {
      id: 'get-usa',
      label: 'Get USA (US)',
      method: 'GET',
      description: 'restcountries.com/v3.1/alpha/US',
      action: () => getCountry('US'),
      detailType: 'country' as DetailScreenType,
    },
    {
      id: 'search-country',
      label: 'Search "Japan"',
      method: 'GET',
      description: 'restcountries.com/v3.1/name/japan',
      action: () => searchCountry('japan'),
      detailType: 'country' as DetailScreenType,
    },
  ];

  const renderGroup = (buttons: ButtonItem[]) =>
    buttons.map((btn) => (
      <ApiButton key={btn.id} item={btn} isDark={isDark} onPress={handleRequest} onNavigate={onNavigate} />
    ));

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* ── App Header ── */}
      <View style={[styles.header, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderBottomColor: isDark ? '#334155' : '#E5E7EB' }]}>
        <View>
          <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#111827' }]}>
            NetworkLogger Demo
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            react-native-network-inspector-devtools
          </Text>
        </View>
        <View style={styles.headerBadges}>
          <View style={[styles.liveBadge, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: isDark ? '#6EE7B7' : '#065F46' }]}>LIVE</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
      >

        {/* Section 1: CRUD — Posts */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
          <SectionHeader
            title="📝  Posts — Full CRUD"
            subtitle="All 5 HTTP methods via JSONPlaceholder"
            isDark={isDark}
          />
          {renderGroup(crudButtons)}
        </View>

        {/* Section 2: Users + Auth */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
          <SectionHeader
            title="👤  Users & Auth"
            subtitle="GET users list · Simulated login with mock variants"
            isDark={isDark}
          />
          {renderGroup(userButtons)}
        </View>

        {/* Section 3: Todos */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
          <SectionHeader
            title="✅  Todos"
            subtitle="GET + POST · Enable mock to switch to 'All Completed'"
            isDark={isDark}
          />
          {renderGroup(todoButtons)}
        </View>

        {/* Section 4: PokéAPI — Multiple instances */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
          <SectionHeader
            title="⚡  Pokémon (2nd axios instance)"
            subtitle="pokeapi.co · Exact-match mock for Pikachu"
            isDark={isDark}
          />
          {renderGroup(pokeButtons)}
        </View>

        {/* Section 5: REST Countries — Regex mock */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
          <SectionHeader
            title="🌍  Countries (3rd axios instance)"
            subtitle="restcountries.com · Regex mock matches IN | US | GB"
            isDark={isDark}
          />
          {renderGroup(countryButtons)}
        </View>

        {/* Demo tip card */}
        <View style={[styles.tipCard, { backgroundColor: isDark ? '#1C1A00' : '#FFFBEB', borderColor: isDark ? '#B45309' : '#FDE68A' }]}>
          <Text style={[styles.tipTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>
            🎬  Recording Tips
          </Text>
          <Text style={[styles.tipText, { color: isDark ? '#FDE68A' : '#78350F' }]}>
            • Open the panel (FAB button) and browse the{' '}<Text style={{ fontWeight: '700' }}>Logs tab</Text> to show real requests.{'\n'}
            • Go to <Text style={{ fontWeight: '700' }}>Presets tab</Text>, enable "Posts GET" mock, then tap "Fetch Posts" — shows mocked response.{'\n'}
            • Switch mock variant to{' '}<Text style={{ fontWeight: '700' }}>"Slow Response (3s)"</Text> and fire again — watch the spinner.{'\n'}
            • Enable the login mock, try{' '}<Text style={{ fontWeight: '700' }}>"Wrong Credentials"</Text> variant.{'\n'}
            • Long-press a log entry to <Text style={{ fontWeight: '700' }}>create a mock from it</Text>.{'\n'}
            • Drag the FAB anywhere on screen.
          </Text>
        </View>

        {/* Footer */}
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              'https://github.com/akshayambaliya/react-native-network-inspector-devtools',
            )
          }
        >
          <Text
            style={[styles.footerLink, { color: isDark ? '#60A5FA' : '#2563EB' }]}
          >
            github.com/akshayambaliya/react-native-network-inspector-devtools
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  headerBadges: {
    alignItems: 'flex-end',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scroll: {
    padding: 12,
    gap: 12,
  },
  // Info card
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  // Section cards
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // API button
  apiButton: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonContent: {
    flex: 1,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  stateIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22C55E',
  },
  navArrow: {
    fontSize: 22,
    fontWeight: '300',
  },
  // Method badge
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 54,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // Tip card
  tipCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 21,
  },
  // Footer
  footerLink: {
    fontSize: 12,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 8,
    marginBottom: 4,
  },
});
