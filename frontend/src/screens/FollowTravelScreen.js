import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import { useStripe } from '@stripe/stripe-react-native';

import useTripTracking  from '../hooks/useTripTracking';
import RatingModal      from '../components/trip/RatingModal';
import tripApi          from '../api/tripApi';
import paymentApi       from '../api/paymentApi';
import { useDispatch }  from 'react-redux';
import { clearTrip }   from '../store/slices/tripSlice';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../constants/theme';
import { formatCOP }    from '../utils/formatters';

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
  const [savedCards,      setSavedCards]      = useState([]);
  const [selectedCardId,  setSelectedCardId]  = useState(null);
  const [paying,          setPaying]          = useState(false);
  const [payDone,         setPayDone]         = useState(false);
  const [payError,        setPayError]        = useState('');

  const { trip, driverLocation, loading, error } = useTripTracking(tripId);

  // Load saved cards once the trip completes with card payment
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

  // Fit map to show both origin and driver when assigned
  const handleMapReady = useCallback(() => {
    if (!mapRef.current || !trip) return;
    const coords = [];
    if (trip.origin?.location?.coordinates) {
      const [lng, lat] = trip.origin.location.coordinates;
      coords.push({ latitude: lat, longitude: lng });
    }
    if (driverLocation) coords.push(driverLocation);
    if (coords.length >= 2) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 300, left: 60 },
        animated: true,
      });
    }
  }, [trip, driverLocation]);

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
            try { await tripApi.cancel(tripId); } catch { /* already cancelled */ }
            setCancelling(false);
            dispatch(clearTrip());
            navigation.goBack();
          },
        },
      ],
    );
  };

  // Pay with saved card via confirmPayment
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
      setRating(true); // jump to rating
    } catch (err) {
      setPayError(err.message ?? 'No se pudo procesar el pago. Intenta de nuevo.');
    } finally {
      setPaying(false);
    }
  };

  // Pay by presenting Stripe PaymentSheet (enter new card or skip saved)
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
        if (presentErr.code !== 'Canceled') {
          setPayError('No se completó el pago. Intenta de nuevo.');
        }
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
    try {
      await tripApi.rate(tripId, stars);
    } catch { /* ignore */ }
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
  const isTerminal = status === 'completed' || status === 'cancelled';
  const needsPayment = status === 'completed' && paymentMethod === 'card' && !payDone;

  const originCoords = origin?.location?.coordinates
    ? { latitude: origin.location.coordinates[1], longitude: origin.location.coordinates[0] }
    : null;
  const destCoords = destination?.location?.coordinates
    ? { latitude: destination.location.coordinates[1], longitude: destination.location.coordinates[0] }
    : null;
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
          showsUserLocation
          showsMyLocationButton={false}
        >
          {originCoords && (
            <Marker coordinate={originCoords} title="Origen">
              <View style={styles.markerOrigin}>
                <Icon name="radio-button-on" size={18} color={COLORS.white} />
              </View>
            </Marker>
          )}
          {destCoords && (
            <Marker coordinate={destCoords} title="Destino">
              <View style={styles.markerDest}>
                <Icon name="location" size={18} color={COLORS.white} />
              </View>
            </Marker>
          )}
          {driverLocation && (
            <Marker coordinate={driverLocation} title="Conductor">
              <View style={styles.markerDriver}>
                <Icon name="car" size={18} color={COLORS.white} />
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
            <Text style={[styles.statusText, { color: statusColor(status) }]}>
              {statusLabel(status)}
            </Text>
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

          {/* Addresses */}
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

              {payError ? (
                <Text style={styles.payError}>{payError}</Text>
              ) : null}

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

              {/* No saved cards — go straight to PaymentSheet */}
              {savedCards.length === 0 && (
                <TouchableOpacity
                  style={[styles.primaryBtn, paying && styles.btnDisabled]}
                  onPress={handlePayWithSheet}
                  disabled={paying}
                >
                  {paying
                    ? <ActivityIndicator color={COLORS.white} size="small" />
                    : <>
                        <Icon name="card-outline" size={18} color={COLORS.white} />
                        <Text style={styles.primaryBtnText}>Ingresar tarjeta</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Completed (cash or after payment) ── */}
          {status === 'completed' && !needsPayment && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setRating(true)}
            >
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

  // Payment block
  payBlock:  { marginBottom: SPACING.xs },
  payHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  payTitle:  { fontSize: FONT.md, fontWeight: '800', color: COLORS.dark },
  payLabel:  { fontSize: FONT.sm, color: COLORS.gray, marginBottom: 8 },
  payError:  { fontSize: FONT.sm, color: COLORS.danger, marginBottom: 8 },

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
  markerDriver: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center',
  },
});
