import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import tripApi    from '../api/tripApi';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../constants/theme';
import { formatCOP, formatDate } from '../utils/formatters';

const VEHICLE_LABEL = { economy: 'Economy', xl: 'XL', premium: 'Premium' };

export default function TravelHistory({ navigation }) {
  const { dbUser } = useAuth();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);

  const STATUS = {
    requested: { color: colors.warning,                         bg: isDark ? '#2D1A00' : '#FFF3E0' },
    accepted:  { color: colors.primary,                         bg: colors.infoBox },
    ongoing:   { color: isDark ? '#7C7AE8' : '#5856D6',         bg: isDark ? '#1E1E30' : '#EEF2FF' },
    completed: { color: colors.success,                         bg: isDark ? '#0A2010' : '#F0FFF4' },
    cancelled: { color: colors.danger,                          bg: isDark ? '#2D0000' : '#FFF0F0' },
  };

  const [trips,      setTrips]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [error,      setError]      = useState('');

  const fetchTrips = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await tripApi.getHistory({ page: pageNum, limit: 10 });
      const { trips: newTrips, pages } = res;
      setTrips(prev => append ? [...prev, ...newTrips] : newTrips);
      setHasMore(pageNum < pages);
      setPage(pageNum);
      setError('');
    } catch {
      setError(t('history_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTrips(1, false);
    }, [fetchTrips]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrips(1, false);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchTrips(page + 1, true);
  };

  const renderItem = ({ item }) => {
    const st  = STATUS[item.status] ?? STATUS.completed;
    const isDriver = item.driver?._id === dbUser?._id || item.driver === dbUser?._id;
    const other = isDriver ? item.passenger : item.driver;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('TripDetail', { tripId: item._id })}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{t('status_' + item.status)}</Text>
          </View>
          <Text style={styles.cardFare}>{formatCOP(item.fare)}</Text>
        </View>

        <View style={styles.routeBlock}>
          <View style={styles.routeRow}>
            <Icon name="radio-button-on" size={12} color={colors.primary} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.origin?.address ?? '—'}
            </Text>
          </View>
          <View style={[styles.routeRow, { marginTop: 4 }]}>
            <Icon name="location" size={12} color={colors.danger} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.destination?.address ?? '—'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.metaItem}>
            <Icon name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
          </View>
          {VEHICLE_LABEL[item.vehicleCategory] && (
            <View style={styles.metaItem}>
              <Icon name="car-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.metaText}>{VEHICLE_LABEL[item.vehicleCategory]}</Text>
            </View>
          )}
          {other?.fullName && (
            <View style={styles.metaItem}>
              <Icon name="person-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>{other.fullName}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('history_title')}</Text>
      </View>

      {error ? (
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryText}>{t('history_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator style={{ margin: SPACING.md }} color={colors.primary} />
              : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="car-outline" size={56} color={colors.border} />
              <Text style={styles.emptyTitle}>{t('history_empty')}</Text>
              <Text style={styles.emptySubtitle}>{t('history_empty_sub')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },

    header: {
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { fontSize: FONT.xl, fontWeight: '800', color: colors.textPrimary },

    list: { padding: SPACING.md, flexGrow: 1 },

    card: {
      backgroundColor: colors.surface, borderRadius: RADIUS.md,
      padding: SPACING.md, ...SHADOW.card, gap: SPACING.xs,
    },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    badge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    cardFare:  { fontSize: FONT.lg, fontWeight: '800', color: colors.textPrimary },

    routeBlock: { gap: 0 },
    routeRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    routeText:  { flex: 1, fontSize: FONT.sm, color: colors.textPrimary, lineHeight: 18 },

    cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: 2 },
    metaItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText:   { fontSize: 12, color: colors.textSecondary, maxWidth: 120 },

    errorText: { fontSize: FONT.base, color: colors.danger, textAlign: 'center', paddingHorizontal: SPACING.lg },
    retryBtn:  { paddingVertical: 10, paddingHorizontal: 28, borderRadius: RADIUS.sm, backgroundColor: colors.primary },
    retryText: { color: '#fff', fontWeight: '700' },

    empty: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingTop: 80, gap: SPACING.sm,
    },
    emptyTitle:    { fontSize: FONT.lg, fontWeight: '800', color: colors.textPrimary },
    emptySubtitle: {
      fontSize: FONT.sm, color: colors.textSecondary,
      textAlign: 'center', paddingHorizontal: SPACING.lg,
    },
  });
}
