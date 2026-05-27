import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView, PermissionsAndroid, Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import decodePolyline from '../utils/decodePolyline';
import Icon from 'react-native-vector-icons/Ionicons';

import { useDispatch, useSelector } from 'react-redux';
import { setOrigin, setDestination, setActiveTrip } from '../store/slices/tripSlice';
import { useAuth }     from '../context/AuthContext';
import useLocation     from '../hooks/useLocation';
import placesApi       from '../api/placesApi';
import tripApi         from '../api/tripApi';
import VehicleSelector from '../components/trip/VehicleSelector';
import { formatCOP }   from '../utils/formatters';
import { COLORS, RADIUS, FONT, SPACING, SHADOW } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';
import { useFocusEffect } from '@react-navigation/native';
import { seedSimulatedDrivers, DRIVER_PROFILES, OFFSETS } from '../utils/seedDrivers';

const MAX_FARE       = 200000;
const DEBOUNCE_MS    = 400;
const DEFAULT_REGION = { latitude: 4.7110, longitude: -74.0721, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const CARD_WIDTH     = Dimensions.get('window').width - SPACING.md * 2; // full panel inner width

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
  const activeTrip   = useSelector(state => state.trip.activeTrip);

  const mapRef          = useRef(null);
  const debounceRef     = useRef(null);
  const sessionToken    = useRef(String(Date.now()));
  const destInputRef    = useRef(null);
  const activeTripRef   = useRef(null);  // mirror of activeTrip for use inside stable callbacks
  const hadActiveTripRef = useRef(false); // true when we left HomeScreen with an active trip

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
  const [driverPositions,  setDriverPositions]  = useState({}); // { driverId: { lat, lng } }
  const [selectedDriverId, setSelectedDriverId] = useState(null);

  const intervalRef       = useRef(null);
  const userLocRef        = useRef(null);
  const driversSeeded     = useRef(false);
  const gpsRejected       = useRef(false);
  const geocodePromiseRef = useRef(null);
  const carouselRef       = useRef(null);
  const carouselTimerRef  = useRef(null);

  const [carouselIndex, setCarouselIndex] = useState(0);

  // Keep latest user location accessible in movement interval without re-creating it
  useEffect(() => { userLocRef.current = location; }, [location]);

  // Keep activeTripRef in sync for use inside stable callbacks
  useEffect(() => { activeTripRef.current = activeTrip; }, [activeTrip]);

  // Reset all trip-related UI state (called on return from FollowTravelScreen)
  const resetHomeState = useCallback(() => {
    setDestPlace(null);
    setEstimate(null);
    setDestText('');
    setSuggestions([]);
    setSelectedCategory('economy');
    setActiveField(null);
    setSelectedDriverId(null);
    setStep(STEP.IDLE);
    gpsRejected.current = false;
    sessionToken.current = String(Date.now());

    const loc = userLocRef.current;
    if (loc) {
      const preliminary = { address: 'Mi ubicación actual', lat: loc.latitude, lng: loc.longitude };
      setOriginPlace(preliminary);
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
    } else {
      setOriginPlace(null);
      setOriginText('');
      setMapRegion(DEFAULT_REGION);
    }
  }, []); // only uses refs and stable setters



  // Detect return from FollowTravelScreen and reset state
  useFocusEffect(
    useCallback(() => {
      if (hadActiveTripRef.current && !activeTripRef.current) {
        resetHomeState();
      }
      hadActiveTripRef.current = false;

      return () => {
        // When leaving HomeScreen, record whether a trip was in progress
        if (activeTripRef.current) hadActiveTripRef.current = true;
      };
    }, [resetHomeState])
  );

  // Build drivers locally from DRIVER_PROFILES as soon as GPS is known.
  // This guarantees the simulation always runs regardless of Firestore availability.
  // Firestore seeding runs in background for persistence only.
  useEffect(() => {
    if (!location || driversSeeded.current) return;
    driversSeeded.current = true;

    const localDrivers = DRIVER_PROFILES.map((d, i) => ({
      _id: d.id,
      id:  d.id,
      fullName:      d.fullName,
      vehicleInfo:   d.vehicle,
      rating:        d.rating,
      licenseNumber: d.licenseNumber,
      status:        'available',
      isSimulated:   true,
      currentLocation: {
        lat: location.latitude  + OFFSETS[i].dlat,
        lng: location.longitude + OFFSETS[i].dlng,
      },
    }));
    setNearbyDrivers(localDrivers);

    // Persist to Firestore in background (best effort — not required for the simulation)
    seedSimulatedDrivers(location.latitude, location.longitude).catch(() => {});
  }, [location]);

  // Auto-advance carousel every 3 s; pauses when user has manually selected a driver
  useEffect(() => {
    clearInterval(carouselTimerRef.current);
    if (nearbyDrivers.length < 2 || step !== STEP.IDLE || selectedDriverId) return;
    carouselTimerRef.current = setInterval(() => {
      setCarouselIndex(prev => {
        const next = (prev + 1) % nearbyDrivers.length;
        try { carouselRef.current?.scrollToIndex({ index: next, animated: true }); } catch (_) {}
        return next;
      });
    }, 3000);
    return () => clearInterval(carouselTimerRef.current);
  }, [nearbyDrivers.length, step, selectedDriverId]);

  // Scroll carousel to the driver selected via map tap
  useEffect(() => {
    if (!selectedDriverId) return;
    const idx = nearbyDrivers.findIndex(d => d._id === selectedDriverId);
    if (idx >= 0) {
      setCarouselIndex(idx);
      try { carouselRef.current?.scrollToIndex({ index: idx, animated: true }); } catch (_) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDriverId]);

  // Start movement simulation once drivers are loaded
  useEffect(() => {
    if (nearbyDrivers.length === 0) return;

    // Initialise positions from Firestore data
    const initial = {};
    nearbyDrivers.forEach(d => {
      if (d.currentLocation) {
        initial[d._id] = { lat: d.currentLocation.lat, lng: d.currentLocation.lng };
      }
    });
    setDriverPositions(initial);

    // Move each driver slightly every 2s; pull back if they drift too far from user
    intervalRef.current = setInterval(() => {
      const center = userLocRef.current;
      setDriverPositions(prev => {
        const next = {};
        for (const [id, pos] of Object.entries(prev)) {
          const STEP       = 0.00015; // ~11 m per tick — smooth urban movement
          const MAX_RADIUS = 0.010;   // ~1.1 km max drift — keeps drivers in map view
          let dlat = (Math.random() - 0.5) * STEP * 2;
          let dlng = (Math.random() - 0.5) * STEP * 2;
          if (center) {
            const offLat = pos.lat - center.latitude;
            const offLng = pos.lng - center.longitude;
            if (Math.abs(offLat) > MAX_RADIUS) dlat -= offLat * 0.2;
            if (Math.abs(offLng) > MAX_RADIUS) dlng -= offLng * 0.2;
          }
          next[id] = { lat: pos.lat + dlat, lng: pos.lng + dlng };
        }
        return next;
      });
    }, 2000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyDrivers.length]);

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

  // ── Find nearest driver using live driverPositions (updates every 2s) ────────
  const { nearestDriver, nearestDistKm } = useMemo(() => {
    const ids = Object.keys(driverPositions);
    if (!ids.length) return { nearestDriver: null, nearestDistKm: null };

    const ref = originPlace ?? (userLocRef.current
      ? { lat: userLocRef.current.latitude, lng: userLocRef.current.longitude }
      : null);
    if (!ref) return { nearestDriver: nearbyDrivers[0] ?? null, nearestDistKm: null };

    let bestId   = ids[0];
    let bestDist = haversineKm(ref.lat, ref.lng, driverPositions[bestId].lat, driverPositions[bestId].lng);
    for (const id of ids.slice(1)) {
      const dist = haversineKm(ref.lat, ref.lng, driverPositions[id].lat, driverPositions[id].lng);
      if (dist < bestDist) { bestId = id; bestDist = dist; }
    }
    const driver = nearbyDrivers.find(d => d._id === bestId) ?? null;
    return { nearestDriver: driver, nearestDistKm: bestDist.toFixed(1) };
  }, [originPlace, driverPositions, nearbyDrivers]);

  // ── Featured driver: explicitly selected or auto-nearest ────────────────────
  const featuredDriver = useMemo(() => {
    if (selectedDriverId) return nearbyDrivers.find(d => d._id === selectedDriverId) ?? nearestDriver;
    return nearestDriver;
  }, [selectedDriverId, nearbyDrivers, nearestDriver]);

  const featuredDriverDist = useMemo(() => {
    if (!featuredDriver) return null;
    if (!selectedDriverId) return nearestDistKm; // already computed by nearestDriver memo
    const pos = driverPositions[featuredDriver._id];
    if (!pos) return null;
    const ref = originPlace ?? (userLocRef.current
      ? { lat: userLocRef.current.latitude, lng: userLocRef.current.longitude }
      : null);
    if (!ref) return null;
    return haversineKm(ref.lat, ref.lng, pos.lat, pos.lng).toFixed(1);
  }, [featuredDriver, selectedDriverId, nearestDistKm, driverPositions, originPlace]);

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
        profilePic: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        phone:      featuredDriver.vehicleInfo?.plate ?? '',
      } : null;
      const simDriverPos = featuredDriver ? driverPositions[featuredDriver._id] : null;

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
              tracksViewChanges={isHighlighted}
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
            <View style={styles.driversSection}>
              {/* Count chip + hint */}
              <View style={styles.driversRow}>
                <View style={styles.driversAvailableChip}>
                  <View style={styles.driversDot} />
                  <Text style={styles.driversAvailableText}>
                    {t('home_drivers_available', nearbyDrivers.length)}
                  </Text>
                </View>
                <Text style={styles.tapHintText}>{t('home_tap_driver_hint')}</Text>
              </View>

              {/* Horizontal paging carousel — one card per driver */}
              <FlatList
                ref={carouselRef}
                data={nearbyDrivers}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item._id}
                getItemLayout={(_, index) => ({
                  length: CARD_WIDTH, offset: CARD_WIDTH * index, index,
                })}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
                  setCarouselIndex(idx);
                }}
                renderItem={({ item: driver }) => {
                  const pos        = driverPositions[driver._id];
                  const isNearest  = nearestDriver?._id === driver._id;
                  const isSelected = selectedDriverId === driver._id;
                  const ref        = originPlace ?? (userLocRef.current
                    ? { lat: userLocRef.current.latitude, lng: userLocRef.current.longitude }
                    : null);
                  const dist = pos && ref
                    ? haversineKm(ref.lat, ref.lng, pos.lat, pos.lng).toFixed(1)
                    : null;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[
                        styles.driverCard,
                        { width: CARD_WIDTH },
                        isNearest  && !isSelected && styles.driverCardNearest,
                        isSelected && styles.driverCardSelected,
                      ]}
                      onPress={() => setSelectedDriverId(prev =>
                        prev === driver._id ? null : driver._id,
                      )}
                    >
                      <View style={[
                        styles.driverCardAvatar,
                        isSelected && { backgroundColor: COLORS.success },
                        isNearest && !isSelected && { backgroundColor: COLORS.primary },
                      ]}>
                        <Icon name="person" size={18} color={COLORS.white} />
                      </View>

                      <View style={styles.driverCardBody}>
                        <Text style={styles.driverCardName}>{driver.fullName}</Text>
                        <Text style={styles.driverCardCar}>
                          {driver.vehicleInfo?.make} {driver.vehicleInfo?.model} {driver.vehicleInfo?.year}
                        </Text>
                        <Text style={styles.driverCardPlate}>
                          {driver.vehicleInfo?.color} · {driver.vehicleInfo?.plate}
                        </Text>
                      </View>

                      <View style={styles.driverCardRight}>
                        <View style={styles.driverCardRatingRow}>
                          <Icon name="star" size={11} color="#FF9500" />
                          <Text style={styles.driverCardRating}>{driver.rating}</Text>
                        </View>
                        {dist != null && (
                          <>
                            <Text style={styles.driverCardDist}>{dist} km</Text>
                            <Text style={styles.driverCardEta}>
                              {t('home_driver_eta', Math.max(1, Math.round(Number(dist) * 3)))}
                            </Text>
                          </>
                        )}
                        {isSelected ? (
                          <View style={[styles.driverBadge, styles.driverBadgeSelected]}>
                            <Text style={styles.driverBadgeText}>{t('home_driver_selected')}</Text>
                          </View>
                        ) : isNearest ? (
                          <View style={[styles.driverBadge, styles.driverBadgeNearest]}>
                            <Text style={styles.driverBadgeText}>{t('home_nearest_driver')}</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Pagination dots */}
              <View style={styles.dotsRow}>
                {nearbyDrivers.map((_, i) => (
                  <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
                ))}
              </View>
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
  driverMarkerSelected: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
    width: 44, height: 44, borderRadius: 22,
    shadowOpacity: 0.4,
  },

  // Drivers section in bottom panel
  driversSection: { marginBottom: SPACING.sm },
  driversRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8, flexWrap: 'wrap',
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
  tapHintText: { fontSize: 11, color: COLORS.gray, flex: 1 },

  // Carousel driver card
  driverCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderRadius: 12, padding: 10,
    borderWidth: 1.5, borderColor: '#D0E4FF',
    gap: 10,
    ...SHADOW.card,
  },
  driverCardNearest: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF6FF',
  },
  driverCardSelected: {
    borderColor: COLORS.success,
    backgroundColor: '#F0FFF4',
  },
  driverCardAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  driverCardBody: { flex: 1 },
  driverCardName: { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark },
  driverCardCar:  { fontSize: FONT.sm, color: COLORS.gray, marginTop: 1 },
  driverCardPlate: { fontSize: FONT.sm, color: COLORS.gray },
  driverCardRight: { alignItems: 'flex-end', gap: 3 },
  driverCardRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  driverCardRating: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.dark },
  driverCardDist: { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },
  driverCardEta:  { fontSize: 11, color: COLORS.gray },
  driverBadge: {
    borderRadius: 10, paddingVertical: 2, paddingHorizontal: 7,
  },
  driverBadgeNearest:  { backgroundColor: '#EEF5FF' },
  driverBadgeSelected: { backgroundColor: '#E8F8EE' },
  driverBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },

  // Pagination dots
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 7, gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#D0D5DD',
  },
  dotActive: {
    width: 18, height: 6, borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
});
