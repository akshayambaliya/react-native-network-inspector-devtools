import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DetailScreenType =
  | 'posts-list'
  | 'post-create'
  | 'todos'
  | 'auth'
  | 'pokemon'
  | 'country'
  | 'users-list';

export interface DetailScreenParams {
  type: DetailScreenType;
  title: string;
  method: string;
  action: () => Promise<any>;
}

interface Props extends DetailScreenParams {
  onBack: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET: { bg: '#DBEAFE', text: '#1D4ED8' },
  POST: { bg: '#EDE9FE', text: '#6D28D9' },
  PUT: { bg: '#FFEDD5', text: '#C2410C' },
  PATCH: { bg: '#FEF3C7', text: '#B45309' },
  DELETE: { bg: '#FEE2E2', text: '#B91C1C' },
};

const TYPE_COLORS: Record<string, string> = {
  fire: '#F97316',
  water: '#3B82F6',
  electric: '#EAB308',
  grass: '#22C55E',
  poison: '#A855F7',
  flying: '#60A5FA',
  psychic: '#EC4899',
  bug: '#84CC16',
  rock: '#78716C',
  ground: '#D97706',
  ice: '#67E8F9',
  fighting: '#EF4444',
  ghost: '#7C3AED',
  dragon: '#7C3AED',
  dark: '#374151',
  steel: '#9CA3AF',
  fairy: '#F9A8D4',
  normal: '#9CA3AF',
};

function parseData(raw: any): any {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MethodBadge = ({ method, small }: { method: string; small?: boolean }) => {
  const c = METHOD_COLORS[method] ?? { bg: '#E5E7EB', text: '#374151' };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text, fontSize: small ? 9 : 11 }]}>
        {method}
      </Text>
    </View>
  );
};

const StatusBadge = ({ code }: { code: number }) => {
  const isOk = code >= 200 && code < 300;
  const isClientErr = code >= 400 && code < 500;
  const bg = isOk ? '#D1FAE5' : isClientErr ? '#FEF3C7' : '#FEE2E2';
  const color = isOk ? '#065F46' : isClientErr ? '#92400E' : '#991B1B';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{code}</Text>
    </View>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ isDark, message }: { isDark: boolean; message?: string }) => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyEmoji}>📭</Text>
    <Text style={[styles.emptyTitle, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
      No data found
    </Text>
    <Text style={[styles.emptyMessage, { color: isDark ? '#64748B' : '#9CA3AF' }]}>
      {message ?? 'The response came back empty. Try switching the mock variant!'}
    </Text>
  </View>
);

// ─── Error State ──────────────────────────────────────────────────────────────

const ErrorState = ({
  isDark,
  status,
  message,
  fields,
  onRetry,
}: {
  isDark: boolean;
  status: number | string;
  message: string;
  fields?: Record<string, string>;
  onRetry: () => void;
}) => {
  const isAuth = status === 401 || status === 403;
  const isRateLimit = status === 429;
  const isValidation = status === 422;

  const emoji = isAuth ? '🔐' : isRateLimit ? '⏱️' : isValidation ? '⚠️' : '❌';
  const title =
    status === 401
      ? 'Authentication Failed'
      : status === 403
      ? 'Access Forbidden'
      : status === 404
      ? 'Not Found'
      : status === 422
      ? 'Validation Error'
      : status === 429
      ? 'Too Many Requests'
      : status === 503
      ? 'Service Unavailable'
      : `Error ${status}`;

  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <View style={styles.errorStatusRow}>
        <StatusBadge code={Number(status)} />
        <Text style={[styles.errorTitle, { color: isDark ? '#F87171' : '#B91C1C' }]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.errorMessage, { color: isDark ? '#CBD5E1' : '#374151' }]}>
        {message}
      </Text>
      {fields && (
        <View style={[styles.fieldsCard, { backgroundColor: isDark ? '#1E293B' : '#FEF3C7', borderColor: isDark ? '#334155' : '#FDE68A' }]}>
          {Object.entries(fields).map(([k, v]) => (
            <Text key={k} style={[styles.fieldRow, { color: isDark ? '#FCD34D' : '#92400E' }]}>
              • <Text style={{ fontWeight: '700' }}>{k}</Text>: {v}
            </Text>
          ))}
        </View>
      )}
      {isRateLimit && (
        <View style={[styles.fieldsCard, { backgroundColor: isDark ? '#1E293B' : '#FFFBEB', borderColor: isDark ? '#92400E' : '#FDE68A' }]}>
          <Text style={[styles.fieldRow, { color: isDark ? '#FCD34D' : '#92400E' }]}>
            Retry after <Text style={{ fontWeight: '700' }}>60 seconds</Text>
          </Text>
        </View>
      )}
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryBtnText}>↻  Retry</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Posts List UI ────────────────────────────────────────────────────────────

