import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import { useStripe } from '@stripe/stripe-react-native';
import firestore from '@react-native-firebase/firestore';
import database  from '@react-native-firebase/database';

import useTripTracking  from '../hooks/useTripTracking';
import RatingModal      from '../components/trip/RatingModal';
import tripApi          from '../api/tripApi';
import paymentApi       from '../api/paymentApi';
import decodePolyline   from '../utils/decodePolyline';
import { useDispatch }  from 'react-redux';
import { clearTrip }   from '../store/slices/tripSlice';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../constants/theme';
import { formatCOP }    from '../utils/formatters';

// ── Simulated driver profile (for demo mode) ───────────────────────────────
const SIM_DRIVER_ID = 'sim_driver_demo';
const SIM_DRIVER = {
  _id:        SIM_DRIVER_ID,
  fullName:   'Carlos Vega',
  profilePic: 'https://randomuser.me/api/portraits/men/47.jpg',
  rating:     4.9,
  phone:      '3171234567',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function statusLabel(status) {
  switch (status) {
    case 'requested': return 'Buscando conductor…';
    case 'accepted':  return 'Tu conductor está en camino';
    case 'ongoing':   return 'Viaje en curso';
    case 'completed': return '¡Llegaste a tu destino!';
    case 'cancelled': return 'Viaje cancelado';
    default:          return '';
  }
}

function statusIcon(status) {
  switch (status) {
    case 'requested': return 'search-outline';
    case 'accepted':  return 'car-outline';
    case 'ongoing':   return 'navigate-outline';
    case 'completed': return 'checkmark-circle-outline';
    case 'cancelled': return 'close-circle-outline';
    default:          return 'ellipse-outline';
  }
}

function statusColor(status) {
  if (status === 'completed') return COLORS.success;
  if (status === 'cancelled') return COLORS.danger;
  return COLORS.primary;
}

const BRAND_LABEL = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover' };

// Subsample polyline coords for smooth but not overly frequent animation
function samplePolyline(encoded, targetSteps = 35) {
  const all = decodePolyline(encoded);
  if (all.length <= targetSteps) return all;
  const step = Math.floor(all.length / targetSteps);
  const sampled = all.filter((_, i) => i % step === 0);
  // Always include last point
  const last = all[all.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function FollowTravelScreen({ route, navigation }) {
  const { tripId } = route.params;
  const dispatch   = useDispatch();
  const mapRef     = useRef(null);
  const { initPaymentSheet, presentPaymentSheet, confirmPayment } = useStripe();

  const [rating,        setRating]        = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [cancelling,    setCancelling]    = useState(false);

  // Payment state
  const [savedCards,     setSavedCards]     = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [paying,         setPaying]         = useState(false);
  const [payDone,        setPayDone]        = useState(false);
  const [payError,       setPayError]       = useState('');

  // Simulation control refs
  const simAcceptedRef  = useRef(false);
  const simStartedRef   = useRef(false);
  const simOngoingRef   = useRef(false);
  const simIntervalRef  = useRef(null);

  const { trip, driverLocation, loading, error } = useTripTracking(tripId);

  // ── Decoded route polyline ─────────────────────────────────────────────────
  const routeCoords = useMemo(() => {
    if (!trip?.polyline) return [];
    return decodePolyline(trip.polyline);
  }, [trip?.polyline]);

  // ── Cleanup simulation on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // ── SIMULATION STEP 1: Auto-accept after 3s in 'requested' state ───────────
  useEffect(() => {
    if (!trip || trip.status !== 'requested' || simAcceptedRef.current) return;
    simAcceptedRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const origin = trip.origin;
        // Place simulated driver ~250m away from pickup
        const simLat = (origin?.lat ?? 4.711) + 0.0022;
        const simLng = (origin?.lng ?? -74.072) + 0.0012;

        // Write initial driver location to Realtime DB
        await database().ref(`/drivers/${SIM_DRIVER_ID}/location`).set({
          lat: simLat, lng: simLng, timestamp: Date.now(),
        });

        // Accept trip in Firestore
        await firestore().collection('trips').doc(tripId).update({
          driverId:     SIM_DRIVER_ID,
          driver:       SIM_DRIVER,
          participants: firestore.FieldValue.arrayUnion(SIM_DRIVER_ID),
          status:       'accepted',
          acceptedAt:   firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.error('[Sim] accept failed:', e.message);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [trip?.status, tripId]);

  // ── SIMULATION STEP 2: Driver approaches pickup (accepted → ongoing) ─────────
  // dep array only uses primitives — object refs (trip.origin) are captured in
  // the closure at effect-run time to avoid interval being cancelled by re-renders
  useEffect(() => {
    if (!trip || trip.status !== 'accepted' || simStartedRef.current) return;
    simStartedRef.current = true;

    // Capture primitive coords so the closure is stable
    const originLat = trip.origin?.lat  ?? 4.711;
    const originLng = trip.origin?.lng  ?? -74.072;
    const driverLat = originLat + 0.0022;
    const driverLng = originLng + 0.0012;
    const steps = 4;
    let step = 0;

    const approachInterval = setInterval(() => {
      step++;
      const fraction = step / steps;
      database().ref(`/drivers/${SIM_DRIVER_ID}/location`).set({
        lat: driverLat + ((originLat - driverLat) * fraction),
        lng: driverLng + ((originLng - driverLng) * fraction),
        timestamp: Date.now(),
      }).catch(() => {});

      if (step >= steps) {
        clearInterval(approachInterval);
        tripApi.start(tripId).catch(e => console.error('[Sim] start failed:', e.message));
      }
    }, 600);

    return () => clearInterval(approachInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.status, tripId]);

  // ── SIMULATION STEP 3: Driver travels along route (ongoing → completed) ──────
  // Capture polyline & destination as primitives/values in the closure.
  // Object deps are excluded to prevent interval cancellation on re-renders.
  useEffect(() => {
    if (!trip || trip.status !== 'ongoing' || !trip.polyline) return;
    if (simOngoingRef.current || simIntervalRef.current) return;
    simOngoingRef.current = true;

    // Capture stable values now (Firestore re-snapshots create new object refs)
    const polyline = trip.polyline;
    const destLat  = trip.destination?.lat;
    const destLng  = trip.destination?.lng;

    const coords = samplePolyline(polyline, 25);
    if (coords.length === 0) {
      tripApi.complete(tripId).catch(() => {});
      return;
    }

    let step = 0;
    simIntervalRef.current = setInterval(async () => {
      step++;
      if (step >= coords.length) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
        if (destLat != null) {
          await database().ref(`/drivers/${SIM_DRIVER_ID}/location`).set({
            lat: destLat, lng: destLng, timestamp: Date.now(),
          }).catch(() => {});
        }
        await tripApi.complete(tripId).catch(() => {});
        return;
      }
      const { latitude, longitude } = coords[step];
      database().ref(`/drivers/${SIM_DRIVER_ID}/location`).set({
        lat: latitude, lng: longitude, timestamp: Date.now(),
      }).catch(() => {});
    }, 600);

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.status, tripId]);

  // ── Fit map to show origin + driver ────────────────────────────────────────
  const handleMapReady = useCallback(() => {
    if (!mapRef.current || !trip) return;
    const coords = [];
    if (trip.origin?.lat != null) {
      coords.push({ latitude: trip.origin.lat, longitude: trip.origin.lng });
    }
    if (driverLocation) coords.push(driverLocation);
    if (coords.length >= 2) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 300, left: 60 },
        animated: true,
      });
    }
  }, [trip, driverLocation]);

  // ── Auto-fit map when driver location changes ──────────────────────────────
  // accepted → show driver + origin so user sees driver approaching
  // ongoing  → show driver + destination so user sees progress toward goal
  useEffect(() => {
    if (!driverLocation || !mapRef.current || !trip) return;

    const anchor = trip.status === 'accepted' && trip.origin?.lat
      ? { latitude: trip.origin.lat, longitude: trip.origin.lng }
      : trip.status === 'ongoing' && trip.destination?.lat
        ? { latitude: trip.destination.lat, longitude: trip.destination.lng }
        : null;

    if (anchor) {
      mapRef.current.fitToCoordinates(
        [driverLocation, anchor],
        { edgePadding: { top: 80, right: 60, bottom: 320, left: 60 }, animated: true },
      );
    } else {
      mapRef.current.animateToRegion({
        latitude:      driverLocation.latitude,
        longitude:     driverLocation.longitude,
        latitudeDelta:  0.015,
        longitudeDelta: 0.015,
      }, 800);
    }
  }, [driverLocation, trip?.status]);

  // ── Load saved cards when trip completes ───────────────────────────────────
  useEffect(() => {
    if (trip?.status === 'completed' && trip?.paymentMethod === 'card' && !payDone) {
      paymentApi.listCards()
        .then(res => {
          const cards = res.data ?? [];
          setSavedCards(cards);
          if (cards.length > 0) setSelectedCardId(cards[0].id);
        })
        .catch(() => {});
    }
  }, [trip?.status, trip?.paymentMethod, payDone]);

  const handleCancel = () => {
    Alert.alert(
      'Cancelar viaje',
      '¿Estás seguro de que quieres cancelar este viaje?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try { await tripApi.cancel(tripId); } catch { }
            setCancelling(false);
            dispatch(clearTrip());
            navigation.goBack();
          },
        },
      ],
    );
  };

  // Pay with a saved card
  const handlePayWithCard = async () => {
    if (!selectedCardId) return;
    setPaying(true);
    setPayError('');
    try {
      const res = await paymentApi.createIntent(tripId, selectedCardId);
      const { clientSecret } = res.data;
      const { error: stripeErr } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: { paymentMethodId: selectedCardId },
      });
      if (stripeErr) throw new Error(stripeErr.message);
      setPayDone(true);
      setRating(true);
    } catch (err) {
      setPayError(err.message ?? 'No se pudo procesar el pago. Intenta de nuevo.');
    } finally {
      setPaying(false);
    }
  };

  // Pay via Stripe PaymentSheet (new card)
  const handlePayWithSheet = async () => {
    setPaying(true);
    setPayError('');
    try {
      const res = await paymentApi.createIntent(tripId);
      const { clientSecret } = res.data;
      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName:       'UberApp',
        style:                     'automatic',
      });
      if (initErr) throw new Error(initErr.message);

      const { error: presentErr } = await presentPaymentSheet();
      if (presentErr) {
        if (presentErr.code !== 'Canceled') setPayError('No se completó el pago. Intenta de nuevo.');
        return;
      }
      setPayDone(true);
      setRating(true);
    } catch (err) {
      setPayError(err.message ?? 'Error al procesar el pago.');
    } finally {
      setPaying(false);
    }
  };

  const handleRate = async (stars) => {
    setRatingLoading(true);
    try { await tripApi.rate(tripId, stars); } catch { }
    setRatingLoading(false);
    dispatch(clearTrip());
    navigation.goBack();
  };

  // ── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando tu viaje…</Text>
      </SafeAreaView>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={styles.center}>
        <Icon name="alert-circle-outline" size={48} color={COLORS.danger} />
        <Text style={styles.errorText}>{error ?? 'No se pudo cargar el viaje.'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { status, origin, destination, fare, driver, paymentMethod } = trip;
  const isTerminal   = status === 'completed' || status === 'cancelled';
  const needsPayment = status === 'completed' && paymentMethod === 'card' && !payDone;

  const originCoords = origin?.lat != null
    ? { latitude: origin.lat, longitude: origin.lng } : null;
  const destCoords = destination?.lat != null
    ? { latitude: destination.lat, longitude: destination.lng } : null;
  const mapRegion = originCoords
    ? { ...originCoords, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: 4.711, longitude: -74.0721, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Map ── */}
      {!isTerminal && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={mapRegion}
          onMapReady={handleMapReady}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {/* Route polyline */}
          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={COLORS.primary}
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}

          {/* Origin marker */}
          {originCoords && (
            <Marker coordinate={originCoords} title="Origen">
              <View style={styles.markerOrigin}>
                <Icon name="radio-button-on" size={16} color={COLORS.white} />
              </View>
            </Marker>
          )}

          {/* Destination marker */}
          {destCoords && (
            <Marker coordinate={destCoords} title="Destino">
              <View style={styles.markerDest}>
                <Icon name="location" size={16} color={COLORS.white} />
              </View>
            </Marker>
          )}

          {/* Driver marker — animated via Realtime DB, moves in real time */}
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title={driver?.fullName ?? 'Conductor'}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.markerDriverOuter}>
                <View style={styles.markerDriver}>
                  <Icon name="car-sport" size={20} color={COLORS.white} />
                </View>
              </View>
            </Marker>
          )}
        </MapView>
      )}

      {/* ── Bottom sheet ── */}
      <SafeAreaView style={styles.sheetWrap} edges={['bottom', 'left', 'right']}>
        <View style={styles.sheet}>

          {/* Status header */}
          <View style={styles.statusRow}>
            {status === 'requested'
              ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
              : <Icon name={statusIcon(status)} size={22} color={statusColor(status)} style={{ marginRight: 8 }} />
            }
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusText, { color: statusColor(status) }]}>
                {statusLabel(status)}
              </Text>
              {status === 'accepted' && (
                <Text style={styles.statusSub}>El conductor se dirige a recogerte</Text>
              )}
              {status === 'ongoing' && (
                <Text style={styles.statusSub}>
                  {trip?.destination?.address ? `Hacia: ${trip.destination.address}` : 'En camino al destino'}
                </Text>
              )}
            </View>
          </View>

          {/* Driver card — visible once accepted/ongoing */}
          {(status === 'accepted' || status === 'ongoing') && driver && (
            <View style={styles.driverCard}>
              {driver.profilePic
                ? <Image source={{ uri: driver.profilePic }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarFallback]}>
                    <Icon name="person" size={20} color={COLORS.white} />
                  </View>
              }
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{driver.fullName}</Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>{driver.rating?.toFixed(1) ?? '—'}</Text>
                </View>
              </View>
              <View style={styles.fareTag}>
                <Text style={styles.fareText}>{formatCOP(fare)}</Text>
              </View>
            </View>
          )}

          {/* Origin / Destination addresses */}
          <View style={styles.addressBlock}>
            <View style={styles.addressRow}>
              <Icon name="radio-button-on" size={14} color={COLORS.primary} />
              <Text style={styles.addressText} numberOfLines={1}>{origin?.address ?? '—'}</Text>
            </View>
            <View style={[styles.addressRow, { marginTop: 6 }]}>
              <Icon name="location" size={14} color={COLORS.danger} />
              <Text style={styles.addressText} numberOfLines={1}>{destination?.address ?? '—'}</Text>
            </View>
          </View>

          {/* ── Payment step (card trips only) ── */}
          {needsPayment && (
            <View style={styles.payBlock}>
              <View style={styles.payHeader}>
                <Icon name="card-outline" size={18} color={COLORS.primary} />
                <Text style={styles.payTitle}>Pagar {formatCOP(fare)}</Text>
              </View>

              {payError ? <Text style={styles.payError}>{payError}</Text> : null}

              {/* Saved cards */}
              {savedCards.length > 0 && (
                <>
                  <Text style={styles.payLabel}>Selecciona una tarjeta:</Text>
                  {savedCards.map(card => (
                    <TouchableOpacity
                      key={card.id}
                      style={[styles.cardOption, selectedCardId === card.id && styles.cardOptionSelected]}
                      onPress={() => setSelectedCardId(card.id)}
                    >
                      <Icon name="card" size={16} color={selectedCardId === card.id ? COLORS.white : COLORS.primary} />
                      <Text style={[styles.cardOptionText, selectedCardId === card.id && { color: COLORS.white }]}>
                        {BRAND_LABEL[card.brand] ?? card.brand}  ****{card.last4}
                      </Text>
                      {selectedCardId === card.id && <Icon name="checkmark" size={16} color={COLORS.white} />}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.primaryBtn, paying && styles.btnDisabled]}
                    onPress={handlePayWithCard}
                    disabled={paying || !selectedCardId}
                  >
                    {paying
                      ? <ActivityIndicator color={COLORS.white} size="small" />
                      : <>
                          <Icon name="lock-closed-outline" size={18} color={COLORS.white} />
                          <Text style={styles.primaryBtnText}>Pagar {formatCOP(fare)}</Text>
                        </>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.altPayBtn} onPress={handlePayWithSheet} disabled={paying}>
                    <Text style={styles.altPayText}>Usar otra tarjeta</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* No saved cards */}
              {savedCards.length === 0 && (
                <>
                  <View style={styles.testCardHint}>
                    <Icon name="information-circle-outline" size={14} color="#666" />
                    <Text style={styles.testCardText}>
                      Modo prueba · Tarjeta: 4242 4242 4242 4242 · Cualquier fecha futura · CVC: 123
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.primaryBtn, paying && styles.btnDisabled]}
                    onPress={handlePayWithSheet}
                    disabled={paying}
                  >
                    {paying
                      ? <ActivityIndicator color={COLORS.white} size="small" />
                      : <>
                          <Icon name="card-outline" size={18} color={COLORS.white} />
                          <Text style={styles.primaryBtnText}>Ingresar tarjeta de pago</Text>
                        </>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* ── Completed (cash or after payment) ── */}
          {status === 'completed' && !needsPayment && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setRating(true)}>
              <Icon name="star-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Calificar conductor</Text>
            </TouchableOpacity>
          )}

          {status === 'cancelled' && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: COLORS.danger }]}
              onPress={() => { dispatch(clearTrip()); navigation.goBack(); }}
            >
              <Text style={styles.primaryBtnText}>Volver al inicio</Text>
            </TouchableOpacity>
          )}

          {(status === 'requested' || status === 'accepted') && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator size="small" color={COLORS.danger} />
                : <>
                    <Icon name="close-circle-outline" size={18} color={COLORS.danger} />
                    <Text style={styles.cancelText}>Cancelar viaje</Text>
                  </>
              }
            </TouchableOpacity>
          )}

        </View>
      </SafeAreaView>

      {/* Rating modal */}
      <RatingModal
        visible={rating}
        onSubmit={handleRate}
        loading={ratingLoading}
        title="Califica a tu conductor"
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },

  center: {
    flex: 1, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  loadingText: { fontSize: FONT.base, color: COLORS.gray, marginTop: SPACING.sm },
  errorText:   { fontSize: FONT.base, color: COLORS.danger, textAlign: 'center', paddingHorizontal: SPACING.lg },
  backBtn:     { marginTop: SPACING.md, paddingVertical: 10, paddingHorizontal: 28, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary },
  backBtnText: { color: COLORS.white, fontWeight: '700' },

  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.md, paddingBottom: SPACING.lg,
    ...SHADOW.card,
  },

  statusRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  statusText: { fontSize: FONT.lg, fontWeight: '800' },
  statusSub:  { fontSize: FONT.sm, color: COLORS.gray, marginTop: 2, numberOfLines: 1 },

  driverCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FB', borderRadius: RADIUS.sm,
    padding: SPACING.sm, marginBottom: SPACING.sm, gap: SPACING.sm,
  },
  avatar:         { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  driverName:     { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark },
  ratingRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText:     { fontSize: FONT.sm, color: COLORS.gray },
  fareTag:        { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  fareText:       { color: COLORS.white, fontWeight: '700', fontSize: FONT.sm },

  addressBlock: { marginBottom: SPACING.sm },
  addressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressText:  { flex: 1, fontSize: FONT.sm, color: COLORS.dark },

  payBlock:  { marginBottom: SPACING.xs },
  payHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  payTitle:  { fontSize: FONT.md, fontWeight: '800', color: COLORS.dark },
  payLabel:  { fontSize: FONT.sm, color: COLORS.gray, marginBottom: 8 },
  payError:  { fontSize: FONT.sm, color: COLORS.danger, marginBottom: 8 },

  testCardHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#FFF8E1', borderRadius: 8,
    padding: 10, marginBottom: 10,
  },
  testCardText: { flex: 1, fontSize: 11, color: '#666', lineHeight: 16 },

  cardOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
  },
  cardOptionSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  cardOptionText:     { flex: 1, fontSize: FONT.sm, fontWeight: '600', color: COLORS.dark },

  altPayBtn:  { alignItems: 'center', paddingVertical: 8 },
  altPayText: { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: COLORS.primary, height: 52, borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: SPACING.xs,
  },
  btnDisabled:    { opacity: 0.5 },
  primaryBtnText: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },

  cancelBtn: {
    height: 48, borderRadius: RADIUS.sm,
    borderWidth: 2, borderColor: COLORS.danger,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: SPACING.xs,
  },
  cancelText: { color: COLORS.danger, fontSize: FONT.base, fontWeight: '700' },

  markerOrigin: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  markerDest: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center',
  },
  markerDriverOuter: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 8,
  },
  markerDriver: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: COLORS.white,
  },
});
