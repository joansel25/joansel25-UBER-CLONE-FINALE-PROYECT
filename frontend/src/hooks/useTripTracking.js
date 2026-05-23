import { useState, useEffect, useCallback, useRef } from 'react';
import database from '@react-native-firebase/database';
import tripApi from '../api/tripApi';

const POLL_MS = 5000;

/**
 * Polls the trip status every 5 s and listens to the driver's
 * real-time location via Firebase Realtime Database.
 *
 * driverLocation shape: { latitude, longitude }
 * Firebase path: /drivers/{driverId}/location  → { lat, lng, timestamp }
 */
export default function useTripTracking(tripId) {
  const [trip,           setTrip]           = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const intervalRef    = useRef(null);
  const fbRefRef       = useRef(null);
  const fbCbRef        = useRef(null);
  const trackedDriverId = useRef(null);

  const stopLocationListener = useCallback(() => {
    if (fbRefRef.current && fbCbRef.current) {
      fbRefRef.current.off('value', fbCbRef.current);
    }
    fbRefRef.current      = null;
    fbCbRef.current       = null;
    trackedDriverId.current = null;
  }, []);

  const startLocationListener = useCallback((driverId) => {
    if (trackedDriverId.current === driverId) return; // already listening
    stopLocationListener();

    const ref = database().ref(`/drivers/${driverId}/location`);
    const cb  = snap => {
      const val = snap.val();
      if (val?.lat != null) {
        setDriverLocation({ latitude: val.lat, longitude: val.lng });
      }
    };

    ref.on('value', cb);
    fbRefRef.current        = ref;
    fbCbRef.current         = cb;
    trackedDriverId.current = driverId;
  }, [stopLocationListener]);

  const fetchTrip = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await tripApi.getById(tripId);
      const t   = res.data;
      setTrip(t);
      setError(null);

      if (t.driver?._id) {
        startLocationListener(t.driver._id);
      }

      // Stop polling once the trip reaches a terminal state
      if (['completed', 'cancelled'].includes(t.status)) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      return t;
    } catch (err) {
      setError(err.message ?? 'Error al cargar el viaje');
    } finally {
      setLoading(false);
    }
  }, [tripId, startLocationListener]);

  useEffect(() => {
    fetchTrip();
    intervalRef.current = setInterval(fetchTrip, POLL_MS);

    return () => {
      clearInterval(intervalRef.current);
      stopLocationListener();
    };
  }, [fetchTrip, stopLocationListener]);

  return { trip, driverLocation, loading, error, refetch: fetchTrip };
}
