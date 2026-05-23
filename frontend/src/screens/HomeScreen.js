import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';

import { useDispatch }  from 'react-redux';
import { setOrigin, setDestination, setActiveTrip } from '../store/slices/tripSlice';
import { useAuth }     from '../context/AuthContext';
import useLocation     from '../hooks/useLocation';
import placesApi       from '../api/placesApi';
import tripApi         from '../api/tripApi';
import VehicleSelector from '../components/trip/VehicleSelector';
import { formatCOP, formatDistance, formatDuration } from '../utils/formatters';
import { COLORS, RADIUS, FONT, SPACING, SHADOW } from '../constants/theme';

const MAX_FARE       = 50000;
const DEBOUNCE_MS    = 400;
const DEFAULT_REGION = { latitude: 4.7110, longitude: -74.0721, latitudeDelta: 0.05, longitudeDelta: 0.05 };

// Steps: idle → searching → estimating → ready → requesting
const STEP = { IDLE: 'idle', SEARCHING: 'searching', ESTIMATING: 'estimating', READY: 'ready', REQUESTING: 'requesting' };

export default function HomeScreen({ navigation }) {
  const dispatch       = useDispatch();
  const { dbUser }     = useAuth();
  const { location }   = useLocation();

  const mapRef        = useRef(null);
  const debounceTimer = useRef(null);
  const sessionToken  = useRef(String(Date.now()));

  const [step,             setStep]             = useState(STEP.IDLE);
  const [searchText,       setSearchText]       = useState('');
  const [suggestions,      setSuggestions]      = useState([]);
  const [originPlace,      setOriginPlace]      = useState(null);
  const [destPlace,        setDestPlace]        = useState(null);
  const [estimate,         setEstimate]         = useState(null);  // { fares, route }
  const [selectedCategory, setSelectedCategory] = useState('economy');
  const [mapRegion,        setMapRegion]        = useState(DEFAULT_REGION);

  // ── Center map when GPS resolves ────────────────────────────────────────────
  useEffect(() => {
    if (location && step === STEP.IDLE) {
      const region = {
        latitude:      location.latitude,
        longitude:     location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(region);
      setOriginPlace({
        address: 'Mi ubicación actual',
        lat:     location.latitude,
        lng:     location.longitude,
      });
    }
  }, [location]);

  // ── Autocomplete with debounce ───────────────────────────────────────────────
  const handleSearchChange = useCallback((text) => {
    setSearchText(text);
    clearTimeout(debounceTimer.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setStep(STEP.IDLE);
      return;
    }

    setStep(STEP.SEARCHING);
    debounceTimer.current = setTimeout(async () => {
      try {
        const result = await placesApi.autocomplete(text, {
          lat:          location?.latitude,
          lng:          location?.longitude,
          sessionToken: sessionToken.current,
        });
        setSuggestions(result.data ?? []);
      } catch {
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  }, [location]);

  // ── Select a suggestion → get details → get estimate ────────────────────────
  const handleSelectSuggestion = async (suggestion) => {
    setSuggestions([]);
    setSearchText(suggestion.mainText);
    setStep(STEP.ESTIMATING);

    try {
      // 1. Convert placeId → coordinates
      const detailsResult = await placesApi.details(suggestion.placeId, sessionToken.current);
      const dest = {
        address: suggestion.description,
        lat:     detailsResult.data.lat,
        lng:     detailsResult.data.lng,
      };
      setDestPlace(dest);
      dispatch(setDestination(dest));

      // Renew session token after selection (Google billing requirement)
      sessionToken.current = String(Date.now());

      // 2. Get fare estimate for all categories
      const origin = originPlace ?? {
        address: 'Mi ubicación actual',
        lat: location.latitude,
        lng: location.longitude,
      };
      dispatch(setOrigin(origin));

      const estimateResult = await tripApi.estimate({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat:   dest.lat,
        destLng:   dest.lng,
      });
      setEstimate(estimateResult.data);

      // 3. Fit map to show both markers
      mapRef.current?.fitToCoordinates(
        [
          { latitude: origin.lat, longitude: origin.lng },
          { latitude: dest.lat,   longitude: dest.lng },
        ],
        { edgePadding: { top: 80, right: 60, bottom: 320, left: 60 }, animated: true }
      );

      setStep(STEP.READY);
    } catch (error) {
      Alert.alert('Error', 'No se pudo calcular la ruta. Intenta de nuevo.');
      setStep(STEP.IDLE);
    }
  };

  // ── Request trip (U-03.5) ────────────────────────────────────────────────────
  const handleRequestTrip = async () => {
    const fare = estimate?.fares?.[selectedCategory]?.fare;

    // U-03.6 — 50k COP limit warning
    if (fare > MAX_FARE) {
      Alert.alert(
        'Límite de tarifa',
        `La tarifa ${formatCOP(fare)} supera el máximo permitido de ${formatCOP(MAX_FARE)}. Selecciona una categoría más económica.`
      );
      return;
    }

    setStep(STEP.REQUESTING);
    try {
      const origin = originPlace ?? { address: 'Mi ubicación actual', lat: location.latitude, lng: location.longitude };

      const result = await tripApi.create({
        origin:          { address: origin.address,   lat: origin.lat,   lng: origin.lng },
        destination:     { address: destPlace.address, lat: destPlace.lat, lng: destPlace.lng },
        vehicleCategory: selectedCategory,
        paymentMethod:   'card',
      });

      const newTrip = result.data.trip;
      dispatch(setActiveTrip(newTrip));
      navigation.navigate('FollowTravel', { tripId: newTrip._id });
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo crear el viaje. Intenta de nuevo.');
      setStep(STEP.READY);
    }
  };

  // ── Reset to idle ─────────────────────────────────────────────────────────────
  const handleClearDestination = () => {
    setDestPlace(null);
    setEstimate(null);
    setSearchText('');
    setSuggestions([]);
    setSelectedCategory('economy');
    setStep(STEP.IDLE);
    if (location) {
      mapRef.current?.animateToRegion({
        latitude:       location.latitude,
        longitude:      location.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }, 400);
    }
  };

  const isRequesting = step === STEP.REQUESTING;
  const selectedFare = estimate?.fares?.[selectedCategory]?.fare;
  const overLimit    = selectedFare > MAX_FARE;

  return (
    <View style={styles.container}>

      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {originPlace && location && (
          <Marker
            coordinate={{ latitude: originPlace.lat, longitude: originPlace.lng }}
            title="Origen"
            pinColor={COLORS.primary}
          />
        )}
        {destPlace && (
          <Marker
            coordinate={{ latitude: destPlace.lat, longitude: destPlace.lng }}
            title="Destino"
            pinColor={COLORS.danger}
          />
        )}
      </MapView>

      {/* ── My location button ── */}
      <TouchableOpacity
        style={styles.myLocationBtn}
        onPress={() => {
          if (location) {
            mapRef.current?.animateToRegion({
              latitude: location.latitude, longitude: location.longitude,
              latitudeDelta: 0.01, longitudeDelta: 0.01,
            }, 400);
          }
        }}
      >
        <Icon name="locate" size={22} color={COLORS.primary} />
      </TouchableOpacity>

      {/* ── Bottom panel ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomPanelWrapper}
      >
        <View style={styles.bottomPanel}>

          {/* Greeting */}
          <Text style={styles.greeting}>
            👋 Hola, {dbUser?.fullName?.split(' ')[0] ?? 'viajero'}
          </Text>

          {/* Origin row */}
          <View style={styles.locationRow}>
            <View style={styles.dotOrigin} />
            <Text style={styles.locationText} numberOfLines={1}>
              {originPlace?.address ?? 'Obteniendo ubicación…'}
            </Text>
          </View>

          {/* Destination search */}
          <View style={styles.searchRow}>
            <View style={styles.dotDest} />
            <View style={styles.searchInputWrapper}>
              <TextInput
                style={styles.searchInput}
                placeholder="¿A dónde vas?"
                placeholderTextColor={COLORS.gray}
                value={searchText}
                onChangeText={handleSearchChange}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={handleClearDestination} style={styles.clearBtn}>
                  <Icon name="close-circle" size={18} color={COLORS.gray} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Suggestions list */}
          {step === STEP.SEARCHING && (
            <FlatList
              data={suggestions}
              keyExtractor={item => item.placeId}
              style={styles.suggestionList}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <Icon name="location-outline" size={18} color={COLORS.gray} style={styles.suggestionIcon} />
                  <View style={styles.suggestionTexts}>
                    <Text style={styles.suggestionMain}>{item.mainText}</Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>
                      {item.secondaryText}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() =>
                searchText.length >= 2 && (
                  <Text style={styles.noResults}>Sin resultados para "{searchText}"</Text>
                )
              }
            />
          )}

          {/* Estimating loader */}
          {step === STEP.ESTIMATING && (
            <View style={styles.estimatingRow}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.estimatingText}>Calculando ruta y tarifa…</Text>
            </View>
          )}

          {/* Ready state: vehicle selector + estimate + button */}
          {step === STEP.READY && estimate && (
            <>
              {/* Route summary */}
              <View style={styles.routeSummary}>
                <Icon name="navigate-outline" size={16} color={COLORS.primary} />
                <Text style={styles.routeText}>
                  {estimate.route.distanceText}  ·  {estimate.route.durationText}
                </Text>
              </View>

              {/* Vehicle selector */}
              <VehicleSelector
                fares={estimate.fares}
                selected={selectedCategory}
                onSelect={setSelectedCategory}
              />

              {/* Fare display */}
              <View style={styles.fareRow}>
                <View>
                  <Text style={styles.fareLabel}>Tarifa estimada</Text>
                  {overLimit && (
                    <Text style={styles.limitWarning}>
                      ⚠ Supera el límite de {formatCOP(MAX_FARE)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.fareAmount, overLimit && styles.fareAmountOver]}>
                  {selectedFare != null ? formatCOP(selectedFare) : '—'}
                </Text>
              </View>

              {/* Request button */}
              <TouchableOpacity
                style={[
                  styles.requestBtn,
                  (overLimit || isRequesting) && styles.requestBtnDisabled,
                ]}
                onPress={handleRequestTrip}
                disabled={overLimit || isRequesting}
                activeOpacity={0.85}
              >
                {isRequesting
                  ? <ActivityIndicator color={COLORS.white} />
                  : <>
                      <Icon name="car" size={18} color={COLORS.white} />
                      <Text style={styles.requestBtnText}>Solicitar viaje</Text>
                    </>
                }
              </TouchableOpacity>
            </>
          )}

        </View>
      </KeyboardAvoidingView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  myLocationBtn: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: COLORS.white, borderRadius: RADIUS.full,
    padding: 10, ...SHADOW.card,
  },

  bottomPanelWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomPanel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
    ...SHADOW.card,
    shadowOffset: { width: 0, height: -2 },
  },

  greeting: { fontSize: FONT.md, fontWeight: '700', color: COLORS.dark, marginBottom: SPACING.sm },

  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  dotOrigin: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.primary, borderWidth: 2, borderColor: '#fff',
    shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 3, elevation: 3,
  },
  locationText: { flex: 1, fontSize: FONT.base, color: COLORS.dark },

  searchRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  dotDest:           { width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.danger },
  searchInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  searchInput: {
    flex: 1, fontSize: FONT.base, color: COLORS.dark,
    paddingVertical: 4,
  },
  clearBtn: { padding: 4 },

  suggestionList: { maxHeight: 220, marginTop: 4 },
  separator:      { height: 1, backgroundColor: COLORS.lightGray },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
  },
  suggestionIcon:      { marginRight: 12 },
  suggestionTexts:     { flex: 1 },
  suggestionMain:      { fontSize: FONT.base, fontWeight: '600', color: COLORS.dark },
  suggestionSecondary: { fontSize: FONT.sm, color: COLORS.gray, marginTop: 2 },
  noResults:           { textAlign: 'center', color: COLORS.gray, paddingVertical: 16, fontSize: FONT.base },

  estimatingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: SPACING.sm,
  },
  estimatingText: { fontSize: FONT.base, color: COLORS.gray },

  routeSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    marginBottom: SPACING.sm,
  },
  routeText: { fontSize: FONT.base, color: COLORS.dark, fontWeight: '600' },

  fareRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },
  fareLabel:       { fontSize: FONT.sm, color: COLORS.gray },
  limitWarning:    { fontSize: 11, color: COLORS.danger, fontWeight: '600', marginTop: 2 },
  fareAmount:      { fontSize: FONT.xl, fontWeight: '800', color: COLORS.dark },
  fareAmountOver:  { color: COLORS.danger },

  requestBtn: {
    backgroundColor: COLORS.success,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: RADIUS.sm, marginTop: 4,
  },
  requestBtnDisabled: { backgroundColor: '#A5D6A7' },
  requestBtnText:     { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
});
