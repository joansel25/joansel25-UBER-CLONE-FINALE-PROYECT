import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import paymentApi from '../api/paymentApi';
import { useTranslation } from '../hooks/useTranslation';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../constants/theme';
import { formatCOP, formatDate, formatTime } from '../utils/formatters';

const TX_STATUS = {
  pending:   { color: '#FF9500', bg: '#FFF3E0', icon: 'time-outline' },
  completed: { color: '#34C759', bg: '#F0FFF4', icon: 'checkmark-circle-outline' },
  failed:    { color: '#FF3B30', bg: '#FFF0F0', icon: 'close-circle-outline' },
  refunded:  { color: '#5856D6', bg: '#EEF2FF', icon: 'return-down-back-outline' },
};

export default function PaymentHistory({ navigation }) {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(true);
  const [error,        setError]        = useState('');

  const fetchTx = useCallback(async (pageNum = 1, append = false) => {
    try {
      // On first load, reconcile any pending transactions against Stripe's real status.
      // This fixes records created before the confirmPayment step was in place.
      if (pageNum === 1) {
        await paymentApi.syncPendingTransactions().catch(() => {});
      }
      const res = await paymentApi.list({ page: pageNum, limit: 15 });
      const { transactions: newTx, pages } = res;
      setTransactions(prev => append ? [...prev, ...newTx] : newTx);
      setHasMore(pageNum < pages);
      setPage(pageNum);
      setError('');
    } catch {
      setError(t('pay_hist_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTx(1, false);
    }, [fetchTx]),
  );

  const handleRefresh = () => { setRefreshing(true); fetchTx(1, false); };
  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchTx(page + 1, true);
  };

  const renderItem = ({ item }) => {
    const st = TX_STATUS[item.status] ?? TX_STATUS.pending;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => item.trip?._id && navigation.navigate('TripDetail', { tripId: item.trip._id })}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: st.bg }]}>
          <Icon name={st.icon} size={22} color={st.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardAmount}>{formatCOP(item.amount)}</Text>
          <Text style={styles.cardRoute} numberOfLines={1}>
            {item.trip?.origin?.address
              ? `${item.trip.origin.address} → ${item.trip.destination?.address ?? ''}`
              : t('pay_hist_trip')}
          </Text>
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}  {formatTime(item.createdAt)}</Text>
        </View>

        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.color }]}>{t('tx_' + item.status)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('pay_hist_title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {error ? (
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={40} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryText}>{t('history_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator style={{ margin: SPACING.md }} color={COLORS.primary} />
              : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="card-outline" size={56} color={COLORS.border} />
              <Text style={styles.emptyTitle}>{t('pay_hist_empty')}</Text>
              <Text style={styles.emptySubtitle}>{t('pay_hist_empty_sub')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  title:   { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },

  list: { padding: SPACING.md, flexGrow: 1 },

  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, ...SHADOW.card,
  },
  iconWrap:   { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cardAmount: { fontSize: FONT.md, fontWeight: '800', color: COLORS.dark },
  cardRoute:  { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  cardDate:   { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  badge:      { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText:  { fontSize: 11, fontWeight: '700' },

  errorText: { fontSize: FONT.base, color: COLORS.danger, textAlign: 'center', paddingHorizontal: SPACING.lg },
  retryBtn:  { paddingVertical: 10, paddingHorizontal: 28, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary },
  retryText: { color: COLORS.white, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyTitle:    { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },
  emptySubtitle: { fontSize: FONT.sm, color: COLORS.gray, textAlign: 'center', paddingHorizontal: SPACING.lg },
});
