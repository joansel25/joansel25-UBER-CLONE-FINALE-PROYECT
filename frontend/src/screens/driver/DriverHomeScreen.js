import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Geolocation from '@react-native-community/geolocation';

import driverApi  from '../../api/driverApi';
import tripApi    from '../../api/tripApi';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import RatingModal from '../../components/trip/RatingModal';
import ErrorBanner from '../../components/common/ErrorBanner';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../../constants/theme';
import { formatCOP, formatDistance, formatDuration } from '../../utils/formatters';

// ── Driver status config (labels resolved via t() at render time) ───────────

const STATUS_CONFIG = {
  offline:   { labelKey: 'driver_offline',   color: COLORS.gray,    icon: 'power-outline' },
  available: { labelKey: 'driver_available', color: COLORS.success,  icon: 'checkmark-circle-outline' },
  busy:      { labelKey: 'driver_busy',      color: COLORS.warning,  icon: 'car-outline' },
};

const LOCATION_INTERVAL = 12000; // ms between location broadcasts

// ── Screen ─────────────────────────────────────────────────────────────────

export default function DriverHomeScreen() {
  const { dbUser } = useAuth();
  const { t } = useTranslation();

  const [driverDoc,      setDriverDoc]      = useState(null);   // Driver MongoDB doc
  const [driverStatus,   setDriverStatus]   = useState('offline');
  const [availableTrips, setAvailableTrips] = useState([]);
  const [activeTrip,     setActiveTrip]     = useState(null);   // accepted/ongoing trip
  const [tripPhase,      setTripPhase]      = useState('idle'); // idle | accepted | ongoing | completed
  const [ratingVisible,  setRatingVisible]  = useState(false);
  const [ratingLoading,  setRatingLoading]  = useState(false);
  const [error,          setError]          = useState('');
  const [loadingInit,    setLoadingInit]    = useState(true);
  const [statusChanging, setStatusChanging] = useState(false);
  const [acceptingId,    setAcceptingId]    = useState(null);
  const [actionLoading,  setActionLoading]  = useState(false);

  const locationWatchRef = useRef(null);
  const tripsIntervalRef = useRef(null);
  const tripPollRef      = useRef(null);

  // ── Init: fetch driver profile ──────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await driverApi.getMe();
        const doc = res.data;
        setDriverDoc(doc);
        setDriverStatus(doc.status);
      } catch (err) {
        setError(t('driver_no_profile'));
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  // ── Location broadcasting ───────────────────────────────────────────────

  const broadcastLocation = useCallback((tripId = null) => {
    Geolocation.getCurrentPosition(
      pos => {
        driverApi.updateLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          tripId,
        ).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const startLocationBroadcast = useCallback((tripId = null) => {
    stopLocationBroadcast();
    broadcastLocation(tripId);
    locationWatchRef.current = setInterval(
      () => broadcastLocation(tripId),
      LOCATION_INTERVAL,
    );
  }, [broadcastLocation, stopLocationBroadcast]);

  const stopLocationBroadcast = useCallback(() => {
    clearInterval(locationWatchRef.current);
    locationWatchRef.current = null;
  }, []);

  // ── Available trips polling ─────────────────────────────────────────────

  const fetchAvailableTrips = useCallback(async () => {
    try {
      const res = await tripApi.getAvailable({ limit: 10 });
      setAvailableTrips(res.trips ?? []);
    } catch { /* silent */ }
  }, []);

  const startTripsPoll = useCallback(() => {
    fetchAvailableTrips();
    tripsIntervalRef.current = setInterval(fetchAvailableTrips, 8000);
  }, [fetchAvailableTrips]);

  const stopTripsPoll = useCallback(() => {
    clearInterval(tripsIntervalRef.current);
    tripsIntervalRef.current = null;
  }, []);

  // ── Active trip polling (when in accepted/ongoing) ──────────────────────

  const pollActiveTrip = useCallback(async (tripId) => {
    try {
      const res = await tripApi.getById(tripId);
      return res.data;
    } catch { return null; }
  }, []);

  // ── Status toggle ───────────────────────────────────────────────────────

  const handleStatusToggle = async (newStatus) => {
    if (!driverDoc || statusChanging) return;
    setStatusChanging(true);
    setError('');
    try {
      await driverApi.updateStatus(newStatus);
      setDriverStatus(newStatus);

      if (newStatus === 'available') {
        startLocationBroadcast();
        startTripsPoll();
      } else {
        stopLocationBroadcast();
        stopTripsPoll();
      }
    } catch {
      setError(t('driver_status_error'));
    } finally {
      setStatusChanging(false);
    }
  };

  // ── Accept a trip ───────────────────────────────────────────────────────

  const handleAccept = async (trip) => {
    if (!dbUser) return;
    setAcceptingId(trip._id);
    setError('');
    try {
      const res = await tripApi.accept(trip._id);
      const accepted = res.data;
      setActiveTrip(accepted);
      setTripPhase('accepted');
      stopTripsPoll();

      // Switch to broadcasting with tripId
      startLocationBroadcast(trip._id);

      // Poll active trip status
      tripPollRef.current = setInterval(async () => {
        const updated = await pollActiveTrip(accepted._id);
        if (updated) {
          setActiveTrip(updated);
          if (updated.status === 'ongoing')   setTripPhase('ongoing');
          if (updated.status === 'completed') {
            setTripPhase('completed');
            clearInterval(tripPollRef.current);
            stopLocationBroadcast();
          }
        }
      }, 5000);

    } catch (err) {
      setError(t('driver_accept_error'));
      fetchAvailableTrips();
    } finally {
      setAcceptingId(null);
    }
  };

  // ── Start trip (passenger boarded) ──────────────────────────────────────

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    setActionLoading(true);
    try {
      await tripApi.start(activeTrip._id);
      setTripPhase('ongoing');
    } catch (err) {
      setError(t('driver_start_error'));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Complete trip ───────────────────────────────────────────────────────

  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    setActionLoading(true);
    try {
      await tripApi.complete(activeTrip._id);
      clearInterval(tripPollRef.current);
      stopLocationBroadcast();
      setTripPhase('completed');
      setRatingVisible(true);
    } catch (err) {
      setError(t('driver_complete_error'));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Rate passenger ──────────────────────────────────────────────────────

  const handleRate = async (stars) => {
    if (!activeTrip) return;
    setRatingLoading(true);
    try {
      await tripApi.rate(activeTrip._id, stars);
    } catch { /* ignore */ }
    setRatingLoading(false);
    setRatingVisible(false);
    setActiveTrip(null);
    setTripPhase('idle');
    setDriverStatus('offline');
    driverApi.updateStatus('offline').catch(() => {});
  };

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => () => {
    stopLocationBroadcast();
    stopTripsPoll();
    clearInterval(tripPollRef.current);
  }, [stopLocationBroadcast, stopTripsPoll]);

  // ── Render: loading ─────────────────────────────────────────────────────

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // ── Render: active trip ─────────────────────────────────────────────────

  if (tripPhase !== 'idle' && activeTrip) {
    const { passenger, origin, destination, fare } = activeTrip;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.activeTripCard}>
          <ErrorBanner message={error} onDismiss={() => setError('')} />

          <Text style={styles.activeTripTitle}>
            {tripPhase === 'accepted' ? t('driver_pickup') : t('driver_ongoing')}
          </Text>

          {passenger && (
            <View style={styles.passengerRow}>
              <View style={styles.passengerAvatar}>
                <Icon name="person" size={20} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.passengerName}>{passenger.fullName}</Text>
                <View style={styles.starRow}>
                  <Icon name="star" size={13} color="#FFD700" />
                  <Text style={styles.starText}>{passenger.rating?.toFixed(1) ?? '—'}</Text>
                </View>
              </View>
              <Text style={styles.fareAmount}>{formatCOP(fare)}</Text>
            </View>
          )}

          <View style={styles.routeBlock}>
            <View style={styles.routeRow}>
              <Icon name="radio-button-on" size={13} color={COLORS.primary} />
              <Text style={styles.routeText} numberOfLines={2}>{origin?.address}</Text>
            </View>
            <View style={[styles.routeRow, { marginTop: 6 }]}>
              <Icon name="location" size={13} color={COLORS.danger} />
              <Text style={styles.routeText} numberOfLines={2}>{destination?.address}</Text>
            </View>
          </View>

          {tripPhase === 'accepted' && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleStartTrip}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <>
                    <Icon name="play-circle-outline" size={20} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>{t('driver_start_btn')}</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {tripPhase === 'ongoing' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
              onPress={handleCompleteTrip}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <>
                    <Icon name="checkmark-circle-outline" size={20} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>{t('driver_complete_btn')}</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </View>

        <RatingModal
          visible={ratingVisible}
          onSubmit={handleRate}
          loading={ratingLoading}
          title={t('driver_rate_passenger')}
        />
      </SafeAreaView>
    );
  }

  // ── Render: idle ────────────────────────────────────────────────────────

  const cfg = STATUS_CONFIG[driverStatus] ?? STATUS_CONFIG.offline;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <ErrorBanner message={error} onDismiss={() => setError('')} />

        {/* ── Status card ── */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={styles.statusLabel}>{t(cfg.labelKey)}</Text>
            {statusChanging && <ActivityIndicator size="small" color={COLORS.gray} style={{ marginLeft: 8 }} />}
          </View>

          <View style={styles.statusBtns}>
            {['available', 'offline'].map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusBtn,
                  driverStatus === s && { backgroundColor: STATUS_CONFIG[s].color },
                ]}
                onPress={() => handleStatusToggle(s)}
                disabled={statusChanging || driverStatus === s}
              >
                <Icon
                  name={STATUS_CONFIG[s].icon}
                  size={16}
                  color={driverStatus === s ? COLORS.white : COLORS.gray}
                />
                <Text style={[
                  styles.statusBtnText,
                  driverStatus === s && { color: COLORS.white },
                ]}>
                  {t(STATUS_CONFIG[s].labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Available trips ── */}
        {driverStatus === 'available' && (
          <View style={styles.tripsSection}>
            <Text style={styles.sectionTitle}>
              {t('driver_trips', availableTrips.length)}
            </Text>

            {availableTrips.length === 0 ? (
              <View style={styles.emptyTrips}>
                <Icon name="search-outline" size={40} color={COLORS.border} />
                <Text style={styles.emptyText}>{t('driver_searching')}</Text>
              </View>
            ) : (
              availableTrips.map(trip => (
                <TripCard
                  key={trip._id}
                  trip={trip}
                  loading={acceptingId === trip._id}
                  onAccept={() => handleAccept(trip)}
                  t={t}
                />
              ))
            )}
          </View>
        )}

        {driverStatus === 'offline' && (
          <View style={styles.offlineHint}>
            <Icon name="power-outline" size={48} color={COLORS.border} />
            <Text style={styles.offlineText}>{t('driver_offline_hint')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Trip card ───────────────────────────────────────────────────────────────

function TripCard({ trip, loading, onAccept, t }) {
  const { origin, destination, fare, distance, duration, passenger, vehicleCategory } = trip;
  return (
    <View style={styles.tripCard}>
      <View style={styles.tripCardHeader}>
        <View style={styles.categoryTag}>
          <Text style={styles.categoryText}>{vehicleCategory?.toUpperCase()}</Text>
        </View>
        <Text style={styles.tripFare}>{formatCOP(fare)}</Text>
      </View>

      <View style={styles.tripRoute}>
        <View style={styles.routeRow}>
          <Icon name="radio-button-on" size={12} color={COLORS.primary} />
          <Text style={styles.routeText} numberOfLines={1}>{origin?.address}</Text>
        </View>
        <View style={[styles.routeRow, { marginTop: 4 }]}>
          <Icon name="location" size={12} color={COLORS.danger} />
          <Text style={styles.routeText} numberOfLines={1}>{destination?.address}</Text>
        </View>
      </View>

      <View style={styles.tripMeta}>
        {distance != null && (
          <View style={styles.metaItem}>
            <Icon name="map-outline" size={13} color={COLORS.gray} />
            <Text style={styles.metaText}>{formatDistance(distance)}</Text>
          </View>
        )}
        {duration != null && (
          <View style={styles.metaItem}>
            <Icon name="time-outline" size={13} color={COLORS.gray} />
            <Text style={styles.metaText}>{formatDuration(duration)}</Text>
          </View>
        )}
        {passenger?.rating != null && (
          <View style={styles.metaItem}>
            <Icon name="star" size={13} color="#FFD700" />
            <Text style={styles.metaText}>{passenger.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.acceptBtn, loading && styles.acceptBtnDisabled]}
        onPress={onAccept}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={COLORS.white} size="small" />
          : <>
              <Icon name="checkmark-outline" size={18} color={COLORS.white} />
              <Text style={styles.acceptBtnText}>{t('driver_accept')}</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F5F7FA' },
  scroll:     { padding: SPACING.md, paddingBottom: SPACING.xl },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Status card
  statusCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md,
    marginBottom: SPACING.md, ...SHADOW.card,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  statusDot:    { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusLabel:  { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark, flex: 1 },
  statusBtns:   { flexDirection: 'row', gap: SPACING.sm },
  statusBtn: {
    flex: 1, height: 44, borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  statusBtnText: { fontSize: FONT.sm, color: COLORS.gray, fontWeight: '600' },

  // Trips section
  tripsSection: { gap: SPACING.sm },
  sectionTitle: { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark, marginBottom: 4 },

  emptyTrips: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  emptyText:  { fontSize: FONT.base, color: COLORS.gray, textAlign: 'center' },

  offlineHint: { alignItems: 'center', paddingVertical: SPACING.xl * 2, gap: SPACING.md },
  offlineText: { fontSize: FONT.base, color: COLORS.gray, textAlign: 'center', paddingHorizontal: SPACING.lg },

  // Trip card
  tripCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: SPACING.md, ...SHADOW.card, gap: SPACING.xs,
  },
  tripCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryTag: {
    backgroundColor: '#EEF2FF', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  categoryText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  tripFare:     { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },

  tripRoute: { gap: 0 },
  routeRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  routeText: { flex: 1, fontSize: FONT.sm, color: COLORS.dark, lineHeight: 18 },

  tripMeta:  { flexDirection: 'row', gap: SPACING.md },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:  { fontSize: 12, color: COLORS.gray },

  acceptBtn: {
    backgroundColor: COLORS.primary, height: 46, borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: SPACING.xs,
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText:     { color: COLORS.white, fontWeight: '700', fontSize: FONT.base },

  // Active trip
  activeTripCard: {
    flex: 1, backgroundColor: COLORS.white, margin: SPACING.md,
    borderRadius: 20, padding: SPACING.md, ...SHADOW.card,
  },
  activeTripTitle: {
    fontSize: FONT.xl, fontWeight: '800', color: COLORS.dark, marginBottom: SPACING.md,
  },
  passengerRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  passengerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  passengerName: { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark },
  starRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  starText:      { fontSize: FONT.sm, color: COLORS.gray },
  fareAmount:    { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },

  routeBlock: { backgroundColor: '#F8F9FB', borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.md },

  actionBtn: {
    backgroundColor: COLORS.primary, height: 54, borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 'auto',
  },
  actionBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
});
