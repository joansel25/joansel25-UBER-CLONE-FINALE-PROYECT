import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView, Dimensions, Animated,
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
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
import { useTheme }        from '../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { requestLocationPermission } from '../hooks/useLocationPermission';
import useDriverSimulation from '../hooks/useDriverSimulation';
import DriverCarousel      from '../components/trip/DriverCarousel';

const MAX_FARE       = 200000;
const DEBOUNCE_MS    = 400;
const DEFAULT_REGION = { latitude: 4.7110, longitude: -74.0721, latitudeDelta: 0.022, longitudeDelta: 0.022 };
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
  const { colors, isDark } = useTheme();
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

  // Current user coordinates (shorthand for map circle + pulsing marker)
  const userCoord = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;

  // Pulsing ring animation for the user dot marker
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Sonar ripple for the coverage-radius circle — 3 rings phase-shifted by 1/3 cycle.
  // Updates at 4 fps; each ring expands from 300 m to 1 400 m while fading out.
  const [ripplePhase, setRipplePhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRipplePhase(p => (p + 1) % 12), 250);
    return () => clearInterval(id);
  }, []);

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
    const userRegion = {
      latitude:      location.latitude,
      longitude:     location.longitude,
      latitudeDelta:  0.022,
      longitudeDelta: 0.022,
    };
    setMapRegion(userRegion);
    // animateToRegion guarantees a smooth fly-in even on the first render
    mapRef.current?.animateToRegion(userRegion, 800);

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

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        showsMyLocationButton={false}
        customMapStyle={colors.mapStyle ?? []}
      >
        {/* Coverage area — static translucent fill */}
        {userCoord && (
          <Circle
            center={userCoord}
            radius={1400}
            fillColor="rgba(0, 122, 255, 0.04)"
            strokeColor="transparent"
            strokeWidth={0}
          />
        )}

        {/* Sonar ripple — 3 rings expanding outward, phase-shifted 1/3 cycle each */}
        {userCoord && [0, 4, 8].map((offset, i) => {
          const p = ((ripplePhase + offset) % 12) / 12; // 0..1 progress
          return (
            <Circle
              key={`ripple-${i}`}
              center={userCoord}
              radius={Math.round(300 + p * 1100)}
              fillColor="transparent"
              strokeColor={`rgba(0, 122, 255, ${(0.55 * (1 - p)).toFixed(2)})`}
              strokeWidth={1.8}
            />
          );
        })}

        {/* Pulsing user location indicator (replaces default blue dot) */}
        {userCoord && (
          <Marker coordinate={userCoord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.userMarkerWrap}>
              <Animated.View style={[styles.userPulseRing, {
                opacity:   pulseAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.7, 0.2, 0] }),
                transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] }) }],
              }]} />
              <View style={styles.userDot} />
            </View>
          </Marker>
        )}

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

        {/* Driver markers — profile photo + car badge; reposition every 2 s */}
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
              anchor={{ x: 0.5, y: 0.9 }}
              tracksViewChanges={true}
              onPress={() => setSelectedDriverId(prev => prev === driver._id ? null : driver._id)}
            >
              <View style={styles.driverMarkerWrap}>
                {isHighlighted && (
                  <View style={[
                    styles.driverMarkerRing,
                    isSelected && styles.driverMarkerRingSelected,
                  ]} />
                )}
                <View style={[
                  styles.driverMarkerFallback,
                  isHighlighted && styles.driverMarkerFallbackActive,
                ]}>
                  <Icon name="car-sport" size={18} color={isHighlighted ? COLORS.white : COLORS.primary} />
                </View>
                <View style={[styles.driverMarkerPointer, isHighlighted && styles.driverMarkerPointerActive]} />
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
        style={[styles.myLocationBtn, { backgroundColor: colors.surface }]}
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
        <View style={[styles.bottomPanel, { backgroundColor: colors.surface }]}>

          {/* Greeting */}
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>
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
          <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: activeField === 'origin' ? colors.primary : 'transparent' }]}>
            <View style={styles.dotOrigin} />
            <TextInput
              style={[styles.locationInput, { color: colors.textPrimary }]}
              placeholder={t('home_origin_ph')}
              placeholderTextColor={colors.textSecondary}
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
          <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: activeField === 'destination' ? colors.primary : 'transparent' }]}>
            <View style={styles.dotDest} />
            <TextInput
              ref={destInputRef}
              style={[styles.locationInput, { color: colors.textPrimary }]}
              placeholder={t('home_dest_ph')}
              placeholderTextColor={colors.textSecondary}
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

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    map:       { flex: 1 },

    myLocationBtn: {
      position: 'absolute', top: 16, right: 16,
      backgroundColor: colors.surface, borderRadius: RADIUS.full,
      padding: 10, ...SHADOW.card,
    },

    bottomPanelWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    bottomPanel: {
      backgroundColor: colors.surface,
      borderTopLeftRadius:  20,
      borderTopRightRadius: 20,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
      ...SHADOW.card,
      shadowOffset: { width: 0, height: -2 },
    },

    greeting: { fontSize: FONT.md, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACING.sm },

    inputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 8, paddingHorizontal: 10,
      borderRadius: 10, backgroundColor: colors.inputBg,
      borderWidth: 1, borderColor: 'transparent', marginBottom: 4,
    },

    dotOrigin: {
      width: 12, height: 12, borderRadius: 6,
      backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface,
      shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 3, elevation: 2,
    },
    dotDest: { width: 12, height: 12, borderRadius: 3, backgroundColor: colors.danger },

    locationInput: { flex: 1, fontSize: FONT.base, color: colors.textPrimary, paddingVertical: 4 },

    routeConnector: { alignItems: 'flex-start', paddingLeft: 14, marginVertical: 1 },
    routeLine:      { width: 2, height: 10, backgroundColor: colors.border, marginLeft: 5 },

    suggestionList: { maxHeight: 220, marginTop: 4 },
    separator:      { height: 1, backgroundColor: colors.border },
    suggestionItem: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, paddingHorizontal: 4,
    },
    suggestionIcon:      { marginRight: 12 },
    suggestionTexts:     { flex: 1 },
    suggestionMain:      { fontSize: FONT.base, fontWeight: '600', color: colors.textPrimary },
    suggestionSecondary: { fontSize: FONT.sm, color: colors.textSecondary, marginTop: 2 },
    noResults:           { textAlign: 'center', color: colors.textSecondary, paddingVertical: 16, fontSize: FONT.base },

    estimatingRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: SPACING.sm,
    },
    estimatingText: { fontSize: FONT.base, color: colors.textSecondary },

    routeSummary: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      marginBottom: SPACING.sm,
    },
    routeText: { fontSize: FONT.base, color: colors.textPrimary, fontWeight: '600' },

    fareRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      marginTop: SPACING.sm, marginBottom: SPACING.sm,
    },
    fareLabel:      { fontSize: FONT.sm, color: colors.textSecondary },
    limitWarning:   { fontSize: 11, color: colors.danger, fontWeight: '600', marginTop: 2 },
    fareAmount:     { fontSize: FONT.xl, fontWeight: '800', color: colors.textPrimary },
    fareAmountOver: { color: colors.danger },

    requestBtn: {
      backgroundColor: colors.success,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 14, borderRadius: RADIUS.sm, marginTop: 4,
    },
    requestBtnDisabled: { opacity: 0.55 },
    requestBtnText:     { color: '#fff', fontSize: FONT.md, fontWeight: '700' },

    // User location indicator
    userMarkerWrap: { alignItems: 'center', justifyContent: 'center', width: 64, height: 64 },
    userPulseRing: {
      position: 'absolute', width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(10, 99, 255, 0.30)',
      borderWidth: 2, borderColor: 'rgba(10, 99, 255, 0.75)',
    },
    userDot: {
      width: 17, height: 17, borderRadius: 9,
      backgroundColor: '#0A63FF',
      borderWidth: 2.5, borderColor: colors.surface,
      shadowColor: '#0A63FF', shadowOpacity: 0.80, shadowRadius: 6, elevation: 8,
    },

    // Driver markers on map
    driverMarkerWrap: { alignItems: 'center' },
    driverMarkerRing: {
      position: 'absolute', width: 54, height: 54, borderRadius: 12,
      borderWidth: 2.5, borderColor: colors.primary,
      top: -5, left: -5,
    },
    driverMarkerRingSelected: { borderColor: colors.success },
    driverMarkerFallback: {
      width: 44, height: 44, borderRadius: 10,
      backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    driverMarkerFallbackActive: { backgroundColor: colors.primary },
    driverMarkerPointer: {
      width: 0, height: 0, marginTop: 1,
      borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderTopColor: colors.surface,
    },
    driverMarkerPointerActive: { borderTopColor: colors.primary },
  });
}
