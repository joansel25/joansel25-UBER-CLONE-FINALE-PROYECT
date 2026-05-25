import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView, PermissionsAndroid,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import decodePolyline from '../utils/decodePolyline';
import Icon from 'react-native-vector-icons/Ionicons';

import { useDispatch }  from 'react-redux';
import { setOrigin, setDestination, setActiveTrip } from '../store/slices/tripSlice';
import { useAuth }     from '../context/AuthContext';
import useLocation     from '../hooks/useLocation';
import placesApi       from '../api/placesApi';
import tripApi         from '../api/tripApi';
import VehicleSelector from '../components/trip/VehicleSelector';
import { formatCOP }   from '../utils/formatters';
import { COLORS, RADIUS, FONT, SPACING, SHADOW } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';
import driverApi from '../api/driverApi';
import { seedSimulatedDrivers } from '../utils/seedDrivers';

const MAX_FARE       = 50000;
const DEBOUNCE_MS    = 400;
const DEFAULT_REGION = { latitude: 4.7110, longitude: -74.0721, latitudeDelta: 0.05, longitudeDelta: 0.05 };

const STEP = {
  IDLE:       'idle',
  SEARCHING:  'searching',
  ESTIMATING: 'estimating',
  READY:      'ready',
  REQUESTING: 'requesting',
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export default function HomeScreen({ navigation }) {
  const dispatch     = useDispatch();
  const { dbUser }   = useAuth();
  const { location } = useLocation();
  const { t }        = useTranslation();

  const mapRef       = useRef(null);
  const debounceRef  = useRef(null);
  const sessionToken = useRef(String(Date.now()));
  const destInputRef = useRef(null);

  const [step,             setStep]             = useState(STEP.IDLE);
  const [activeField,      setActiveField]      = useState(null); // 'origin' | 'destination'
  const [originText,       setOriginText]       = useState('');
  const [destText,         setDestText]         = useState('');
  const [suggestions,      setSuggestions]      = useState([]);
  const [originPlace,      setOriginPlace]      = useState(null);
  const [destPlace,        setDestPlace]        = useState(null);
  const [estimate,         setEstimate]         = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('economy');
  const [mapRegion,        setMapRegion]        = useState(DEFAULT_REGION);
  const [gettingGPS,       setGettingGPS]       = useState(false);
  const [nearbyDrivers,    setNearbyDrivers]    = useState([]);

  // ── Load nearby drivers; auto-seed simulated ones if none exist ─────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await driverApi.getNearby();
        if (cancelled) return;
        if (data.length === 0) {
          await seedSimulatedDrivers();
          const { data: seeded } = await driverApi.getNearby();
          if (!cancelled) setNearbyDrivers(seeded);
        } else {
          setNearbyDrivers(data);
        }
      } catch { /* map still works without drivers */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Set origin from GPS on first fix ────────────────────────────────────────
  useEffect(() => {
    if (location && !originPlace) {
      const gpsPlace = {
        address: t('home_my_location'),
        lat:     location.latitude,
        lng:     location.longitude,
      };
      setOriginPlace(gpsPlace);
      setOriginText('Mi ubicación actual');
      setMapRegion({
        latitude:      location.latitude,
        longitude:     location.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [location, originPlace, t]);

  // ── Debounced Places autocomplete ────────────────────────────────────────────
  const handleSearchChange = useCallback((text, field) => {
    if (field === 'origin') setOriginText(text);
    else setDestText(text);

    clearTimeout(debounceRef.current);
    setSuggestions([]);

    if (text.trim().length < 2) {
      setStep(STEP.IDLE);
      return;
    }

    setStep(STEP.SEARCHING);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await placesApi.autocomplete(text, {
          lat:          location?.latitude,
          lng:          location?.longitude,
          sessionToken: sessionToken.current,
        });
        setSuggestions(result.data ?? []);
      } catch (err) {
        console.error('[HomeScreen] autocomplete error:', err.message);
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  }, [location]);

  // ── Calculate route estimate ─────────────────────────────────────────────────
  const calculateEstimate = useCallback(async (origin, dest) => {
    setStep(STEP.ESTIMATING);
    setSuggestions([]);
    setActiveField(null);

    try {
      const result = await tripApi.estimate({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat:   dest.lat,
        destLng:   dest.lng,
      });
      setEstimate(result.data);

      mapRef.current?.fitToCoordinates(
        [
          { latitude: origin.lat, longitude: origin.lng },
          { latitude: dest.lat,   longitude: dest.lng },
        ],
        { edgePadding: { top: 80, right: 60, bottom: 340, left: 60 }, animated: true },
      );
      setStep(STEP.READY);
    } catch (error) {
      Alert.alert(t('home_route_error'), t('home_route_error_msg', error.message));
      setStep(STEP.IDLE);
    }
  }, [t]);

  // ── Find nearest available driver to the origin point ───────────────────────
  const { nearestDriver, nearestDistKm } = useMemo(() => {
    const withLoc = nearbyDrivers.filter(d => d.currentLocation);
    if (!withLoc.length) return { nearestDriver: null, nearestDistKm: null };
    const ref = originPlace;
    if (!ref) return { nearestDriver: withLoc[0], nearestDistKm: null };
    let best = withLoc[0];
    let bestDist = haversineKm(ref.lat, ref.lng, best.currentLocation.lat, best.currentLocation.lng);
    for (const d of withLoc.slice(1)) {
      const dist = haversineKm(ref.lat, ref.lng, d.currentLocation.lat, d.currentLocation.lng);
      if (dist < bestDist) { best = d; bestDist = dist; }
    }
    return { nearestDriver: best, nearestDistKm: bestDist.toFixed(1) };
  }, [originPlace, nearbyDrivers]);

  // ── Select autocomplete suggestion ───────────────────────────────────────────
  const handleSelectSuggestion = async (suggestion) => {
    setSuggestions([]);
    try {
      const detailsResult = await placesApi.details(suggestion.placeId, sessionToken.current);
      sessionToken.current = String(Date.now()); // renew session token (Google billing)

      const place = {
        address: suggestion.description,
        lat:     detailsResult.data.lat,
        lng:     detailsResult.data.lng,
      };

      if (activeField === 'origin') {
        setOriginPlace(place);
        setOriginText(suggestion.mainText);
        dispatch(setOrigin(place));

        if (destPlace) {
          calculateEstimate(place, destPlace);
        } else {
          setStep(STEP.IDLE);
          setActiveField(null);
          setTimeout(() => destInputRef.current?.focus(), 200);
        }
      } else {
        setDestPlace(place);
        setDestText(suggestion.mainText);
        dispatch(setDestination(place));

        const currentOrigin = originPlace ?? (location
          ? { address: t('home_my_location'), lat: location.latitude, lng: location.longitude }
          : null);

        if (currentOrigin) {
          if (!originPlace) {
            setOriginPlace(currentOrigin);
            setOriginText(t('home_my_location'));
            dispatch(setOrigin(currentOrigin));
          }
          calculateEstimate(currentOrigin, place);
        } else {
          Alert.alert(t('home_origin_req_title'), t('home_origin_req_msg'));
          setStep(STEP.IDLE);
        }
      }
    } catch (error) {
      Alert.alert('Error', t('home_place_error'));
      setStep(STEP.IDLE);
    }
  };

  // ── Request trip ─────────────────────────────────────────────────────────────
  const handleRequestTrip = async () => {
    const fare = estimate?.fares?.[selectedCategory]?.fare;
    if (fare > MAX_FARE) {
      Alert.alert(
        t('home_fare_limit_title'),
        t('home_fare_limit_msg', formatCOP(fare), formatCOP(MAX_FARE)),
      );
      return;
    }

    setStep(STEP.REQUESTING);
    try {
      const origin = originPlace ?? {
        address: t('home_my_location'),
        lat:     location.latitude,
        lng:     location.longitude,
      };

      const result = await tripApi.create({
        origin:          { address: origin.address,    lat: origin.lat,    lng: origin.lng },
        destination:     { address: destPlace.address, lat: destPlace.lat, lng: destPlace.lng },
        vehicleCategory: selectedCategory,
        paymentMethod:   'card',
      });

      const newTrip = result.data.trip;
      dispatch(setActiveTrip(newTrip));
      navigation.navigate('FollowTravel', { tripId: newTrip._id });
    } catch (error) {
      Alert.alert('Error', t('home_trip_error', error.message));
      setStep(STEP.READY);
    }
  };

  // ── Reset to idle ─────────────────────────────────────────────────────────────
  const handleClear = () => {
    setDestPlace(null);
    setEstimate(null);
    setDestText('');
    setSuggestions([]);
    setSelectedCategory('economy');
    setActiveField(null);
    setStep(STEP.IDLE);
    if (location) {
      mapRef.current?.animateToRegion({
        latitude:      location.latitude,
        longitude:     location.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }, 400);
    }
  };

  const isRequesting  = step === STEP.REQUESTING;
  const selectedFare  = estimate?.fares?.[selectedCategory]?.fare;
  const overLimit     = selectedFare > MAX_FARE;
  const showResults   = step === STEP.SEARCHING;

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
        {originPlace && (
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
        {/* Nearby driver markers */}
        {nearbyDrivers.map(driver => {
          if (!driver.currentLocation) return null;
          const isNearest = nearestDriver?._id === driver._id;
          return (
            <Marker
              key={driver._id}
              coordinate={{ latitude: driver.currentLocation.lat, longitude: driver.currentLocation.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={[styles.driverMarker, isNearest && styles.driverMarkerNearest]}>
                <Icon
                  name="car"
                  size={isNearest ? 16 : 13}
                  color={isNearest ? COLORS.white : COLORS.primary}
                />
              </View>
            </Marker>
          );
        })}

        {/* Route polyline when estimate is ready */}
        {estimate?.route?.polyline && (
          <Polyline
            coordinates={decodePolyline(estimate.route.polyline)}
            strokeColor={COLORS.primary}
            strokeWidth={4}
            lineDashPattern={[0]}
          />
        )}
      </MapView>

      {/* ── My location button (native GPS fresh fix) ── */}
      <TouchableOpacity
        style={styles.myLocationBtn}
        disabled={gettingGPS}
        onPress={async () => {
          if (Platform.OS === 'android') {
            const already = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            );
            if (!already) {
              const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              );
              if (result !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert(t('home_gps_perm_title'), t('home_gps_perm_msg'));
                return;
              }
            }
          }
          setGettingGPS(true);
          Geolocation.getCurrentPosition(
            ({ coords }) => {
              setGettingGPS(false);
              const gpsPlace = {
                address: t('home_my_location'),
                lat:     coords.latitude,
                lng:     coords.longitude,
              };
              setOriginPlace(gpsPlace);
              setOriginText(t('home_my_location'));
              setActiveField(null);
              setSuggestions([]);
              dispatch(setOrigin(gpsPlace));
              mapRef.current?.animateToRegion({
                latitude:      coords.latitude,
                longitude:     coords.longitude,
                latitudeDelta:  0.01,
                longitudeDelta: 0.01,
              }, 400);
              if (destPlace && step !== STEP.REQUESTING) {
                calculateEstimate(gpsPlace, destPlace);
              }
            },
            (err) => {
              setGettingGPS(false);
              if (err.code === 1) {
                Alert.alert(t('home_gps_perm_title'), t('home_gps_perm_msg'));
              } else if (err.code === 2) {
                Alert.alert(t('home_gps_title'), t('home_gps_unavailable'));
              } else {
                Alert.alert(t('home_gps_title'), t('home_gps_timeout'));
              }
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 },
          );
        }}
      >
        {gettingGPS
          ? <ActivityIndicator size="small" color={COLORS.primary} />
          : <Icon name="locate" size={22} color={COLORS.primary} />
        }
      </TouchableOpacity>

      {/* ── Bottom panel ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomPanelWrapper}
      >
        <View style={styles.bottomPanel}>

          {/* Greeting */}
          <Text style={styles.greeting}>
            {t('home_greeting', dbUser?.fullName?.split(' ')[0] ?? t('home_traveler'))}
          </Text>

          {/* Drivers available + nearest driver info */}
          {nearbyDrivers.length > 0 && step === STEP.IDLE && (
            <View style={styles.driversRow}>
              <View style={styles.driversAvailableChip}>
                <View style={styles.driversDot} />
                <Text style={styles.driversAvailableText}>
                  {t('home_drivers_available', nearbyDrivers.length)}
                </Text>
              </View>
              {nearestDriver && nearestDistKm && (
                <View style={styles.nearestDriverChip}>
                  <Icon name="navigate" size={11} color={COLORS.primary} />
                  <Text style={styles.nearestDriverText}>
                    {t('home_nearest_driver')} · {t('home_driver_km_away', nearestDistKm)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Origin input ── */}
          <View style={[styles.inputRow, activeField === 'origin' && styles.inputRowFocused]}>
            <View style={styles.dotOrigin} />
            <TextInput
              style={styles.locationInput}
              placeholder={t('home_origin_ph')}
              placeholderTextColor={COLORS.gray}
              value={originText}
              onFocus={() => {
                setActiveField('origin');
                // Clear "Mi ubicación actual" to let user type freely
                if (originText === 'Mi ubicación actual') setOriginText('');
              }}
              onBlur={() => {
                // Restore GPS text if user cleared without selecting
                if (!originText.trim() && originPlace) setOriginText(originPlace.address);
              }}
              onChangeText={text => handleSearchChange(text, 'origin')}
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => destInputRef.current?.focus()}
            />
            {activeField === 'origin' && originText.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setOriginText('');
                  setSuggestions([]);
                  setStep(STEP.IDLE);
                }}
              >
                <Icon name="close-circle" size={18} color={COLORS.gray} />
              </TouchableOpacity>
            )}
          </View>

          {/* Route line between dots */}
          <View style={styles.routeConnector}>
            <View style={styles.routeLine} />
          </View>

          {/* ── Destination input ── */}
          <View style={[styles.inputRow, activeField === 'destination' && styles.inputRowFocused]}>
            <View style={styles.dotDest} />
            <TextInput
              ref={destInputRef}
              style={styles.locationInput}
              placeholder={t('home_dest_ph')}
              placeholderTextColor={COLORS.gray}
              value={destText}
              onFocus={() => setActiveField('destination')}
              onChangeText={text => handleSearchChange(text, 'destination')}
              autoCorrect={false}
              returnKeyType="search"
            />
            {(destText.length > 0 || step === STEP.READY) && (
              <TouchableOpacity onPress={handleClear}>
                <Icon
                  name={step === STEP.READY ? 'refresh' : 'close-circle'}
                  size={18}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Suggestions list ── */}
          {showResults && (
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
              ListEmptyComponent={() => (
                <Text style={styles.noResults}>{t('home_no_results')}</Text>
              )}
            />
          )}

          {/* ── Estimating loader ── */}
          {step === STEP.ESTIMATING && (
            <View style={styles.estimatingRow}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.estimatingText}>{t('home_estimating')}</Text>
            </View>
          )}

          {/* ── Ready: vehicle + fare + request button ── */}
          {step === STEP.READY && estimate && (
            <>
              <View style={styles.routeSummary}>
                <Icon name="navigate-outline" size={16} color={COLORS.primary} />
                <Text style={styles.routeText}>
                  {estimate.route.distanceText} · {estimate.route.durationText}
                </Text>
              </View>

              <VehicleSelector
                fares={estimate.fares}
                selected={selectedCategory}
                onSelect={setSelectedCategory}
              />

              <View style={styles.fareRow}>
                <View>
                  <Text style={styles.fareLabel}>{t('home_fare_label')}</Text>
                  {overLimit && (
                    <Text style={styles.limitWarning}>
                      {t('home_fare_over', formatCOP(MAX_FARE))}
                    </Text>
                  )}
                </View>
                <Text style={[styles.fareAmount, overLimit && styles.fareAmountOver]}>
                  {selectedFare != null ? formatCOP(selectedFare) : '—'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.requestBtn, (overLimit || isRequesting) && styles.requestBtnDisabled]}
                onPress={handleRequestTrip}
                disabled={overLimit || isRequesting}
                activeOpacity={0.85}
              >
                {isRequesting
                  ? <ActivityIndicator color={COLORS.white} />
                  : <>
                      <Icon name="car" size={18} color={COLORS.white} />
                      <Text style={styles.requestBtnText}>{t('home_request_btn')}</Text>
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

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  inputRowFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F7FF',
  },

  dotOrigin: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.primary, borderWidth: 2, borderColor: '#fff',
    shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 3, elevation: 2,
  },
  dotDest: { width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.danger },

  locationInput: { flex: 1, fontSize: FONT.base, color: COLORS.dark, paddingVertical: 4 },

  routeConnector: { alignItems: 'flex-start', paddingLeft: 14, marginVertical: 1 },
  routeLine:      { width: 2, height: 10, backgroundColor: COLORS.lightGray, marginLeft: 5 },

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

  // Driver markers on map
  driverMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.white,
    borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  driverMarkerNearest: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    width: 42, height: 42, borderRadius: 21,
    shadowOpacity: 0.3,
  },

  // Drivers available chips in bottom panel
  driversRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: SPACING.sm, flexWrap: 'wrap',
  },
  driversAvailableChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F0FFF4', borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#A8E6CF',
  },
  driversDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  driversAvailableText: { fontSize: 11, color: '#2d7a44', fontWeight: '600' },
  nearestDriverChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EEF5FF', borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#B8D4FF',
  },
  nearestDriverText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
});