const PostsList = ({ data, isDark }: { data: any[]; isDark: boolean }) => (
  <>
    <Text style={[styles.resultLabel, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
      {data.length} post{data.length !== 1 ? 's' : ''} returned
    </Text>
    {data.map((post: any) => (
      <View
        key={post.id}
        style={[styles.postCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB' }]}
      >
        <View style={styles.postHeader}>
          <View style={[styles.postIdBadge, { backgroundColor: isDark ? '#334155' : '#EFF6FF' }]}>
            <Text style={[styles.postIdText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
              #{post.id}
            </Text>
          </View>
          <View style={[styles.userChip, { backgroundColor: isDark ? '#292524' : '#FEF3C7' }]}>
            <Text style={[styles.userChipText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
              user {post.userId}
            </Text>
          </View>
        </View>
        <Text style={[styles.postTitle, { color: isDark ? '#F1F5F9' : '#111827' }]}>
          {post.title}
        </Text>
        <Text style={[styles.postBody, { color: isDark ? '#94A3B8' : '#6B7280' }]} numberOfLines={3}>
          {post.body}
        </Text>
      </View>
    ))}
  </>
);

// ─── Post Create UI ───────────────────────────────────────────────────────────

const PostCreate = ({ data, isDark }: { data: any; isDark: boolean }) => (
  <View
    style={[styles.successCard, { backgroundColor: isDark ? '#134E4A' : '#F0FDF4', borderColor: isDark ? '#0D9488' : '#86EFAC' }]}
  >
    <View style={styles.successHeader}>
      <Text style={styles.successEmoji}>✅</Text>
      <View>
        <Text style={[styles.successTitle, { color: isDark ? '#6EE7B7' : '#065F46' }]}>
          Post Created Successfully
        </Text>
        <Text style={[styles.successSub, { color: isDark ? '#34D399' : '#059669' }]}>
          ID: {data.id}  ·  User: {data.userId}
        </Text>
      </View>
    </View>
    <View style={[styles.divider, { backgroundColor: isDark ? '#0D9488' : '#BBF7D0' }]} />
    <Text style={[styles.postTitle, { color: isDark ? '#F0FDFA' : '#111827', marginTop: 4 }]}>
      {data.title}
    </Text>
    <Text style={[styles.postBody, { color: isDark ? '#99F6E4' : '#374151', marginTop: 6 }]}>
      {data.body}
    </Text>
  </View>
);

// ─── Todos UI ─────────────────────────────────────────────────────────────────

const TodosList = ({ data, isDark }: { data: any[]; isDark: boolean }) => {
  const completed = data.filter((t) => t.completed).length;
  const progress = data.length ? completed / data.length : 0;

  return (
    <>
      {/* Progress bar */}
      <View style={[styles.progressContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: isDark ? '#F1F5F9' : '#111827' }]}>
            Progress
          </Text>
          <Text style={[styles.progressCount, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            {completed}/{data.length} done
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: isDark ? '#334155' : '#E5E7EB' }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: progress === 1 ? '#22C55E' : '#3B82F6' },
            ]}
          />
        </View>
        <Text style={[styles.progressPct, { color: progress === 1 ? '#22C55E' : (isDark ? '#60A5FA' : '#2563EB') }]}>
          {Math.round(progress * 100)}%  {progress === 1 ? '🎉 All done!' : ''}
        </Text>
      </View>

      {data.map((todo: any) => (
        <View
          key={todo.id}
          style={[
            styles.todoRow,
            {
              backgroundColor: todo.completed
                ? isDark ? '#14532D' : '#F0FDF4'
                : isDark ? '#1E293B' : '#FFFFFF',
              borderColor: todo.completed
                ? isDark ? '#15803D' : '#BBF7D0'
                : isDark ? '#334155' : '#E5E7EB',
            },
          ]}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: todo.completed ? '#22C55E' : 'transparent',
                borderColor: todo.completed ? '#22C55E' : isDark ? '#475569' : '#D1D5DB',
              },
            ]}
          >
            {todo.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text
            style={[
              styles.todoText,
              {
                color: todo.completed
                  ? isDark ? '#4ADE80' : '#15803D'
                  : isDark ? '#F1F5F9' : '#111827',
                textDecorationLine: todo.completed ? 'line-through' : 'none',
              },
            ]}
          >
            {todo.title}
          </Text>
        </View>
      ))}
    </>
  );
};

// ─── Auth UI ──────────────────────────────────────────────────────────────────

const AuthResult = ({ data, isDark }: { data: any; isDark: boolean }) => (
  <View style={[styles.successCard, { backgroundColor: isDark ? '#0F2A1F' : '#F0FDF4', borderColor: isDark ? '#0D9488' : '#86EFAC' }]}>
    <View style={styles.successHeader}>
      <Text style={styles.successEmoji}>🔑</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.successTitle, { color: isDark ? '#6EE7B7' : '#065F46' }]}>
          Login Successful
        </Text>
        <Text style={[styles.successSub, { color: isDark ? '#34D399' : '#059669' }]}>
          Welcome, {data.name ?? data.username ?? 'User'}
        </Text>
      </View>
    </View>
    <View style={[styles.divider, { backgroundColor: isDark ? '#0D9488' : '#BBF7D0' }]} />

    {data.email && (
      <View style={styles.infoRow}>
        <Text style={[styles.infoKey, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Email</Text>
        <Text style={[styles.infoVal, { color: isDark ? '#E2E8F0' : '#111827' }]}>{data.email}</Text>
      </View>
    )}
    {data.userId && (
      <View style={styles.infoRow}>
        <Text style={[styles.infoKey, { color: isDark ? '#94A3B8' : '#6B7280' }]}>User ID</Text>
        <Text style={[styles.infoVal, { color: isDark ? '#E2E8F0' : '#111827' }]}>{data.userId}</Text>
      </View>
    )}
    {data.token && (
      <View style={[styles.tokenBox, { backgroundColor: isDark ? '#1E293B' : '#ECFDF5', borderColor: isDark ? '#334155' : '#A7F3D0' }]}>
        <Text style={[styles.tokenLabel, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
          JWT Token
        </Text>
        <Text style={[styles.tokenValue, { color: isDark ? '#6EE7B7' : '#065F46' }]} numberOfLines={2}>
          {data.token}
        </Text>
      </View>
    )}
  </View>
);

// ─── Pokemon UI ───────────────────────────────────────────────────────────────

const PokemonCard = ({ data, isDark }: { data: any; isDark: boolean }) => {
  const types: string[] = (data.types ?? []).map((t: any) =>
    typeof t === 'string' ? t : t?.type?.name ?? ''
  );
  const stats: { name: string; value: number }[] = (data.stats ?? []).map((s: any) => ({
    name: typeof s === 'string' ? s : s?.stat?.name ?? '',
    value: typeof s === 'number' ? s : s?.base_stat ?? 0,
  }));
  const primaryType = types[0] ?? 'normal';
  const typeColor = TYPE_COLORS[primaryType] ?? '#9CA3AF';

  return (
    <View style={[styles.pokemonCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: typeColor, borderWidth: 2 }]}>
      {/* Big colored header */}
      <View style={[styles.pokemonHeader, { backgroundColor: typeColor + '33' }]}>
        <Text style={styles.pokemonEmoji}>
          {primaryType === 'fire' ? '🔥' : primaryType === 'water' ? '💧' : primaryType === 'electric' ? '⚡' : primaryType === 'grass' ? '🌿' : primaryType === 'poison' ? '☠️' : primaryType === 'flying' ? '🌬️' : primaryType === 'psychic' ? '🔮' : '✨'}
        </Text>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.pokemonName, { color: isDark ? '#F1F5F9' : '#111827' }]}>
            {String(data.name ?? '').toUpperCase()}
          </Text>
          <Text style={[styles.pokemonId, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            #{String(data.id ?? '?').padStart(3, '0')}
          </Text>
        </View>
      </View>

      {/* Types */}
      <View style={styles.typesRow}>
        {types.map((t) => (
          <View key={t} style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[t] ?? '#9CA3AF' }]}>
            <Text style={styles.typeBadgeText}>{t.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {/* Base stats */}
      <View style={[styles.statsSection, { borderTopColor: isDark ? '#334155' : '#E5E7EB' }]}>
        <View style={styles.statsInfoRow}>
          <View style={[styles.statInfoBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
            <Text style={[styles.statInfoLabel, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Height</Text>
            <Text style={[styles.statInfoValue, { color: isDark ? '#F1F5F9' : '#111827' }]}>{data.height ?? '?'} dm</Text>
          </View>
          <View style={[styles.statInfoBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
            <Text style={[styles.statInfoLabel, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Weight</Text>
            <Text style={[styles.statInfoValue, { color: isDark ? '#F1F5F9' : '#111827' }]}>{data.weight ?? '?'} hg</Text>
          </View>
        </View>

        {stats.length > 0 && (
          <Text style={[styles.statsTitle, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Base Stats</Text>
        )}
        {stats.map((stat) => (
          <View key={stat.name} style={styles.statRow}>
            <Text style={[styles.statName, { color: isDark ? '#CBD5E1' : '#374151' }]}>
              {stat.name}
            </Text>
            <Text style={[styles.statValue, { color: typeColor }]}>{stat.value}</Text>
            <View style={[styles.statBar, { backgroundColor: isDark ? '#334155' : '#E5E7EB' }]}>
              <View
                style={[
                  styles.statBarFill,
                  { width: `${Math.min(100, Math.round((stat.value / 150) * 100))}%`, backgroundColor: typeColor },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Country UI ───────────────────────────────────────────────────────────────

const CountryCard = ({ data, isDark }: { data: any; isDark: boolean }) => {
  const country = Array.isArray(data) ? data[0] : data;
  if (!country) return null;

  const name = country?.name?.common ?? country?.name ?? 'Unknown';
  const official = country?.name?.official ?? '';
  const capital = Array.isArray(country?.capital) ? country.capital[0] : country?.capital ?? '—';
  const population: number = country?.population ?? 0;
  const region = country?.region ?? '—';
  const currency = country?.currencies
    ? Object.values(country.currencies as Record<string, { name: string; symbol: string }>)
        .map((c) => `${c.name} (${c.symbol})`)
        .join(', ')
    : '—';

  return (
    <View style={[styles.countryCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
      <View style={[styles.countryHeader, { backgroundColor: isDark ? '#0F172A' : '#EFF6FF' }]}>
        <Text style={styles.countryEmoji}>🌍</Text>
        <View>
          <Text style={[styles.countryName, { color: isDark ? '#F1F5F9' : '#111827' }]}>{name}</Text>
          {official && official !== name && (
            <Text style={[styles.countryOfficial, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
              {official}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.countryBody}>
        {[
          { label: 'Capital', value: capital },
          { label: 'Region', value: region },
          { label: 'Population', value: population.toLocaleString() },
          { label: 'Currency', value: currency },
        ].map(({ label, value }) => (
          <View key={label} style={[styles.countryRow, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <Text style={[styles.countryLabel, { color: isDark ? '#64748B' : '#6B7280' }]}>{label}</Text>
            <Text style={[styles.countryValue, { color: isDark ? '#E2E8F0' : '#111827' }]}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Users List UI ────────────────────────────────────────────────────────────

const UsersList = ({ data, isDark }: { data: any[]; isDark: boolean }) => (
  <>
    <Text style={[styles.resultLabel, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
      {data.length} user{data.length !== 1 ? 's' : ''} found
    </Text>
    {data.map((user: any) => (
      <View
        key={user.id}
        style={[styles.userCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB' }]}
      >
        <View style={[styles.avatar, { backgroundColor: isDark ? '#334155' : '#DBEAFE' }]}>
          <Text style={[styles.avatarText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
            {String(user.name ?? user.username ?? 'U')
              .split(' ')
              .map((w: string) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: isDark ? '#F1F5F9' : '#111827' }]}>
            {user.name ?? user.username ?? `User #${user.id}`}
          </Text>
          {user.email && (
            <Text style={[styles.userEmail, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
              {user.email}
            </Text>
          )}
          {user.phone && (
            <Text style={[styles.userPhone, { color: isDark ? '#64748B' : '#9CA3AF' }]}>
              📞 {user.phone}
            </Text>
          )}
        </View>
        <View style={[styles.userIdBadge, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
          <Text style={[styles.userIdText, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            #{user.id}
          </Text>
        </View>
      </View>
    ))}
  </>
);

// ─── Main Details Screen ──────────────────────────────────────────────────────

export const DetailsScreen = ({ type, title, method, action, onBack }: Props) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bg = isDark ? '#0F172A' : '#F4F6F8';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';

  const [status, setStatus] = useState<Status>('idle');
  const [responseStatus, setResponseStatus] = useState<number>(0);
  const [data, setData] = useState<any>(null);
  const [errorInfo, setErrorInfo] = useState<{
    status: number | string;
    message: string;
    fields?: Record<string, string>;
  } | null>(null);

  const fireRequest = useCallback(async () => {
    setStatus('loading');
    setData(null);
    setErrorInfo(null);
    try {
      const res = await action();
      setResponseStatus(res.status ?? 200);
      setData(res.data);
      setStatus('success');
    } catch (err: any) {
      const status = err?.response?.status ?? 0;
      setResponseStatus(status);
      const body = parseData(err?.response?.data ?? {});
      setErrorInfo({
        status,
        message:
          body?.message ?? body?.error ?? err?.message ?? 'Something went wrong.',
        fields: body?.fields,
      });
      setStatus('error');
    }
  }, [action]);

  useEffect(() => {
    fireRequest();
  }, [fireRequest]);

  // ─── Render content based on type & status ──────────────────────────────

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={[styles.loadingText, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            Firing {method} request…
          </Text>
          <Text style={[styles.loadingHint, { color: isDark ? '#475569' : '#9CA3AF' }]}>
            If a slow mock is active, this may take a few seconds
          </Text>
        </View>
      );
    }

    if (status === 'error' && errorInfo) {
      return (
        <ErrorState
          isDark={isDark}
          status={errorInfo.status}
          message={errorInfo.message}
          fields={errorInfo.fields}
          onRetry={fireRequest}
        />
      );
    }

    if (status === 'success') {
      const parsed = parseData(data);

      // Empty array
      if (Array.isArray(parsed) && parsed.length === 0) {
        return (
          <EmptyState isDark={isDark} message="The server returned an empty array. Try switching to a different mock variant!" />
        );
      }

      switch (type) {
        case 'posts-list':
          return Array.isArray(parsed) ? (
            <PostsList data={parsed} isDark={isDark} />
          ) : (
            <EmptyState isDark={isDark} />
          );

        case 'post-create':
          return <PostCreate data={parsed} isDark={isDark} />;

        case 'todos':
          return Array.isArray(parsed) ? (
            <TodosList data={parsed} isDark={isDark} />
          ) : (
            <EmptyState isDark={isDark} />
          );

        case 'auth':
          return parsed?.token ? (
            <AuthResult data={parsed} isDark={isDark} />
          ) : (
            <EmptyState isDark={isDark} message="No token received in response." />
          );

        case 'pokemon':
          return parsed?.name ? (
            <PokemonCard data={parsed} isDark={isDark} />
          ) : (
            <EmptyState isDark={isDark} message="Pokémon data not found." />
          );

        case 'country':
          return <CountryCard data={parsed} isDark={isDark} />;

        case 'users-list':
          return Array.isArray(parsed) ? (
            <UsersList data={parsed} isDark={isDark} />
          ) : (
            <EmptyState isDark={isDark} />
          );

        default:
          return null;
      }
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderBottomColor: isDark ? '#334155' : '#E5E7EB' }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.backText, { color: isDark ? '#60A5FA' : '#2563EB' }]}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.headerTitleRow}>
            <MethodBadge method={method} small />
            <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#111827' }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {status === 'success' && responseStatus > 0 && (
            <View style={styles.statusRow}>
              <StatusBadge code={responseStatus} />
              <Text style={[styles.statusLabel, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
                {status === 'success' ? 'Response received' : ''}
              </Text>
            </View>
          )}
          {status === 'error' && responseStatus > 0 && (
            <View style={styles.statusRow}>
              <StatusBadge code={responseStatus} />
              <Text style={[styles.statusLabel, { color: isDark ? '#F87171' : '#B91C1C' }]}>
                Request failed
              </Text>
            </View>
          )}
        </View>

        {/* Retry button */}
        {status !== 'loading' && (
          <TouchableOpacity
            style={[styles.retryBtnSmall, { backgroundColor: isDark ? '#334155' : '#EFF6FF' }]}
            onPress={fireRequest}
          >
            <Text style={[styles.retryBtnSmallText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>↻ Fire</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Hint bar ── */}
      <View style={[styles.hintBar, { backgroundColor: isDark ? '#0F172A' : '#F0F9FF', borderBottomColor: isDark ? '#1E3A5F' : '#BAE6FD' }]}>
        <Text style={[styles.hintText, { color: isDark ? '#7DD3FC' : '#0369A1' }]}>
          💡 Switch mock variant in the logger panel, then tap <Text style={{ fontWeight: '700' }}>↻ Fire</Text> to see different UI
        </Text>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]}
      >
        <View style={[styles.responseCard, { backgroundColor: cardBg, borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
          {renderContent()}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusLabel: { fontSize: 11 },
  retryBtnSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryBtnSmallText: { fontSize: 13, fontWeight: '700' },

  // Hint bar
  hintBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  hintText: { fontSize: 12, lineHeight: 18 },

  // Scroll
  scroll: { padding: 16, gap: 12 },

  // Response card
  responseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },

  // Badge
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  // Loading
  loadingContainer: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 15, fontWeight: '500' },
  loadingHint: { fontSize: 12, textAlign: 'center', maxWidth: 240 },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMessage: { fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  // Error state
  errorStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700' },
  errorMessage: { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  fieldsCard: { marginTop: 8, borderRadius: 8, borderWidth: 1, padding: 12, gap: 4, width: '100%' },
  fieldRow: { fontSize: 13, lineHeight: 20 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Result label
  resultLabel: { fontSize: 12, marginBottom: 4 },

  // Post card
  postCard: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postIdBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  postIdText: { fontSize: 11, fontWeight: '700' },
  userChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  userChipText: { fontSize: 11 },
  postTitle: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  postBody: { fontSize: 13, lineHeight: 20 },

  // Success card
  successCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  successHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  successEmoji: { fontSize: 32 },
  successTitle: { fontSize: 17, fontWeight: '700' },
  successSub: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, width: '100%' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoKey: { fontSize: 13 },
  infoVal: { fontSize: 13, fontWeight: '600' },
  tokenBox: { borderRadius: 8, borderWidth: 1, padding: 10, gap: 4 },
  tokenLabel: { fontSize: 11 },
  tokenValue: { fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },

  // Todos
  progressContainer: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 14, fontWeight: '700' },
  progressCount: { fontSize: 13 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressPct: { fontSize: 13, fontWeight: '700' },
  todoRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, padding: 12, gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  todoText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // Pokemon
  pokemonCard: { borderRadius: 16, overflow: 'hidden' },
  pokemonHeader: { padding: 24, alignItems: 'center', gap: 8 },
  pokemonEmoji: { fontSize: 56 },
  pokemonName: { fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },
  pokemonId: { fontSize: 13 },
  typesRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  typeBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  typeBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  statsSection: { padding: 16, gap: 8, borderTopWidth: 1 },
  statsInfoRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statInfoBox: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', gap: 2 },
  statInfoLabel: { fontSize: 11 },
  statInfoValue: { fontSize: 15, fontWeight: '700' },
  statsTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statName: { width: 70, fontSize: 12, textTransform: 'capitalize' },
  statValue: { width: 32, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  statBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  statBarFill: { height: 6, borderRadius: 3 },

  // Country
  countryCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  countryHeader: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  countryEmoji: { fontSize: 40 },
  countryName: { fontSize: 20, fontWeight: '800' },
  countryOfficial: { fontSize: 12, marginTop: 2 },
  countryBody: { padding: 4 },
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  countryLabel: { fontSize: 13 },
  countryValue: { fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  // User card
  userCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 12, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  userName: { fontSize: 15, fontWeight: '700' },
  userEmail: { fontSize: 12, marginTop: 2 },
  userPhone: { fontSize: 12, marginTop: 2 },
  userIdBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  userIdText: { fontSize: 11 },
});
