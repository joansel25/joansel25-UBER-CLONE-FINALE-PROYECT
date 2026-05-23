import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';

import useTripTracking  from '../hooks/useTripTracking';
import RatingModal      from '../components/trip/RatingModal';
import tripApi          from '../api/tripApi';
import { useTrip }      from '../context/TripContext';
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

// ── Screen ─────────────────────────────────────────────────────────────────

export default function FollowTravelScreen({ route, navigation }) {
  const { tripId } = route.params;
  const { clearTrip } = useTrip();
  const mapRef = useRef(null);

  const [rating,        setRating]        = useState(false);  // show modal?
  const [ratingLoading, setRatingLoading] = useState(false);
  const [rated,         setRated]         = useState(false);
  const [cancelling,    setCancelling]    = useState(false);

  const { trip, driverLocation, loading, error } = useTripTracking(tripId);

  // Fit map to show both passenger and driver when driver assigned
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
            try {
              await tripApi.cancel(tripId);
            } catch {/* trip already cancelled server-side is fine */}
            setCancelling(false);
            clearTrip();
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleRate = async (stars) => {
    setRatingLoading(true);
    try {
      await tripApi.rate(tripId, stars);
      setRated(true);
    } catch { /* ignore */ }
    setRatingLoading(false);
    clearTrip();
    navigation.goBack();
  };

  // ── Loading ──────────────────────────────────────────────────────────────

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

  const { status, origin, destination, fare, driver } = trip;
  const isTerminal = status === 'completed' || status === 'cancelled';

  // Coordinates
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
            {status === 'requested' && (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
            )}
            {status !== 'requested' && (
              <Icon
                name={statusIcon(status)}
                size={22}
                color={statusColor(status)}
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={[styles.statusText, { color: statusColor(status) }]}>
              {statusLabel(status)}
            </Text>
          </View>

          {/* Driver card — visible once accepted */}
          {(status === 'accepted' || status === 'ongoing') && driver && (
            <View style={styles.driverCard}>
              {driver.profilePic
                ? <Image source={{ uri: driver.profilePic }} style={styles.avatar} />
                : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Icon name="person" size={20} color={COLORS.white} />
                  </View>
                )
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

          {/* Actions */}
          {status === 'completed' && !rated && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setRating(true)}
            >
              <Icon name="star-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Calificar conductor</Text>
            </TouchableOpacity>
          )}

          {status === 'completed' && rated && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { clearTrip(); navigation.goBack(); }}
            >
              <Text style={styles.primaryBtnText}>Volver al inicio</Text>
            </TouchableOpacity>
          )}

          {status === 'cancelled' && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: COLORS.danger }]}
              onPress={() => { clearTrip(); navigation.goBack(); }}
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
        visible={rating && !rated}
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
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
    ...SHADOW.card,
  },

  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusText: { fontSize: FONT.lg, fontWeight: '800' },

  driverCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FB', borderRadius: RADIUS.sm,
    padding: SPACING.sm, marginBottom: SPACING.sm, gap: SPACING.sm,
  },
  avatar:        { width: 44, height: 44, borderRadius: 22 },
  avatarFallback:{ backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  driverName:    { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark },
  ratingRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText:    { fontSize: FONT.sm, color: COLORS.gray },
  fareTag:       { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  fareText:      { color: COLORS.white, fontWeight: '700', fontSize: FONT.sm },

  addressBlock: { marginBottom: SPACING.sm },
  addressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressText:  { flex: 1, fontSize: FONT.sm, color: COLORS.dark },

  primaryBtn: {
    backgroundColor: COLORS.primary, height: 52, borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: SPACING.xs,
  },
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
