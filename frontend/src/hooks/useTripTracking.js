import { useState, useEffect, useCallback, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import database  from '@react-native-firebase/database';

function docToTrip(doc) {
  if (!doc.exists) return null;
  const d = doc.data();
  const ts = (t) => (t?.toDate ? t.toDate().toISOString() : t);
  return {
    _id:         doc.id,
    id:          doc.id,
    ...d,
    createdAt:   ts(d.createdAt),
    acceptedAt:  ts(d.acceptedAt),
    startedAt:   ts(d.startedAt),
    completedAt: ts(d.completedAt),
  };
}

/**
 * Escucha el viaje en tiempo real mediante Firestore onSnapshot.
 * Escucha la ubicación del conductor en Realtime Database.
 */
export default function useTripTracking(tripId) {
  const [trip,           setTrip]           = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const fbRefRef        = useRef(null);
  const fbCbRef         = useRef(null);
  const trackedDriverId = useRef(null);

  const stopLocationListener = useCallback(() => {
    if (fbRefRef.current && fbCbRef.current) {
      fbRefRef.current.off('value', fbCbRef.current);
    }
    fbRefRef.current        = null;
    fbCbRef.current         = null;
    trackedDriverId.current = null;
  }, []);

  const startLocationListener = useCallback((driverId) => {
    if (trackedDriverId.current === driverId) return;
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

  useEffect(() => {
    if (!tripId) return;

    const unsubscribe = firestore()
      .collection('trips')
      .doc(tripId)
      .onSnapshot(
        (doc) => {
          if (!doc.exists) {
            setError('Viaje no encontrado');
            setLoading(false);
            return;
          }

          const t = docToTrip(doc);
          setTrip(t);
          setError(null);
          setLoading(false);

          // driverId es el Firebase UID del conductor → ruta en Realtime DB
          const driverId = t.driverId ?? t.driver?._id;
          if (driverId) {
            startLocationListener(driverId);
          }
        },
        (err) => {
          setError(err.message ?? 'Error al cargar el viaje');
          setLoading(false);
        },
      );

    return () => {
      unsubscribe();
      stopLocationListener();
    };
  }, [tripId, startLocationListener, stopLocationListener]);

  return { trip, driverLocation, loading, error };
}
