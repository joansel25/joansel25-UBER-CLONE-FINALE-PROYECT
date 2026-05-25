import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import tripApi    from '../api/tripApi';
import paymentApi from '../api/paymentApi';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../constants/theme';
import { formatCOP, formatDate, formatTime, formatDistance, formatDuration } from '../utils/formatters';

// ── Config ──────────────────────────────────────────────────────────────────

const STATUS = {
  requested: { color: '#FF9500', bg: '#FFF3E0', icon: 'time-outline' },
  accepted:  { color: '#007AFF', bg: '#E3F2FD', icon: 'checkmark-outline' },
  ongoing:   { color: '#5856D6', bg: '#EEF2FF', icon: 'navigate-outline' },
  completed: { color: '#34C759', bg: '#F0FFF4', icon: 'checkmark-circle-outline' },
  cancelled: { color: '#FF3B30', bg: '#FFF0F0', icon: 'close-circle-outline' },
};

const TX_STATUS = {
  pending:   { color: '#FF9500' },
  completed: { color: '#34C759' },
  failed:    { color: '#FF3B30' },
  refunded:  { color: '#5856D6' },
};

const VEHICLE_LABEL = { economy: 'Economy', xl: 'XL', premium: 'Premium' };

// ── Row helper ───────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={16} color={COLORS.gray} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function TripDetailScreen({ route, navigation }) {
  const { tripId } = route.params;
  const { dbUser } = useAuth();
  const { t } = useTranslation();

  const [trip,    setTrip]    = useState(null);
  const [tx,      setTx]      = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [tripRes] = await Promise.all([
          tripApi.getById(tripId),
        ]);
        const tripData = tripRes.data;
        setTrip(tripData);

        // Fetch transaction if trip was paid by card
        if (tripData.paymentMethod === 'card' && tripData.status === 'completed') {
          paymentApi.getByTrip(tripId)
            .then(r => setTx(r.data))
            .catch(() => {});
        }
      } catch {
        setError(t('detail_error'));
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId, t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={styles.center}>
        <Icon name="alert-circle-outline" size={48} color={COLORS.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>{t('detail_back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const st = STATUS[trip.status] ?? STATUS.completed;
  const isDriver = trip.driver?._id === dbUser?._id || trip.driver === dbUser?._id;
  const other    = isDriver ? trip.passenger : trip.driver;
  const otherRole = isDriver ? t('detail_passenger') : t('detail_driver');

  const myRating   = isDriver ? trip.driverRatingPassenger : trip.passengerRatingDriver;
  const theirRating = isDriver ? trip.passengerRatingDriver : trip.driverRatingPassenger;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
          <Icon name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('detail_title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: st.bg }]}>
          <Icon name={st.icon} size={22} color={st.color} />
          <Text style={[styles.statusLabel, { color: st.color }]}>{t('status_' + trip.status)}</Text>
          <Text style={styles.statusFare}>{formatCOP(trip.fare)}</Text>
        </View>

        {/* Route */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('detail_route')}</Text>
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>{t('detail_origin')}</Text>
                <Text style={styles.routeAddress}>{trip.origin?.address ?? '—'}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: COLORS.danger }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>{t('detail_destination')}</Text>
                <Text style={styles.routeAddress}>{trip.destination?.address ?? '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Trip details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('detail_info')}</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="calendar-outline"   label={t('detail_date')}     value={formatDate(trip.createdAt)} />
            <InfoRow icon="time-outline"        label={t('detail_time')}     value={formatTime(trip.createdAt)} />
            {trip.distance  != null && <InfoRow icon="map-outline"    label={t('detail_distance')} value={formatDistance(trip.distance)} />}
            {trip.duration  != null && <InfoRow icon="stopwatch-outline" label={t('detail_duration')} value={formatDuration(trip.duration)} />}
            <InfoRow icon="car-outline"         label={t('detail_category')} value={VEHICLE_LABEL[trip.vehicleCategory] ?? trip.vehicleCategory} />
            <InfoRow
              icon="wallet-outline"
              label={t('detail_pay_method')}
              value={trip.paymentMethod === 'card' ? t('detail_card') : t('detail_cash')}
            />
          </View>
        </View>

        {/* Other party */}
        {other && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{otherRole}</Text>
            <View style={styles.personCard}>
              <View style={styles.personAvatar}>
                <Icon name="person" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{other.fullName}</Text>
                {other.rating != null && (
                  <View style={styles.starRow}>
                    <Icon name="star" size={13} color="#FFD700" />
                    <Text style={styles.starText}>{Number(other.rating).toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Ratings */}
        {trip.status === 'completed' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('detail_ratings')}</Text>
            <View style={styles.infoCard}>
              <InfoRow
                icon="star-outline"
                label={t('detail_my_rating')}
                value={myRating != null ? '★'.repeat(myRating) + ` (${myRating}/5)` : t('detail_unrated')}
                valueColor={myRating != null ? '#FFD700' : COLORS.gray}
              />
              <InfoRow
                icon="star-outline"
                label={t('detail_their_rating', otherRole)}
                value={theirRating != null ? '★'.repeat(theirRating) + ` (${theirRating}/5)` : t('detail_unrated')}
                valueColor={theirRating != null ? '#FFD700' : COLORS.gray}
              />
            </View>
          </View>
        )}

        {/* Transaction */}
        {tx && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('detail_payment')}</Text>
            <View style={styles.infoCard}>
              <InfoRow icon="cash-outline"    label={t('detail_amount')} value={formatCOP(tx.amount)} />
              <InfoRow icon="card-outline"    label={t('detail_method')} value={t('detail_card_full')} />
              <InfoRow
                icon="checkmark-circle-outline"
                label={t('detail_pay_status')}
                value={t('tx_' + tx.status) ?? tx.status}
                valueColor={(TX_STATUS[tx.status] ?? {}).color}
              />
              <InfoRow icon="calendar-outline" label={t('detail_date')} value={formatDate(tx.createdAt)} />
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backIcon: { padding: 4 },
  title:    { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },

  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  statusLabel: { flex: 1, fontSize: FONT.lg, fontWeight: '800' },
  statusFare:  { fontSize: FONT.xl, fontWeight: '900', color: COLORS.dark },

  section:      {},
  sectionTitle: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  infoCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingVertical: 4, ...SHADOW.card,
  },
  infoRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  infoIcon:  { marginRight: 10 },
  infoLabel: { flex: 1, fontSize: FONT.sm, color: COLORS.gray },
  infoValue: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.dark, textAlign: 'right', maxWidth: '55%' },

  routeCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.card },
  routeRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDot:  { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  routeLine: { width: 2, height: 16, backgroundColor: COLORS.border, marginLeft: 5, marginVertical: 4 },
  routeLabel:   { fontSize: 11, fontWeight: '600', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.3 },
  routeAddress: { fontSize: FONT.sm, color: COLORS.dark, marginTop: 2, lineHeight: 18 },

  personCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, ...SHADOW.card,
  },
  personAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  personName: { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark },
  starRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  starText:   { fontSize: FONT.sm, color: COLORS.gray },

  errorText: { fontSize: FONT.base, color: COLORS.danger, textAlign: 'center', paddingHorizontal: SPACING.lg },
  backBtn:   { paddingVertical: 10, paddingHorizontal: 28, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary },
  backBtnText: { color: COLORS.white, fontWeight: '700' },
});
