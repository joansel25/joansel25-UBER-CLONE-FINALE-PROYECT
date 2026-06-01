import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { seedSimulatedDrivers, DRIVER_PROFILES, OFFSETS } from '../utils/seedDrivers';

export function haversineKm(lat1, lng1, lat2, lng2) {
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

function buildDrivers(lat, lng) {
  return DRIVER_PROFILES.map((d, i) => ({
    _id: d.id, id: d.id,
    fullName:      d.fullName,
    vehicleInfo:   d.vehicle,
    rating:        d.rating,
    licenseNumber: d.licenseNumber,
    profilePic:    d.profilePic,
    status:        'available',
    isSimulated:   true,
    currentLocation: {
      lat: lat + OFFSETS[i].dlat,
      lng: lng + OFFSETS[i].dlng,
    },
  }));
}

export default function useDriverSimulation({ location, originPlace, step }) {
  const [nearbyDrivers,    setNearbyDrivers]    = useState([]);
  const [driverPositions,  setDriverPositions]  = useState({});
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [carouselIndex,    setCarouselIndex]    = useState(0);

  const intervalRef      = useRef(null);
  const driversSeeded    = useRef(false);
  const userLocRef       = useRef(null);
  const carouselRef      = useRef(null);
  const carouselTimerRef = useRef(null);

  useEffect(() => { userLocRef.current = location; }, [location]);

  // Seed 6 simulated drivers once the first GPS fix arrives
  useEffect(() => {
    if (!location || driversSeeded.current) return;
    driversSeeded.current = true;
    const drivers = buildDrivers(location.latitude, location.longitude);
    setNearbyDrivers(drivers);
    seedSimulatedDrivers(location.latitude, location.longitude).catch(() => {});
  }, [location]);

  // Auto-advance carousel every 3 s; stops when user manually selects a driver
  useEffect(() => {
    clearInterval(carouselTimerRef.current);
    if (nearbyDrivers.length < 2 || step !== 'idle' || selectedDriverId) return;
    carouselTimerRef.current = setInterval(() => {
      setCarouselIndex(prev => {
        const next = (prev + 1) % nearbyDrivers.length;
        try { carouselRef.current?.scrollToIndex({ index: next, animated: true }); } catch (_) {}
        return next;
      });
    }, 3000);
    return () => clearInterval(carouselTimerRef.current);
  }, [nearbyDrivers.length, step, selectedDriverId]);

  // Scroll carousel to the driver tapped on the map
  useEffect(() => {
    if (!selectedDriverId) return;
    const idx = nearbyDrivers.findIndex(d => d._id === selectedDriverId);
    if (idx >= 0) {
      setCarouselIndex(idx);
      try { carouselRef.current?.scrollToIndex({ index: idx, animated: true }); } catch (_) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDriverId]);

  // Movement simulation: nudge each driver every 2 s, pull back if too far from user
  useEffect(() => {
    if (nearbyDrivers.length === 0) return;

    const initial = {};
    nearbyDrivers.forEach(d => {
      if (d.currentLocation) {
        initial[d._id] = { lat: d.currentLocation.lat, lng: d.currentLocation.lng };
      }
    });
    setDriverPositions(initial);

    intervalRef.current = setInterval(() => {
      const center = userLocRef.current;
      setDriverPositions(prev => {
        const next = {};
        for (const [id, pos] of Object.entries(prev)) {
          const MOVE_STEP  = 0.00015;
          const MAX_RADIUS = 0.010;
          let dlat = (Math.random() - 0.5) * MOVE_STEP * 2;
          let dlng = (Math.random() - 0.5) * MOVE_STEP * 2;
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
    return {
      nearestDriver:  nearbyDrivers.find(d => d._id === bestId) ?? null,
      nearestDistKm:  bestDist.toFixed(1),
    };
  }, [originPlace, driverPositions, nearbyDrivers]);

  const featuredDriver = useMemo(() => {
    if (selectedDriverId) return nearbyDrivers.find(d => d._id === selectedDriverId) ?? nearestDriver;
    return nearestDriver;
  }, [selectedDriverId, nearbyDrivers, nearestDriver]);

  const featuredDriverDist = useMemo(() => {
    if (!featuredDriver) return null;
    if (!selectedDriverId) return nearestDistKm;
    const pos = driverPositions[featuredDriver._id];
    if (!pos) return null;
    const ref = originPlace ?? (userLocRef.current
      ? { lat: userLocRef.current.latitude, lng: userLocRef.current.longitude }
      : null);
    if (!ref) return null;
    return haversineKm(ref.lat, ref.lng, pos.lat, pos.lng).toFixed(1);
  }, [featuredDriver, selectedDriverId, nearestDistKm, driverPositions, originPlace]);

  // Called by HomeScreen after a trip completes to restart the simulation cleanly
  const resetDrivers = useCallback((lat, lng) => {
    const fresh = buildDrivers(lat, lng);
    const freshPos = {};
    fresh.forEach(d => {
      freshPos[d._id] = { lat: d.currentLocation.lat, lng: d.currentLocation.lng };
    });
    driversSeeded.current = true;
    setNearbyDrivers(fresh);
    setDriverPositions(freshPos);
    setSelectedDriverId(null);
    setCarouselIndex(0);
  }, []);

  return {
    nearbyDrivers,
    driverPositions,
    selectedDriverId, setSelectedDriverId,
    carouselIndex,    setCarouselIndex,
    carouselRef,
    nearestDriver,    nearestDistKm,
    featuredDriver,   featuredDriverDist,
    userLocRef,
    resetDrivers,
  };
}
