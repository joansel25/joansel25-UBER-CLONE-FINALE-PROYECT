import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView, Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import decodePolyline from '../utils/decodePolyline';
import Icon from 'react-native-vector-icons/Ionicons';

import { useDispatch } from 'react-redux';
import { setOrigin, setDestination, setActiveTrip, clearTrip } from '../store/slices/tripSlice';
import { useAuth }        from '../context/AuthContext';
import useLocation        from '../hooks/useLocation';
import placesApi          from '../api/placesApi';
import tripApi            from '../api/tripApi';
import VehicleSelector    from '../components/trip/VehicleSelector';
import { formatCOP }      from '../utils/formatters';
import { COLORS, RADIUS, FONT, SPACING, SHADOW } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';
import { useFocusEffect } from '@react-navigation/native';
import { requestLocationPermission } from '../hooks/useLocationPermission';
import useDriverSimulation from '../hooks/useDriverSimulation';
import DriverCarousel      from '../components/trip/DriverCarousel';

const MAX_FARE       = 200000;
const DEBOUNCE_MS    = 400;
const DEFAULT_REGION = { latitude: 6.2518, longitude: -7.334892, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const CARD_WIDTH     = Dimensions.get('window').width - SPACING.md * 2; // full panel inner width

const STEP = {
  IDLE:       'idle',
  SEARCHING:  'searching',
  ESTIMATING: 'estimating',
  READY:      'ready',
  REQUESTING: 'requesting',
};

export default function HomeScreen({ navigation }) {
  const dispatch     = useDispatch();
  const { dbUser }   = useAuth();
  const { location } = useLocation();
  const { t }        = useTranslation();
  const mapRef          = useRef(null);
  const debounceRef     = useRef(null);
  const sessionToken    = useRef(String(Date.now()));
  const destInputRef    = useRef(null);
  const wentToTripRef   = useRef(false);
  const gpsRejected     = useRef(false);
  const geocodePromiseRef = useRef(null);

  const [step,             setStep]             = useState(STEP.IDLE);
  const [activeField,      setActiveField]      = useState(null);
  const [originText,       setOriginText]       = useState('');
  const [destText,         setDestText]         = useState('');
  const [suggestions,      setSuggestions]      = useState([]);
  const [originPlace,      setOriginPlace]      = useState(null);
  const [destPlace,        setDestPlace]        = useState(null);
  const [estimate,         setEstimate]         = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('economy');
  const [mapRegion,        setMapRegion]        = useState(DEFAULT_REGION);
  const [gettingGPS,       setGettingGPS]       = useState(false);

  const {
    nearbyDrivers, driverPositions,
    selectedDriverId, setSelectedDriverId,
    carouselIndex, setCarouselIndex, carouselRef,
    nearestDriver, nearestDistKm,
    featuredDriver, featuredDriverDist,
    userLocRef, resetDrivers,
  } = useDriverSimulation({ location, originPlace, step });

  // Reset all trip-related UI state (called on return from FollowTravelScreen)
  const resetHomeState = useCallback(() => {
    setDestPlace(null);
    setEstimate(null);
    setDestText('');
    setSuggestions([]);
    setSelectedCategory('economy');
    setActiveField(null);
    setStep(STEP.IDLE);
    gpsRejected.current = false;
    sessionToken.current = String(Date.now());

    const loc = userLocRef.current;
    if (loc) {
      setOriginPlace({ address: 'Mi ubicación actual', lat: loc.latitude, lng: loc.longitude });
      setOriginText('Mi ubicación actual');
      setMapRegion({
        latitude:      loc.latitude,
        longitude:     loc.longitude,
        latitudeDelta:  0.022,
        longitudeDelta: 0.022,
      });
      mapRef.current?.animateToRegion({
        latitude: loc.latitude, longitude: loc.longitude,
        latitudeDelta: 0.022, longitudeDelta: 0.022,
      }, 400);

      geocodePromiseRef.current = placesApi.reverseGeocode(loc.latitude, loc.longitude)
        .then(({ data }) => { setOriginPlace(data); return data; })
        .catch(() => null)
        .finally(() => { geocodePromiseRef.current = null; });

      resetDrivers(loc.latitude, loc.longitude);
    } else {
      setOriginPlace(null);
      setOriginText('');
      setMapRegion(DEFAULT_REGION);
    }
  // userLocRef is a stable ref — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetDrivers]);



  // Reset state when returning from FollowTravelScreen.
  // wentToTripRef is set synchronously before navigation so there is no race
  // condition with async effect updates.
  useFocusEffect(
    useCallback(() => {
      if (wentToTripRef.current) {
        wentToTripRef.current = false;
        resetHomeState();
        dispatch(clearTrip());
      }
    }, [resetHomeState, dispatch])
  );

  // ── Set origin from GPS on first fix ────────────────────────────────────────
  useEffect(() => {
    if (!location || originPlace || gpsRejected.current) return;

    // Set preliminary origin immediately so the map responds
    const preliminary = {
      address: t('home_my_location'),
      lat:     location.latitude,
      lng:     location.longitude,
    };
    setOriginPlace(preliminary);
    setOriginText(t('home_my_location'));
    setMapRegion({
      latitude:      location.latitude,
      longitude:     location.longitude,
      latitudeDelta:  0.022,
      longitudeDelta: 0.022,
    });

    // Reverse geocode to get road-snapped coordinates for reliable routing.
    // Store the promise so calculateEstimate can await it if needed (race condition fix).
    geocodePromiseRef.current = placesApi.reverseGeocode(location.latitude, location.longitude)
      .then(({ data }) => { setOriginPlace(data); return data; })
      .catch(() => null)
      .finally(() => { geocodePromiseRef.current = null; });
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

    // If reverse geocoding is still in progress, wait for it.
    // This avoids the race condition where raw GPS coords are used before
    // the road-snapped geocoded coords are ready.
    let routeOrigin = origin;
    if (geocodePromiseRef.current) {
      const geocoded = await geocodePromiseRef.current;
      if (geocoded) routeOrigin = geocoded;
    }

    try {
      const result = await tripApi.estimate({
        originLat: routeOrigin.lat,
        originLng: routeOrigin.lng,
        destLat:   dest.lat,
        destLng:   dest.lng,
      });
      setEstimate(result.data);

      mapRef.current?.fitToCoordinates(
        [
          { latitude: routeOrigin.lat, longitude: routeOrigin.lng },
          { latitude: dest.lat,        longitude: dest.lng },
        ],
        { edgePadding: { top: 80, right: 60, bottom: 340, left: 60 }, animated: true },
      );
      setStep(STEP.READY);
    } catch (error) {
      if (error.googleStatus === 'ZERO_RESULTS') {
        Alert.alert(t('home_route_error'), t('home_no_route'));
      } else {
        Alert.alert(t('home_route_error'), t('home_route_error_msg', error.message));
      }
      setStep(STEP.IDLE);
    }
  }, [t]);

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

        const gpsOrigin = !originPlace && location
          ? { address: t('home_my_location'), lat: location.latitude, lng: location.longitude }
          : null;

        const currentOrigin = originPlace ?? gpsOrigin ?? null;

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

      // Build driver snapshot for simulation (use nearest/selected driver from map)
      const simDriverSnap = featuredDriver ? {
        _id:        featuredDriver._id,
        fullName:   featuredDriver.fullName,
        rating:     featuredDriver.rating,
        profilePic: featuredDriver.profilePic ?? null,
        phone:      featuredDriver.vehicleInfo?.plate ?? '',
      } : null;
      const simDriverPos = featuredDriver ? driverPositions[featuredDriver._id] : null;

      wentToTripRef.current = true; // flag set before navigate — no async race condition
      navigation.navigate('FollowTravel', { tripId: newTrip._id, simDriver: simDriverSnap, simDriverPos });
    } catch (error) {
      Alert.alert('Error', t('home_trip_error', error.message));
      setStep(STEP.READY);
    }
  };

  // ── Reset to idle ─────────────────────────────────────────────────────────────
  const handleClear = () => {
    gpsRejected.current = false;
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
        latitudeDelta:  0.022,
        longitudeDelta: 0.022,
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
        {originPlace && destPlace && (
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
        {/* Nearby driver markers — positions update every 2s; tap to select */}
        {nearbyDrivers.map(driver => {
          const pos = driverPositions[driver._id];
          if (!pos) return null;
          const isNearest    = !selectedDriverId && nearestDriver?._id === driver._id;
          const isSelected   = selectedDriverId === driver._id;
          const isHighlighted = isSelected || isNearest;
          return (
            <Marker
              key={driver._id}
              coordinate={{ latitude: pos.lat, longitude: pos.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={true}
              onPress={() => setSelectedDriverId(prev => prev === driver._id ? null : driver._id)}
            >
              <View style={[
                styles.driverMarker,
                isHighlighted && styles.driverMarkerNearest,
                isSelected    && styles.driverMarkerSelected,
              ]}>
                <Icon
                  name="car"
                  size={isHighlighted ? 16 : 13}
                  color={isHighlighted ? COLORS.white : COLORS.primary}
                />
              </View>
            </Marker>
          );
        })}

        {/* Route polyline — only when both destination and estimate exist */}
        {estimate?.route?.polyline && destPlace && (
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
          const granted = await requestLocationPermission();
          if (!granted) {
            Alert.alert(t('home_gps_perm_title'), t('home_gps_perm_msg'));
            return;
          }
          setGettingGPS(true);
          gpsRejected.current = false;
          Geolocation.getCurrentPosition(
            ({ coords }) => {
              setGettingGPS(false);
              const preliminary = {
                address: t('home_my_location'),
                lat:     coords.latitude,
                lng:     coords.longitude,
              };
              setOriginPlace(preliminary);
              setOriginText(t('home_my_location'));
              setActiveField(null);
              setSuggestions([]);
              dispatch(setOrigin(preliminary));
              mapRef.current?.animateToRegion({
                latitude:      coords.latitude,
                longitude:     coords.longitude,
                latitudeDelta:  0.022,
                longitudeDelta: 0.022,
              }, 400);

              // Reverse geocode for road-snapped coordinates, then calculate route.
              // We store the promise in geocodePromiseRef so calculateEstimate can
              // await it if the user somehow triggers it before this resolves.
              geocodePromiseRef.current = placesApi.reverseGeocode(coords.latitude, coords.longitude)
                .then(({ data: geocoded }) => {
                  setOriginPlace(geocoded);
                  dispatch(setOrigin(geocoded));
                  if (destPlace && step !== STEP.REQUESTING) {
                    calculateEstimate(geocoded, destPlace);
                  }
                  return geocoded;
                })
                .catch(() => {
                  if (destPlace && step !== STEP.REQUESTING) {
                    calculateEstimate(preliminary, destPlace);
                  }
                  return null;
                })
                .finally(() => { geocodePromiseRef.current = null; });
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
        behavior="padding"
        style={styles.bottomPanelWrapper}
      >
        <View style={styles.bottomPanel}>

          {/* Greeting */}
          <Text style={styles.greeting}>
            {t('home_greeting', dbUser?.fullName?.split(' ')[0] ?? t('home_traveler'))}
          </Text>

          {/* ── Driver carousel ── */}
          {nearbyDrivers.length > 0 && step === STEP.IDLE && (
            <DriverCarousel
              drivers={nearbyDrivers}
              driverPositions={driverPositions}
              selectedDriverId={selectedDriverId}
              setSelectedDriverId={setSelectedDriverId}
              carouselRef={carouselRef}
              carouselIndex={carouselIndex}
              setCarouselIndex={setCarouselIndex}
              nearestDriver={nearestDriver}
              originPlace={originPlace}
              userLocRef={userLocRef}
              t={t}
              cardWidth={CARD_WIDTH}
            />
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
  driverMarkerSelected: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
    width: 44, height: 44, borderRadius: 22,
    shadowOpacity: 0.4,
  },

});
